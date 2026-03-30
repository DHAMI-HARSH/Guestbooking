"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApprovalBadge, EstateBadge } from "@/components/dashboard/shared";
import { formatDisplayDate } from "@/lib/date";
import type { BookingRecord } from "@/lib/types";

interface MyBookingsProps {
  refreshKey?: number;
}

export function MyBookings({ refreshKey }: MyBookingsProps) {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
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
  }, [refreshKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Bookings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={loadBookings} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {bookings.length} booking(s)
          </span>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Arrival</TableHead>
              <TableHead>Departure</TableHead>
              <TableHead>Rooms</TableHead>
              <TableHead>Booked On</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Estate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  No bookings found.
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>#{booking.id}</TableCell>
                  <TableCell>
                    <div>{booking.guest_name}</div>
                    <div className="text-xs text-muted-foreground">{booking.guest_phone}</div>
                  </TableCell>
                  <TableCell>{formatDisplayDate(booking.arrival_date)}</TableCell>
                  <TableCell>{formatDisplayDate(booking.departure_date)}</TableCell>
                  <TableCell>{booking.rooms_required}</TableCell>
                  <TableCell>
                    <div>{formatDisplayDate(booking.created_at)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(booking.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ApprovalBadge status={booking.approval_status} />
                  </TableCell>
                  <TableCell>
                    <EstateBadge status={booking.estate_status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
