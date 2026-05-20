import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fetchReportData, REPORT_COLUMNS } from "@/lib/reports";
import { requireRoles } from "@/lib/permissions";

export const runtime = "nodejs";

function toCsv(data: Record<string, unknown>[]) {
  if (!data.length) return "";
  const headers = REPORT_COLUMNS;
  const rows = data.map((row) =>
    headers
      .map((h) => {
        const rawValue = row[h] ?? "";
        const value =
          (h === "Arrival Date" || h === "Departure Date") && rawValue ? `\t${String(rawValue)}` : rawValue;
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
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595, 842]; // A4 portrait in points
  const marginX = 36;
  const marginY = 40;
  const maxWidth = pageSize[0] - marginX * 2;
  let page = pdfDoc.addPage(pageSize);
  let y = pageSize[1] - marginY;

  const lineGap = 4;

  const ensureSpace = (requiredHeight: number) => {
    if (y - requiredHeight < marginY) {
      page = pdfDoc.addPage(pageSize);
      y = pageSize[1] - marginY;
    }
  };

  const wrapText = (text: string, size: number, usedFont = font, width = maxWidth) => {
    const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
    if (!normalized) return [""];
    const words = normalized.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (usedFont.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = word;
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  };

  const drawTextLine = (text: string, size: number, isBold = false, indent = 0) => {
    ensureSpace(size + lineGap);
    page.drawText(text, {
      x: marginX + indent,
      y,
      size,
      font: isBold ? boldFont : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= size + lineGap;
  };

  const drawWrapped = (text: string, size: number, isBold = false, indent = 0) => {
    const lines = wrapText(text, size, isBold ? boldFont : font, maxWidth - indent);
    for (const line of lines) {
      drawTextLine(line, size, isBold, indent);
    }
  };

  const drawKeyValue = (label: string, value: unknown) => {
    const display = String(value ?? "").trim();
    drawWrapped(`${label}:`, 10, true);
    if (!display) {
      drawTextLine("-", 10, false, 12);
      return;
    }
    const lines = wrapText(display, 10, font, maxWidth - 12);
    for (const line of lines) {
      drawTextLine(line, 10, false, 12);
    }
  };

  drawWrapped(title, 16, true);
  drawWrapped(`Generated at: ${new Date().toLocaleString("en-GB")}`, 9);
  drawTextLine(" ", 9);

  if (!data.length) {
    drawWrapped("No records found.", 11, true);
  } else {
    const headers = REPORT_COLUMNS;
    for (const row of data) {
      const bookingId = row["Booking ID"] ?? "";
      drawWrapped(`Booking #${bookingId}`, 13, true);
      for (const header of headers) {
        if (header === "Booking ID") continue;
        drawKeyValue(header, row[header]);
      }
      drawTextLine(" ", 10);
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
  const format = searchParams.get("format");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  if (!format || !["csv", "pdf"].includes(format) || !startDate || !endDate) {
    return NextResponse.json({ message: "Invalid report export request" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return NextResponse.json({ message: "Dates must be in YYYY-MM-DD format" }, { status: 400 });
  }
  if (startDate > endDate) {
    return NextResponse.json({ message: "Start date must be on or before end date" }, { status: 400 });
  }

  try {
    const data = (await fetchReportData(startDate, endDate)) as Record<string, unknown>[];
    const fileBase = `general-report-${new Date().toISOString().slice(0, 10)}`;

    if (format === "csv") {
      const csv = toCsv(data);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${fileBase}.csv"`,
        },
      });
    }

    const pdf = await toPdf(`Guest House Report (${startDate} to ${endDate})`, data);
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
