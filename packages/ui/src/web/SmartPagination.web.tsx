"use client";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "./Pagination.web";
import { smartPaginationWindow } from "./smart-pagination";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Hover dos controles: fundo cinza, borda cinza e o texto sem a cor laranja do botão (vale também para a página
 * atual). Fora do hover, a cor padrão de borda (border-border); no hover, cinza.
 */
const CONTROL_CLASSES =
  "cursor-pointer select-none border-border hover:border hover:border-gray-200 hover:bg-gray-100 hover:text-current";

interface SmartPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (_page: number) => void;
  className?: string;
  showPageNumbers?: number;
}

export function SmartPagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
  showPageNumbers = 5,
}: SmartPaginationProps) {
  const window = smartPaginationWindow(currentPage, totalPages, showPageNumbers);
  if (!window) return null;
  const { visiblePages, showLeftEllipsis, showRightEllipsis, canGoPrev, canGoNext } = window;

  return (
    <div className={cn("flex flex-col items-center gap-3 w-full min-w-0 max-w-full", className)}>
      <div className="flex items-center justify-center text-sm text-gray-600">
        Página {currentPage} de {totalPages}
      </div>

      <Pagination className="w-full min-w-0 max-w-full overflow-x-auto py-2 scrollbar-thin [&::-webkit-scrollbar]:h-1.5">
        <PaginationContent className="w-full justify-center">
          <PaginationItem className="shrink-0">
            <PaginationPrevious
              onClick={() => canGoPrev && onPageChange(currentPage - 1)}
              className={cn(CONTROL_CLASSES, !canGoPrev && "pointer-events-none opacity-50")}
            />
          </PaginationItem>

          {showLeftEllipsis && (
            <PaginationItem className="shrink-0">
              <PaginationEllipsis />
            </PaginationItem>
          )}

          {visiblePages.map((page) => (
            <PaginationItem key={page} className="shrink-0">
              <PaginationLink
                onClick={() => onPageChange(page)}
                isActive={page === currentPage}
                className={cn(
                  page === currentPage && "bg-orange-600 text-white",
                  "shrink-0 min-w-[2.25rem]",
                  CONTROL_CLASSES,
                )}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          ))}

          {showRightEllipsis && (
            <PaginationItem className="shrink-0">
              <PaginationEllipsis />
            </PaginationItem>
          )}

          <PaginationItem className="shrink-0">
            <PaginationNext
              onClick={() => canGoNext && onPageChange(currentPage + 1)}
              className={cn(CONTROL_CLASSES, !canGoNext && "pointer-events-none opacity-50")}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
