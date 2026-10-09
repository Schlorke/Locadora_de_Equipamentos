// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./Pagination.web";

afterEach(cleanup);

describe("Pagination", () => {
  it("mantém Anterior, Próximo e o rótulo inglês More pages", () => {
    const previous = vi.fn();
    const next = vi.fn();
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem><PaginationPrevious href="#" onClick={previous} /></PaginationItem>
          <PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem>
          <PaginationItem><PaginationLink href="#">2</PaginationLink></PaginationItem>
          <PaginationItem><PaginationEllipsis data-testid="reticencias" /></PaginationItem>
          <PaginationItem><PaginationNext href="#" onClick={next} /></PaginationItem>
        </PaginationContent>
      </Pagination>,
    );

    const nav = screen.getByRole("navigation", { name: "pagination" });
    expect(nav.querySelector("ul")?.className).toContain("gap-2 sm:gap-1");

    const anterior = screen.getByRole("link", { name: "Ir para página anterior" });
    const proximo = screen.getByRole("link", { name: "Ir para próxima página" });
    expect(anterior.textContent).toBe("Anterior");
    expect(proximo.textContent).toBe("Próximo");
    fireEvent.click(anterior);
    fireEvent.click(proximo);
    expect(previous).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();

    expect(screen.getByRole("link", { name: "1" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "2" }).getAttribute("aria-current")).toBeNull();

    const ellipsis = screen.getByTestId("reticencias");
    expect(ellipsis.className).toContain("h-9 w-9");
    expect(ellipsis.getAttribute("aria-hidden")).toBe("true");
    expect(ellipsis.querySelector(".sr-only")?.textContent).toBe("More pages");
  });
});
