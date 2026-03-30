"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDisplayDate } from "@/lib/date";
import { parseServices } from "@/lib/utils";
import { ApprovalBadge, EstateBadge } from "@/components/dashboard/shared";
import { ROOM_MASTER } from "@/lib/room-master";
import type { BookingRecord, RoomAllocationRecord } from "@/lib/types";
import { X } from "lucide-react";

type BookingWithOwner = BookingRecord & {
  booking_owner_name?: string;
  booking_owner_department?: string;
};

type RoomAllocationWithBooking = RoomAllocationRecord & {
  arrival_date: string;
  departure_date: string;
  guest_name: string;
  estate_status: string;
  approval_status: string;
};

export function RoomAllocationPanel() {
  const [bookings, setBookings] = useState<BookingWithOwner[]>([]);
  const [selected, setSelected] = useState<BookingWithOwner | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [allocationFrom, setAllocationFrom] = useState("");
  const [allocationTo, setAllocationTo] = useState("");
  const [allocations, setAllocations] = useState<RoomAllocationWithBooking[]>([]);
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [pendingBookingId, setPendingBookingId] = useState<number | null>(null);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const services = useMemo(() => {
    if (!selected) return [];
    return parseServices(selected.services_required);
  }, [selected]);

  const roomsByFloor = useMemo(() => {
    const map = new Map<string, typeof ROOM_MASTER>();
    for (const room of ROOM_MASTER) {
      if (!map.has(room.floor)) {
        map.set(room.floor, []);
      }
      map.get(room.floor)?.push(room);
    }
    for (const entry of map.values()) {
      entry.sort((a, b) => Number(a.roomNumber) - Number(b.roomNumber));
    }
    return Array.from(map.entries());
  }, []);

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

  const loadAllocations = useCallback(async () => {
    if (!allocationFrom || !allocationTo) return;
    setAllocationLoading(true);
    setAllocationError(null);
    try {
      const params = new URLSearchParams({
        from: allocationFrom,
        to: allocationTo,
      });
      const res = await fetch(`/api/room-allocations?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        const detail = data?.detail ? ` (${data.detail})` : "";
        throw new Error(`Failed to fetch room allocations (${res.status}). ${data?.message || "Request failed"}${detail}`);
      }
      setAllocations(data.allocations ?? []);
    } catch (err) {
      setAllocationError(err instanceof Error ? err.message : "Failed to fetch room allocations");
    } finally {
      setAllocationLoading(false);
    }
  }, [allocationFrom, allocationTo]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const booking = params.get("booking");
    const from = params.get("from");
    const to = params.get("to");
    if (from) setAllocationFrom(from);
    if (to) setAllocationTo(to);
    if (booking && !Number.isNaN(Number(booking))) {
      setPendingBookingId(Number(booking));
    }
  }, []);

  useEffect(() => {
    if (!pendingBookingId || bookings.length === 0) return;
    const match = bookings.find((item) => item.id === pendingBookingId);
    if (match) {
      setSelected(match);
    }
    setPendingBookingId(null);
  }, [bookings, pendingBookingId]);

  useEffect(() => {
    if (!selected) return;
    setAllocationFrom(String(selected.arrival_date).slice(0, 10));
    setAllocationTo(String(selected.departure_date).slice(0, 10));
    setSelectedRooms([]);
  }, [selected]);

  useEffect(() => {
    void loadAllocations();
  }, [loadAllocations]);

  useEffect(() => {
    if (!selected) return;
    const existing = allocations.find((item) => item.booking_id === selected.id);
    if (existing) {
      setSelectedRooms([]);
    }
  }, [allocations, selected]);

  const occupiedByRoom = useMemo(() => {
    const map = new Map<string, RoomAllocationWithBooking[]>();
    for (const allocation of allocations) {
      const list = map.get(allocation.room_number) ?? [];
      list.push(allocation);
      map.set(allocation.room_number, list);
    }
    return map;
  }, [allocations]);

  const allocatedForBooking = useMemo(() => {
    if (!selected) return [];
    return allocations.filter((item) => item.booking_id === selected.id);
  }, [allocations, selected]);

  const roomsRequired = selected?.rooms_required ?? 0;
  const remainingRooms = Math.max(0, roomsRequired - allocatedForBooking.length);

  async function allocateRoom() {
    if (!selected || selectedRooms.length === 0) return;
    if (remainingRooms === 0) {
      setError("All required rooms are already allocated. You can only cancel the booking.");
      return;
    }
    if (selectedRooms.length > remainingRooms) {
      setError(`You can only allocate ${remainingRooms} room(s) for this booking.`);
      return;
    }
    const conflicts = selectedRooms.filter((room) => (occupiedByRoom.get(room) ?? []).length > 0);
    if (conflicts.length > 0) {
      setError(`Room(s) ${conflicts.join(", ")} are occupied for the selected dates.`);
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const allocationsCreated: RoomAllocationWithBooking[] = [];
      for (const room of selectedRooms) {
        const res = await fetch("/api/room-allocation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking_id: selected.id,
            room_number: room,
            allocation_status: "ALLOCATED",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const detail = data?.detail ? ` (${data.detail})` : "";
          throw new Error(`Room ${room} allocation failed (${res.status}). ${data?.message || "Request failed"}${detail}`);
        }
        const allocation = data?.allocation as RoomAllocationRecord | undefined;
        if (allocation) {
          allocationsCreated.push({
            ...allocation,
            arrival_date: String(selected.arrival_date),
            departure_date: String(selected.departure_date),
            guest_name: selected.guest_name,
            estate_status: selected.estate_status,
            approval_status: selected.approval_status,
          });
        }
      }

      if (allocationsCreated.length > 0) {
        const from = allocationFrom;
        const to = allocationTo;
        const inRange =
          !from ||
          !to ||
          (String(selected.arrival_date).slice(0, 10) <= to &&
            String(selected.departure_date).slice(0, 10) >= from);
        setAllocations((prev) => {
          const filtered = prev.filter((item) => item.booking_id !== selected.id);
          return inRange ? [...filtered, ...allocationsCreated] : filtered;
        });
      }

      setMessage(`Allocated rooms: ${selectedRooms.join(", ")}.`);
      setSelectedRooms([]);
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
        payload.approval_status = "CANCELLED";
        payload.cancellation_remarks = remarks || "Rejected by estate manager.";
      }

      const res = await fetch(`/api/bookings/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data?.detail ? ` (${data.detail})` : "";
        throw new Error(`Failed to update estate status (${res.status}). ${data?.message || "Request failed"}${detail}`);
      }
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
        <CardTitle>Room Allocation</CardTitle>
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
              <TableHead>Booked On</TableHead>
              <TableHead>Guests</TableHead>
              <TableHead>Extras</TableHead>
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
                <TableCell>{formatDisplayDate(booking.arrival_date)}</TableCell>
                <TableCell>
                  <div>{formatDisplayDate(booking.created_at)}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(booking.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </TableCell>
                <TableCell>{booking.total_guests}</TableCell>
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
                <TableCell>
                  <Button
                    variant={selected?.id === booking.id ? "destructive" : "outline"}
                    size="sm"
                    onClick={() =>
                      setSelected((prev) => (prev?.id === booking.id ? null : booking))
                    }
                  >
                    {selected?.id === booking.id ? (
                      <X className="h-4 w-4" />
                    ) : (
                      "Open"
                    )}
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
              <p>
                <span className="font-medium">Extra Bed:</span>{" "}
                {selected.extra_bed ? "Yes (Free)" : "No"}
              </p>
              <p className="md:col-span-2">
                <span className="font-medium">Services:</span> {services.join(", ") || "None"}
              </p>
              <p className="md:col-span-2">
                <span className="font-medium">Justification:</span> {selected.justification}
              </p>
              <p className="md:col-span-2">
                <span className="font-medium">Special Requests:</span>{" "}
                {selected.special_requests?.trim() || "None"}
              </p>
            </div>

            <div id="room-allocation" className="space-y-3 rounded-md border bg-background/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Room Allocation Board</p>
                  <p className="text-xs text-muted-foreground">
                    Pick the stay dates to see availability. Green is free, red is occupied.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (selected) params.set("booking", String(selected.id));
                      if (allocationFrom) params.set("from", allocationFrom);
                      if (allocationTo) params.set("to", allocationTo);
                      const query = params.toString();
                      const url = `/dashboard/room-allocation${query ? `?${query}` : ""}#room-allocation`;
                      window.open(url, "_blank", "noopener,noreferrer");
                    }}
                  >
                    Open In New Window
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadAllocations}
                    disabled={allocationLoading || !allocationFrom || !allocationTo}
                  >
                    {allocationLoading ? "Loading..." : "Refresh Availability"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>From</Label>
                  <Input
                    type="date"
                    value={allocationFrom}
                    onChange={(e) => setAllocationFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>To</Label>
                  <Input
                    type="date"
                    value={allocationTo}
                    onChange={(e) => setAllocationTo(e.target.value)}
                  />
                </div>
              </div>

              {allocationError ? <p className="text-xs text-red-600">{allocationError}</p> : null}

              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-emerald-500/80" />
                  Available
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-red-500/80" />
                  Occupied
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm border border-amber-400" />
                  Selected
                </span>
                <span className="text-xs text-muted-foreground">
                  Required: {roomsRequired} | Allocated: {allocatedForBooking.length} | Remaining: {remainingRooms}
                </span>
              </div>

              <div className="space-y-4">
                {roomsByFloor.map(([floor, rooms]) => (
                  <div key={floor} className="space-y-2">
                    <p className="text-sm font-semibold">{floor}</p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                      {rooms.map((room) => {
                        const allocationsForRoom = occupiedByRoom.get(room.roomNumber) ?? [];
                        const occupiedByOther = allocationsForRoom.length > 0;
                        const isSelected = selectedRooms.includes(room.roomNumber);
                        const statusClass = occupiedByOther
                          ? "border-red-600 bg-red-500/20 text-red-700"
                          : "border-emerald-600 bg-emerald-500/20 text-emerald-800 hover:bg-emerald-500/30";
                        const tooltip = allocationsForRoom
                          .map(
                            (item) =>
                              `${item.guest_name} (${formatDisplayDate(item.arrival_date)} -> ${formatDisplayDate(
                                item.departure_date
                              )})`
                          )
                          .join(", ");

                        return (
                          <button
                            key={room.roomNumber}
                            type="button"
                            title={tooltip || "Available"}
                            className={`group relative flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold transition ${
                              statusClass
                            } ${isSelected ? "ring-2 ring-amber-400 ring-offset-2" : ""} ${
                              !selected || occupiedByOther || remainingRooms === 0
                                ? "cursor-not-allowed opacity-70"
                                : "cursor-pointer"
                            }`}
                            onClick={() => {
                              if (!selected || occupiedByOther || remainingRooms === 0) return;
                              setSelectedRooms((prev) => {
                                if (prev.includes(room.roomNumber)) {
                                  return prev.filter((item) => item !== room.roomNumber);
                                }
                              if (prev.length >= remainingRooms) {
                                setError(`You can only select ${remainingRooms} room(s) for this booking.`);
                                return prev;
                              }
                                return [...prev, room.roomNumber];
                              });
                            }}
                          >
                            <span className="text-sm">{room.roomNumber}</span>
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              {room.configuration}
                            </span>
                            {occupiedByOther ? (
                              <span className="text-[10px] font-medium text-red-700">Occupied</span>
                            ) : (
                              <span className="text-[10px] font-medium text-emerald-700">Free</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label>Selected Rooms</Label>
                <Input value={selectedRooms.join(", ")} readOnly placeholder="Select rooms above" />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={allocateRoom}
                  disabled={loading || selectedRooms.length === 0 || remainingRooms === 0}
                >
                  Allocate Room
                </Button>
              </div>
            </div>

            {remainingRooms === 0 ? (
              <p className="text-xs font-medium text-amber-700">
                All required rooms are already allocated. You can only cancel the booking.
              </p>
            ) : null}

            <div className="space-y-1.5">
              <Label>Rejection Remarks</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" onClick={() => updateEstateStatus("ESTATE_REJECTED")} disabled={loading}>
                Cancel Booking
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
