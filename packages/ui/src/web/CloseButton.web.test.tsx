import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CloseButton } from "./CloseButton.web";

describe("CloseButton", () => {
  it("usa Close quando ninguém informa o rótulo", () => {
    const html = renderToStaticMarkup(createElement(CloseButton));
    expect(html).toContain('aria-label="Close"');
    expect(html).toContain("Close");
  });

  it("aceita Fechar dialog no orçamento", () => {
    const html = renderToStaticMarkup(createElement(CloseButton, { "aria-label": "Fechar dialog", size: "sm" }));
    expect(html).toContain('aria-label="Fechar dialog"');
    expect(html).toContain("h-6 w-6");
  });
});
