"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
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

const clockPositions = Array.from({ length: 12 }, (_, index) => {
  const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
  return { index, angle };
});

const meridiemOptions = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
] as const;

function splitTime(value: string) {
  const trimmed = value.trim();
  const parts = trimmed.split(/\s+/);
  const time = parts[0] || "12:00";
  const meridiem = (parts[1] || "PM").toUpperCase();
  return {
    time,
    meridiem: meridiem === "AM" ? "AM" : "PM",
  };
}

function buildTime(time: string, meridiem: "AM" | "PM") {
  return `${time} ${meridiem}`;
}

function TimeClockPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const parts = useMemo(() => splitTime(value), [value]);
  const [rawHour, rawMinute] = parts.time.split(":");
  const hour = Math.min(12, Math.max(1, Number(rawHour) || 12));
  const minute = Math.min(59, Math.max(0, Number(rawMinute) || 0));
  const hourLabel = String(hour);
  const minuteLabel = String(minute).padStart(2, "0");
  const currentValue = `${hourLabel}:${minuteLabel} ${parts.meridiem}`;

  function setHour(nextHour: number) {
    onChange(buildTime(`${nextHour}:${minuteLabel}`, parts.meridiem as "AM" | "PM"));
    setMode("minute");
  }

  function setMinute(nextMinute: number) {
    const safeMinute = String(nextMinute).padStart(2, "0");
    onChange(buildTime(`${hourLabel}:${safeMinute}`, parts.meridiem as "AM" | "PM"));
  }

  function setMeridiem(next: "AM" | "PM") {
    onChange(buildTime(`${hourLabel}:${minuteLabel}`, next));
  }

  const size = 200;
  const radius = 78;
  const center = size / 2;
  const buttonSize = 30;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={() => setOpen((prev) => !prev)}>
          {currentValue}
        </Button>
        <div className="flex items-center gap-2">
          {meridiemOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={parts.meridiem === option.value ? "secondary" : "outline"}
              onClick={() => setMeridiem(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
      {open ? (
        <div className="rounded-md border bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {mode === "hour" ? "Select Hour" : "Select Minute"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={mode === "hour" ? "secondary" : "outline"}
                onClick={() => setMode("hour")}
              >
                Hour
              </Button>
              <Button
                type="button"
                variant={mode === "minute" ? "secondary" : "outline"}
                onClick={() => setMode("minute")}
              >
                Minute
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
          <div
            className="relative mx-auto mt-3 rounded-full border bg-slate-50"
            style={{ width: size, height: size }}
          >
            {clockPositions.map(({ index, angle }) => {
              const x = center + radius * Math.cos(angle) - buttonSize / 2;
              const y = center + radius * Math.sin(angle) - buttonSize / 2;
              const hourValue = index + 1;
              const minuteValue = index * 5;
              const isSelected =
                mode === "hour" ? hourValue === hour : minuteValue === Math.round(minute / 5) * 5;
              const label = mode === "hour"
                ? String(hourValue)
                : String(minuteValue).padStart(2, "0");
              return (
                <button
                  key={`${mode}-${index}`}
                  type="button"
                  className={`absolute flex items-center justify-center rounded-full text-sm font-medium transition ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                  style={{ width: buttonSize, height: buttonSize, left: x, top: y }}
                  onClick={() =>
                    mode === "hour" ? setHour(hourValue) : setMinute(minuteValue)
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}


interface BookingFormProps {
  onCreated?: () => void;
}

interface BookingState {
  guest_name: string;
  guest_phone: string;
  guest_address: string;
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
  guest_phone: "",
  guest_address: "",
  room_configuration: "",
  meal_plan: "General",
  extra_bed: false,
  guests: [],
  purpose: "Official",
  justification: "",
  arrival_date: format(new Date(), "yyyy-MM-dd"),
  arrival_time: "12:00 PM",
  departure_date: format(addDays(new Date(), 1), "yyyy-MM-dd"),
  departure_time: "10:00 AM",
  stay_days: 1,
  male_count: 1,
  female_count: 0,
  children_count: 0,
  services_required: ["Room"],
  booking_cost_center: "",
};

export function BookingForm({ onCreated }: BookingFormProps) {
  const [form, setForm] = useState<BookingState>(initialState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);

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
  const hasChildren = derivedCounts.children > 0;
  const roomsRequired = useMemo(() => {
    if (!form.services_required.includes("Room")) return 0;
    const capacity =
      form.room_configuration === "Triple Bed"
        ? 3
        : form.room_configuration === "Double Bed" || form.room_configuration === "Twin Sharing"
          ? 2
          : 2;
    return Math.max(1, Math.ceil(totalGuests / capacity));
  }, [form.services_required, form.room_configuration, totalGuests]);

  useEffect(() => {
    if (!hasChildren && form.extra_bed) {
      setForm((prev) => ({ ...prev, extra_bed: false }));
    }
  }, [hasChildren, form.extra_bed]);


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
        guest.id === id ? { ...guest, [key]: value } : guest,
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
    const departure = addDays(new Date(form.arrival_date), safeDays);
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
        throw new Error(firstFieldError || data.detail || data.message || "Could not save booking");
      }
      setMessage("Booking submitted and marked as PENDING_APPROVAL.");
      setForm(initialState);
      setEstimatedCost(null);
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
            <Label>Guest Full Name</Label>
            <Input
              value={form.guest_name}
              onChange={(e) => setForm((prev) => ({ ...prev, guest_name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Guest Mobile No</Label>
            <Input
              type="tel"
              minLength={8}
              placeholder="Enter at least 8 digits"
              value={form.guest_phone}
              onChange={(e) => setForm((prev) => ({ ...prev, guest_phone: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Guest Address</Label>
            <Input
              value={form.guest_address}
              onChange={(e) => setForm((prev) => ({ ...prev, guest_address: e.target.value }))}
              required
            />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-base">*</span>
              <span className="font-semibold">
                Check in may be completed at any time However checkout must be strictly completed by 12:00 noon
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Room Configuration</Label>
            <Select
              value={form.room_configuration}
              onValueChange={(value: BookingState["room_configuration"]) =>
                setForm((prev) => ({ ...prev, room_configuration: value }))
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
              onValueChange={(value: "Official" | "Personal") => setForm((prev) => ({ ...prev, purpose: value }))}
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

          <div className="space-y-1.5 md:col-span-2">
            <Label>Justification</Label>
            <Textarea
              value={form.justification}
              onChange={(e) => setForm((prev) => ({ ...prev, justification: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Arrival Date</Label>
            <Input
              type="date"
              value={form.arrival_date}
              onChange={(e) => {
                const arrivalDate = e.target.value;
                const departure = addDays(new Date(arrivalDate), form.stay_days);
                setForm((prev) => ({
                  ...prev,
                  arrival_date: arrivalDate,
                  departure_date: format(departure, "yyyy-MM-dd"),
                }));
              }}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Arrival Time</Label>
            <TimeClockPicker
              value={form.arrival_time}
              onChange={(next) => setForm((prev) => ({ ...prev, arrival_time: next }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Stay Days</Label>
            <Input
              type="number"
              min={1}
              value={form.stay_days}
              onChange={(e) => updateStayDays(Number(e.target.value))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Departure Date</Label>
            <Input
              type="date"
              value={form.departure_date}
              onChange={(e) => setForm((prev) => ({ ...prev, departure_date: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Departure Time</Label>
            <TimeClockPicker
              value={form.departure_time}
              onChange={(next) => setForm((prev) => ({ ...prev, departure_time: next }))}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 md:col-span-2">
            <div className="space-y-1.5">
              <Label>Male</Label>
              <Input
                type="number"
                min={0}
                value={form.guests.length > 0 ? derivedCounts.male : form.male_count}
                disabled={form.guests.length > 0}
                onChange={(e) => setForm((prev) => ({ ...prev, male_count: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Female</Label>
              <Input
                type="number"
                min={0}
                value={form.guests.length > 0 ? derivedCounts.female : form.female_count}
                disabled={form.guests.length > 0}
                onChange={(e) => setForm((prev) => ({ ...prev, female_count: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Children</Label>
              <Input
                type="number"
                min={0}
                value={form.guests.length > 0 ? derivedCounts.children : form.children_count}
                disabled={form.guests.length > 0}
                onChange={(e) => setForm((prev) => ({ ...prev, children_count: Number(e.target.value) || 0 }))}
              />
            </div>
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
                        value={guest.age}
                        onChange={(e) => handleGuestChange(guest.id, "age", e.target.value)}
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

          <div className="space-y-1.5 md:col-span-2">
            <Label>Booking Cost Center</Label>
            <Input
              value={form.booking_cost_center}
              onChange={(e) => setForm((prev) => ({ ...prev, booking_cost_center: e.target.value }))}
              required
            />
            <p className="text-xs text-muted-foreground">Enter the cost center code for billing.</p>
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
