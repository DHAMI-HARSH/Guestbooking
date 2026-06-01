"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, addMonths, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToastBanner, type ToastTone } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";

const serviceOptions = ["Room", "Breakfast", "Lunch", "Dinner"] as const;

const roomConfigurations = [
  { label: "Double Bed", rate: 2000 },
  { label: "Triple Bed", rate: 3000 },
  { label: "Twin Sharing", rate: 2000 },
] as const;

const mealRates = {
  General: { Breakfast: 100, Lunch: 150, Dinner: 150 },
  Special: { Breakfast: 200, Lunch: 400, Dinner: 400 },
} as const;

function splitTime(value: string) {
  const trimmed = value.trim();
  const parts = trimmed.split(/\s+/);
  const time = parts[0] || "12:00";
  return { time };
}

function buildTime(time: string) {
  return time;
}

function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

interface BookingFormProps {
  onCreated?: () => void;
}

type GuestEntry = {
  id: string;
  name: string;
  gender: "Male" | "Female" | "Child";
  age: string;
  arrival_date: string;
  arrival_time: string;
  departure_date: string;
  departure_time: string;
};

type FoodReservationEntry = {
  id: string;
  date: string;
  meal_type: "Breakfast" | "Lunch" | "Dinner";
  head_count: string;
  notes: string;
};

interface BookingState {
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  guest_address: string;
  guest_pincode: string;
  guest_city: string;
  guest_state: string;
  room_configuration: "Double Bed" | "Triple Bed" | "Twin Sharing" | "";
  room_selection: {
    "Double Bed": number;
    "Triple Bed": number;
    "Twin Sharing": number;
  };
  meal_plan: "General" | "Special";
  extra_bed: boolean;
  guests: GuestEntry[];
  food_reservations: FoodReservationEntry[];
  purpose: "Official" | "Personal";
  justification: string;
  special_requests: string;
  arrival_date: string;
  arrival_time: string;
  departure_date: string;
  departure_time: string;
  stay_days: number;
  male_count: number;
  female_count: number;
  children_count: number;
  services_required: string[];
  booking_cost_center: string;
}

const initialState: BookingState = {
  guest_name: "",
  guest_email: "",
  guest_phone: "",
  guest_address: "",
  guest_pincode: "",
  guest_city: "",
  guest_state: "",
  room_configuration: "",
  room_selection: {
    "Double Bed": 0,
    "Triple Bed": 0,
    "Twin Sharing": 0,
  },
  meal_plan: "General",
  extra_bed: false,
  guests: [],
  food_reservations: [],
  purpose: "Official",
  justification: "",
  special_requests: "",
  arrival_date: format(new Date(), "yyyy-MM-dd"),
  arrival_time: "12:00",
  departure_date: format(addDays(new Date(), 1), "yyyy-MM-dd"),
  departure_time: "10:00",
  stay_days: 1,
  male_count: 1,
  female_count: 0,
  children_count: 0,
  services_required: ["Room"],
  booking_cost_center: "SELF",
};

export function BookingForm({ onCreated }: BookingFormProps) {
  const [form, setForm] = useState<BookingState>(initialState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pincodeStatus, setPincodeStatus] = useState<string | null>(null);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [showSpecialRequests, setShowSpecialRequests] = useState(false);
  const [showFoodReservations, setShowFoodReservations] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitConfirmation, setSubmitConfirmation] = useState<"YES" | "NO" | "">("");
  const [toast, setToast] = useState<{ title: string; description?: string; tone?: ToastTone } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const stepLabels = [
    { label: "Basic details", description: "Booking initiator, contact and purpose" },
    { label: "Stay details", description: "Arrival, departure and stay dates" },
    { label: "Guest details", description: "Guest list and guest count details" },
    { label: "Room & food", description: "Room selection, services and meal plan" },
    { label: "Review & submit", description: "Confirm your booking details before submit" },
  ];

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === stepLabels.length - 1;
  const reviewStepIndex = stepLabels.length - 1;

  const validateStep = useCallback((step: number) => {
    if (step === 0) {
      const hasBasic = [
        form.guest_name,
        form.guest_email,
        form.guest_phone,
        form.guest_address,
        form.guest_pincode,
        form.guest_city,
        form.guest_state,
      ].every(Boolean);
      const hasPurpose = form.purpose === "Personal" || form.justification.trim().length > 0;
      return hasBasic && hasPurpose;
    }

    if (step === 1) {
      return (
        Boolean(form.arrival_date) &&
        Boolean(form.arrival_time) &&
        Boolean(form.departure_date) &&
        Boolean(form.departure_time) &&
        form.stay_days > 0
      );
    }

    if (step === 2) {
      if (form.guests.length === 0) {
        return true;
      }
      return form.guests.every((guest) =>
        Boolean(guest.name) &&
        Boolean(guest.age) &&
        Boolean(guest.arrival_date) &&
        Boolean(guest.arrival_time) &&
        Boolean(guest.departure_date) &&
        Boolean(guest.departure_time)
      );
    }

    if (step === 3) {
      if (form.services_required.length === 0) return false;
      if (form.services_required.includes("Room")) {
        return (
          Object.values(form.room_selection).some((count) => count > 0) ||
          form.special_requests.trim().length > 0
        );
      }
      return true;
    }

    return true;
  }, [form]);

  const isReviewReady = useMemo(() => {
    return (
      validateStep(0) &&
      validateStep(1) &&
      validateStep(2) &&
      validateStep(3)
    );
  }, [validateStep]);

  const canNavigateToStep = (target: number) => {
    if (target === reviewStepIndex) return isReviewReady;
    return true;
  };

  useEffect(() => {
    if (currentStep === reviewStepIndex && !isReviewReady) {
      setCurrentStep(reviewStepIndex - 1);
    }
  }, [currentStep, reviewStepIndex, isReviewReady]);

  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const maxArrivalStr = useMemo(() => format(addMonths(new Date(), 1), "yyyy-MM-dd"), []);
  const selectedMealServices = useMemo(
    () =>
      form.services_required.filter((service): service is "Breakfast" | "Lunch" | "Dinner" =>
        ["Breakfast", "Lunch", "Dinner"].includes(service)
      ),
    [form.services_required],
  );
  const bookingDateOptions = useMemo(() => {
    const dates: string[] = [];
    const start = parseLocalDate(form.arrival_date);
    const end = parseLocalDate(form.departure_date);
    let cursor = start;
    while (cursor <= end) {
      dates.push(format(cursor, "yyyy-MM-dd"));
      cursor = addDays(cursor, 1);
    }
    return dates;
  }, [form.arrival_date, form.departure_date]);

  const derivedCounts = useMemo(() => {
    if (form.guests.length === 0) {
      return {
        male: form.male_count,
        female: form.female_count,
        children: form.children_count,
      };
    }

    return form.guests.reduce(
      (acc, guest) => {
        const ageValue = Number(guest.age || 0);
        const isChild = Number.isFinite(ageValue) && ageValue > 0 && ageValue < 10;
        if (isChild) {
          acc.children += 1;
          return acc;
        }
        if (guest.gender === "Male") acc.male += 1;
        if (guest.gender === "Female") acc.female += 1;
        if (guest.gender === "Child") acc.children += 1;
        return acc;
      },
      { male: 0, female: 0, children: 0 },
    );
  }, [form.guests, form.male_count, form.female_count, form.children_count]);

  const totalGuests = useMemo(
    () => derivedCounts.male + derivedCounts.female + derivedCounts.children,
    [derivedCounts],
  );
  const adultGuests = useMemo(
    () => derivedCounts.male + derivedCounts.female,
    [derivedCounts],
  );
  const suggestedRoomsRequired = useMemo(() => {
    if (!form.services_required.includes("Room")) return 0;
    const capacity =
      form.room_configuration === "Triple Bed"
        ? 3
        : form.room_configuration === "Double Bed" || form.room_configuration === "Twin Sharing"
          ? 2
          : 2;
    return Math.max(1, Math.ceil(adultGuests / capacity));
  }, [form.services_required, form.room_configuration, adultGuests]);

  const roomsRequired = useMemo(() => {
    return (
      form.room_selection["Double Bed"] +
      form.room_selection["Triple Bed"] +
      form.room_selection["Twin Sharing"]
    );
  }, [form.room_selection]);

  const totalFoodCoverCount = useMemo(
    () =>
      form.food_reservations.reduce((sum, reservation) => {
        const count = Number(reservation.head_count || 0);
        return sum + (Number.isFinite(count) ? count : 0);
      }, 0),
    [form.food_reservations],
  );

  useEffect(() => {
    const pincode = form.guest_pincode.trim();
    if (pincode.length === 0) {
      setPincodeStatus(null);
      return;
    }
    if (!/^\d{6}$/.test(pincode)) {
      setPincodeStatus("Enter a valid 6-digit pincode.");
      return;
    }
    const timer = setTimeout(async () => {
      setPincodeLoading(true);
      setPincodeStatus(null);
      try {
        const res = await fetch(`/api/pincode?pincode=${encodeURIComponent(pincode)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Pincode lookup failed");
        }
        setForm((prev) => ({
          ...prev,
          guest_city: data.city ?? prev.guest_city,
          guest_state: data.state ?? prev.guest_state,
        }));
        setPincodeStatus(`Mapped to ${data.city}, ${data.state}.`);
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.guest_city;
          delete next.guest_state;
          delete next.guest_pincode;
          return next;
        });
      } catch (lookupError) {
        setPincodeStatus(
          lookupError instanceof Error ? lookupError.message : "Pincode lookup failed"
        );
      } finally {
        setPincodeLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [form.guest_pincode]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function clearFieldError(field: string) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }


  function handleAddGuest() {
    const id = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
    setForm((prev) => ({
      ...prev,
      guests: [
        ...prev.guests,
        {
          id,
          name: "",
          gender: "Male",
          age: "",
          arrival_date: prev.arrival_date,
          arrival_time: prev.arrival_time,
          departure_date: prev.departure_date,
          departure_time: prev.departure_time,
        },
      ],
    }));
  }

  function handleGuestChange(
    id: string,
    key: keyof Omit<GuestEntry, "id">,
    value: string,
  ) {
    setForm((prev) => ({
      ...prev,
      guests: prev.guests.map((guest) =>
        guest.id === id
          ? {
              ...guest,
              ...(key === "gender"
                ? {
                    gender: value as "Male" | "Female" | "Child",
                    age:
                      value === "Child" && Number(guest.age || 0) > 10 ? "10" : guest.age,
                  }
                : key === "arrival_date"
                  ? {
                      arrival_date: value,
                      departure_date: guest.departure_date < value ? value : guest.departure_date,
                    }
                  : key === "departure_date"
                    ? {
                        departure_date: value < guest.arrival_date ? guest.arrival_date : value,
                      }
                : key === "age" && guest.gender === "Child"
                  ? { age: String(Math.min(10, Number(value || 0))) }
                  : { [key]: value }),
            }
          : guest,
      ),
    }));
  }

  function handleRemoveGuest(id: string) {
    setForm((prev) => ({
      ...prev,
      guests: prev.guests.filter((guest) => guest.id !== id),
    }));
  }

  function estimateCost() {
    const stayDays = Math.max(1, Number(form.stay_days) || 1);
    const roomCost = form.services_required.includes("Room")
      ? roomConfigurations.reduce((sum, room) => {
          const count = form.room_selection[room.label];
          return sum + room.rate * count * stayDays;
        }, 0)
      : 0;

    const mealPlanRates = mealRates[form.meal_plan];
    const mealCost = form.food_reservations.reduce((sum, reservation) => {
      const count = Number(reservation.head_count || 0);
      if (!reservation.meal_type || !Number.isFinite(count) || count <= 0) return sum;
      return sum + mealPlanRates[reservation.meal_type] * count;
    }, 0);

    setEstimatedCost(roomCost + mealCost);
  }

  function updateStayDays(days: number) {
    const safeDays = Number.isFinite(days) && days > 0 ? days : 1;
    const departure = addDays(parseLocalDate(form.arrival_date), safeDays);
    setForm((prev) => ({
      ...prev,
      stay_days: safeDays,
      departure_date: format(departure, "yyyy-MM-dd"),
      guests: prev.guests.map((guest) => ({
        ...guest,
        arrival_date: guest.arrival_date < prev.arrival_date ? prev.arrival_date : guest.arrival_date,
        departure_date:
          guest.departure_date > format(departure, "yyyy-MM-dd")
            ? format(departure, "yyyy-MM-dd")
            : guest.departure_date,
      })),
      food_reservations: prev.food_reservations.filter((reservation) => {
        const nextDeparture = format(departure, "yyyy-MM-dd");
        return reservation.date >= prev.arrival_date && reservation.date <= nextDeparture;
      }),
    }));
  }

  function handleServiceToggle(service: string, checked: boolean) {
    setForm((prev) => {
      const nextServices = checked
        ? [...prev.services_required, service]
        : prev.services_required.filter((item) => item !== service);
      return {
        ...prev,
        services_required: nextServices,
        food_reservations: ["Breakfast", "Lunch", "Dinner"].includes(service) && !checked
          ? prev.food_reservations.filter((item) => item.meal_type !== service)
          : prev.food_reservations,
        room_selection: nextServices.includes("Room")
          ? prev.room_selection
          : {
              "Double Bed": 0,
              "Triple Bed": 0,
              "Twin Sharing": 0,
            },
      };
    });
  }

  function handleAddFoodReservation() {
    const id = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
    const defaultMeal = selectedMealServices[0] ?? "Breakfast";
    setForm((prev) => ({
      ...prev,
      services_required: prev.services_required.includes(defaultMeal)
        ? prev.services_required
        : [...prev.services_required, defaultMeal],
      food_reservations: [
        ...prev.food_reservations,
        {
          id,
          date: bookingDateOptions[0] ?? prev.arrival_date,
          meal_type: defaultMeal,
          head_count: String(totalGuests || 1),
          notes: "",
        },
      ],
    }));
    clearFieldError("food_reservations");
  }

  function handleFoodReservationChange(
    id: string,
    key: keyof Omit<FoodReservationEntry, "id">,
    value: string,
  ) {
    setForm((prev) => ({
      ...prev,
      food_reservations: prev.food_reservations.map((reservation) =>
        reservation.id === id
          ? {
              ...reservation,
              [key]: value,
            }
          : reservation,
      ),
      services_required:
        key === "meal_type" && !prev.services_required.includes(value)
          ? [...prev.services_required, value]
          : prev.services_required,
    }));
  }

  function handleRemoveFoodReservation(id: string) {
    setForm((prev) => ({
      ...prev,
      food_reservations: prev.food_reservations.filter((reservation) => reservation.id !== id),
    }));
  }

  async function submitBooking() {
    setLoading(true);
    setError(null);
    setMessage(null);
    setFieldErrors({});

    try {
      const payload = {
        ...form,
        guests: form.guests.map((guest) => {
          const { id, ...rest } = guest;
          void id;
          return rest;
        }),
        food_reservations: form.food_reservations.map((reservation) => {
          const { id, ...rest } = reservation;
          void id;
          return {
            ...rest,
            head_count: Number(rest.head_count),
          };
        }),
        male_count: derivedCounts.male,
        female_count: derivedCounts.female,
        children_count: derivedCounts.children,
        rooms_required: roomsRequired,
        estimated_cost: estimatedCost,
      };

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const fieldErrors = data?.errors?.fieldErrors as Record<string, string[] | undefined> | undefined;
        const firstFieldError = fieldErrors
          ? Object.values(fieldErrors).flat().find((msg) => typeof msg === "string")
          : undefined;
        if (fieldErrors) {
          setFieldErrors(
            Object.fromEntries(
              Object.entries(fieldErrors).map(([key, value]) => [key, value?.[0] || "Invalid value"])
            )
          );
        }
        throw new Error(firstFieldError || data.detail || data.message || "Could not save booking");
      }
      setMessage("Booking submitted successfully and marked as PENDING_APPROVAL.");
      setToast({
        title: "Booking submitted successfully",
        description: "Your booking is now marked as pending approval.",
        tone: "success",
      });
      setForm(initialState);
      setCurrentStep(0);
      setEstimatedCost(null);
      setPincodeStatus(null);
      setShowSpecialRequests(false);
      setShowFoodReservations(false);
      setShowSubmitConfirm(false);
      setSubmitConfirmation("");
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit booking");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Guest Booking</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] items-start">
          <aside className="hidden lg:block">
            <div className="sticky top-6 min-h-[620px] space-y-4 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm">
              <div className="space-y-2">
                <p className="text-sm font-semibold">Booking steps</p>
                <p className="text-sm text-slate-600">Complete each step in order to continue.</p>
              </div>
              <div className="space-y-3">
                {stepLabels.map((step, index) => {
                  const completed = index < currentStep;
                  const active = index === currentStep;
                  return (
                    <button
                      key={step.label}
                      type="button"
                      disabled={!canNavigateToStep(index)}
                      onClick={() => canNavigateToStep(index) && setCurrentStep(index)}
                      className={`w-full rounded-3xl border px-4 py-4 text-left text-sm transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 ${
                        active
                          ? "border-sky-500 bg-sky-50 text-sky-900 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`grid h-9 w-9 place-items-center rounded-full border text-xs font-semibold ${
                          completed
                            ? "border-sky-500 bg-sky-500 text-white"
                            : active
                              ? "border-sky-500 bg-white text-sky-900"
                              : "border-slate-300 bg-white text-slate-500"
                        }`}>
                          {completed ? "✓" : index + 1}
                        </span>
                        <div>
                          <div className="font-semibold">{step.label}</div>
                          <div className="text-xs text-muted-foreground">{step.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="grid gap-4 min-h-[560px]">
            <div className="lg:hidden">
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Step {currentStep + 1} of {stepLabels.length}</p>
                      <p className="text-xs text-slate-500">{stepLabels[currentStep].label}</p>
                    </div>
                    <div className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-700">
                      {currentStep + 1}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {stepLabels.map((step, index) => (
                      <div
                        key={step.label}
                        className={`h-2 rounded-full ${
                          index <= currentStep ? "bg-sky-500" : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-sky-700">Step {currentStep + 1} of {stepLabels.length}</p>
                  <h2 className="text-2xl font-semibold text-slate-900">{stepLabels[currentStep].label}</h2>
                </div>
                <p className="max-w-xl text-sm leading-6 text-slate-600">{stepLabels[currentStep].description}</p>
              </div>
            </div>

          {currentStep === 0 && (
            <>
              <div className="space-y-1.5">
                <Label>Booking Initiator</Label>
            <Input
              value={form.guest_name}
              onChange={(e) => {
                clearFieldError("guest_name");
                setForm((prev) => ({ ...prev, guest_name: e.target.value }));
              }}
              required
            />
            {fieldErrors.guest_name ? <p className="text-xs text-red-600">{fieldErrors.guest_name}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label>Booking Initiator Email</Label>
            <Input
              type="email"
              value={form.guest_email}
              onChange={(e) => {
                clearFieldError("guest_email");
                setForm((prev) => ({ ...prev, guest_email: e.target.value }));
              }}
              required
            />
            {fieldErrors.guest_email ? <p className="text-xs text-red-600">{fieldErrors.guest_email}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label>Guest Mobile No</Label>
            <Input
              type="tel"
              minLength={10}
              placeholder="Enter at least 10 digits"
              value={form.guest_phone}
              onChange={(e) => {
                clearFieldError("guest_phone");
                setForm((prev) => ({ ...prev, guest_phone: e.target.value }));
              }}
              required
            />
            {fieldErrors.guest_phone ? <p className="text-xs text-red-600">{fieldErrors.guest_phone}</p> : null}
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Guest Address (min 10 characters)</Label>
            <Input
              minLength={10}
              value={form.guest_address}
              onChange={(e) => {
                clearFieldError("guest_address");
                setForm((prev) => ({ ...prev, guest_address: e.target.value }));
              }}
              required
            />
            {fieldErrors.guest_address ? <p className="text-xs text-red-600">{fieldErrors.guest_address}</p> : null}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-base">*</span>
              <span className="font-semibold">
                Check in may be completed at any time However checkout must be strictly completed by 12:00 noon
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Pincode</Label>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={form.guest_pincode}
              onChange={(e) => {
                clearFieldError("guest_pincode");
                setForm((prev) => ({ ...prev, guest_pincode: e.target.value.replace(/\D/g, "") }));
              }}
              required
            />
            {pincodeLoading ? (
              <p className="text-xs text-muted-foreground">Looking up pincode...</p>
            ) : null}
            {pincodeStatus ? <p className="text-xs text-muted-foreground">{pincodeStatus}</p> : null}
            {fieldErrors.guest_pincode ? (
              <p className="text-xs text-red-600">{fieldErrors.guest_pincode}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>City</Label>
            <Input
              value={form.guest_city}
              onChange={(e) => {
                clearFieldError("guest_city");
                setForm((prev) => ({ ...prev, guest_city: e.target.value }));
              }}
              required
            />
            {fieldErrors.guest_city ? <p className="text-xs text-red-600">{fieldErrors.guest_city}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label>State</Label>
            <Input
              value={form.guest_state}
              onChange={(e) => {
                clearFieldError("guest_state");
                setForm((prev) => ({ ...prev, guest_state: e.target.value }));
              }}
              required
            />
            {fieldErrors.guest_state ? <p className="text-xs text-red-600">{fieldErrors.guest_state}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>Meal Plan</Label>
            <Select
              value={form.meal_plan}
              onValueChange={(value: BookingState["meal_plan"]) =>
                setForm((prev) => ({ ...prev, meal_plan: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="General">General</SelectItem>
                <SelectItem value="Special">Special</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Breakfast: INR {mealRates[form.meal_plan].Breakfast}, Lunch: INR {mealRates[form.meal_plan].Lunch}, Dinner: INR {mealRates[form.meal_plan].Dinner}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Purpose</Label>
            <Select
              value={form.purpose}
              onValueChange={(value: "Official" | "Personal") =>
                setForm((prev) => ({
                  ...prev,
                  purpose: value,
                  justification:
                    value === "Personal" && prev.justification.trim().length < 3
                      ? "Personal booking"
                      : prev.justification,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select purpose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Official">Official</SelectItem>
                <SelectItem value="Personal">Personal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.purpose === "Official" ? (
            <div className="space-y-1.5 md:col-span-2">
              <Label>Justification</Label>
              <Textarea
                value={form.justification}
                onChange={(e) => {
                  clearFieldError("justification");
                  setForm((prev) => ({ ...prev, justification: e.target.value }));
                }}
                required
              />
              {fieldErrors.justification ? <p className="text-xs text-red-600">{fieldErrors.justification}</p> : null}
            </div>
          ) : null}
          </>
          )}

          {currentStep === 1 && (
            <>
              <div className="space-y-1.5">
                <Label>Arrival Date</Label>
            <Input
              type="date"
              value={form.arrival_date}
              min={todayStr}
              max={maxArrivalStr}
              onChange={(e) => {
                clearFieldError("arrival_date");
                let arrivalDate = e.target.value;
                if (!arrivalDate) {
                  setForm((prev) => ({ ...prev, arrival_date: arrivalDate }));
                  return;
                }
                if (arrivalDate < todayStr) {
                  arrivalDate = todayStr;
                }
                if (arrivalDate > maxArrivalStr) {
                  arrivalDate = maxArrivalStr;
                }
                const departure = addDays(parseLocalDate(arrivalDate), form.stay_days);
                const nextDeparture = format(departure, "yyyy-MM-dd");
                setForm((prev) => ({
                  ...prev,
                  arrival_date: arrivalDate,
                  departure_date: nextDeparture,
                  guests: prev.guests.map((guest) => ({
                    ...guest,
                    arrival_date: guest.arrival_date < arrivalDate ? arrivalDate : guest.arrival_date,
                    departure_date: guest.departure_date > nextDeparture ? nextDeparture : guest.departure_date,
                  })),
                  food_reservations: prev.food_reservations.filter(
                    (reservation) => reservation.date >= arrivalDate && reservation.date <= nextDeparture
                  ),
                }));
              }}
              required
            />
            {fieldErrors.arrival_date ? <p className="text-xs text-red-600">{fieldErrors.arrival_date}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label>Arrival Time (24-hour)</Label>
            <Input
              type="time"
              value={splitTime(form.arrival_time).time}
              onChange={(e) => setForm((prev) => ({ ...prev, arrival_time: buildTime(e.target.value) }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Stay Days</Label>
            <Input
              type="number"
              min={1}
              value={form.stay_days}
              onChange={(e) => {
                clearFieldError("stay_days");
                updateStayDays(Number(e.target.value));
              }}
              required
            />
            {fieldErrors.stay_days ? <p className="text-xs text-red-600">{fieldErrors.stay_days}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label>Departure Date</Label>
            <Input
              type="date"
              value={form.departure_date}
              disabled
              required
            />
            {fieldErrors.departure_date ? <p className="text-xs text-red-600">{fieldErrors.departure_date}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label>Departure Time (24-hour)</Label>
            <Input
              type="time"
              value={splitTime(form.departure_time).time}
              onChange={(e) => setForm((prev) => ({ ...prev, departure_time: buildTime(e.target.value) }))}
              required
            />
          </div>
          </>
          )}

          {currentStep === 2 && (
            <>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
              <Label>Guest List</Label>
              <Button type="button" variant="outline" onClick={handleAddGuest}>
                Add Guest
              </Button>
            </div>
            {form.guests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No guest details added yet.</p>
            ) : (
              <div className="grid gap-3">
                {form.guests.map((guest) => (
                  <div key={guest.id} className="grid gap-3 rounded border bg-white p-3 md:grid-cols-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Guest Name</Label>
                      <Input
                        value={guest.name}
                        onChange={(e) => handleGuestChange(guest.id, "name", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Gender</Label>
                      <Select
                        value={guest.gender}
                        onValueChange={(value: "Male" | "Female" | "Child") =>
                          handleGuestChange(guest.id, "gender", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Child">Child</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Age</Label>
                      <Input
                        type="number"
                        min={0}
                        max={guest.gender === "Child" ? 10 : undefined}
                        value={guest.age}
                        onChange={(e) => handleGuestChange(guest.id, "age", e.target.value)}
                      />
                      {guest.gender === "Child" ? (
                        <p className="text-xs text-muted-foreground">Child age must be 10 or below.</p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Guest Arrival Date</Label>
                      <Input
                        type="date"
                        min={form.arrival_date}
                        max={form.departure_date}
                        value={guest.arrival_date}
                        onChange={(e) => handleGuestChange(guest.id, "arrival_date", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Guest Arrival Time</Label>
                      <Input
                        type="time"
                        value={splitTime(guest.arrival_time).time}
                        onChange={(e) => handleGuestChange(guest.id, "arrival_time", buildTime(e.target.value))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Guest Departure Date</Label>
                      <Input
                        type="date"
                        min={guest.arrival_date || form.arrival_date}
                        max={form.departure_date}
                        value={guest.departure_date}
                        onChange={(e) => handleGuestChange(guest.id, "departure_date", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Guest Departure Time</Label>
                      <Input
                        type="time"
                        value={splitTime(guest.departure_time).time}
                        onChange={(e) => handleGuestChange(guest.id, "departure_time", buildTime(e.target.value))}
                        required
                      />
                    </div>
                    <div className="md:col-span-4">
                      <Button type="button" variant="ghost" onClick={() => handleRemoveGuest(guest.id)}>
                        Remove Guest
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 md:col-span-2">
            <div className="space-y-1.5">
              <Label>Male</Label>
              <Input
                type="number"
                min={0}
                value={form.guests.length > 0 ? derivedCounts.male : form.male_count}
                disabled
              />
            </div>
            <div className="space-y-1.5">
              <Label>Female</Label>
              <Input
                type="number"
                min={0}
                value={form.guests.length > 0 ? derivedCounts.female : form.female_count}
                disabled
              />
            </div>
            <div className="space-y-1.5">
              <Label>Children</Label>
              <Input
                type="number"
                min={0}
                value={form.guests.length > 0 ? derivedCounts.children : form.children_count}
                disabled
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground md:col-span-2">
            Counts are auto-calculated from the guest list. Children age must be less than 10.
          </p>

          <div className="rounded-md border bg-secondary/40 p-3 md:col-span-2">
            <p className="text-sm font-semibold">Total Guests: {totalGuests}</p>
            <p className="text-sm text-muted-foreground">
              Rooms Required: {roomsRequired}{" "}
              <span className="text-xs text-muted-foreground">
                (Suggested: {suggestedRoomsRequired})
              </span>
            </p>
            {form.guests.length > 0 ? (
              <p className="text-xs text-muted-foreground">Guest counts are auto-calculated from the guest list.</p>
            ) : null}
          </div>
          </>
          )}

          {currentStep === 3 && (
            <>
              <div className="space-y-2 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Services Required</Label>
              <Button
                type="button"
                variant="outline"
                className="border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
                onClick={() => setShowFoodReservations(true)}
              >
                Arrange Food
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {serviceOptions.map((service) => {
                const checked = form.services_required.includes(service);
                return (
                  <label key={service} className="flex items-center gap-2 rounded border bg-white p-2 text-sm">
                    <Checkbox checked={checked} onCheckedChange={(value) => handleServiceToggle(service, Boolean(value))} />
                    {service}
                  </label>
                );
              })}
            </div>
            <div className="rounded-md border bg-sky-50/50 p-3 text-sm">
              <p className="font-medium">
                Food reservations: {form.food_reservations.length} row(s), {totalFoodCoverCount} total covers
              </p>
              <p className="text-xs text-muted-foreground">
                Food rows are optional. Use Arrange Food only for special occasions or when exact meal counts are needed.
              </p>
            </div>
            {fieldErrors.food_reservations ? (
              <p className="text-xs text-red-600">{fieldErrors.food_reservations}</p>
            ) : null}
          </div>

          {form.services_required.includes("Room") ? (
            <div className="space-y-2 md:col-span-2">
              <Label>Room Selection</Label>
              <div className="space-y-2">
                {roomConfigurations.map((room) => {
                  return (
                    <div
                      key={room.label}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-white p-3"
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium">Room – {room.label}</div>
                        <div className="text-xs text-muted-foreground">INR {room.rate}/night</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Required number</span>
                        <Select
                          value={String(form.room_selection[room.label])}
                          onValueChange={(value) => {
                            const parsed = Number(value);
                            clearFieldError("rooms_required");
                            setForm((prev) => ({
                              ...prev,
                              room_selection: {
                                ...prev.room_selection,
                                [room.label]: Number.isFinite(parsed) ? parsed : prev.room_selection[room.label],
                              },
                            }));
                          }}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0 Rooms</SelectItem>
                            {[1, 2, 3].map((count) => (
                              <SelectItem key={count} value={String(count)}>
                                {count} {count === 1 ? "Room" : "Rooms"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
              {fieldErrors.rooms_required ? (
                <p className="text-xs text-red-600">{fieldErrors.rooms_required}</p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Suggested based on guest list: {suggestedRoomsRequired} room(s).
                </p>
                <Button
                  type="button"
                  variant={showSpecialRequests ? "secondary" : "outline"}
                  className="border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                  onClick={() => setShowSpecialRequests((prev) => !prev)}
                >
                  Special Requests
                </Button>
              </div>
              {showSpecialRequests ? (
                <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50/40 p-3">
                  <Label>Special Requests</Label>
                  <Textarea
                    value={form.special_requests}
                    onChange={(e) => {
                      clearFieldError("special_requests");
                      setForm((prev) => ({ ...prev, special_requests: e.target.value }));
                    }}
                  />
                  {fieldErrors.special_requests ? (
                    <p className="text-xs text-red-600">{fieldErrors.special_requests}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button type="button" variant="secondary" onClick={estimateCost}>
              Estimate Total Cost
            </Button>
            {estimatedCost !== null ? (
              <p className="text-sm font-semibold">Estimated Cost: INR {estimatedCost.toLocaleString()}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Estimate uses room configuration rate and selected meals per guest per day.
              </p>
            )}
          </div>

          </>
          )}

          {currentStep === 4 && (
            <>
              <div className="md:col-span-2 space-y-4">
                <div className="rounded-lg border bg-slate-50 p-4 shadow-sm">
                  <p className="text-lg font-semibold">Final review</p>
                  <p className="text-sm text-muted-foreground">Review your completed booking details before submitting.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3 rounded-lg border bg-white p-4">
                    <p className="text-sm font-semibold">Booking details</p>
                    <div className="grid gap-2 text-sm text-slate-700">
                      <div><span className="font-medium">Initiator:</span> {form.guest_name || "—"}</div>
                      <div><span className="font-medium">Email:</span> {form.guest_email || "—"}</div>
                      <div><span className="font-medium">Phone:</span> {form.guest_phone || "—"}</div>
                      <div><span className="font-medium">Purpose:</span> {form.purpose}</div>
                      {form.purpose === "Official" ? (
                        <div><span className="font-medium">Justification:</span> {form.justification || "—"}</div>
                      ) : null}
                      <div><span className="font-medium">Meal plan:</span> {form.meal_plan}</div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border bg-white p-4">
                    <p className="text-sm font-semibold">Address</p>
                    <div className="grid gap-2 text-sm text-slate-700">
                      <div>{form.guest_address || "—"}</div>
                      <div>
                        {form.guest_city || "—"}, {form.guest_state || "—"} {form.guest_pincode || ""}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3 rounded-lg border bg-white p-4">
                    <p className="text-sm font-semibold">Stay details</p>
                    <div className="grid gap-2 text-sm text-slate-700">
                      <div><span className="font-medium">Arrival:</span> {form.arrival_date} at {form.arrival_time}</div>
                      <div><span className="font-medium">Departure:</span> {form.departure_date} at {form.departure_time}</div>
                      <div><span className="font-medium">Stay days:</span> {form.stay_days}</div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border bg-white p-4">
                    <p className="text-sm font-semibold">Guest summary</p>
                    <div className="grid gap-2 text-sm text-slate-700">
                      <div><span className="font-medium">Male:</span> {derivedCounts.male}</div>
                      <div><span className="font-medium">Female:</span> {derivedCounts.female}</div>
                      <div><span className="font-medium">Children:</span> {derivedCounts.children}</div>
                      <div><span className="font-medium">Total guests:</span> {totalGuests}</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3 rounded-lg border bg-white p-4">
                    <p className="text-sm font-semibold">Room & food</p>
                    <div className="grid gap-2 text-sm text-slate-700">
                      <div><span className="font-medium">Services:</span> {form.services_required.join(", ") || "—"}</div>
                      {form.services_required.includes("Room") ? (
                        <div>
                          <span className="font-medium">Rooms:</span> {roomsRequired} selected
                        </div>
                      ) : null}
                      {form.special_requests ? (
                        <div><span className="font-medium">Special requests:</span> {form.special_requests}</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border bg-white p-4">
                    <p className="text-sm font-semibold">Cost preview</p>
                    <div className="grid gap-2 text-sm text-slate-700">
                      <div><span className="font-medium">Estimated cost:</span> {estimatedCost !== null ? `INR ${estimatedCost.toLocaleString()}` : "Not estimated"}</div>
                      <div className="text-xs text-muted-foreground">Use Estimate Total Cost before submit to confirm pricing.</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2">
              {!isFirstStep ? (
                <Button type="button" variant="outline" onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}>
                  Back
                </Button>
              ) : null}
            </div>
            <div className="ml-auto flex gap-2">
              {!isLastStep ? (
                <Button
                  type="button"
                  disabled={!validateStep(currentStep)}
                  onClick={() => setCurrentStep((prev) => Math.min(prev + 1, stepLabels.length - 1))}
                  className="ml-auto disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    if (loading) return;
                    setSubmitConfirmation("");
                    setShowSubmitConfirm(true);
                  }}
                >
                  {loading ? "Submitting..." : "Submit Booking"}
                </Button>
              )}
            </div>
          </div>

          {message ? <p className="text-sm font-medium text-emerald-600">{message}</p> : null}
          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
        </div>
        </form>
      </CardContent>
      {currentStep === reviewStepIndex && showSubmitConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border bg-white p-6 shadow-2xl">
            <div className="space-y-2">
              <p className="text-lg font-semibold text-slate-900">Confirm booking submission</p>
              <p className="text-sm text-slate-600">
                Please confirm that you have reviewed the booking and all of the details are correct before submitting.
              </p>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-800">
                <input
                  type="radio"
                  name="booking-confirmation"
                  className="mt-1 h-4 w-4 accent-sky-600"
                  checked={submitConfirmation === "YES"}
                  onChange={() => setSubmitConfirmation("YES")}
                />
                <span>I have carefully reviewed details and all of the details are correct.</span>
              </label>
              <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm text-slate-600">
                <input
                  type="radio"
                  name="booking-confirmation"
                  className="mt-1 h-4 w-4 accent-sky-600"
                  checked={submitConfirmation === "NO"}
                  onChange={() => setSubmitConfirmation("NO")}
                />
                <span>No, let me go back and review the form again.</span>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowSubmitConfirm(false);
                  setSubmitConfirmation("");
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCurrentStep(reviewStepIndex);
                  setShowSubmitConfirm(false);
                  setSubmitConfirmation("");
                }}
                disabled={loading}
              >
                Review Again
              </Button>
              <Button
                type="button"
                onClick={() => void submitBooking()}
                disabled={loading || submitConfirmation !== "YES"}
              >
                {loading ? "Submitting..." : "Confirm Submit"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {showFoodReservations ? (
        <div className="gh-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="gh-scale-in w-full max-w-5xl rounded-lg border bg-white shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="font-semibold">Food Reservation Planner</p>
                <p className="text-xs text-muted-foreground">
                  Reserve meals by date and headcount, even when no room stay is needed.
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={() => setShowFoodReservations(false)}>
                Close
              </Button>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Booking window: {form.arrival_date} {form.arrival_time} to {form.departure_date} {form.departure_time}
                </p>
                <Button type="button" onClick={handleAddFoodReservation}>
                  Add Food Row
                </Button>
              </div>
              {form.food_reservations.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                  No food rows added yet. Add rows for the exact dates and meal headcounts you need.
                </div>
              ) : (
                <div className="grid gap-3">
                  {form.food_reservations.map((reservation) => (
                    <div
                      key={reservation.id}
                      className="grid gap-3 rounded-lg border bg-slate-50 p-3 md:grid-cols-[1.2fr_1fr_1fr_1.8fr_auto]"
                    >
                      <div className="space-y-1.5">
                        <Label>Date</Label>
                        <Select
                          value={reservation.date}
                          onValueChange={(value) => handleFoodReservationChange(reservation.id, "date", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select date" />
                          </SelectTrigger>
                          <SelectContent>
                            {bookingDateOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Meal</Label>
                        <Select
                          value={reservation.meal_type}
                          onValueChange={(value: "Breakfast" | "Lunch" | "Dinner") =>
                            handleFoodReservationChange(reservation.id, "meal_type", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select meal" />
                          </SelectTrigger>
                          <SelectContent>
                            {(["Breakfast", "Lunch", "Dinner"] as const).map((meal) => (
                              <SelectItem key={meal} value={meal}>
                                {meal}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>People</Label>
                        <Input
                          type="number"
                          min={1}
                          value={reservation.head_count}
                          onChange={(e) => handleFoodReservationChange(reservation.id, "head_count", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Notes</Label>
                        <Input
                          value={reservation.notes}
                          placeholder="VIP lunch / external guests / etc."
                          onChange={(e) => handleFoodReservationChange(reservation.id, "notes", e.target.value)}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button type="button" variant="ghost" onClick={() => handleRemoveFoodReservation(reservation.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="rounded-md border bg-secondary/30 p-3">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="space-y-1.5">
                    <Label>Meal Plan</Label>
                    <Select
                      value={form.meal_plan}
                      onValueChange={(value: BookingState["meal_plan"]) => {
                        clearFieldError("meal_plan");
                        setForm((prev) => ({ ...prev, meal_plan: value }));
                      }}
                    >
                      <SelectTrigger className="min-w-44">
                        <SelectValue placeholder="Select plan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="Special">Special</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Breakfast INR {mealRates[form.meal_plan].Breakfast}, Lunch INR {mealRates[form.meal_plan].Lunch},
                    Dinner INR {mealRates[form.meal_plan].Dinner}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <ToastBanner
        open={Boolean(toast)}
        title={toast?.title || ""}
        description={toast?.description}
        tone={toast?.tone}
        onClose={() => setToast(null)}
      />
    </Card>
  );
}
