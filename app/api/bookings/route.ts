import { NextRequest, NextResponse } from "next/server";
import { getDbPool, sql } from "@/lib/db";
import { calculateTotals, bookingSchema } from "@/lib/validation";
import { requireRoles } from "@/lib/permissions";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

const bookingRoles: Role[] = ["EMPLOYEE", "APPROVER", "ESTATE_PRIMARY", "ESTATE_SECONDARY"];

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, bookingRoles);
  if (!auth.authorized || !auth.session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const parsed = bookingSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });
    }

    const totals = calculateTotals(parsed.data);
    const pool = await getDbPool();

    const result = await pool
      .request()
      .input("guest_name", sql.NVarChar(120), parsed.data.guest_name)
      .input("guest_phone", sql.VarChar(30), parsed.data.guest_phone)
      .input("guest_address", sql.NVarChar(255), parsed.data.guest_address)
      .input("purpose", sql.VarChar(20), parsed.data.purpose)
      .input("justification", sql.NVarChar(sql.MAX), parsed.data.justification)
      .input("arrival_date", sql.Date, parsed.data.arrival_date)
      .input("arrival_time", sql.VarChar(8), parsed.data.arrival_time)
      .input("departure_date", sql.Date, parsed.data.departure_date)
      .input("departure_time", sql.VarChar(8), parsed.data.departure_time)
      .input("stay_days", sql.Int, parsed.data.stay_days)
      .input("male_count", sql.Int, parsed.data.male_count)
      .input("female_count", sql.Int, parsed.data.female_count)
      .input("children_count", sql.Int, parsed.data.children_count)
      .input("total_guests", sql.Int, totals.totalGuests)
      .input("services_required", sql.NVarChar(sql.MAX), JSON.stringify(parsed.data.services_required))
      .input("rooms_required", sql.Int, totals.roomsRequired)
      .input("booking_cost_center", sql.VarChar(50), parsed.data.booking_cost_center)
      .input("created_by", sql.Int, auth.session.id).query(`
        INSERT INTO Bookings (
          guest_name, guest_phone, guest_address, purpose, justification, arrival_date, arrival_time,
          departure_date, departure_time, stay_days, male_count, female_count, children_count, total_guests,
          services_required, rooms_required, booking_cost_center, created_by, approval_status, estate_status
        )
        OUTPUT INSERTED.*
        VALUES (
          @guest_name, @guest_phone, @guest_address, @purpose, @justification, @arrival_date, @arrival_time,
          @departure_date, @departure_time, @stay_days, @male_count, @female_count, @children_count, @total_guests,
          @services_required, @rooms_required, @booking_cost_center, @created_by, 'PENDING_APPROVAL', 'PENDING_ESTATE_REVIEW'
        );
      `);

    return NextResponse.json({ message: "Booking created", booking: result.recordset[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to create booking", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, bookingRoles);
  if (!auth.authorized || !auth.session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const arrivalDate = searchParams.get("arrival_date");
  const guestName = searchParams.get("guest_name");
  const guestPhone = searchParams.get("guest_phone");
  const approvalStatus = searchParams.get("approval_status");
  const estateStatus = searchParams.get("estate_status");

  try {
    const pool = await getDbPool();
    const req = pool.request();
    const conditions: string[] = [];

    if (auth.session.role === "EMPLOYEE") {
      req.input("created_by", sql.Int, auth.session.id);
      conditions.push("b.created_by = @created_by");
    }

    if (auth.session.role === "APPROVER") {
      conditions.push("b.purpose = 'Official'");
      conditions.push("b.approval_status = 'PENDING_APPROVAL'");
    }

    if (arrivalDate) {
      req.input("arrival_date", sql.Date, arrivalDate);
      conditions.push("b.arrival_date = @arrival_date");
    }

    if (guestName) {
      req.input("guest_name", sql.NVarChar(120), `%${guestName}%`);
      conditions.push("b.guest_name LIKE @guest_name");
    }

    if (guestPhone) {
      req.input("guest_phone", sql.VarChar(30), `%${guestPhone}%`);
      conditions.push("b.guest_phone LIKE @guest_phone");
    }

    if (approvalStatus) {
      req.input("approval_status", sql.VarChar(30), approvalStatus);
      conditions.push("b.approval_status = @approval_status");
    }

    if (estateStatus) {
      req.input("estate_status", sql.VarChar(40), estateStatus);
      conditions.push("b.estate_status = @estate_status");
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await req.query(`
      SELECT
        b.*,
        u.name AS booking_owner_name,
        u.department AS booking_owner_department,
        u.ecode AS booking_owner_ecode
      FROM Bookings b
      INNER JOIN Users u ON u.id = b.created_by
      ${whereClause}
      ORDER BY b.created_at DESC;
    `);

    return NextResponse.json({ bookings: result.recordset });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch bookings", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
