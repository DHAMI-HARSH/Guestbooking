import { NextRequest, NextResponse } from "next/server";
import { getDbPool, sql } from "@/lib/db";
import { approvalSchema } from "@/lib/validation";
import { requireRoles } from "@/lib/permissions";

export const runtime = "nodejs";

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
    const bookingCheck = await pool
      .request()
      .input("booking_id", sql.Int, parsed.data.booking_id)
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
        .input("booking_id", sql.Int, parsed.data.booking_id)
        .input("approver_id", sql.Int, auth.session.id)
        .input("decision", sql.VarChar(20), parsed.data.decision)
        .input("remarks", sql.NVarChar(sql.MAX), parsed.data.remarks || null)
        .query(
          "INSERT INTO Approvals (booking_id, approver_id, decision, remarks) VALUES (@booking_id, @approver_id, @decision, @remarks)",
        );

      await tx
        .request()
        .input("booking_id", sql.Int, parsed.data.booking_id)
        .input("status", sql.VarChar(30), statusValue)
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
