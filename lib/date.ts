import { format } from "date-fns";

function parseDateValue(value: string | number | Date) {
  if (value instanceof Date) return value;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00`);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDisplayDate(value?: string | number | Date | null) {
  if (value === null || value === undefined || value === "") return "-";
  const date = parseDateValue(value);
  if (!date) return String(value);
  return format(date, "dd-MMMM-yyyy");
}
