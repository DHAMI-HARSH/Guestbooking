"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const serviceOptions = ["Room", "Breakfast", "Lunch", "Dinner"] as const;

interface BookingFormProps {
  onCreated?: () => void;
}

interface BookingState {
  guest_name: string;
  guest_phone: string;
  guest_address: string;
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
  purpose: "Official",
  justification: "",
  arrival_date: format(new Date(), "yyyy-MM-dd"),
  arrival_time: "12:00",
  departure_date: format(addDays(new Date(), 1), "yyyy-MM-dd"),
  departure_time: "10:00",
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

  const totalGuests = useMemo(
    () => form.male_count + form.female_count + form.children_count,
    [form.male_count, form.female_count, form.children_count],
  );
  const roomsRequired = useMemo(
    () => (form.services_required.includes("Room") ? Math.max(1, Math.ceil(totalGuests / 2)) : 0),
    [form.services_required, totalGuests],
  );

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
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not save booking");
      }
      setMessage("Booking submitted and marked as PENDING_APPROVAL.");
      setForm(initialState);
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
            <Label>Guest Cell No</Label>
            <Input
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
            <Input
              type="time"
              value={form.arrival_time}
              onChange={(e) => setForm((prev) => ({ ...prev, arrival_time: e.target.value }))}
              required
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
            <Input
              type="time"
              value={form.departure_time}
              onChange={(e) => setForm((prev) => ({ ...prev, departure_time: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3 md:col-span-2">
            <div className="space-y-1.5">
              <Label>Male</Label>
              <Input
                type="number"
                min={0}
                value={form.male_count}
                onChange={(e) => setForm((prev) => ({ ...prev, male_count: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Female</Label>
              <Input
                type="number"
                min={0}
                value={form.female_count}
                onChange={(e) => setForm((prev) => ({ ...prev, female_count: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Children</Label>
              <Input
                type="number"
                min={0}
                value={form.children_count}
                onChange={(e) => setForm((prev) => ({ ...prev, children_count: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="rounded-md border bg-secondary/40 p-3 md:col-span-2">
            <p className="text-sm font-semibold">Total Guests: {totalGuests}</p>
            <p className="text-sm text-muted-foreground">Rooms Required: {roomsRequired}</p>
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
