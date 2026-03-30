"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApprovalBadge } from "@/components/dashboard/shared";
import type { BookingRecord } from "@/lib/types";

type BookingWithOwner = BookingRecord & {
  booking_owner_name?: string;
  booking_owner_department?: string;
};

interface ApproverPanelProps {
  onChanged?: () => void;
}

export function ApproverPanel({ onChanged }: ApproverPanelProps) {
  const [bookings, setBookings] = useState<BookingWithOwner[]>([]);
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

  useEffect(() => {
    void loadPending();
    void loadRecentApprovals();
  }, [loadPending, loadRecentApprovals]);

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
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell>#{booking.id}</TableCell>
                <TableCell>
                  <div>{new Date(booking.created_at).toLocaleDateString()}</div>
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
                <TableCell className="space-y-2">
                  <Textarea
                    placeholder="Remarks"
                    value={remarks[booking.id] || ""}
                    onChange={(e) => setRemarks((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decide(booking.id, "Approved")} disabled={loading}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => decide(booking.id, "Rejected")}
                      disabled={loading}
                    >
                      Reject
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

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
                    <p className="font-medium">#{item.booking_id} · {item.guest_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Arrival {String(item.arrival_date).slice(0, 10)} ·{" "}
                      {new Date(item.decided_at).toLocaleDateString()}
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
