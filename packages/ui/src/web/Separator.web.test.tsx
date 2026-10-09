import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Separator } from "./Separator.web";

describe("Separator", () => {
  it("fica horizontal com 1px de altura", () => {
    const html = renderToStaticMarkup(createElement(Separator));
    expect(html).toContain('data-orientation="horizontal"');
    expect(html).toContain("h-[1px]");
    expect(html).toContain("w-full");
  });

  it("fica vertical com 1px de largura", () => {
    const html = renderToStaticMarkup(createElement(Separator, { orientation: "vertical" }));
    expect(html).toContain('data-orientation="vertical"');
    expect(html).toContain("w-[1px]");
    expect(html).toContain("h-full");
  });
});
