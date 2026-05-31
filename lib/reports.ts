import { getDbPool } from "@/lib/db";
import { REPORT_COLUMNS } from "@/lib/report-columns";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/pagination";

export type ReportType = "general";

export { REPORT_COLUMNS } from "@/lib/report-columns";

type ReportRow = Record<(typeof REPORT_COLUMNS)[number], string | number>;

type ReportDbRow = {
  id: number;
  created_at: unknown;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  guest_address: string;
  guest_pincode: string;
  guest_city: string;
  guest_state: string;
  guests: string | null;
  food_reservations: string | null;
  arrival_date: unknown;
  arrival_time: string;
  departure_date: unknown;
  departure_time: string;
  stay_days: number;
  meal_plan: string;
  extra_bed: boolean;
  room_configuration: string | null;
  room_selection: string | null;
  rooms_required: number;
  male_count: number;
  female_count: number;
  children_count: number;
  total_guests: number;
  special_requests: string | null;
  services_required: string | null;
  booking_cost_center: string;
  estimated_cost: number | null;
  purpose: string;
  justification: string;
  approval_status: string;
  estate_status: string;
  cancellation_remarks: string | null;
  department: string;
};

function formatDate(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatDateTime(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  })
    .format(date)
    .replace(",", "");
}

function parseGuestNames(guests: string | null, fallback: string) {
  if (!guests) return fallback;
  try {
    const parsed = JSON.parse(guests) as Array<{ name?: string }>;
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
    const names = parsed
      .map((guest) => guest.name?.trim())
      .filter((name): name is string => Boolean(name));
    if (names.length === 0) return fallback;
    const joined = names.join(", ");
    return names.length > 1 ? `(${joined})` : names[0];
  } catch {
    return fallback;
  }
}

function parseServicesRequired(services: string | null) {
  if (!services) return "None";
  try {
    const parsed = JSON.parse(services) as string[];
    if (!Array.isArray(parsed) || parsed.length === 0) return "None";
    return parsed.join(" + ");
  } catch {
    return "None";
  }
}

function formatRoomSelection(selection: string | null) {
  if (!selection) return "";
  try {
    const parsed = JSON.parse(selection) as {
      "Double Bed"?: number;
      "Triple Bed"?: number;
      "Twin Sharing"?: number;
    };
    if (!parsed || typeof parsed !== "object") return "";
    const entries = [
      { label: "Double Bed", count: parsed["Double Bed"] ?? 0 },
      { label: "Triple Bed", count: parsed["Triple Bed"] ?? 0 },
      { label: "Twin Sharing", count: parsed["Twin Sharing"] ?? 0 },
    ].filter((item) => item.count > 0);
    if (entries.length === 0) return "";
    return entries.map((item) => `${item.label} (${item.count})`).join(", ");
  } catch {
    return "";
  }
}

function formatGuestList(guests: string | null) {
  if (!guests) return "";
  try {
    const parsed = JSON.parse(guests) as Array<{
      name?: string;
      gender?: string;
      age?: string;
      arrival_date?: string;
      arrival_time?: string;
      departure_date?: string;
      departure_time?: string;
    }>;
    if (!Array.isArray(parsed) || parsed.length === 0) return "";
    return parsed
      .map((guest) => {
        const name = guest.name?.trim() || "Guest";
        const gender = guest.gender?.trim();
        const age = guest.age?.trim();
        const meta = [gender, age].filter(Boolean).join(", ");
        const window = `${guest.arrival_date || "-"} ${guest.arrival_time || ""} -> ${guest.departure_date || "-"} ${guest.departure_time || ""}`.trim();
        return meta ? `${name} (${meta}) ${window}` : `${name} ${window}`;
      })
      .join("; ");
  } catch {
    return "";
  }
}

function formatFoodReservations(food: string | null) {
  if (!food) return "";
  try {
    const parsed = JSON.parse(food) as Array<{
      date?: string;
      meal_type?: string;
      head_count?: string;
      notes?: string;
    }>;
    if (!Array.isArray(parsed) || parsed.length === 0) return "";
    return parsed
      .map((item) => {
        const meal = item.meal_type?.trim() || "Meal";
        const date = item.date || "-";
        const count = item.head_count ? `${item.head_count} pax` : "";
        const notes = item.notes?.trim();
        return [date, meal, count].filter(Boolean).join(" ") + (notes ? ` - ${notes}` : "");
      })
      .join("; ");
  } catch {
    return "";
  }
}

function formatMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (Number.isNaN(num)) return "";
  return `INR ${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export async function fetchReportData(startDate: string, endDate: string): Promise<ReportRow[]> {
  return (await fetchReportInternal(startDate, endDate, { includeTotal: false })).rows;
}

export async function fetchReportPage(
  startDate: string,
  endDate: string,
  {
    page = 1,
    limit = DEFAULT_PAGE_LIMIT,
    q,
  }: { page?: number; limit?: number; q?: string | null } = {},
): Promise<{ rows: ReportRow[]; total: number }> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const limitCandidate = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_PAGE_LIMIT;
  const safeLimit = Math.max(1, Math.min(MAX_PAGE_LIMIT, limitCandidate));
  const offset = (safePage - 1) * safeLimit;
  return await fetchReportInternal(startDate, endDate, { offset, limit: safeLimit, q });
}

async function fetchReportInternal(
  startDate: string,
  endDate: string,
  {
    offset,
    limit,
    q,
    includeTotal = true,
  }: { offset?: number; limit?: number; q?: string | null; includeTotal?: boolean } = {},
): Promise<{ rows: ReportRow[]; total: number }> {
  const pool = await getDbPool();
  const req = pool.request();
  req.input("start_date", startDate);
  req.input("end_date", endDate);

  const conditions: string[] = ["b.arrival_date BETWEEN @start_date AND @end_date"];

  if (q && q.trim()) {
    req.input("q_like", `%${q.trim()}%`);
    conditions.push(
        "(" +
        [
          "CAST(b.id AS TEXT) ILIKE @q_like",
          "b.guest_name ILIKE @q_like",
          "b.guest_phone ILIKE @q_like",
          "b.guest_email ILIKE @q_like",
          "u.department ILIKE @q_like",
        ].join(" OR ") +
        ")",
    );
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const shouldCount = includeTotal && typeof offset === "number" && typeof limit === "number";
  let total = 0;

  if (shouldCount) {
    const countResult = await req.query(`
      SELECT COUNT(*) AS total
      FROM bookings b
      INNER JOIN users u ON u.id = b.created_by
      ${whereClause}
    `);
    total = Number((countResult.recordset[0] as { total?: unknown } | undefined)?.total ?? 0);
  }

  if (typeof offset === "number" && typeof limit === "number") {
    req.input("offset", offset);
    req.input("limit", limit);
  }

    const paginationClause =
      typeof offset === "number" && typeof limit === "number"
      ? "LIMIT @limit OFFSET @offset"
      : "";

  const result = await req.query(`
    SELECT
      b.id,
      b.created_at,
      b.guest_name,
      b.guest_email,
      b.guest_phone,
      b.guest_address,
      b.guest_pincode,
      b.guest_city,
      b.guest_state,
      b.guests,
      b.food_reservations,
      b.arrival_date,
      b.arrival_time,
      b.departure_date,
      b.departure_time,
      b.stay_days,
      b.meal_plan,
      b.extra_bed,
      b.room_configuration,
      b.room_selection,
      b.rooms_required,
      b.male_count,
      b.female_count,
      b.children_count,
      b.total_guests,
      b.special_requests,
      b.services_required,
      b.booking_cost_center,
      b.estimated_cost,
      b.purpose,
      b.justification,
      b.approval_status,
      b.estate_status,
      b.cancellation_remarks,
      u.department AS department
    FROM bookings b
    INNER JOIN users u ON u.id = b.created_by
    ${whereClause}
    ORDER BY b.arrival_date DESC, b.id DESC
    ${paginationClause};
  `);

  const rows = result.recordset.map((record) => {
    const row = record as ReportDbRow;
    const specialRequests =
      typeof row.special_requests === "string" && row.special_requests.trim().length > 0
        ? row.special_requests.trim()
        : "NONE";

    return {
      "Booking ID": row.id,
      "Booked On": formatDateTime(row.created_at),
      "Booking Initiator Name": row.guest_name,
      "Booking Initiator Email": row.guest_email,
      "Booking Initiator Phone": row.guest_phone,
      "Department": row.department,
      "Guest's Address": row.guest_address,
      "Pincode": row.guest_pincode,
      "City": row.guest_city,
      "State": row.guest_state,
      "Purpose": row.purpose,
      "Justification": row.justification,
      "Guest Names": parseGuestNames(row.guests as string | null, row.guest_name as string),
      "Guest List": formatGuestList(row.guests as string | null),
      "Arrival Date": formatDate(row.arrival_date),
      "Arrival Time": row.arrival_time,
      "Departure Date": formatDate(row.departure_date),
      "Departure Time": row.departure_time,
      "No. of stay days": row.stay_days,
      "Meal Plan": row.meal_plan,
      "Extra Bed": row.extra_bed ? "Yes" : "No",
      "Room Configuration": row.room_configuration || "",
      "Room Selection": formatRoomSelection(row.room_selection as string | null),
      "Rooms Required": row.rooms_required,
      "Services required": parseServicesRequired(row.services_required as string | null),
      "Food Reservations": formatFoodReservations(row.food_reservations as string | null),
      "Male Count": row.male_count,
      "Female Count": row.female_count,
      "Children Count": row.children_count,
      "Total Guests": row.total_guests,
      "Booking Cost Center": row.booking_cost_center,
      "Estimated Cost": formatMoney(row.estimated_cost),
      "Special requests": specialRequests,
      "Approval Status": row.approval_status,
      "Estate Status": row.estate_status,
      "Cancellation Remarks": row.cancellation_remarks || "",
    } satisfies ReportRow;
  });

  return { rows, total };
}
