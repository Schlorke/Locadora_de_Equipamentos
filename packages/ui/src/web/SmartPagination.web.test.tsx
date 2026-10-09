// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { smartPaginationWindow } from "./smart-pagination";
import { SmartPagination } from "./SmartPagination.web";

afterEach(cleanup);

const classes = (element: Element) => element.className.split(/\s+/);

describe("SmartPagination", () => {
  it("mostra no máximo 3 números e some com uma página só", () => {
    expect(smartPaginationWindow(1, 1)).toBeNull();
    expect(smartPaginationWindow(1, 10)?.visiblePages).toEqual([1, 2, 3]);
    expect(smartPaginationWindow(5, 10)?.visiblePages).toEqual([4, 5, 6]);
    expect(smartPaginationWindow(10, 10)?.visiblePages).toEqual([8, 9, 10]);
    expect(smartPaginationWindow(5, 10)?.showLeftEllipsis).toBe(true);
    expect(smartPaginationWindow(5, 10)?.showRightEllipsis).toBe(true);
    expect(smartPaginationWindow(1, 10)?.canGoPrev).toBe(false);
    expect(smartPaginationWindow(10, 10)?.canGoNext).toBe(false);
  });

  it("mostra 'Página x de y' e o hover cinza em todos os controles, inclusive na página atual", () => {
    render(<SmartPagination currentPage={5} totalPages={10} onPageChange={() => undefined} />);
    expect(screen.getByText("Página 5 de 10")).toBeTruthy();
    const controls = [
      screen.getByLabelText("Ir para página anterior"),
      screen.getByText("4"),
      screen.getByText("5"),
      screen.getByLabelText("Ir para próxima página"),
    ];
    for (const control of controls) {
      // A borda tem a cor padrão e fica cinza no hover; o texto não fica laranja no hover.
      expect(classes(control)).toEqual(
        expect.arrayContaining(["border-border", "hover:border", "hover:border-gray-200", "hover:bg-gray-100", "hover:text-current"]),
      );
      expect(classes(control)).not.toContain("hover:text-orange-600");
      expect(control.className).not.toMatch(/(^|\s|:)!/);
    }
    const current = screen.getByText("5");
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(classes(current)).toEqual(expect.arrayContaining(["bg-orange-600", "text-white", "min-w-[2.25rem]"]));
    // O hover da página atual também é cinza: nenhuma cor de hover própria concorre.
    expect(classes(current).filter((name) => name.startsWith("hover:bg-"))).toEqual(["hover:bg-gray-100"]);
  });
});
