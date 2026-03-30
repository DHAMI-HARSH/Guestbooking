"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApprovalBadge, EstateBadge } from "@/components/dashboard/shared";
import { formatDisplayDate } from "@/lib/date";
import { parseServices } from "@/lib/utils";
import type { BookingRecord } from "@/lib/types";
import { BedDouble, X } from "lucide-react";

type BookingWithOwner = BookingRecord & {
  booking_owner_name?: string;
  booking_owner_department?: string;
};

export function EstatePrimaryPanel() {
  const [bookings, setBookings] = useState<BookingWithOwner[]>([]);
  const [selected, setSelected] = useState<BookingWithOwner | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allocatedRooms, setAllocatedRooms] = useState<string[]>([]);
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [roomHighlightId, setRoomHighlightId] = useState<number | null>(null);

  async function loadBookings() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch bookings");
      setBookings(data.bookings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBookings();
  }, []);

  useEffect(() => {
    if (!selected) {
      setAllocatedRooms([]);
      setAllocationError(null);
      return;
    }

    setAllocationLoading(true);
    setAllocationError(null);

    fetch(`/api/room-allocations?booking_id=${encodeURIComponent(String(selected.id))}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          const detail = data?.detail ? ` (${data.detail})` : "";
          throw new Error(`Failed to fetch room allocations${detail}`);
        }
        const rooms = (data.allocations ?? []).map((item: { room_number: string }) => item.room_number);
        setAllocatedRooms(rooms);
      })
      .catch((err) => {
        setAllocationError(err instanceof Error ? err.message : "Failed to fetch room allocations");
        setAllocatedRooms([]);
      })
      .finally(() => {
        setAllocationLoading(false);
      });
  }, [selected]);

  const guestListSummary = useMemo(() => {
    if (!selected?.guests) return "No guest list provided.";
    try {
      const parsed = JSON.parse(selected.guests) as Array<{
        name?: string;
        gender?: string;
        age?: string;
      }>;
      if (!Array.isArray(parsed) || parsed.length === 0) return "No guest list provided.";
      return parsed
        .map((guest) => `${guest.name || "Guest"} (${guest.gender || "N/A"}${guest.age ? `, ${guest.age}` : ""})`)
        .join(", ");
    } catch {
      return "Guest list unavailable.";
    }
  }, [selected]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estate Manager Primary Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadBookings} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const params = new URLSearchParams();
              if (selected) {
                params.set("booking", String(selected.id));
                params.set("from", String(selected.arrival_date).slice(0, 10));
                params.set("to", String(selected.departure_date).slice(0, 10));
              }
              const query = params.toString();
              const url = `/dashboard/room-allocation${query ? `?${query}` : ""}#room-allocation`;
              window.open(url, "_blank", "noopener,noreferrer");
            }}
          >
            Open Room Allocation
          </Button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Arrival Date</TableHead>
              <TableHead>Booked On</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Extras</TableHead>
              <TableHead>Booking Owner</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Approval Status</TableHead>
              <TableHead>Estate Status</TableHead>
              <TableHead>Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <Fragment key={booking.id}>
                <TableRow>
                  <TableCell>{formatDisplayDate(booking.arrival_date)}</TableCell>
                  <TableCell>
                    <div>{formatDisplayDate(booking.created_at)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(booking.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </TableCell>
                  <TableCell>{booking.guest_name}</TableCell>
                  <TableCell>{booking.guest_phone}</TableCell>
                  <TableCell>
                    {booking.extra_bed ? (
                      <span className="text-xs font-semibold text-emerald-700">Extra bed (Free)</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{booking.booking_owner_name}</TableCell>
                  <TableCell>{booking.booking_owner_department}</TableCell>
                  <TableCell>
                    <ApprovalBadge status={booking.approval_status} />
                  </TableCell>
                  <TableCell>
                    <EstateBadge status={booking.estate_status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={selected?.id === booking.id ? "destructive" : "outline"}
                        onClick={() => setSelected((prev) => (prev?.id === booking.id ? null : booking))}
                      >
                        {selected?.id === booking.id ? <X className="h-4 w-4" /> : "View"}
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 w-8 p-0"
                        variant="outline"
                        title="View allocated rooms"
                        onClick={() => {
                          setSelected(booking);
                          setRoomHighlightId(booking.id);
                        }}
                      >
                        <BedDouble className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {selected?.id === booking.id ? (
                  <TableRow>
                    <TableCell colSpan={10} className="bg-secondary/20">
                      <div className="rounded-lg border bg-secondary/10 p-4">
                        <h3 className="font-semibold">Booking #{selected.id} Details</h3>
                        <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
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
                            <span className="font-medium">Pincode:</span> {selected.guest_pincode}
                          </p>
                          <p>
                            <span className="font-medium">City:</span> {selected.guest_city}
                          </p>
                          <p>
                            <span className="font-medium">State:</span> {selected.guest_state}
                          </p>
                          <p>
                            <span className="font-medium">Purpose:</span> {selected.purpose}
                          </p>
                          <p>
                            <span className="font-medium">Room Preference:</span>{" "}
                            {selected.room_configuration || "Not specified"}
                          </p>
                          <p>
                            <span className="font-medium">Meal Plan:</span> {selected.meal_plan}
                          </p>
                          <p>
                            <span className="font-medium">Extra Bed:</span>{" "}
                            {selected.extra_bed ? "Yes (Free)" : "No"}
                          </p>
                          <p>
                            <span className="font-medium">Stay:</span> {selected.stay_days} day(s)
                          </p>
                          <p>
                            <span className="font-medium">Total Guests:</span> {selected.total_guests}
                          </p>
                          <p>
                            <span className="font-medium">Counts:</span> M {selected.male_count}, F{" "}
                            {selected.female_count}, C {selected.children_count}
                          </p>
                          <p>
                            <span className="font-medium">Rooms Required:</span> {selected.rooms_required}
                          </p>
                          <p>
                            <span className="font-medium">Arrival:</span>{" "}
                            {formatDisplayDate(selected.arrival_date)} {selected.arrival_time}
                          </p>
                          <p>
                            <span className="font-medium">Departure:</span>{" "}
                            {formatDisplayDate(selected.departure_date)} {selected.departure_time}
                          </p>
                          <p className="md:col-span-2">
                            <span className="font-medium">Services:</span>{" "}
                            {parseServices(selected.services_required).join(", ") || "None"}
                          </p>
                          <p className="md:col-span-2">
                            <span className="font-medium">Guest List:</span> {guestListSummary}
                          </p>
                          <p>
                            <span className="font-medium">Cost Center:</span> {selected.booking_cost_center}
                          </p>
                          <p>
                            <span className="font-medium">Estimated Cost:</span>{" "}
                            {selected.estimated_cost !== null
                              ? `INR ${Number(selected.estimated_cost).toLocaleString()}`
                              : "-"}
                          </p>
                          <p className="md:col-span-2">
                            <span className="font-medium">Justification:</span> {selected.justification}
                          </p>
                          <p className="md:col-span-2">
                            <span className="font-medium">Special Requests:</span>{" "}
                            {selected.special_requests?.trim() || "None"}
                          </p>
                          <p
                            className={`md:col-span-2 ${
                              roomHighlightId === selected.id
                                ? "rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1"
                                : ""
                            }`}
                          >
                            <span className="font-medium">Allocated Rooms:</span>{" "}
                            {allocationLoading
                              ? "Loading..."
                              : allocationError
                                ? allocationError
                                : allocatedRooms.length > 0
                                  ? allocatedRooms.join(", ")
                                  : "Not allocated yet"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
