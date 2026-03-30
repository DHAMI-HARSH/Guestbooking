"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApprovalBadge, EstateBadge } from "@/components/dashboard/shared";
import type { BookingRecord } from "@/lib/types";
import { X } from "lucide-react";

type BookingWithOwner = BookingRecord & {
  booking_owner_name?: string;
  booking_owner_department?: string;
};

export function EstatePrimaryPanel() {
  const [bookings, setBookings] = useState<BookingWithOwner[]>([]);
  const [selected, setSelected] = useState<BookingWithOwner | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              <TableRow key={booking.id}>
                <TableCell>{String(booking.arrival_date).slice(0, 10)}</TableCell>
                <TableCell>
                  <div>{new Date(booking.created_at).toLocaleDateString()}</div>
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
                  <Button
                    size="sm"
                    variant={selected?.id === booking.id ? "destructive" : "outline"}
                    onClick={() =>
                      setSelected((prev) => (prev?.id === booking.id ? null : booking))
                    }
                  >
                    {selected?.id === booking.id ? (
                      <X className="h-4 w-4" />
                    ) : (
                      "OPEN"
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {selected ? (
          <div className="rounded-lg border bg-secondary/20 p-4">
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
                <span className="font-medium">Purpose:</span> {selected.purpose}
              </p>
              <p>
                <span className="font-medium">Stay:</span> {selected.stay_days} day(s)
              </p>
              <p>
                <span className="font-medium">Total Guests:</span> {selected.total_guests}
              </p>
              <p>
                <span className="font-medium">Extra Bed:</span> {selected.extra_bed ? "Yes (Free)" : "No"}
              </p>
              <p className="md:col-span-2">
                <span className="font-medium">Justification:</span> {selected.justification}
              </p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
