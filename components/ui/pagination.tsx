"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrev?: boolean;
  hasNext?: boolean;
};

export function PaginationBar({
  pagination,
  onPageChange,
  loading,
  className,
}: {
  pagination: PaginationMeta | null;
  onPageChange: (page: number) => void;
  loading?: boolean;
  className?: string;
}) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const hasPrev = pagination.hasPrev ?? pagination.page > 1;
  const hasNext = pagination.hasNext ?? pagination.page < pagination.totalPages;

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="text-xs text-muted-foreground">
        Page <span className="font-medium text-foreground">{pagination.page}</span> of{" "}
        <span className="font-medium text-foreground">{pagination.totalPages}</span> ·{" "}
        <span className="font-medium text-foreground">{pagination.total}</span> record(s)
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(1)}
          disabled={loading || !hasPrev}
        >
          First
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
          disabled={loading || !hasPrev}
        >
          Prev
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))}
          disabled={loading || !hasNext}
        >
          Next
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(pagination.totalPages)}
          disabled={loading || !hasNext}
        >
          Last
        </Button>
      </div>
    </div>
  );
}

