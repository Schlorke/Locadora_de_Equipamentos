import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminIndexPage } from "./AdminIndexPage";

describe("AdminIndexPage", () => {
  it("mostra Redirecionando", () => {
    const html = renderToStaticMarkup(createElement(AdminIndexPage));
    expect(html).toContain("Redirecionando...");
    expect(html).toContain("border-t-slate-700");
  });
});
