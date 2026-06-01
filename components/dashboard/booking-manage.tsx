"use client";

import { useEffect, useState } from "react";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { CalendarDays, FilterX, Phone, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationBar } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToastBanner, type ToastTone } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApprovalBadge, EstateBadge } from "@/components/dashboard/shared";
import { useTableControls, type TableFilterField } from "@/components/dashboard/table-controls";
import { formatDisplayDate } from "@/lib/date";
import type { BookingRecord } from "@/lib/types";

type BookingWithOwner = BookingRecord & {
  booking_owner_name?: string;
  booking_owner_department?: string;
};

interface BookingManageProps {
  onChanged?: () => void;
  refreshKey?: number;
}

export function BookingManage({ onChanged, refreshKey }: BookingManageProps) {
  const [arrivalDate, setArrivalDate] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [bookings, setBookings] = useState<BookingWithOwner[]>([]);
  const [editing, setEditing] = useState<BookingWithOwner | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; description?: string; tone?: ToastTone } | null>(null);

  const filterFields: TableFilterField<BookingWithOwner>[] = [
    { key: "guest_name", label: "Guest", accessor: (booking) => booking.guest_name },
    { key: "guest_phone", label: "Phone", accessor: (booking) => booking.guest_phone },
    { key: "arrival_date", label: "Arrival", type: "date", accessor: (booking) => booking.arrival_date },
    {
      key: "extra_bed",
      label: "Extra Services",
      accessor: (booking) => (booking.extra_bed ? "extra bed" : "none"),
    },
    { key: "approval_status", label: "Approval", accessor: (booking) => booking.approval_status },
    { key: "estate_status", label: "Estate / Property", accessor: (booking) => booking.estate_status },
  ];

  const table = useTableControls({
    rows: bookings,
    filterFields,
    pageSize: 10,
  });

  async function searchBookings() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (arrivalDate) params.set("arrival_date", arrivalDate);
      if (guestName) params.set("guest_name", guestName);
      if (guestPhone) params.set("guest_phone", guestPhone);
      if (bookingId.trim()) params.set("q", bookingId.trim());

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

  function clearAllFilters() {
    setArrivalDate("");
    setGuestName("");
    setGuestPhone("");
    setBookingId("");
    table.clearFilters();
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
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Cancellation failed");
      setMessage("Booking cancelled successfully.");
      setToast({
        title: "Booking cancelled",
        description: "The booking was removed from the database and the list was refreshed.",
        tone: "success",
      });
      setEditing(null);
      await searchBookings();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancellation failed");
    } finally {
      setLoading(false);
    }
  }

  function updateStayDays(days: number) {
    if (!editing) return;
    const safeDays = Number.isFinite(days) && days > 0 ? days : 1;
    const baseArrivalDate = String(editing.arrival_date).slice(0, 10);
    const departure = format(addDays(new Date(baseArrivalDate), safeDays), "yyyy-MM-dd");
    setEditing((prev) => (prev ? { ...prev, stay_days: safeDays, departure_date: departure } : prev));
  }

  function updateDepartureDate(value: string) {
    if (!editing) return;
    const baseArrivalDate = String(editing.arrival_date).slice(0, 10);
    const stayDays = Math.max(1, differenceInCalendarDays(new Date(value), new Date(baseArrivalDate)));
    setEditing((prev) => (prev ? { ...prev, departure_date: value, stay_days: stayDays } : prev));
  }

  useEffect(() => {
    if (!arrivalDate && !guestName && !guestPhone && !bookingId && bookings.length === 0) return;
    void searchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh only when requested
  }, [refreshKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <Card className="overflow-hidden border-slate-200/80 shadow-sm">
      <CardHeader className="space-y-2 border-b bg-gradient-to-r from-slate-50 via-white to-sky-50/60">
        <div className="space-y-1">
          <CardTitle className="text-xl text-slate-900">Cancel Booking</CardTitle>
          <p className="max-w-3xl text-sm text-slate-600">
            Search and manage guest reservations. Use the filters below to locate a specific booking for modification or cancellation requests.
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr_1.15fr]">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Guest Name
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-11 pl-9"
                  placeholder="Enter guest name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Arrival Date
              </Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-11 pl-9"
                  type="date"
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Phone Number
              </Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-11 pl-9"
                  placeholder="Search by phone"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button className="h-11 w-full gap-2" onClick={searchBookings} disabled={loading}>
                <Search className="h-4 w-4" />
                {loading ? "Searching..." : "Search Bookings"}
              </Button>
            </div>
          </div>

          <div className="my-4 h-px bg-slate-200" />

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Booking ID
              </Label>
              <Input
                className="h-11"
                placeholder="ID Number"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Extra Services
              </Label>
              <Select
                value={table.filters.extra_bed || "__all__"}
                onValueChange={(value) => table.updateFilter("extra_bed", value === "__all__" ? "" : value)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="All Extras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Extras</SelectItem>
                  <SelectItem value="extra bed">Extra Bed</SelectItem>
                  <SelectItem value="none">No Extra Bed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Approval Status
              </Label>
              <Select
                value={table.filters.approval_status || "__all__"}
                onValueChange={(value) => table.updateFilter("approval_status", value === "__all__" ? "" : value)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Any Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Any Status</SelectItem>
                  <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Estate / Property
              </Label>
              <Select
                value={table.filters.estate_status || "__all__"}
                onValueChange={(value) => table.updateFilter("estate_status", value === "__all__" ? "" : value)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="All Properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Properties</SelectItem>
                  <SelectItem value="PENDING_ESTATE_REVIEW">Pending Review</SelectItem>
                  <SelectItem value="ROOM_ALLOCATED">Room Allocated</SelectItem>
                  <SelectItem value="SERVICES_APPROVED">Services Approved</SelectItem>
                  <SelectItem value="ESTATE_REJECTED">Estate Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                className="h-11 gap-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                onClick={clearAllFilters}
              >
                <FilterX className="h-4 w-4" />
                Clear All Filters
              </Button>
            </div>
          </div>
        </div>

        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
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
              {table.pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                    {table.filteredRows.length === 0 ? "No bookings found." : "No bookings on this page."}
                  </TableCell>
                </TableRow>
              ) : (
                table.pageRows.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>{booking.id}</TableCell>
                    <TableCell>{booking.guest_name}</TableCell>
                    <TableCell>{booking.guest_phone}</TableCell>
                    <TableCell>{formatDisplayDate(booking.arrival_date)}</TableCell>
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
                      <Button variant="destructive" size="sm" onClick={() => cancelBooking(booking.id)}>
                        Cancel
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <PaginationBar pagination={table.pagination} onPageChange={table.setPage} loading={loading} />
        <ToastBanner
          open={Boolean(toast)}
          title={toast?.title || ""}
          description={toast?.description}
          tone={toast?.tone}
          onClose={() => setToast(null)}
        />

        {editing ? (
          <div className="rounded-2xl border bg-secondary/20 p-4">
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
                  onChange={(e) => updateStayDays(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Departure Date</Label>
                <Input
                  type="date"
                  value={String(editing.departure_date).slice(0, 10)}
                  onChange={(e) => updateDepartureDate(e.target.value)}
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
