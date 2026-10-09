export const MAX_VISIBLE_PAGE_NUMBERS = 3;

export interface SmartPaginationWindow {
  visiblePages: number[];
  showLeftEllipsis: boolean;
  showRightEllipsis: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export function smartPaginationWindow(
  currentPage: number,
  totalPages: number,
  showPageNumbers = 5,
): SmartPaginationWindow | null {
  if (totalPages <= 1) return null;
  const count = Math.min(MAX_VISIBLE_PAGE_NUMBERS, showPageNumbers, totalPages);
  const half = Math.floor(count / 2);
  let start = Math.max(1, currentPage - half);
  const end = Math.min(totalPages, start + count - 1);
  if (end - start + 1 < count) {
    start = Math.max(1, end - count + 1);
  }
  const visiblePages: number[] = [];
  for (let i = start; i <= end; i++) visiblePages.push(i);
  return {
    visiblePages,
    showLeftEllipsis: (visiblePages[0] ?? 1) > 1,
    showRightEllipsis: (visiblePages[visiblePages.length - 1] ?? totalPages) < totalPages,
    canGoPrev: currentPage > 1,
    canGoNext: currentPage < totalPages,
  };
}
