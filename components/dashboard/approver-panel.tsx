"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApprovalBadge } from "@/components/dashboard/shared";
import { formatDisplayDate } from "@/lib/date";
import { parseServices } from "@/lib/utils";
import type { BookingRecord } from "@/lib/types";
import { X } from "lucide-react";

type BookingWithOwner = BookingRecord & {
  booking_owner_name?: string;
  booking_owner_department?: string;
};

type DecidedBooking = BookingWithOwner & {
  decision?: "Approved" | "Rejected";
  decided_at?: string;
};

interface ApproverPanelProps {
  onChanged?: () => void;
}

export function ApproverPanel({ onChanged }: ApproverPanelProps) {
  const [bookings, setBookings] = useState<BookingWithOwner[]>([]);
  const [selected, setSelected] = useState<BookingWithOwner | null>(null);
  const [decidedBookings, setDecidedBookings] = useState<DecidedBooking[]>([]);
  const [decidedSelected, setDecidedSelected] = useState<DecidedBooking | null>(null);
  const [decisionsLoading, setDecisionsLoading] = useState(false);
  const [decisionsError, setDecisionsError] = useState<string | null>(null);
  const [showDecisions, setShowDecisions] = useState(false);
  const [recentApprovals, setRecentApprovals] = useState<
    Array<{
      id: number;
      booking_id: number;
      decision: "Approved" | "Rejected";
      decided_at: string;
      guest_name: string;
      arrival_date: string;
    }>
  >([]);
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [allocatedRooms, setAllocatedRooms] = useState<string[]>([]);
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);

  const services = useMemo(() => {
    if (!selected) return [];
    return parseServices(selected.services_required);
  }, [selected]);

  const formatGuestList = useCallback((booking: BookingRecord | null) => {
    if (!booking?.guests) return "No guest list provided.";
    try {
      const parsed = JSON.parse(booking.guests) as Array<{
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
  }, []);

  const loadPending = useCallback(async (query?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set("guest_name", query);
      const res = await fetch(`/api/bookings?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load");
      setBookings(data.bookings ?? []);
      setSelected((previous) => {
        if (!previous) return previous;
        const nextSelected = (data.bookings ?? []).find((item: BookingWithOwner) => item.id === previous.id);
        return nextSelected ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecentApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/approval?limit=8");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load approvals");
      setRecentApprovals(data.approvals ?? []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadDecisions = useCallback(async () => {
    setDecisionsLoading(true);
    setDecisionsError(null);
    try {
      const res = await fetch("/api/approval?details=1&limit=25");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load decisions");
      setDecidedBookings(data.approvals ?? []);
      setDecidedSelected((previous) => {
        if (!previous) return previous;
        const nextSelected = (data.approvals ?? []).find((item: DecidedBooking) => item.id === previous.id);
        return nextSelected ?? null;
      });
    } catch (err) {
      setDecisionsError(err instanceof Error ? err.message : "Failed to load decisions");
    } finally {
      setDecisionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPending();
    void loadRecentApprovals();
  }, [loadPending, loadRecentApprovals]);

  const detailBooking = selected ?? decidedSelected;

  useEffect(() => {
    if (!detailBooking) {
      setAllocatedRooms([]);
      setAllocationError(null);
      return;
    }

    setAllocationLoading(true);
    setAllocationError(null);

    fetch(`/api/room-allocations?booking_id=${encodeURIComponent(String(detailBooking.id))}`)
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
  }, [detailBooking]);

  async function decide(bookingId: number, decision: "Approved" | "Rejected") {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, decision, remarks: remarks[bookingId] || "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || "Failed to submit decision");
      setMessage(`Booking #${bookingId} ${decision.toLowerCase()}.`);
      await loadPending(search);
      await loadRecentApprovals();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approving Authority Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="Search guest name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="outline" onClick={() => loadPending(search)}>
            Refresh
          </Button>
          <Button
            variant={showDecisions ? "secondary" : "outline"}
            onClick={() => {
              const next = !showDecisions;
              setShowDecisions(next);
              if (next) void loadDecisions();
            }}
          >
            {showDecisions ? "Hide My Decisions" : "View My Decisions"}
          </Button>
        </div>

        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking</TableHead>
              <TableHead>Booked On</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Extras</TableHead>
              <TableHead>Justification</TableHead>
              <TableHead>Booked By</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <Fragment key={booking.id}>
                <TableRow>
                  <TableCell>#{booking.id}</TableCell>
                  <TableCell>
                    <div>{formatDisplayDate(booking.created_at)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(booking.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{booking.guest_name}</div>
                    <div className="text-xs text-muted-foreground">{booking.guest_phone}</div>
                  </TableCell>
                  <TableCell>
                    {booking.extra_bed ? (
                      <span className="text-xs font-semibold text-emerald-700">Extra bed (Free)</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-sm">{booking.justification}</TableCell>
                  <TableCell>{booking.booking_owner_name}</TableCell>
                  <TableCell>{booking.booking_owner_department}</TableCell>
                  <TableCell>
                    <ApprovalBadge status={booking.approval_status} />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={selected?.id === booking.id ? "destructive" : "outline"}
                      onClick={() => setSelected((prev) => (prev?.id === booking.id ? null : booking))}
                    >
                      {selected?.id === booking.id ? <X className="h-4 w-4" /> : "Open"}
                    </Button>
                  </TableCell>
                </TableRow>
                {selected?.id === booking.id ? (
                  <TableRow>
                    <TableCell colSpan={9} className="bg-secondary/20">
                      <div className="space-y-4 rounded-lg border bg-secondary/10 p-4">
                        <h3 className="font-semibold">Booking #{selected.id} Details</h3>
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
                            <span className="font-medium">Arrival:</span> {formatDisplayDate(selected.arrival_date)}{" "}
                            {selected.arrival_time}
                          </p>
                          <p>
                            <span className="font-medium">Departure:</span> {formatDisplayDate(selected.departure_date)}{" "}
                            {selected.departure_time}
                          </p>
                          <p>
                            <span className="font-medium">Stay:</span> {selected.stay_days} day(s)
                          </p>
                          <p>
                            <span className="font-medium">Guests:</span> {selected.total_guests}
                          </p>
                          <p>
                            <span className="font-medium">Rooms Required:</span> {selected.rooms_required}
                          </p>
                          <p>
                            <span className="font-medium">Counts:</span> M {selected.male_count}, F {selected.female_count}, C{" "}
                            {selected.children_count}
                          </p>
                          <p className="md:col-span-2">
                            <span className="font-medium">Allocated Rooms:</span>{" "}
                            {allocationLoading
                              ? "Loading..."
                              : allocationError
                                ? allocationError
                                : allocatedRooms.length > 0
                                  ? allocatedRooms.join(", ")
                                  : "Not allocated yet"}
                          </p>
                          <p>
                            <span className="font-medium">Extra Bed:</span> {selected.extra_bed ? "Yes (Free)" : "No"}
                          </p>
                          <p className="md:col-span-2">
                            <span className="font-medium">Services:</span> {services.join(", ") || "None"}
                          </p>
                          <p className="md:col-span-2">
                            <span className="font-medium">Guest List:</span> {formatGuestList(selected)}
                          </p>
                          <p>
                            <span className="font-medium">Cost Center:</span> {selected.booking_cost_center}
                          </p>
                          <p>
                            <span className="font-medium">Estimated Cost:</span>{" "}
                            {selected.estimated_cost !== null ? `INR ${Number(selected.estimated_cost).toLocaleString()}` : "-"}
                          </p>
                          <p className="md:col-span-2">
                            <span className="font-medium">Justification:</span> {selected.justification}
                          </p>
                          <p className="md:col-span-2">
                            <span className="font-medium">Special Requests:</span>{" "}
                            {selected.special_requests?.trim() || "None"}
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Remarks</Label>
                          <Textarea
                            placeholder="Remarks"
                            value={remarks[selected.id] || ""}
                            onChange={(e) => setRemarks((prev) => ({ ...prev, [selected.id]: e.target.value }))}
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => decide(selected.id, "Approved")} disabled={loading}>
                            Approve
                          </Button>
                          <Button variant="destructive" onClick={() => decide(selected.id, "Rejected")} disabled={loading}>
                            Reject
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </TableBody>
        </Table>

        {showDecisions ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">My Accepted / Rejected Bookings</h3>
            {decisionsError ? <p className="text-sm text-red-600">{decisionsError}</p> : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Decided On</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Arrival</TableHead>
                  <TableHead>View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decisionsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Loading decisions...
                    </TableCell>
                  </TableRow>
                ) : decidedBookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      No decisions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  decidedBookings.map((booking) => (
                    <Fragment key={booking.id}>
                      <TableRow>
                        <TableCell>#{booking.id}</TableCell>
                        <TableCell>{booking.decision || "-"}</TableCell>
                        <TableCell>
                          {booking.decided_at ? formatDisplayDate(booking.decided_at) : "-"}
                        </TableCell>
                        <TableCell>{booking.guest_name}</TableCell>
                        <TableCell>{formatDisplayDate(booking.arrival_date)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={decidedSelected?.id === booking.id ? "destructive" : "outline"}
                            onClick={() =>
                              setDecidedSelected((prev) => (prev?.id === booking.id ? null : booking))
                            }
                          >
                            {decidedSelected?.id === booking.id ? <X className="h-4 w-4" /> : "View"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {decidedSelected?.id === booking.id ? (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-secondary/20">
                            <div className="space-y-4 rounded-lg border bg-secondary/10 p-4">
                              <h3 className="font-semibold">Booking #{decidedSelected.id} Details</h3>
                              <div className="grid gap-2 text-sm md:grid-cols-2">
                                <p>
                                  <span className="font-medium">Guest:</span> {decidedSelected.guest_name}
                                </p>
                                <p>
                                  <span className="font-medium">Phone:</span> {decidedSelected.guest_phone}
                                </p>
                                <p>
                                  <span className="font-medium">Address:</span> {decidedSelected.guest_address}
                                </p>
                                <p>
                                  <span className="font-medium">Pincode:</span> {decidedSelected.guest_pincode}
                                </p>
                                <p>
                                  <span className="font-medium">City:</span> {decidedSelected.guest_city}
                                </p>
                                <p>
                                  <span className="font-medium">State:</span> {decidedSelected.guest_state}
                                </p>
                                <p>
                                  <span className="font-medium">Purpose:</span> {decidedSelected.purpose}
                                </p>
                                <p>
                                  <span className="font-medium">Room Preference:</span>{" "}
                                  {decidedSelected.room_configuration || "Not specified"}
                                </p>
                                <p>
                                  <span className="font-medium">Meal Plan:</span> {decidedSelected.meal_plan}
                                </p>
                                <p>
                                  <span className="font-medium">Arrival:</span>{" "}
                                  {formatDisplayDate(decidedSelected.arrival_date)} {decidedSelected.arrival_time}
                                </p>
                                <p>
                                  <span className="font-medium">Departure:</span>{" "}
                                  {formatDisplayDate(decidedSelected.departure_date)} {decidedSelected.departure_time}
                                </p>
                                <p>
                                  <span className="font-medium">Stay:</span> {decidedSelected.stay_days} day(s)
                                </p>
                                <p>
                                  <span className="font-medium">Guests:</span> {decidedSelected.total_guests}
                                </p>
                                <p>
                                  <span className="font-medium">Rooms Required:</span> {decidedSelected.rooms_required}
                                </p>
                                <p>
                                  <span className="font-medium">Counts:</span> M {decidedSelected.male_count}, F{" "}
                                  {decidedSelected.female_count}, C {decidedSelected.children_count}
                                </p>
                                <p className="md:col-span-2">
                                  <span className="font-medium">Allocated Rooms:</span>{" "}
                                  {allocationLoading
                                    ? "Loading..."
                                    : allocationError
                                      ? allocationError
                                      : allocatedRooms.length > 0
                                        ? allocatedRooms.join(", ")
                                        : "Not allocated yet"}
                                </p>
                                <p>
                                  <span className="font-medium">Extra Bed:</span>{" "}
                                  {decidedSelected.extra_bed ? "Yes (Free)" : "No"}
                                </p>
                                <p className="md:col-span-2">
                                  <span className="font-medium">Services:</span>{" "}
                                  {parseServices(decidedSelected.services_required).join(", ") || "None"}
                                </p>
                                <p className="md:col-span-2">
                                  <span className="font-medium">Guest List:</span> {formatGuestList(decidedSelected)}
                                </p>
                                <p>
                                  <span className="font-medium">Cost Center:</span> {decidedSelected.booking_cost_center}
                                </p>
                                <p>
                                  <span className="font-medium">Estimated Cost:</span>{" "}
                                  {decidedSelected.estimated_cost !== null
                                    ? `INR ${Number(decidedSelected.estimated_cost).toLocaleString()}`
                                    : "-"}
                                </p>
                                <p className="md:col-span-2">
                                  <span className="font-medium">Justification:</span> {decidedSelected.justification}
                                </p>
                                <p className="md:col-span-2">
                                  <span className="font-medium">Special Requests:</span>{" "}
                                  {decidedSelected.special_requests?.trim() || "None"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : null}

        <div className="rounded-lg border bg-secondary/20 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Recent Decisions</p>
            <Button variant="ghost" size="sm" onClick={loadRecentApprovals}>
              Refresh
            </Button>
          </div>
          {recentApprovals.length === 0 ? (
            <p className="text-xs text-muted-foreground">No approvals yet.</p>
          ) : (
            <div className="mt-2 grid gap-2 text-sm">
              {recentApprovals.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-white px-3 py-2">
                  <div>
                    <p className="font-medium">#{item.booking_id} - {item.guest_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Arrival {formatDisplayDate(item.arrival_date)} - {formatDisplayDate(item.decided_at)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold">{item.decision}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

