/**
 * Standardized Pagination Helper untuk Backend tertaut.com
 */

export interface PaginationParams {
  limit?: number | string | null;
  offset?: number | string | null;
  page?: number | string | null;
  defaultLimit?: number;
  maxLimit?: number;
}

export interface PaginationResult {
  limit: number;
  offset: number;
}

export function parsePagination(params: PaginationParams): PaginationResult {
  const defaultLimit = params.defaultLimit ?? 200;
  const maxLimit = params.maxLimit ?? 500;
  const limit = Math.max(1, Math.min(Number(params.limit) || defaultLimit, maxLimit));
  const offset = params.page
    ? (Math.max(1, Number(params.page)) - 1) * limit
    : Math.max(0, Number(params.offset) || 0);

  return { limit, offset };
}

export function paginationEnvelope<T>(items: T[], total: number, pagination: PaginationResult) {
  return {
    total,
    limit: pagination.limit,
    offset: pagination.offset,
    hasMore: pagination.offset + items.length < total,
  };
}
