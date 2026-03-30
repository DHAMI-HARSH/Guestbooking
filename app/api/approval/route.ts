import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { approvalSchema } from "@/lib/validation";
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

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, ["APPROVER"]);
  if (!auth.authorized || !auth.session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const parsed = approvalSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });
    }

    const pool = await getDbPool();
    const approverId = await resolveSessionUserId(pool, auth.session.ecode);
    if (!approverId) {
      return NextResponse.json({ message: "Session user no longer exists. Please login again." }, { status: 401 });
    }

    const bookingCheck = await pool
      .request()
      .input("booking_id", parsed.data.booking_id)
      .query("SELECT TOP 1 id, approval_status, purpose FROM Bookings WHERE id = @booking_id");

    const booking = bookingCheck.recordset[0];
    if (!booking) {
      return NextResponse.json({ message: "Booking not found" }, { status: 404 });
    }

    if (booking.purpose !== "Official") {
      return NextResponse.json({ message: "Only official bookings need approval workflow" }, { status: 400 });
    }

    const statusValue = parsed.data.decision === "Approved" ? "APPROVED" : "REJECTED";
    const tx = pool.transaction();
    await tx.begin();
    try {
      await tx
        .request()
        .input("booking_id", parsed.data.booking_id)
        .input("approver_id", approverId)
        .input("decision", parsed.data.decision)
        .input("remarks", parsed.data.remarks || null)
        .query(
          "INSERT INTO Approvals (booking_id, approver_id, decision, remarks) VALUES (@booking_id, @approver_id, @decision, @remarks)",
        );

      await tx
        .request()
        .input("booking_id", parsed.data.booking_id)
        .input("status", statusValue)
        .query("UPDATE Bookings SET approval_status = @status WHERE id = @booking_id");

      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }

    return NextResponse.json({ message: `Booking ${statusValue.toLowerCase()}` });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to submit approval", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, ["APPROVER"]);
  if (!auth.authorized || !auth.session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const pool = await getDbPool();
    const approverId = await resolveSessionUserId(pool, auth.session.ecode);
    if (!approverId) {
      return NextResponse.json({ message: "Session user no longer exists. Please login again." }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(25, Number(url.searchParams.get("limit")) || 8));

    const result = await pool
      .request()
      .input("approver_id", approverId)
      .input("limit", limit)
      .query(`
        SELECT TOP (@limit)
          a.id,
          a.booking_id,
          a.decision,
          a.remarks,
          a.[date] AS decided_at,
          b.guest_name,
          b.arrival_date
        FROM Approvals a
        INNER JOIN Bookings b ON b.id = a.booking_id
        WHERE a.approver_id = @approver_id
        ORDER BY a.[date] DESC
      `);

    return NextResponse.json({ approvals: result.recordset });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch approvals", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
