import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fetchReportData, type ReportType } from "@/lib/reports";
import { requireRoles } from "@/lib/permissions";

export const runtime = "nodejs";

function parseType(raw: string | null): ReportType | null {
  if (raw === "monthly" || raw === "guest-history" || raw === "room-usage") {
    return raw;
  }
  return null;
}

function toCsv(data: Record<string, unknown>[]) {
  if (!data.length) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((h) => {
        const value = row[h] ?? "";
        const text = String(value).replaceAll('"', '""');
        return `"${text}"`;
      })
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

async function toPdf(title: string, data: Record<string, unknown>[]) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage([842, 595]);
  const { height } = page.getSize();
  let y = height - 40;

  const drawLine = (text: string, size = 10) => {
    if (y < 40) {
      page = pdfDoc.addPage([842, 595]);
      y = height - 40;
    }
    page.drawText(text, {
      x: 24,
      y,
      size,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= size + 6;
  };

  drawLine(title, 14);
  drawLine(`Generated at: ${new Date().toISOString()}`, 9);
  drawLine(" ");

  if (!data.length) {
    drawLine("No records found.", 11);
  } else {
    const headers = Object.keys(data[0]);
    drawLine(headers.join(" | "), 10);
    drawLine("-".repeat(140), 9);
    for (const row of data) {
      const line = headers
        .map((header) => String(row[header] ?? "").replace(/\s+/g, " ").slice(0, 25))
        .join(" | ");
      drawLine(line, 9);
    }
  }

  return Buffer.from(await pdfDoc.save());
}

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, ["APPROVER", "ESTATE_PRIMARY"]);
  if (!auth.authorized) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = parseType(searchParams.get("type"));
  const format = searchParams.get("format");
  const month = searchParams.get("month") ?? undefined;

  if (!type || !format || !["csv", "pdf"].includes(format)) {
    return NextResponse.json({ message: "Invalid report export request" }, { status: 400 });
  }

  try {
    const data = (await fetchReportData(type, month)) as Record<string, unknown>[];
    const fileBase = `${type}-report-${new Date().toISOString().slice(0, 10)}`;

    if (format === "csv") {
      const csv = toCsv(data);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${fileBase}.csv"`,
        },
      });
    }

    const pdf = await toPdf(`Guest House ${type.toUpperCase()} Report`, data);
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileBase}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to export report", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
