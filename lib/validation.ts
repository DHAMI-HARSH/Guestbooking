import { z } from "zod";

export const loginSchema = z.object({
  ecode: z.string().min(2, "Ecode is required"),
  password: z.string().min(6, "Password is required"),
});

const guestSchema = z.object({
  name: z.string().min(2, "Guest name is required"),
  gender: z.enum(["Male", "Female", "Child"]),
  age: z.string().optional(),
});

const bookingBaseSchema = z.object({
  guest_name: z.string().min(2),
  guest_phone: z
    .string()
    .trim()
    .refine((value) => value.replace(/\D/g, "").length >= 8, {
      message: "Guest phone must have at least 8 digits",
    }),
  guest_address: z.string().min(5),
  room_configuration: z
    .enum(["Double Bed", "Triple Bed", "Twin Sharing"])
    .optional()
    .or(z.literal("")),
  meal_plan: z.enum(["General", "Special"]),
  extra_bed: z.boolean().optional().default(false),
  guests: z.array(guestSchema).optional().default([]),
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
  estimated_cost: z.coerce.number().min(0).optional().nullable(),
});

export const bookingSchema = bookingBaseSchema.superRefine((data, ctx) => {
  if (data.services_required.includes("Room") && !data.room_configuration) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["room_configuration"],
      message: "Room configuration is required when Room is selected",
    });
  }
  const childCount = data.children_count ?? 0;
  if (data.extra_bed && childCount === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["extra_bed"],
      message: "Extra bed is only available when children are included",
    });
  }
});

export const bookingUpdateSchema = bookingBaseSchema.partial().extend({
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
  room_configuration?: "Double Bed" | "Triple Bed" | "Twin Sharing" | "";
}) {
  const totalGuests = input.male_count + input.female_count + input.children_count;
  const roomRequested = input.services_required.includes("Room");
  const capacity =
    input.room_configuration === "Triple Bed"
      ? 3
      : input.room_configuration === "Double Bed" || input.room_configuration === "Twin Sharing"
        ? 2
        : 2;
  const roomsRequired = roomRequested ? Math.max(1, Math.ceil(totalGuests / capacity)) : 0;
  return { totalGuests, roomsRequired };
}
