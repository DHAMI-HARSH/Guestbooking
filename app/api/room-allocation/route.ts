import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { requireRoles } from "@/lib/permissions";
import { roomAllocationSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, ["ESTATE_PRIMARY"]);
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
      const bookingResult = await tx
        .request()
        .input("booking_id", parsed.data.booking_id)
        .query(
          "SELECT TOP 1 rooms_required FROM Bookings WITH (UPDLOCK, ROWLOCK) WHERE id = @booking_id"
        );
      const booking = bookingResult.recordset[0] as { rooms_required: number } | undefined;
      if (!booking) {
        await tx.rollback();
        return NextResponse.json({ message: "Booking not found" }, { status: 404 });
      }

      const allocatedCountResult = await tx
        .request()
        .input("booking_id", parsed.data.booking_id)
        .query(
          "SELECT COUNT(*) AS count FROM RoomAllocation WITH (UPDLOCK, ROWLOCK) WHERE booking_id = @booking_id AND allocation_status = 'ALLOCATED'"
        );
      const allocatedCount = Number(allocatedCountResult.recordset[0]?.count ?? 0);
      if (allocatedCount >= booking.rooms_required) {
        await tx.rollback();
        return NextResponse.json(
          { message: "All required rooms are already allocated for this booking." },
          { status: 409 },
        );
      }

      const existingRoomResult = await tx
        .request()
        .input("booking_id", parsed.data.booking_id)
        .input("room_number", parsed.data.room_number)
        .query(
          "SELECT COUNT(*) AS count FROM RoomAllocation WHERE booking_id = @booking_id AND room_number = @room_number AND allocation_status = 'ALLOCATED'"
        );
      const existingRoomCount = Number(existingRoomResult.recordset[0]?.count ?? 0);
      if (existingRoomCount > 0) {
        await tx.rollback();
        return NextResponse.json(
          { message: "This room is already allocated for the booking." },
          { status: 409 },
        );
      }

      const allocation = await tx
        .request()
        .input("booking_id", parsed.data.booking_id)
        .input("room_number", parsed.data.room_number)
        .input("allocation_status", parsed.data.allocation_status).query(`
          INSERT INTO RoomAllocation (booking_id, room_number, allocation_status)
          OUTPUT INSERTED.*
          VALUES (@booking_id, @room_number, @allocation_status);
        `);

      const estateStatus = parsed.data.allocation_status === "ALLOCATED" ? "ROOM_ALLOCATED" : "PENDING_ESTATE_REVIEW";
      await tx
        .request()
        .input("booking_id", parsed.data.booking_id)
        .input("estate_status", estateStatus)
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
