// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useReleaseScrollLockRef } from "./release-scroll-lock";

/** Conteúdo aberto; `lock` imita o Radix modal, que grava a trava no body depois de montar. */
function Content({ lock = true, forwarded }: { lock?: boolean; forwarded?: React.Ref<HTMLDivElement> }) {
  const ref = useReleaseScrollLockRef<HTMLDivElement>(forwarded);
  React.useEffect(() => {
    if (!lock) return;
    document.body.setAttribute("data-scroll-locked", "1");
    document.body.style.pointerEvents = "none";
  }, [lock]);
  return <div ref={ref}>conteúdo</div>;
}

/** Deixa o MutationObserver entregar os registros. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const body = () => document.body;

afterEach(() => {
  cleanup();
  body().removeAttribute("data-scroll-locked");
  body().removeAttribute("data-scroll-released");
  body().style.removeProperty("pointer-events");
});

describe("useReleaseScrollLockRef", () => {
  it("retira a trava do Radix, devolve pointer-events e marca o body enquanto o conteúdo está aberto", async () => {
    render(<Content />);
    await settle();
    expect(body().hasAttribute("data-scroll-locked")).toBe(false);
    expect(body().style.pointerEvents).toBe("");
    expect(body().hasAttribute("data-scroll-released")).toBe(true);
  });

  it("conteúdo que não trava não altera o body", async () => {
    body().style.pointerEvents = "auto";
    render(<Content lock={false} />);
    await settle();
    expect(body().hasAttribute("data-scroll-released")).toBe(false);
    expect(body().style.pointerEvents).toBe("auto");
  });

  it("solta o body só quando o último conteúdo aberto fecha", async () => {
    const view = render(
      <>
        <Content />
        <Content />
      </>,
    );
    await settle();
    view.rerender(<Content />);
    await settle();
    expect(body().hasAttribute("data-scroll-released")).toBe(true);
    view.unmount();
    expect(body().hasAttribute("data-scroll-released")).toBe(false);
    // Fechado, a trava volta a valer: nada mais a remove.
    body().setAttribute("data-scroll-locked", "1");
    await settle();
    expect(body().getAttribute("data-scroll-locked")).toBe("1");
  });

  it("repassa o elemento ao ref do consumidor", () => {
    const forwarded = React.createRef<HTMLDivElement>();
    render(<Content lock={false} forwarded={forwarded} />);
    expect(forwarded.current?.textContent).toBe("conteúdo");
  });
});
