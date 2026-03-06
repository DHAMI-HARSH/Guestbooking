import { NextRequest, NextResponse } from "next/server";
import { fetchReportData, type ReportType } from "@/lib/reports";
import { requireRoles } from "@/lib/permissions";

export const runtime = "nodejs";

const reportRoles = ["APPROVER", "ESTATE_PRIMARY", "ESTATE_SECONDARY"] as const;

function parseType(raw: string | null): ReportType | null {
  if (raw === "monthly" || raw === "guest-history" || raw === "room-usage") {
    return raw;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, [...reportRoles]);
  if (!auth.authorized) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = parseType(searchParams.get("type"));
  const month = searchParams.get("month") ?? undefined;

  if (!type) {
    return NextResponse.json({ message: "Invalid report type" }, { status: 400 });
  }

  try {
    const data = await fetchReportData(type, month);
    return NextResponse.json({ type, data });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to generate report", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
