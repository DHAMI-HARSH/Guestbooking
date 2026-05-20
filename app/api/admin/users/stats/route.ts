import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { requireRoles } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, ["ADMIN"]);
  if (!auth.authorized || !auth.session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const pool = await getDbPool();
    const result = await pool.request().query(`
      SELECT
        department,
        COUNT(*) AS total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active
      FROM Users
      GROUP BY department
      ORDER BY total DESC, department ASC
    `);

    return NextResponse.json({
      departments: result.recordset as Array<{ department: string; total: number; active: number }>,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to fetch user stats",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

