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
];

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDaysUTC(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function diffDaysUTC(start: Date, end: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay));
}

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
    .input("ecode", ecode.trim().toUpperCase())
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
      .input("booking_id", bookingId)
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
      .input("booking_id", bookingId)
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

    if (
      parsed.data.approval_status &&
      effectiveSession.role !== "APPROVER" &&
      effectiveSession.role !== "ADMIN"
    ) {
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
      effectiveSession.role !== "ESTATE_PRIMARY" &&
      effectiveSession.role !== "ADMIN"
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

    /* ---- keep stay_days and departure_date in sync ---- */

    const arrivalDate = String(
      parsed.data.arrival_date ?? current.arrival_date
    ).slice(0, 10);

    const derivedUpdates: Record<string, string | number> = {};

    if (parsed.data.stay_days !== undefined && parsed.data.departure_date === undefined) {
      const safeDays = Math.max(1, Number(parsed.data.stay_days) || 1);
      const departure = formatDate(addDaysUTC(parseDate(arrivalDate), safeDays));
      derivedUpdates.departure_date = departure;
    }

    if (parsed.data.departure_date !== undefined && parsed.data.stay_days === undefined) {
      const stayDays = diffDaysUTC(
        parseDate(arrivalDate),
        parseDate(String(parsed.data.departure_date).slice(0, 10))
      );
      derivedUpdates.stay_days = stayDays;
    }

    /* ---- build dynamic update ---- */

    const req = pool.request().input("id", bookingId);

    const updates: string[] = [];

    const fields: Array<keyof typeof parsed.data> = [
      "guest_name",
      "guest_email",
      "guest_phone",
      "guest_address",
      "room_configuration",
      "meal_plan",
      "extra_bed",
      "purpose",
      "justification",
      "arrival_date",
      "arrival_time",
      "departure_date",
      "departure_time",
      "stay_days",
      "male_count",
      "female_count",
      "children_count",
      "booking_cost_center",
      "special_requests",
      "approval_status",
      "estate_status",
      "cancellation_remarks",
      "estimated_cost",
    ];

    for (const field of fields) {
      const value =
        field in derivedUpdates
          ? (derivedUpdates[field] as typeof parsed.data[typeof field])
          : parsed.data[field];

      if (value !== undefined) {
        req.input(field, value as string | number | boolean | null);
        updates.push(`${field} = @${field}`);
      }
    }

    /* ---- services JSON ---- */

    if (parsed.data.services_required) {
      req.input("services_required", JSON.stringify(parsed.data.services_required));

      updates.push("services_required = @services_required");
    }

    if (parsed.data.guests) {
      req.input("guests", JSON.stringify(parsed.data.guests));
      updates.push("guests = @guests");
    }

    /* ---- totals ---- */

    req.input("total_guests", totals.totalGuests);
    req.input("rooms_required", totals.roomsRequired);

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

    const nextBooking = updated.recordset[0];
    const shouldReleaseRooms =
      parsed.data.approval_status === "CANCELLED" ||
      parsed.data.estate_status === "ESTATE_REJECTED";

    if (shouldReleaseRooms) {
      await pool
        .request()
        .input("booking_id", bookingId)
        .query(`
          UPDATE RoomAllocation
          SET allocation_status = 'RELEASED'
          WHERE booking_id = @booking_id
            AND allocation_status = 'ALLOCATED'
        `);
    }

    return NextResponse.json({
      message: "Booking updated",
      booking: nextBooking,
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
