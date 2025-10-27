export interface PaginationInput {
  pageStart?: unknown;
  pageSize?: unknown;
}

export interface ParsedPagination {
  pageStart: number;
  pageSize: number;
}

export function parsePagination(
  query: PaginationInput,
  opts: { defaultSize?: number; maxSize?: number } = {}
): ParsedPagination {
  const defaultSize = opts.defaultSize ?? 10;
  const maxSize = opts.maxSize ?? 100;

  const rawStart = Number((query as any).pageStart);
  const rawSize = Number((query as any).pageSize);

  const pageStart = Number.isFinite(rawStart) && rawStart >= 0 ? Math.floor(rawStart) : 0;
  let pageSize = Number.isFinite(rawSize) && rawSize > 0 ? Math.floor(rawSize) : defaultSize;
  pageSize = Math.min(Math.max(pageSize, 1), maxSize);

  return { pageStart, pageSize };
}

export function toRange(pageStart: number, pageSize: number): { from: number; to: number } {
  const from = pageStart;
  const to = pageStart + pageSize - 1;
  return { from, to };
}

export function buildPageMeta(
  total: number,
  pageSize: number,
  pageStart: number,
  pageLength: number
) {
  const hasMore = pageStart + pageLength < total;
  return { total, pageSize, pageStart, hasMore };
}

