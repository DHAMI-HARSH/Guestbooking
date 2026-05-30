"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationBar } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableFiltersBar, useTableControls, type TableFilterField } from "@/components/dashboard/table-controls";

type DateRangePreset = "today" | "week" | "month" | "last-month" | "custom";

export function ReportsPanel() {
  const [dateRange, setDateRange] = useState<DateRangePreset>("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        if (endDate) end = new Date(`${endDate}T23:59:59`);
        break;
    }

    const formatDate = (value: Date) => value.toISOString().split("T")[0];
    return { start: formatDate(start), end: formatDate(end) };
  }, [dateRange, startDate, endDate]);

  const headers = rows.length ? Object.keys(rows[0]) : [];
  const visibleHeaders = headers.filter((header) => displayColumns.includes(header));
  const filterFields = useMemo<TableFilterField<Record<string, unknown>>[]>(
    () =>
      visibleHeaders.map((header) => ({
        key: header,
        label: header,
        accessor: (row) => row[header] ?? "",
      })),
    [visibleHeaders],
  );
  const table = useTableControls({
    rows,
    filterFields,
    pageSize: 10,
  });

  async function fetchReport() {
    if (!computedDateRange.start || !computedDateRange.end) {
      setError("Please select a valid date range");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const firstParams = new URLSearchParams({
        start_date: computedDateRange.start,
        end_date: computedDateRange.end,
        page: "1",
        limit: "12",
      });

      const firstResponse = await fetch(`/api/reports?${firstParams.toString()}`);
      const firstData = await firstResponse.json();
      if (!firstResponse.ok) throw new Error(firstData.message || "Failed to load report");

      const collectedRows: Record<string, unknown>[] = Array.isArray(firstData.data) ? firstData.data : [];
      const totalPages = Number(firstData.pagination?.totalPages ?? 1);

      if (totalPages > 1) {
        const additionalPages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
        const extraResults = await Promise.all(
          additionalPages.map(async (page) => {
            const params = new URLSearchParams({
              start_date: computedDateRange.start,
              end_date: computedDateRange.end,
              page: String(page),
              limit: "12",
            });
            const response = await fetch(`/api/reports?${params.toString()}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Failed to load report");
            return Array.isArray(data.data) ? (data.data as Record<string, unknown>[]) : [];
          }),
        );

        for (const batch of extraResults) {
          collectedRows.push(...batch);
        }
      }

      setRows(collectedRows);
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

    if (table.search) params.set("q", table.search);

    const link = document.createElement("a");
    link.href = `/api/reports/export?${params.toString()}`;
    link.target = "_blank";
    link.click();
  }

  return (
    <Card className="w-full">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Booking Reports</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate comprehensive reports for the selected date range
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5">
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

            {dateRange === "custom" ? (
              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-xs font-semibold uppercase">
                  From Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
            ) : null}

            {dateRange === "custom" ? (
              <div className="space-y-2">
                <Label htmlFor="end-date" className="text-xs font-semibold uppercase">
                  To Date
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={fetchReport} disabled={loading} className="gap-2">
              {loading ? "Generating..." : "Generate Report"}
            </Button>

            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => exportReport("csv")} disabled={rows.length === 0 || loading}>
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => exportReport("pdf")} disabled={rows.length === 0 || loading}>
                Export PDF
              </Button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-sm font-medium text-blue-800">
              Report generated successfully • {rows.length} total records found
            </p>
            <p className="mt-1 text-xs text-blue-700">
              Date Range: {computedDateRange.start} to {computedDateRange.end}
            </p>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="space-y-4">
            <TableFiltersBar
              search={table.search}
              onSearchChange={table.updateSearch}
              filterFields={filterFields}
              filterValues={table.filters}
              onFilterChange={table.updateFilter}
              onClear={table.clearFilters}
              searchPlaceholder="Search report rows"
            />

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
                  {table.pageRows.map((row, index) => (
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

            <PaginationBar pagination={table.pagination} onPageChange={table.setPage} loading={loading} />
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
