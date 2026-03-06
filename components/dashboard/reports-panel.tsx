"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ReportType = "monthly" | "guest-history" | "room-usage";

const reportLabels: Record<ReportType, string> = {
  monthly: "Monthly Bookings Report",
  "guest-history": "Guest History",
  "room-usage": "Room Usage Report",
};

export function ReportsPanel() {
  const [type, setType] = useState<ReportType>("monthly");
  const [month, setMonth] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchReport() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type });
      if (month) params.set("month", month);
      const res = await fetch(`/api/reports?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load report");
      setRows(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  function exportReport(format: "csv" | "pdf") {
    const params = new URLSearchParams({ type, format });
    if (month) params.set("month", month);
    window.open(`/api/reports/export?${params.toString()}`, "_blank");
  }

  const headers = rows.length ? Object.keys(rows[0]) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reports and Receipts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Report Type</Label>
            <Select value={type} onValueChange={(value: ReportType) => setType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly Bookings</SelectItem>
                <SelectItem value="guest-history">Guest History</SelectItem>
                <SelectItem value="room-usage">Room Usage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Month (optional)</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={fetchReport} disabled={loading}>
              {loading ? "Generating..." : "Generate"}
            </Button>
            <Button variant="outline" onClick={() => exportReport("csv")}>
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => exportReport("pdf")}>
              Export PDF
            </Button>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-muted-foreground">{reportLabels[type]}</h3>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index}>
                {headers.map((header) => (
                  <TableCell key={`${index}-${header}`}>{String(row[header] ?? "")}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
