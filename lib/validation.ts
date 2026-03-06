import { z } from "zod";

export const loginSchema = z.object({
  ecode: z.string().min(2, "Ecode is required"),
  password: z.string().min(6, "Password is required"),
});

export const bookingSchema = z.object({
  guest_name: z.string().min(2),
  guest_phone: z.string().min(8),
  guest_address: z.string().min(5),
  purpose: z.enum(["Official", "Personal"]),
  justification: z.string().min(3),
  arrival_date: z.string().min(8),
  arrival_time: z.string().min(4),
  departure_date: z.string().min(8),
  departure_time: z.string().min(4),
  stay_days: z.coerce.number().int().min(1),
  male_count: z.coerce.number().int().min(0),
  female_count: z.coerce.number().int().min(0),
  children_count: z.coerce.number().int().min(0),
  services_required: z.array(z.enum(["Room", "Breakfast", "Lunch", "Dinner"])),
  booking_cost_center: z.string().min(1),
});

export const bookingUpdateSchema = bookingSchema.partial().extend({
  cancellation_remarks: z.string().optional(),
  approval_status: z.enum(["PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  estate_status: z
    .enum(["PENDING_ESTATE_REVIEW", "ROOM_ALLOCATED", "SERVICES_APPROVED", "ESTATE_REJECTED"])
    .optional(),
});

export const approvalSchema = z.object({
  booking_id: z.number().int().positive(),
  decision: z.enum(["Approved", "Rejected"]),
  remarks: z.string().optional(),
});

export const roomAllocationSchema = z.object({
  booking_id: z.number().int().positive(),
  room_number: z.string().min(1),
  allocation_status: z.enum(["ALLOCATED", "RELEASED"]).default("ALLOCATED"),
});

export function calculateTotals(input: {
  male_count: number;
  female_count: number;
  children_count: number;
  services_required: string[];
}) {
  const totalGuests = input.male_count + input.female_count + input.children_count;
  const roomRequested = input.services_required.includes("Room");
  const roomsRequired = roomRequested ? Math.max(1, Math.ceil(totalGuests / 2)) : 0;
  return { totalGuests, roomsRequired };
}
