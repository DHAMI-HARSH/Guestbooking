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
      SELECT id
      FROM users
      WHERE UPPER(LTRIM(RTRIM(ecode))) = @ecode
      LIMIT 1
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
      .query("SELECT id, approval_status FROM bookings WHERE id = @booking_id LIMIT 1");

    const booking = bookingCheck.recordset[0];
    if (!booking) {
      return NextResponse.json({ message: "Booking not found" }, { status: 404 });
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
          "INSERT INTO approvals (booking_id, approver_id, decision, remarks) VALUES (@booking_id, @approver_id, @decision, @remarks)",
        );

      await tx
        .request()
        .input("booking_id", parsed.data.booking_id)
        .input("status", statusValue)
        .query("UPDATE bookings SET approval_status = @status WHERE id = @booking_id");

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
    const includeDetails = url.searchParams.get("details") === "1";

    if (includeDetails) {
      const result = await pool
        .request()
        .input("approver_id", approverId)
        .input("limit", limit)
        .query(`
          SELECT
            a.id AS approval_id,
            a.booking_id,
            a.decision,
            a.remarks,
            a.date AS decided_at,
            b.*
          FROM approvals a
          INNER JOIN bookings b ON b.id = a.booking_id
          WHERE a.approver_id = @approver_id
          ORDER BY a.date DESC
          LIMIT @limit
        `);

      return NextResponse.json({ approvals: result.recordset });
    }

    const result = await pool
      .request()
      .input("approver_id", approverId)
      .input("limit", limit)
      .query(`
        SELECT
          a.id,
          a.booking_id,
          a.decision,
          a.remarks,
          a.date AS decided_at,
          b.guest_name,
          b.arrival_date
        FROM approvals a
        INNER JOIN bookings b ON b.id = a.booking_id
        WHERE a.approver_id = @approver_id
        ORDER BY a.date DESC
        LIMIT @limit
      `);

    return NextResponse.json({ approvals: result.recordset });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch approvals", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
