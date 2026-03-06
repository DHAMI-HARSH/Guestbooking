"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { parseServices } from "@/lib/utils";
import { ApprovalBadge, EstateBadge } from "@/components/dashboard/shared";
import type { BookingRecord } from "@/lib/types";

type BookingWithOwner = BookingRecord & {
  booking_owner_name?: string;
  booking_owner_department?: string;
};

export function EstateSecondaryPanel() {
  const [bookings, setBookings] = useState<BookingWithOwner[]>([]);
  const [selected, setSelected] = useState<BookingWithOwner | null>(null);
  const [roomNumber, setRoomNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const services = useMemo(() => {
    if (!selected) return [];
    return parseServices(selected.services_required);
  }, [selected]);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ approval_status: "APPROVED" });
      const res = await fetch(`/api/bookings?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch bookings");
      setBookings(data.bookings ?? []);
      setSelected((previous) => {
        if (!previous) return previous;
        const nextSelected = (data.bookings ?? []).find((item: BookingWithOwner) => item.id === previous.id);
        return nextSelected ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  async function allocateRoom() {
    if (!selected || !roomNumber) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/room-allocation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: selected.id,
          room_number: roomNumber,
          allocation_status: "ALLOCATED",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Room allocation failed");
      setMessage(`Room ${roomNumber} allocated.`);
      setRoomNumber("");
      await loadBookings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Room allocation failed");
    } finally {
      setLoading(false);
    }
  }

  async function updateEstateStatus(status: "SERVICES_APPROVED" | "ESTATE_REJECTED") {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const payload: Record<string, string> = { estate_status: status };
      if (status === "ESTATE_REJECTED") {
        payload.cancellation_remarks = remarks || "Rejected by estate manager.";
      }

      const res = await fetch(`/api/bookings/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update estate status");
      setMessage(status === "SERVICES_APPROVED" ? "Services approved." : "Booking rejected by estate manager.");
      await loadBookings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update estate status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estate Manager Secondary / Admin</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" onClick={loadBookings} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Arrival</TableHead>
              <TableHead>Guests</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Estate</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell>#{booking.id}</TableCell>
                <TableCell>{booking.guest_name}</TableCell>
                <TableCell>{String(booking.arrival_date).slice(0, 10)}</TableCell>
                <TableCell>{booking.total_guests}</TableCell>
                <TableCell>
                  <ApprovalBadge status={booking.approval_status} />
                </TableCell>
                <TableCell>
                  <EstateBadge status={booking.estate_status} />
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => setSelected(booking)}>
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {selected ? (
          <div className="space-y-4 rounded-lg border bg-secondary/20 p-4">
            <h3 className="font-semibold">Booking #{selected.id}</h3>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p>
                <span className="font-medium">Guest:</span> {selected.guest_name}
              </p>
              <p>
                <span className="font-medium">Phone:</span> {selected.guest_phone}
              </p>
              <p>
                <span className="font-medium">Address:</span> {selected.guest_address}
              </p>
              <p>
                <span className="font-medium">Stay:</span> {selected.stay_days} day(s)
              </p>
              <p>
                <span className="font-medium">Counts:</span> M {selected.male_count}, F {selected.female_count}, C{" "}
                {selected.children_count}
              </p>
              <p>
                <span className="font-medium">Rooms Required:</span> {selected.rooms_required}
              </p>
              <p className="md:col-span-2">
                <span className="font-medium">Services:</span> {services.join(", ") || "None"}
              </p>
              <p className="md:col-span-2">
                <span className="font-medium">Justification:</span> {selected.justification}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label>Room Number</Label>
                <Input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="A-101" />
              </div>
              <div className="flex items-end">
                <Button onClick={allocateRoom} disabled={loading || !roomNumber}>
                  Allocate Room
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Rejection Remarks</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => updateEstateStatus("SERVICES_APPROVED")} disabled={loading}>
                Approve Services
              </Button>
              <Button variant="destructive" onClick={() => updateEstateStatus("ESTATE_REJECTED")} disabled={loading}>
                Reject Booking
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
