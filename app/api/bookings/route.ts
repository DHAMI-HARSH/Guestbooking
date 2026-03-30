import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { calculateTotals, bookingSchema } from "@/lib/validation";
import { requireRoles } from "@/lib/permissions";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

const bookingRoles: Role[] = [
  "EMPLOYEE",
  "APPROVER",
  "ESTATE_PRIMARY",
  "ESTATE_SECONDARY",
];

async function resolveSessionUserId(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  ecode: string
): Promise<number | null> {
  const result = await pool
    .request()
    .input("ecode", ecode.trim().toUpperCase())
    .query(`
      SELECT TOP 1 id
      FROM Users
      WHERE UPPER(LTRIM(RTRIM(ecode))) = @ecode
    `);

  const row = result.recordset[0] as { id: number } | undefined;
  return row?.id ?? null;
}

/* ---------------- CREATE BOOKING ---------------- */

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, bookingRoles);

  if (!auth.authorized || !auth.session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();

    const parsed = bookingSchema.safeParse(payload);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError =
        Object.values(fieldErrors).flat().find((msg) => typeof msg === "string") ||
        "Invalid data";

      return NextResponse.json(
        { message: firstError, errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const totals = calculateTotals(parsed.data);

    const pool = await getDbPool();
    const createdById = await resolveSessionUserId(pool, auth.session.ecode);

    if (!createdById) {
      return NextResponse.json(
        { message: "Session user no longer exists. Please login again." },
        { status: 401 }
      );
    }

    const req = pool.request();

    req.input("guest_name", parsed.data.guest_name);
    req.input("guest_phone", parsed.data.guest_phone);
    req.input("guest_address", parsed.data.guest_address);
    req.input(
      "room_configuration",
      parsed.data.room_configuration || null
    );
    req.input("meal_plan", parsed.data.meal_plan);
    req.input("extra_bed", parsed.data.extra_bed ? 1 : 0);
    req.input(
      "guests",
      parsed.data.guests?.length ? JSON.stringify(parsed.data.guests) : null
    );
    req.input(
      "estimated_cost",
      parsed.data.estimated_cost ?? null
    );
    req.input("purpose", parsed.data.purpose);
    req.input("justification", parsed.data.justification);
    req.input("arrival_date", parsed.data.arrival_date);
    req.input("arrival_time", parsed.data.arrival_time);
    req.input("departure_date", parsed.data.departure_date);
    req.input("departure_time", parsed.data.departure_time);
    req.input("stay_days", parsed.data.stay_days);

    req.input("male_count", parsed.data.male_count);
    req.input("female_count", parsed.data.female_count);
    req.input("children_count", parsed.data.children_count);

    req.input("total_guests", totals.totalGuests);

    req.input(
      "services_required",
      JSON.stringify(parsed.data.services_required)
    );

    req.input("rooms_required", totals.roomsRequired);

    req.input(
      "booking_cost_center",
      parsed.data.booking_cost_center
    );

    req.input("created_by", createdById);

    const result = await req.query(`
      INSERT INTO Bookings (
        guest_name,
        guest_phone,
        guest_address,
        room_configuration,
        meal_plan,
        extra_bed,
        guests,
        estimated_cost,
        purpose,
        justification,
        arrival_date,
        arrival_time,
        departure_date,
        departure_time,
        stay_days,
        male_count,
        female_count,
        children_count,
        total_guests,
        services_required,
        rooms_required,
        booking_cost_center,
        created_by,
        approval_status,
        estate_status
      )
      OUTPUT INSERTED.*
      VALUES (
        @guest_name,
        @guest_phone,
        @guest_address,
        @room_configuration,
        @meal_plan,
        @extra_bed,
        @guests,
        @estimated_cost,
        @purpose,
        @justification,
        @arrival_date,
        @arrival_time,
        @departure_date,
        @departure_time,
        @stay_days,
        @male_count,
        @female_count,
        @children_count,
        @total_guests,
        @services_required,
        @rooms_required,
        @booking_cost_center,
        @created_by,
        'PENDING_APPROVAL',
        'PENDING_ESTATE_REVIEW'
      )
    `);

    return NextResponse.json(
      {
        message: "Booking created",
        booking: result.recordset[0],
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to create booking",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/* ---------------- FETCH BOOKINGS ---------------- */

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
    const currentUserId = await resolveSessionUserId(pool, auth.session.ecode);

    if (!currentUserId) {
      return NextResponse.json(
        { message: "Session user no longer exists. Please login again." },
        { status: 401 }
      );
    }

    const req = pool.request();

    const conditions: string[] = [];

    /* Employee sees only own bookings */

    if (auth.session.role === "EMPLOYEE") {
      req.input("created_by", currentUserId);
      conditions.push("b.created_by = @created_by");
    }

    /* Approver rules */

    if (auth.session.role === "APPROVER") {
      conditions.push("b.purpose = 'Official'");
      conditions.push("b.approval_status = 'PENDING_APPROVAL'");
    }

    /* Filters */

    if (arrivalDate) {
      req.input("arrival_date", arrivalDate);
      conditions.push("b.arrival_date = @arrival_date");
    }

    if (guestName) {
      req.input("guest_name", `%${guestName}%`);
      conditions.push("b.guest_name LIKE @guest_name");
    }

    if (guestPhone) {
      req.input("guest_phone", `%${guestPhone}%`);
      conditions.push("b.guest_phone LIKE @guest_phone");
    }

    if (approvalStatus) {
      req.input("approval_status", approvalStatus);
      conditions.push("b.approval_status = @approval_status");
    }

    if (estateStatus) {
      req.input("estate_status", estateStatus);
      conditions.push("b.estate_status = @estate_status");
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await req.query(`
      SELECT
        b.*,
        u.name AS booking_owner_name,
        u.department AS booking_owner_department,
        u.ecode AS booking_owner_ecode
      FROM Bookings b
      INNER JOIN Users u ON u.id = b.created_by
      ${whereClause}
      ORDER BY b.created_at DESC
    `);

    return NextResponse.json({
      bookings: result.recordset,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to fetch bookings",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
