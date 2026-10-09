import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminLoginPage } from "./AdminLoginPage";

describe("AdminLoginPage", () => {
  it("mostra Redirecionando", () => {
    const html = renderToStaticMarkup(createElement(AdminLoginPage));
    expect(html).toContain("Redirecionando...");
    expect(html).toContain("border-orange-600");
  });
});
