"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DateRangePreset = "today" | "week" | "month" | "last-month" | "custom";

interface ReportData {
  data: Record<string, unknown>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function ReportsPanel() {
  const [dateRange, setDateRange] = useState<DateRangePreset>("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Essential columns to display in preview (full data exported)
  const displayColumns = [
    "Booking ID",
    "Booked On",
    "Booking Initiator Name",
    "Department",
    "Guest's Address",
    "City",
  ];

  const computedDateRange = useMemo(() => {
    const today = new Date();
    let end = new Date(today);
    let start = new Date(today);

    switch (dateRange) {
      case "today":
        start = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      case "week":
        start.setDate(today.getDate() - today.getDay());
        end.setHours(23, 59, 59, 999);
        break;
      case "month":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end.setHours(23, 59, 59, 999);
        break;
      case "last-month":
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        break;
      case "custom":
        if (startDate) start = new Date(startDate);
        if (endDate) end = new Date(endDate + "T23:59:59");
        break;
    }

    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    return { start: formatDate(start), end: formatDate(end) };
  }, [dateRange, startDate, endDate]);

  async function fetchReport() {
    if (!computedDateRange.start || !computedDateRange.end) {
      setError("Please select a valid date range");
      return;
    }

    setLoading(true);
    setError(null);
    setPage(1);

    try {
      const params = new URLSearchParams({
        start_date: computedDateRange.start,
        end_date: computedDateRange.end,
        page: "1",
        limit: "50",
      });

      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(`/api/reports?${params.toString()}`);
      const data: ReportData = await res.json();

      if (!res.ok) throw new Error(data.pagination ? "Failed to load report" : "Failed to load report");
      
      setRows(data.data || []);
      setTotalRecords(data.pagination?.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function exportReport(format: "csv" | "pdf") {
    if (!computedDateRange.start || !computedDateRange.end) {
      setError("Please select a valid date range");
      return;
    }

    const params = new URLSearchParams({
      start_date: computedDateRange.start,
      end_date: computedDateRange.end,
      format,
    });

    if (searchQuery) params.set("q", searchQuery);

    const link = document.createElement("a");
    link.href = `/api/reports/export?${params.toString()}`;
    link.target = "_blank";
    link.click();
  }

  const headers = rows.length ? Object.keys(rows[0]) : [];
  const visibleHeaders = headers.filter((h) => displayColumns.includes(h));

  return (
    <Card className="w-full">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Booking Reports</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Generate comprehensive reports for the selected date range
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Filters Section */}
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5">
            {/* Date Range Preset */}
            <div className="space-y-2">
              <Label htmlFor="date-range" className="text-xs font-semibold uppercase">
                Time Period
              </Label>
              <Select value={dateRange} onValueChange={(value: DateRangePreset) => setDateRange(value)}>
                <SelectTrigger id="date-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="custom">Select date and Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Start Date */}
            {dateRange === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-xs font-semibold uppercase">
                  From Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            )}

            {/* Custom End Date */}
            {dateRange === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="end-date" className="text-xs font-semibold uppercase">
                  To Date
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            )}

            {/* Search Query */}
            <div className="space-y-2">
              <Label htmlFor="search" className="text-xs font-semibold uppercase">
                Search
              </Label>
              <Input
                id="search"
                placeholder="Guest name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={fetchReport} disabled={loading} className="gap-2">
              {loading ? (
                <>
                  <span className="inline-block animate-spin">⟳</span>
                  Generating...
                </>
              ) : (
                "Generate Report"
              )}
            </Button>

            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                onClick={() => exportReport("csv")}
                disabled={rows.length === 0 || loading}
              >
                📊 Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => exportReport("pdf")}
                disabled={rows.length === 0 || loading}
              >
                📄 Export PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Report Summary */}
        {rows.length > 0 && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="text-sm text-blue-800 font-medium">
              ✓ Report generated successfully • {totalRecords} total records found
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Date Range: {computedDateRange.start} to {computedDateRange.end}
            </p>
          </div>
        )}

        {/* Table Section */}
        {rows.length > 0 ? (
          <div className="space-y-4">
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    {visibleHeaders.map((header) => (
                      <TableHead key={header} className="font-semibold">
                        {header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={index} className="hover:bg-gray-50">
                      {visibleHeaders.map((header) => (
                        <TableCell key={`${index}-${header}`} className="text-sm">
                          {String(row[header] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Records Count */}
            <div className="flex items-center justify-between px-2 py-2 text-sm text-muted-foreground">
              <span>Showing {rows.length} of {totalRecords} records</span>
            </div>
          </div>
        ) : (
          !loading && (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground">
                {rows.length === 0 && !error
                  ? "Click 'Generate Report' to view booking data"
                  : "No records found for the selected date range"}
              </p>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
