import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { requireRoles } from "@/lib/permissions";

export const runtime = "nodejs";

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

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, ["ESTATE_PRIMARY", "APPROVER", "EMPLOYEE"]);
  if (!auth.authorized || !auth.session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const bookingId = searchParams.get("booking_id");

  if (!bookingId && (!from || !to)) {
    return NextResponse.json(
      { message: "from and to dates are required" },
      { status: 400 }
    );
  }

  try {
    const pool = await getDbPool();
    const req = pool.request();

    if (bookingId) {
      const bookingIdNum = Number(bookingId);
      if (!Number.isFinite(bookingIdNum)) {
        return NextResponse.json({ message: "Invalid booking id" }, { status: 400 });
      }
      req.input("booking_id", bookingIdNum);

      if (auth.session.role === "EMPLOYEE") {
        const currentUserId = await resolveSessionUserId(pool, auth.session.ecode);
        if (!currentUserId) {
          return NextResponse.json(
            { message: "Session user no longer exists. Please login again." },
            { status: 401 }
          );
        }
        req.input("created_by", currentUserId);
      }

      const result = await req.query(`
        SELECT
          ra.*,
          b.arrival_date,
          b.departure_date,
          b.guest_name,
          b.estate_status,
          b.approval_status
        FROM RoomAllocation ra
        INNER JOIN Bookings b ON b.id = ra.booking_id
        WHERE ra.allocation_status = 'ALLOCATED'
          AND b.id = @booking_id
          ${auth.session.role === "EMPLOYEE" ? "AND b.created_by = @created_by" : ""}
        ORDER BY ra.room_number ASC
      `);

      return NextResponse.json({ allocations: result.recordset });
    }

    const result = await pool
      .request()
      .input("from", from)
      .input("to", to)
      .query(`
        SELECT
          ra.*,
          b.arrival_date,
          b.departure_date,
          b.guest_name,
          b.estate_status,
          b.approval_status
        FROM RoomAllocation ra
        INNER JOIN Bookings b ON b.id = ra.booking_id
        WHERE ra.allocation_status = 'ALLOCATED'
          AND b.arrival_date <= @to
          AND b.departure_date >= @from
        ORDER BY ra.room_number ASC
      `);

    return NextResponse.json({ allocations: result.recordset });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch room allocations", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
