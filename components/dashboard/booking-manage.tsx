"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApprovalBadge, EstateBadge } from "@/components/dashboard/shared";
import type { BookingRecord } from "@/lib/types";

type BookingWithOwner = BookingRecord & {
  booking_owner_name?: string;
  booking_owner_department?: string;
};

interface BookingManageProps {
  onChanged?: () => void;
}

export function BookingManage({ onChanged }: BookingManageProps) {
  const [arrivalDate, setArrivalDate] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [bookings, setBookings] = useState<BookingWithOwner[]>([]);
  const [editing, setEditing] = useState<BookingWithOwner | null>(null);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function searchBookings() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (arrivalDate) params.set("arrival_date", arrivalDate);
      if (guestName) params.set("guest_name", guestName);
      if (guestPhone) params.set("guest_phone", guestPhone);
      const res = await fetch(`/api/bookings?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Search failed");
      setBookings(data.bookings || []);
      setMessage(`${data.bookings?.length ?? 0} booking(s) found.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function updateBooking(payload: Partial<BookingWithOwner>) {
    if (!editing) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/bookings/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Update failed");
      setMessage("Booking updated successfully.");
      setEditing(null);
      setRemarks("");
      await searchBookings();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking(bookingId: number) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_status: "CANCELLED",
          cancellation_remarks: remarks || "Cancelled by booking owner.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Cancellation failed");
      setMessage("Booking cancelled.");
      await searchBookings();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancellation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cancellation / Modify Booking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Arrival Date</Label>
            <Input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Guest Name</Label>
            <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={searchBookings} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>
        </div>

        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Arrival</TableHead>
              <TableHead>Extras</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Estate</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell>{booking.id}</TableCell>
                <TableCell>{booking.guest_name}</TableCell>
                <TableCell>{booking.guest_phone}</TableCell>
                <TableCell>{String(booking.arrival_date).slice(0, 10)}</TableCell>
                <TableCell>
                  {booking.extra_bed ? (
                    <span className="text-xs font-semibold text-emerald-700">Extra bed (Free)</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <ApprovalBadge status={booking.approval_status} />
                </TableCell>
                <TableCell>
                  <EstateBadge status={booking.estate_status} />
                </TableCell>
                <TableCell className="space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(booking)}>
                    Modify
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => cancelBooking(booking.id)}
                  >
                    Cancel
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="space-y-1.5">
          <Label>Cancellation Remarks</Label>
          <Textarea
            placeholder="Enter remarks for cancellation, if needed."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>

        {editing ? (
          <div className="rounded-lg border bg-secondary/20 p-4">
            <h3 className="mb-3 font-semibold">Modify Booking #{editing.id}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Justification</Label>
                <Textarea
                  value={editing.justification}
                  onChange={(e) => setEditing((prev) => (prev ? { ...prev, justification: e.target.value } : prev))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cost Center</Label>
                <Input
                  value={editing.booking_cost_center}
                  onChange={(e) =>
                    setEditing((prev) => (prev ? { ...prev, booking_cost_center: e.target.value } : prev))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Stay Days</Label>
                <Input
                  type="number"
                  min={1}
                  value={editing.stay_days}
                  onChange={(e) => setEditing((prev) => (prev ? { ...prev, stay_days: Number(e.target.value) } : prev))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Departure Date</Label>
                <Input
                  type="date"
                  value={String(editing.departure_date).slice(0, 10)}
                  onChange={(e) => setEditing((prev) => (prev ? { ...prev, departure_date: e.target.value } : prev))}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() =>
                  updateBooking({
                    justification: editing.justification,
                    booking_cost_center: editing.booking_cost_center,
                    stay_days: editing.stay_days,
                    departure_date: String(editing.departure_date).slice(0, 10),
                  })
                }
                disabled={loading}
              >
                Save Changes
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
