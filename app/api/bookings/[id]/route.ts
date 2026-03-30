import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getDbPool } from "@/lib/db";
import { bookingUpdateSchema, calculateTotals } from "@/lib/validation";
import { canManageBooking, requireRoles } from "@/lib/permissions";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

const bookingRoles: Role[] = [
  "EMPLOYEE",
  "APPROVER",
  "ESTATE_PRIMARY",
  "ESTATE_SECONDARY",
];

function parseId(id: string) {
  const value = Number(id);
  return Number.isInteger(value) && value > 0 ? value : null;
}

async function resolveSessionUserId(
  pool: sql.ConnectionPool,
  ecode: string
): Promise<number | null> {
  const result = await pool
    .request()
    .input("ecode", sql.VarChar(20), ecode.trim().toUpperCase())
    .query(`
      SELECT TOP 1 id
      FROM Users
      WHERE UPPER(LTRIM(RTRIM(ecode))) = @ecode
    `);

  const row = result.recordset[0] as { id: number } | undefined;
  return row?.id ?? null;
}

/* ---------------- GET BOOKING ---------------- */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRoles(request, bookingRoles);

  if (!auth.authorized || !auth.session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const bookingId = parseId(params.id);

  if (!bookingId) {
    return NextResponse.json({ message: "Invalid booking id" }, { status: 400 });
  }

  try {
    const pool = await getDbPool();
    const currentUserId = await resolveSessionUserId(pool, auth.session.ecode);

    if (!currentUserId) {
      return NextResponse.json(
        { message: "Session user no longer exists. Please login again." },
        { status: 401 }
      );
    }

    const effectiveSession = { ...auth.session, id: currentUserId };

    const result = await pool
      .request()
      .input("booking_id", sql.Int, bookingId)
      .query(`
        SELECT TOP 1 
          b.*, 
          u.name AS booking_owner_name, 
          u.department AS booking_owner_department
        FROM Bookings b
        INNER JOIN Users u ON u.id = b.created_by
        WHERE b.id = @booking_id
      `);

    const booking = result.recordset[0];

    if (!booking) {
      return NextResponse.json({ message: "Booking not found" }, { status: 404 });
    }

    if (
      !canManageBooking(effectiveSession, booking.created_by) &&
      effectiveSession.role !== "APPROVER"
    ) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ booking });

  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to fetch booking",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/* ---------------- UPDATE BOOKING ---------------- */

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRoles(request, bookingRoles);

  if (!auth.authorized || !auth.session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const bookingId = parseId(params.id);

  if (!bookingId) {
    return NextResponse.json({ message: "Invalid booking id" }, { status: 400 });
  }

  try {
    const payload = await request.json();

    const parsed = bookingUpdateSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid data", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const pool = await getDbPool();
    const currentUserId = await resolveSessionUserId(pool, auth.session.ecode);

    if (!currentUserId) {
      return NextResponse.json(
        { message: "Session user no longer exists. Please login again." },
        { status: 401 }
      );
    }

    const effectiveSession = { ...auth.session, id: currentUserId };

    const bookingResult = await pool
      .request()
      .input("booking_id", sql.Int, bookingId)
      .query(`SELECT TOP 1 * FROM Bookings WHERE id = @booking_id`);

    const current = bookingResult.recordset[0];

    if (!current) {
      return NextResponse.json({ message: "Booking not found" }, { status: 404 });
    }

    if (
      !canManageBooking(effectiveSession, current.created_by) &&
      effectiveSession.role !== "APPROVER"
    ) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    /* ---- role restrictions ---- */

    if (parsed.data.approval_status && effectiveSession.role !== "APPROVER") {
      const isCancellation =
        parsed.data.approval_status === "CANCELLED" &&
        canManageBooking(effectiveSession, current.created_by);

      if (!isCancellation) {
        return NextResponse.json(
          { message: "Only approver can update approval status" },
          { status: 403 }
        );
      }
    }

    if (
      parsed.data.estate_status &&
      !["ESTATE_PRIMARY", "ESTATE_SECONDARY"].includes(effectiveSession.role)
    ) {
      return NextResponse.json(
        { message: "Only estate manager can update estate status" },
        { status: 403 }
      );
    }

    /* ---- totals calculation ---- */

    const maleCount = parsed.data.male_count ?? current.male_count;
    const femaleCount = parsed.data.female_count ?? current.female_count;
    const childrenCount = parsed.data.children_count ?? current.children_count;

    const services =
      parsed.data.services_required ??
      JSON.parse(current.services_required ?? "[]");

    const totals = calculateTotals({
      male_count: maleCount,
      female_count: femaleCount,
      children_count: childrenCount,
      services_required: services,
      room_configuration:
        parsed.data.room_configuration ??
        (current.room_configuration as
          | "Double Bed"
          | "Triple Bed"
          | "Twin Sharing"
          | ""
          | null) ??
        "",
    });

    /* ---- build dynamic update ---- */

    const req = pool.request().input("id", sql.Int, bookingId);

    const updates: string[] = [];

    type SqlInputType = Parameters<sql.Request["input"]>[1];
    const fields: Array<[keyof typeof parsed.data, SqlInputType]> = [
      ["guest_name", sql.NVarChar(120)],
      ["guest_phone", sql.VarChar(30)],
      ["guest_address", sql.NVarChar(255)],
      ["room_configuration", sql.NVarChar(50)],
      ["meal_plan", sql.VarChar(20)],
      ["extra_bed", sql.Bit],
      ["purpose", sql.VarChar(20)],
      ["justification", sql.NVarChar(sql.MAX)],
      ["arrival_date", sql.Date],
      ["arrival_time", sql.VarChar(8)],
      ["departure_date", sql.Date],
      ["departure_time", sql.VarChar(8)],
      ["stay_days", sql.Int],
      ["male_count", sql.Int],
      ["female_count", sql.Int],
      ["children_count", sql.Int],
      ["booking_cost_center", sql.VarChar(50)],
      ["approval_status", sql.VarChar(30)],
      ["estate_status", sql.VarChar(40)],
      ["cancellation_remarks", sql.NVarChar(sql.MAX)],
      ["estimated_cost", sql.Decimal(10, 2)],
    ];

    for (const [field, type] of fields) {
      const value = parsed.data[field];

      if (value !== undefined) {
        req.input(field, type, value);
        updates.push(`${field} = @${field}`);
      }
    }

    /* ---- services JSON ---- */

    if (parsed.data.services_required) {
      req.input(
        "services_required",
        sql.NVarChar(sql.MAX),
        JSON.stringify(parsed.data.services_required)
      );

      updates.push("services_required = @services_required");
    }

    if (parsed.data.guests) {
      req.input("guests", sql.NVarChar(sql.MAX), JSON.stringify(parsed.data.guests));
      updates.push("guests = @guests");
    }

    /* ---- totals ---- */

    req.input("total_guests", sql.Int, totals.totalGuests);
    req.input("rooms_required", sql.Int, totals.roomsRequired);

    updates.push(
      "total_guests = @total_guests",
      "rooms_required = @rooms_required"
    );

    if (!updates.length) {
      return NextResponse.json(
        { message: "No updates provided" },
        { status: 400 }
      );
    }

    const updated = await req.query(`
      UPDATE Bookings
      SET ${updates.join(", ")}
      OUTPUT INSERTED.*
      WHERE id = @id
    `);

    return NextResponse.json({
      message: "Booking updated",
      booking: updated.recordset[0],
    });

  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to update booking",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
