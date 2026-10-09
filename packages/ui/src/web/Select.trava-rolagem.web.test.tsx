// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select.web";

beforeAll(() => {
  // Posicionamento do Radix no jsdom: sem ResizeObserver nem scrollIntoView.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => undefined;
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
});

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

function Exemplo({ open }: { open: boolean }) {
  return (
    <Select open={open} defaultValue="a">
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">Opção A</SelectItem>
        <SelectItem value="b">Opção B</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe("Select: trava de rolagem", () => {
  afterEach(cleanup);

  it("aberto não trava a página e, fechado, devolve o body como estava", async () => {
    const { rerender } = render(<Exemplo open={false} />);
    await settle();
    expect(document.body.hasAttribute("data-scroll-released")).toBe(false);

    rerender(<Exemplo open />);
    await settle();
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    expect(document.body.hasAttribute("data-scroll-released")).toBe(true);
    expect(document.body.style.pointerEvents).not.toBe("none");

    rerender(<Exemplo open={false} />);
    await settle();
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    expect(document.body.hasAttribute("data-scroll-released")).toBe(false);
  });
});
