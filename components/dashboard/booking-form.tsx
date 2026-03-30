"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface BookingState {
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  guest_address: string;
  guest_pincode: string;
  guest_city: string;
  guest_state: string;
  room_configuration: "Double Bed" | "Triple Bed" | "Twin Sharing" | "";
  meal_plan: "General" | "Special";
  extra_bed: boolean;
  guests: Array<{
    id: string;
    name: string;
    gender: "Male" | "Female" | "Child";
    age: string;
  }>;
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
  meal_plan: "General",
  extra_bed: false,
  guests: [],
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
  const hasChildren = derivedCounts.children > 0;
  const roomsRequired = useMemo(() => {
    if (!form.services_required.includes("Room")) return 0;
    const capacity =
      form.room_configuration === "Triple Bed"
        ? 3
        : form.room_configuration === "Double Bed" || form.room_configuration === "Twin Sharing"
          ? 2
          : 2;
    return Math.max(1, Math.ceil(adultGuests / capacity));
  }, [form.services_required, form.room_configuration, adultGuests]);

  useEffect(() => {
    if (!hasChildren && form.extra_bed) {
      setForm((prev) => ({ ...prev, extra_bed: false }));
    }
  }, [hasChildren, form.extra_bed]);

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
        const res = await fetch(`/api/pincode?pincode=${encodeURIComponent(pincode)}`);
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
        { id, name: "", gender: "Male", age: "" },
      ],
    }));
  }

  function handleGuestChange(
    id: string,
    key: "name" | "gender" | "age",
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
    const roomRate =
      roomConfigurations.find((room) => room.label === form.room_configuration)?.rate ?? 0;
    const roomCost = form.services_required.includes("Room")
      ? roomRate * roomsRequired * stayDays
      : 0;

    const mealPlanRates = mealRates[form.meal_plan];
    const mealCost = form.services_required.reduce((sum, service) => {
      if (service === "Breakfast" || service === "Lunch" || service === "Dinner") {
        return sum + mealPlanRates[service] * totalGuests * stayDays;
      }
      return sum;
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
    }));
  }

  function handleServiceToggle(service: string, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      services_required: checked
        ? [...prev.services_required, service]
        : prev.services_required.filter((item) => item !== service),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setFieldErrors({});

    try {
      const payload = {
        ...form,
        male_count: derivedCounts.male,
        female_count: derivedCounts.female,
        children_count: derivedCounts.children,
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
      setMessage("Booking submitted and marked as PENDING_APPROVAL.");
      setForm(initialState);
      setEstimatedCost(null);
      setPincodeStatus(null);
      setShowSpecialRequests(false);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit booking");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Guest Booking</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Booking Person Name</Label>
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
            <Label>Booking Person Email</Label>
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
              minLength={8}
              placeholder="Enter at least 8 digits"
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
            <Label>Guest Address</Label>
            <Input
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
          <div className="md:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSpecialRequests((prev) => !prev)}
            >
              Special Requests
            </Button>
            {showSpecialRequests ? (
              <div className="mt-2 space-y-1.5">
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
            <Label>Room Configuration</Label>
            <Select
              value={form.room_configuration}
              onValueChange={(value: BookingState["room_configuration"]) =>
                setForm((prev) => {
                  clearFieldError("room_configuration");
                  return { ...prev, room_configuration: value };
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select configuration" />
              </SelectTrigger>
              <SelectContent>
                {roomConfigurations.map((room) => (
                  <SelectItem key={room.label} value={room.label}>
                    {room.label} (INR {room.rate}/night)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.room_configuration ? (
              <p className="text-xs text-red-600">{fieldErrors.room_configuration}</p>
            ) : null}
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

          <div className="space-y-1.5">
            <Label>Arrival Date</Label>
            <Input
              type="date"
              value={form.arrival_date}
              onChange={(e) => {
                clearFieldError("arrival_date");
                const arrivalDate = e.target.value;
                if (!arrivalDate) {
                  setForm((prev) => ({ ...prev, arrival_date: arrivalDate }));
                  return;
                }
                const departure = addDays(parseLocalDate(arrivalDate), form.stay_days);
                setForm((prev) => ({
                  ...prev,
                  arrival_date: arrivalDate,
                  departure_date: format(departure, "yyyy-MM-dd"),
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
              onChange={(e) => {
                clearFieldError("departure_date");
                const value = e.target.value;
                if (!value) {
                  setForm((prev) => ({ ...prev, departure_date: value }));
                  return;
                }
                const stayDays = Math.max(
                  1,
                  differenceInCalendarDays(
                    parseLocalDate(value),
                    parseLocalDate(form.arrival_date)
                  )
                );
                setForm((prev) => ({
                  ...prev,
                  departure_date: value,
                  stay_days: stayDays,
                }));
              }}
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

          <div className="rounded-md border bg-secondary/40 p-3 md:col-span-2">
            <p className="text-sm font-semibold">Total Guests: {totalGuests}</p>
            <p className="text-sm text-muted-foreground">Rooms Required: {roomsRequired}</p>
            {form.extra_bed ? (
              <p className="text-xs font-medium text-emerald-700">Extra bed added (free of cost)</p>
            ) : null}
            {form.guests.length > 0 ? (
              <p className="text-xs text-muted-foreground">Guest counts are auto-calculated from the guest list.</p>
            ) : null}
          </div>

          {hasChildren ? (
            <div className="flex items-center gap-3 md:col-span-2">
              <Button
                type="button"
                variant={form.extra_bed ? "secondary" : "outline"}
                onClick={() => setForm((prev) => ({ ...prev, extra_bed: !prev.extra_bed }))}
              >
                {form.extra_bed ? "Remove Extra Bed" : "Add Extra Bed (Free)"}
              </Button>
              <p className="text-xs text-muted-foreground">Available only when children are included.</p>
            </div>
          ) : null}

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

          <div className="space-y-2 md:col-span-2">
            <Label>Services Required</Label>
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
          </div>

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

          {message ? <p className="text-sm font-medium text-emerald-600 md:col-span-2">{message}</p> : null}
          {error ? <p className="text-sm font-medium text-red-600 md:col-span-2">{error}</p> : null}

          <div className="md:col-span-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Booking"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
