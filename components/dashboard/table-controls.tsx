"use client";

import { useEffect, useMemo, useState } from "react";
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
    <div className="space-y-4 rounded-lg border bg-secondary/20 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5 md:col-span-2 xl:col-span-2">
          <Label>Search</Label>
          <Input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} />
        </div>

        {filterFields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label>{field.label}</Label>
            <Input
              type={field.type ?? "text"}
              value={filterValues[field.key] ?? ""}
              onChange={(event) => onFilterChange(field.key, event.target.value)}
              placeholder={field.placeholder ?? `Filter ${field.label}`}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Use the search box to scan all visible columns, or filter each column directly.
        </p>
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear Filters
        </Button>
      </div>
    </div>
  );
}
