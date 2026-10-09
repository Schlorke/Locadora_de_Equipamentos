import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Card, CardContent, CardHeader, CardTitle } from "./Card.web";

describe("Card", () => {
  it("mantém a borda, a sombra e o título", () => {
    const html = renderToStaticMarkup(
      createElement(
        Card,
        null,
        createElement(CardHeader, null, createElement(CardTitle, null, "Resumo")),
        createElement(CardContent, null, "Total"),
      ),
    );
    expect(html).toContain("rounded-lg");
    expect(html).toContain("border");
    expect(html).toContain("bg-card");
    expect(html).toContain("shadow-sm");
    expect(html).toContain("px-6");
    expect(html).toContain("pt-6");
    expect(html).toContain("text-2xl");
    expect(html).toContain("font-semibold");
    expect(html).toContain("Resumo");
    expect(html).toContain("p-6");
    expect(html).toContain("pt-0");
    expect(html).toContain("Total");
  });
});
