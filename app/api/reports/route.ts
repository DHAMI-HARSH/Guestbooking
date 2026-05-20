import { NextRequest, NextResponse } from "next/server";
import { fetchReportPage } from "@/lib/reports";
import { requireRoles } from "@/lib/permissions";
import { parsePagination, toPaginationMeta } from "@/lib/pagination";

export const runtime = "nodejs";

const reportRoles = ["APPROVER", "ESTATE_PRIMARY"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, [...reportRoles]);
  if (!auth.authorized) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const query = searchParams.get("q");
  const { page, limit } = parsePagination(searchParams);

  if (!startDate || !endDate) {
    return NextResponse.json({ message: "Start and end dates are required" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return NextResponse.json({ message: "Dates must be in YYYY-MM-DD format" }, { status: 400 });
  }
  if (startDate > endDate) {
    return NextResponse.json({ message: "Start date must be on or before end date" }, { status: 400 });
  }

  try {
    const { rows, total } = await fetchReportPage(startDate, endDate, {
      page,
      limit,
      q: query,
    });
    return NextResponse.json({
      data: rows,
      pagination: toPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to generate report", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
