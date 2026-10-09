import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge.web";

describe("Badge", () => {
  it("mantém a pílula padrão", () => {
    const html = renderToStaticMarkup(createElement(Badge, null, "Pendente"));
    expect(html).toContain("Pendente");
    expect(html).toContain("rounded-full");
    expect(html).toContain("px-2.5");
    expect(html).toContain("py-0.5");
    expect(html).toContain("text-xs");
    expect(html).toContain("font-semibold");
    expect(html).toContain("bg-primary");
  });

  it("mantém a variante destrutiva", () => {
    const html = renderToStaticMarkup(createElement(Badge, { variant: "destructive" }, "Vencido"));
    expect(html).toContain("Vencido");
    expect(html).toContain("bg-destructive");
    expect(html).toContain("text-destructive-foreground");
  });
});
