"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterX, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaginationMeta } from "@/components/ui/pagination";

export type TableFilterField<T> = {
  key: string;
  label: string;
  accessor: (row: T) => unknown;
  type?: "text" | "date";
  placeholder?: string;
};

type TableControlsOptions<T> = {
  rows: T[];
  filterFields: TableFilterField<T>[];
  pageSize?: number;
  searchPlaceholder?: string;
};

function toSearchText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toDateText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0, 10);
}

export function useTableControls<T>({
  rows,
  filterFields,
  pageSize = 10,
}: TableControlsOptions<T>) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const activeSearch = search.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (activeSearch) {
        const haystack = filterFields
          .map((field) => toSearchText(field.accessor(row)))
          .concat(Object.values(row as Record<string, unknown>).map(toSearchText))
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(activeSearch)) return false;
      }

      for (const field of filterFields) {
        const value = filters[field.key]?.trim();
        if (!value) continue;

        const cell = field.accessor(row);
        if (field.type === "date") {
          if (!toDateText(cell).startsWith(value)) return false;
        } else if (!toSearchText(cell).toLowerCase().includes(value.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [activeSearch, filterFields, filters, rows]);

  const total = filteredRows.length;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
  const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1;
  const startIndex = totalPages > 0 ? (currentPage - 1) * pageSize : 0;
  const pageRows = totalPages > 0 ? filteredRows.slice(startIndex, startIndex + pageSize) : [];

  const pagination: PaginationMeta | null =
    totalPages > 0
      ? {
          page: currentPage,
          limit: pageSize,
          total,
          totalPages,
          hasPrev: currentPage > 1,
          hasNext: currentPage < totalPages,
        }
      : null;

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateFilter(key: string, value: string) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setFilters({});
    setPage(1);
  }

  useEffect(() => {
    if (page > 1 && currentPage !== page) {
      setPage(currentPage);
    }
  }, [currentPage, page]);

  return {
    search,
    filters,
    page,
    setPage,
    pageRows,
    filteredRows,
    pagination,
    updateSearch,
    updateFilter,
    clearFilters,
    hasFilters: Boolean(activeSearch || Object.values(filters).some(Boolean)),
  };
}

export function TableFiltersBar<T>({
  search,
  onSearchChange,
  filterFields,
  filterValues,
  onFilterChange,
  onClear,
  searchPlaceholder = "Search all columns",
}: {
  search: string;
  onSearchChange: (value: string) => void;
  filterFields: TableFilterField<T>[];
  filterValues: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClear: () => void;
  searchPlaceholder?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="space-y-1.5 lg:col-span-1">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Search
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 pl-9"
            />
          </div>
        </div>

        {filterFields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {field.label}
            </Label>
            <Input
              type={field.type ?? "text"}
              value={filterValues[field.key] ?? ""}
              onChange={(event) => onFilterChange(field.key, event.target.value)}
              placeholder={field.placeholder ?? `Filter ${field.label}`}
              className="h-11"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-500">
          Use the search box to scan all visible columns, or filter each column directly.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="gap-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <FilterX className="h-4 w-4" />
          Clear Filters
        </Button>
      </div>
    </div>
  );
}
