"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DepartmentStat = {
  department: string;
  total: number;
  active: number;
};

function formatUpdatedAt(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function AdminDepartmentChart({
  onSelectDepartment,
}: {
  onSelectDepartment?: (department: string) => void;
}) {
  const [rows, setRows] = useState<DepartmentStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<"total" | "active">("total");
  const [selected, setSelected] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users/stats");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load user stats");
      setRows((data.departments ?? []) as DepartmentStat[]);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user stats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      void load();
    }, 10_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional polling
  }, []);

  const maxValue = useMemo(() => {
    const values = rows.map((row) => (metric === "active" ? row.active : row.total));
    return Math.max(1, ...values);
  }, [rows, metric]);

  return (
    <Card className="border-sky-200/70 bg-gradient-to-r from-sky-50 via-white to-emerald-50">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-sky-700" />
            Users by Department
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={metric === "total" ? "default" : "outline"}
              onClick={() => setMetric("total")}
            >
              Total
            </Button>
            <Button
              size="sm"
              variant={metric === "active" ? "default" : "outline"}
              onClick={() => setMetric("active")}
            >
              Active
            </Button>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCcw className={cn("mr-2 h-4 w-4", loading ? "animate-spin" : "")} />
              Refresh
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Click a bar to filter the user list by department{selected ? ` (selected: ${selected})` : ""}.
          </span>
          <span>{updatedAt ? `Last updated: ${formatUpdatedAt(updatedAt)}` : ""}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {rows.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">No departments found.</p>
        ) : null}

        <div className="space-y-2">
          {rows.map((row) => {
            const value = metric === "active" ? row.active : row.total;
            const widthPct = Math.max(2, Math.round((value / maxValue) * 100));
            const isSelected = selected === row.department;
            return (
              <button
                key={row.department}
                type="button"
                className={cn(
                  "group flex w-full items-center gap-3 rounded-md border bg-white/70 px-3 py-2 text-left transition hover:bg-white",
                  isSelected ? "border-emerald-300 bg-emerald-50/70" : "border-slate-200/70",
                )}
                onClick={() => {
                  const next = isSelected ? null : row.department;
                  setSelected(next);
                  if (next) onSelectDepartment?.(next);
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-medium">{row.department || "Unknown"}</div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {metric === "active" ? `${row.active}/${row.total} active` : `${row.total} user(s)`}
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        isSelected ? "bg-emerald-500" : "bg-sky-500 group-hover:bg-sky-600",
                      )}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

