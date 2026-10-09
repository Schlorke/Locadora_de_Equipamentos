import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Label } from "./Label.web";

describe("Label", () => {
  it("mantém o texto pequeno e o peso médio", () => {
    const html = renderToStaticMarkup(createElement(Label, null, "Nome Completo"));
    expect(html).toContain("Nome Completo");
    expect(html).toContain("text-sm");
    expect(html).toContain("font-medium");
    expect(html).toContain("leading-none");
  });
});
