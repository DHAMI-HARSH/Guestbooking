import { sql, getDbPool } from "@/lib/db";

export type ReportType = "monthly" | "guest-history" | "room-usage";

export async function fetchReportData(type: ReportType, month?: string) {
  const pool = await getDbPool();
  const req = pool.request();

  if (month) {
    req.input("month", sql.VarChar(7), month);
  }

  if (type === "monthly") {
    const result = await req.query(`
      SELECT
        FORMAT(arrival_date, 'yyyy-MM') AS month,
        COUNT(*) AS total_bookings,
        SUM(total_guests) AS total_guests,
        SUM(rooms_required) AS total_rooms_requested
      FROM Bookings
      ${month ? "WHERE FORMAT(arrival_date, 'yyyy-MM') = @month" : ""}
      GROUP BY FORMAT(arrival_date, 'yyyy-MM')
      ORDER BY month DESC;
    `);
    return result.recordset;
  }

  if (type === "guest-history") {
    const result = await req.query(`
      SELECT
        guest_name,
        guest_phone,
        COUNT(*) AS visits,
        MIN(arrival_date) AS first_visit,
        MAX(arrival_date) AS latest_visit
      FROM Bookings
      GROUP BY guest_name, guest_phone
      ORDER BY latest_visit DESC;
    `);
    return result.recordset;
  }

  const result = await req.query(`
    SELECT
      ra.room_number,
      COUNT(*) AS usage_count,
      MIN(b.arrival_date) AS first_used,
      MAX(b.arrival_date) AS last_used
    FROM RoomAllocation ra
    INNER JOIN Bookings b ON b.id = ra.booking_id
    GROUP BY ra.room_number
    ORDER BY usage_count DESC, ra.room_number;
  `);
  return result.recordset;
}
