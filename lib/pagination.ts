export const DEFAULT_PAGE_LIMIT = 12;
export const MAX_PAGE_LIMIT = 12;

export function parsePagination(
  searchParams: URLSearchParams,
  {
    defaultLimit = DEFAULT_PAGE_LIMIT,
    maxLimit = MAX_PAGE_LIMIT,
  }: { defaultLimit?: number; maxLimit?: number } = {},
) {
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const limitRaw = Number(searchParams.get("limit") ?? String(defaultLimit));

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limitCandidate =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : defaultLimit;
  const limit = Math.max(1, Math.min(maxLimit, limitCandidate));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export function toPaginationMeta({
  page,
  limit,
  total,
}: {
  page: number;
  limit: number;
  total: number;
}) {
  const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasPrev: page > 1 && totalPages > 0,
    hasNext: totalPages > 0 && page < totalPages,
  };
}

