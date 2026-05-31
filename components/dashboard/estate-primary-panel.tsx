"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationBar } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApprovalBadge, EstateBadge } from "@/components/dashboard/shared";
import { TableFiltersBar, useTableControls, type TableFilterField } from "@/components/dashboard/table-controls";
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
  const [message, setMessage] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<string>("");
  const [allocatedRooms, setAllocatedRooms] = useState<string[]>([]);
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [roomHighlightId, setRoomHighlightId] = useState<number | null>(null);
  const filterFields: TableFilterField<BookingWithOwner>[] = [
    { key: "arrival_date", label: "Arrival Date", type: "date", accessor: (booking) => booking.arrival_date },
    { key: "created_at", label: "Booked On", type: "date", accessor: (booking) => booking.created_at },
    { key: "guest_name", label: "Guest", accessor: (booking) => booking.guest_name },
    { key: "booking_owner_name", label: "Booking Owner", accessor: (booking) => booking.booking_owner_name || "" },
    { key: "booking_owner_department", label: "Department", accessor: (booking) => booking.booking_owner_department || "" },
    { key: "approval_status", label: "Approval Status", accessor: (booking) => booking.approval_status },
    { key: "estate_status", label: "Estate Status", accessor: (booking) => booking.estate_status },
  ];
  const table = useTableControls({
    rows: bookings,
    filterFields,
    pageSize: 10,
  });

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

  async function decide(
    bookingId: number,
    approvalStatus: "APPROVED" | "REJECTED",
    cancellationRemarks?: string,
  ) {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const payload: { approval_status: string; cancellation_remarks?: string } = {
        approval_status: approvalStatus,
      };

      if (approvalStatus === "REJECTED") {
        payload.cancellation_remarks = cancellationRemarks || remarks || "Rejected by estate manager.";
      }

      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || "Failed to update booking");

      setMessage(`Booking #${bookingId} has been ${approvalStatus === "APPROVED" ? "approved" : "rejected"}.`);
      setRemarks("");
      await loadBookings();
      setSelected((prev) => {
        if (!prev || prev.id !== bookingId) return prev;
        return { ...prev, approval_status: approvalStatus };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update booking");
    } finally {
      setLoading(false);
    }
  }

  function canDecide(booking: BookingWithOwner) {
    return booking.approval_status === "PENDING_APPROVAL";
  }

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
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Estate Manager Primary Dashboard</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage booking allocations
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {/* Refresh and Room Allocation Buttons */}
        <div className="flex gap-2 items-center">
          <Button variant="outline" onClick={loadBookings} disabled={loading} size="sm">
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
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
            className="gap-2"
            size="sm"
          >
            <BedDouble className="h-4 w-4" />
            Open Room Allocation
          </Button>
          {message && <p className="text-sm text-emerald-600 ml-auto">{message}</p>}
          {error && <p className="text-sm text-red-600 ml-auto">{error}</p>}
        </div>

        {/* Table Section */}
        <TableFiltersBar
          search={table.search}
          onSearchChange={table.updateSearch}
          filterFields={filterFields}
          filterValues={table.filters}
          onFilterChange={table.updateFilter}
          onClear={table.clearFilters}
        />
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Arrival Date</TableHead>
                <TableHead>Booked On</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Booking Owner</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Approval Status</TableHead>
                <TableHead>Estate Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.pageRows.map((booking) => (
                <Fragment key={booking.id}>
                  <TableRow className="hover:bg-gray-50">
                    <TableCell className="text-sm">{formatDisplayDate(booking.arrival_date)}</TableCell>
                    <TableCell className="text-sm">
                      <div>{formatDisplayDate(booking.created_at)}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(booking.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{booking.guest_name}</TableCell>
                    <TableCell className="text-sm">{booking.booking_owner_name}</TableCell>
                    <TableCell className="text-sm">{booking.booking_owner_department}</TableCell>
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
                        {canDecide(booking) ? (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => void decide(booking.id, "APPROVED")}
                              disabled={loading}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelected(booking);
                                void decide(booking.id, "REJECTED", remarks || "Rejected by estate manager.");
                              }}
                              disabled={loading}
                            >
                              Reject
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Full Details Row - Expands below selected row */}
                  {selected?.id === booking.id && (
                    <TableRow className="bg-blue-50">
                      <TableCell colSpan={8} className="p-6">
                        <div className="rounded-lg border border-blue-200 bg-white p-4">
                          <h3 className="font-semibold text-lg mb-4">Booking #{selected.id} - Full Details</h3>
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {/* Guest Information */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-gray-700">Guest Information</h4>
                              <div className="space-y-1 text-sm">
                                <p><span className="font-medium">Name:</span> {selected.guest_name}</p>
                                <p><span className="font-medium">Email:</span> {selected.guest_email}</p>
                                <p><span className="font-medium">Phone:</span> {selected.guest_phone}</p>
                                <p><span className="font-medium">Address:</span> {selected.guest_address}</p>
                                <p><span className="font-medium">Pincode:</span> {selected.guest_pincode}</p>
                                <p><span className="font-medium">City:</span> {selected.guest_city}</p>
                                <p><span className="font-medium">State:</span> {selected.guest_state}</p>
                              </div>
                            </div>

                            {/* Booking Details */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-gray-700">Booking Details</h4>
                              <div className="space-y-1 text-sm">
                                <p><span className="font-medium">Purpose:</span> {selected.purpose}</p>
                                <p><span className="font-medium">Meal Plan:</span> {selected.meal_plan}</p>
                                <p><span className="font-medium">Extra Bed:</span> {selected.extra_bed ? "Yes (Free)" : "No"}</p>
                                <p><span className="font-medium">Cost Center:</span> {selected.booking_cost_center}</p>
                                <p><span className="font-medium">Estimated Cost:</span> {selected.estimated_cost !== null ? `INR ${Number(selected.estimated_cost).toLocaleString()}` : "-"}</p>
                              </div>
                            </div>

                            {/* Stay Information */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-gray-700">Stay Information</h4>
                              <div className="space-y-1 text-sm">
                                <p><span className="font-medium">Arrival:</span> {formatDisplayDate(selected.arrival_date)} {selected.arrival_time}</p>
                                <p><span className="font-medium">Departure:</span> {formatDisplayDate(selected.departure_date)} {selected.departure_time}</p>
                                <p><span className="font-medium">Duration:</span> {selected.stay_days} day(s)</p>
                                <p><span className="font-medium">Total Guests:</span> {selected.total_guests}</p>
                                <p><span className="font-medium">Breakdown:</span> M {selected.male_count}, F {selected.female_count}, C {selected.children_count}</p>
                              </div>
                            </div>

                            {/* Room Information */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-gray-700">Room Information</h4>
                              <div className="space-y-1 text-sm">
                                <p><span className="font-medium">Preference:</span> {selected.room_configuration || "Not specified"}</p>
                                <p><span className="font-medium">Rooms Required:</span> {selected.rooms_required}</p>
                                <p><span className="font-medium">Room Selection:</span> {selected.room_selection || "Not specified"}</p>
                              </div>
                            </div>

                            {/* Services and Allocations */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-gray-700">Services & Allocation</h4>
                              <div className="space-y-1 text-sm">
                                <p><span className="font-medium">Services:</span> {parseServices(selected.services_required).join(", ") || "None"}</p>
                                <p className={`rounded px-2 py-1 ${roomHighlightId === selected.id ? "bg-emerald-100 border border-emerald-300" : ""}`}>
                                  <span className="font-medium">Allocated Rooms:</span> {allocationLoading ? "Loading..." : allocationError ? allocationError : allocatedRooms.length > 0 ? allocatedRooms.join(", ") : "Not allocated yet"}
                                </p>
                              </div>
                            </div>

                            {/* Status Information */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-gray-700">Status</h4>
                              <div className="space-y-2">
                                <p><span className="font-medium">Approval:</span> <ApprovalBadge status={selected.approval_status} /></p>
                                <p><span className="font-medium">Estate:</span> <EstateBadge status={selected.estate_status} /></p>
                              </div>
                              {selected.approval_status === "PENDING_APPROVAL" ? (
                                <div className="space-y-4">
                                  <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-gray-700">Remarks</label>
                                    <textarea
                                      className="block w-full rounded border border-muted-foreground/20 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                      value={remarks}
                                      onChange={(event) => setRemarks(event.target.value)}
                                      placeholder="Optional remarks for rejection"
                                      rows={3}
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            {/* Additional Details */}
                            <div className="space-y-2 lg:col-span-3">
                              <h4 className="font-semibold text-sm text-gray-700">Additional Details</h4>
                              <div className="space-y-1 text-sm">
                                <p><span className="font-medium">Justification:</span> {selected.justification}</p>
                                <p><span className="font-medium">Special Requests:</span> {selected.special_requests?.trim() || "None"}</p>
                                <p><span className="font-medium">Guest List:</span> {guestListSummary}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        <PaginationBar pagination={table.pagination} onPageChange={table.setPage} loading={loading} />
      </CardContent>
    </Card>
  );
}
