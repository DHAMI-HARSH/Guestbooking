import { z } from "zod";

export const loginSchema = z.object({
  ecode: z.string().min(2, "Ecode is required"),
  password: z.string().min(6, "Password is required"),
});

const guestSchema = z.object({
  name: z.string().min(2, "Guest name is required"),
  gender: z.enum(["Male", "Female", "Child"]),
  age: z.string().optional(),
  arrival_date: z.string().min(8, "Guest arrival date is required"),
  arrival_time: z.string().min(4, "Guest arrival time is required"),
  departure_date: z.string().min(8, "Guest departure date is required"),
  departure_time: z.string().min(4, "Guest departure time is required"),
});

const foodReservationSchema = z.object({
  date: z.string().min(8, "Food reservation date is required"),
  meal_type: z.enum(["Breakfast", "Lunch", "Dinner"]),
  head_count: z.coerce.number().int().min(1, "Head count must be at least 1"),
  notes: z.string().optional().nullable(),
});

function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addOneMonth(date: Date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

const bookingBaseSchema = z.object({
  guest_name: z.string().min(2, "Booking initiator name is required"),
  guest_email: z.string().email("Valid email is required"),
  guest_phone: z
    .string()
    .trim()
    .refine((value) => value.replace(/\D/g, "").length >= 10, {
      message: "Guest phone must have at least 10 digits",
    }),
  guest_address: z.string().min(10, "Guest address must be at least 10 characters"),
  guest_pincode: z
    .string()
    .trim()
    .refine((value) => /^\d{6}$/.test(value), {
      message: "Pincode must be 6 digits",
    }),
  guest_city: z.string().min(2, "City is required"),
  guest_state: z.string().min(2, "State is required"),
  room_configuration: z
    .enum(["Double Bed", "Triple Bed", "Twin Sharing"])
    .optional()
    .or(z.literal("")),
  room_selection: z
    .object({
      "Double Bed": z.coerce.number().int().min(0).max(3),
      "Triple Bed": z.coerce.number().int().min(0).max(3),
      "Twin Sharing": z.coerce.number().int().min(0).max(3),
    })
    .optional(),
  meal_plan: z.enum(["General", "Special"]),
  extra_bed: z.boolean().optional().default(false),
  guests: z.array(guestSchema).optional().default([]),
  food_reservations: z.array(foodReservationSchema).optional().default([]),
  purpose: z.enum(["Official", "Personal"]),
  justification: z.string().min(3, "Justification is required"),
  special_requests: z.string().optional().nullable(),
  arrival_date: z.string().min(8, "Arrival date is required"),
  arrival_time: z.string().min(4, "Arrival time is required"),
  departure_date: z.string().min(8, "Departure date is required"),
  departure_time: z.string().min(4, "Departure time is required"),
  stay_days: z.coerce.number().int().min(1, "Stay days must be at least 1"),
  male_count: z.coerce.number().int().min(0),
  female_count: z.coerce.number().int().min(0),
  children_count: z.coerce.number().int().min(0),
  services_required: z.array(z.enum(["Room", "Breakfast", "Lunch", "Dinner"])),
  rooms_required: z.coerce.number().int().min(0).optional(),
  booking_cost_center: z.string().min(1, "Cost center is required"),
  estimated_cost: z.coerce.number().min(0).optional().nullable(),
});

export const bookingSchema = bookingBaseSchema.superRefine((data, ctx) => {
  const roomSelection = data.room_selection ?? {
    "Double Bed": 0,
    "Triple Bed": 0,
    "Twin Sharing": 0,
  };
  const totalRooms =
    roomSelection["Double Bed"] + roomSelection["Triple Bed"] + roomSelection["Twin Sharing"];
  if (data.services_required.includes("Room") && totalRooms === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rooms_required"],
      message: "Select at least one room when Room service is selected",
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

  const arrival = data.arrival_date ? parseLocalDate(data.arrival_date) : null;
  if (arrival) {
    const today = startOfToday();
    const maxArrival = addOneMonth(today);
    if (arrival < today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["arrival_date"],
        message: "Arrival date cannot be in the past",
      });
    } else if (arrival > maxArrival) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["arrival_date"],
        message: "Arrival date must be within 1 month from today",
      });
    }
  }

  if (data.services_required.includes("Room")) {
    const roomsRequired = data.rooms_required ?? 0;
    if (roomsRequired < 0 || roomsRequired > 9) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rooms_required"],
        message: "Rooms required must be between 0 and 9 when Room is selected",
      });
    }
  }

  const bookingArrival = data.arrival_date ? parseLocalDate(data.arrival_date) : null;
  const bookingDeparture = data.departure_date ? parseLocalDate(data.departure_date) : null;

  data.guests.forEach((guest, index) => {
    const guestArrival = parseLocalDate(guest.arrival_date);
    const guestDeparture = parseLocalDate(guest.departure_date);

    if (guestDeparture < guestArrival) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guests", index, "departure_date"],
        message: "Guest departure must be on or after guest arrival",
      });
    }

    if (bookingArrival && guestArrival < bookingArrival) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guests", index, "arrival_date"],
        message: "Guest arrival must be within the booking period",
      });
    }

    if (bookingDeparture && guestDeparture > bookingDeparture) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guests", index, "departure_date"],
        message: "Guest departure must be within the booking period",
      });
    }
  });

  const selectedMeals = data.services_required.filter((service) =>
    ["Breakfast", "Lunch", "Dinner"].includes(service)
  );

  if (selectedMeals.length > 0 && data.food_reservations.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["food_reservations"],
      message: "Add at least one food reservation when meal services are selected",
    });
  }

  data.food_reservations.forEach((reservation, index) => {
    const reservationDate = parseLocalDate(reservation.date);

    if (!selectedMeals.includes(reservation.meal_type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["food_reservations", index, "meal_type"],
        message: "Enable the selected meal service before adding this reservation",
      });
    }

    if (bookingArrival && reservationDate < bookingArrival) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["food_reservations", index, "date"],
        message: "Food reservation date must be within the booking period",
      });
    }

    if (bookingDeparture && reservationDate > bookingDeparture) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["food_reservations", index, "date"],
        message: "Food reservation date must be within the booking period",
      });
    }
  });
});

export const bookingUpdateSchema = bookingBaseSchema.partial().extend({
  cancellation_remarks: z.string().optional(),
  approval_status: z.enum(["PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  estate_status: z
    .enum(["PENDING_ESTATE_REVIEW", "ROOM_ALLOCATED", "SERVICES_APPROVED", "ESTATE_REJECTED"])
    .optional(),
}).superRefine((data, ctx) => {
  if (data.arrival_date) {
    const arrival = parseLocalDate(data.arrival_date);
    const today = startOfToday();
    const maxArrival = addOneMonth(today);
    if (arrival < today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["arrival_date"],
        message: "Arrival date cannot be in the past",
      });
    } else if (arrival > maxArrival) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["arrival_date"],
        message: "Arrival date must be within 1 month from today",
      });
    }
  }

  if (data.services_required?.includes("Room")) {
    const roomsRequired = data.rooms_required ?? 0;
    if (roomsRequired < 0 || roomsRequired > 9) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rooms_required"],
        message: "Rooms required must be between 0 and 9 when Room is selected",
      });
    }
  }
  if (data.services_required?.includes("Room") && data.room_selection) {
    const totalRooms =
      data.room_selection["Double Bed"] +
      data.room_selection["Triple Bed"] +
      data.room_selection["Twin Sharing"];
    if (totalRooms === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rooms_required"],
        message: "Select at least one room when Room service is selected",
      });
    }
  }
});

export const approvalSchema = z.object({
  booking_id: z.number().int().positive(),
  decision: z.enum(["Approved", "Rejected"]),
  remarks: z.string().optional(),
});

export const adminUserSchema = z.object({
  ecode: z.string().min(2, "Ecode is required"),
  name: z.string().min(2, "Name is required"),
  department: z.string().min(2, "Department is required"),
  unit: z.string().optional().nullable(),
  role: z.enum(["EMPLOYEE", "APPROVER", "ESTATE_PRIMARY", "ADMIN"]),
  password: z.string().min(6, "Password is required"),
  is_active: z.boolean().optional().default(true),
});

export const adminUserUpdateSchema = z.object({
  role: z.enum(["EMPLOYEE", "APPROVER", "ESTATE_PRIMARY", "ADMIN"]).optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  is_active: z.boolean().optional(),
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
  rooms_required?: number;
  room_selection?: {
    "Double Bed": number;
    "Triple Bed": number;
    "Twin Sharing": number;
  };
}) {
  const totalGuests = input.male_count + input.female_count + input.children_count;
  const adultGuests = input.male_count + input.female_count;
  const roomRequested = input.services_required.includes("Room");
  const capacity =
    input.room_configuration === "Triple Bed"
      ? 3
      : input.room_configuration === "Double Bed" || input.room_configuration === "Twin Sharing"
        ? 2
        : 2;
  const computedRooms = Math.max(1, Math.ceil(adultGuests / capacity));
  const overrideRooms = input.rooms_required;
  const selectionRooms = input.room_selection
    ? input.room_selection["Double Bed"] +
      input.room_selection["Triple Bed"] +
      input.room_selection["Twin Sharing"]
    : undefined;
  const roomsRequired = roomRequested
    ? Number.isFinite(selectionRooms)
      ? Math.max(0, Math.min(9, Number(selectionRooms)))
      : Number.isFinite(overrideRooms)
        ? Math.max(0, Math.min(9, Number(overrideRooms)))
        : computedRooms
    : 0;
  return { totalGuests, roomsRequired };
}
