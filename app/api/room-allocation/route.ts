import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getDbPool } from "@/lib/db";
import { requireRoles } from "@/lib/permissions";
import { roomAllocationSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, ["ESTATE_PRIMARY", "ESTATE_SECONDARY"]);
  if (!auth.authorized) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const parsed = roomAllocationSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
    }

    const pool = await getDbPool();
    const tx = pool.transaction();
    await tx.begin();
    try {
      const allocation = await tx
        .request()
        .input("booking_id", sql.Int, parsed.data.booking_id)
        .input("room_number", sql.VarChar(20), parsed.data.room_number)
        .input("allocation_status", sql.VarChar(20), parsed.data.allocation_status).query(`
          INSERT INTO RoomAllocation (booking_id, room_number, allocation_status)
          OUTPUT INSERTED.*
          VALUES (@booking_id, @room_number, @allocation_status);
        `);

      const estateStatus = parsed.data.allocation_status === "ALLOCATED" ? "ROOM_ALLOCATED" : "PENDING_ESTATE_REVIEW";
      await tx
        .request()
        .input("booking_id", sql.Int, parsed.data.booking_id)
        .input("estate_status", sql.VarChar(40), estateStatus)
        .query("UPDATE Bookings SET estate_status = @estate_status WHERE id = @booking_id");

      await tx.commit();
      return NextResponse.json({ message: "Room allocation updated", allocation: allocation.recordset[0] });
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to allocate room", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
