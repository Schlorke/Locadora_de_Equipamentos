import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HybridTooltip } from "./HybridTooltip.web";

describe("Dica", () => {
  it("mostra o gatilho e esconde o texto no servidor", () => {
    const html = renderToStaticMarkup(
      createElement(HybridTooltip, {
        content: "sábados e domingos são incluídos",
        children: createElement("span", null, "AJUDA"),
      }),
    );
    expect(html).toContain("AJUDA");
    expect(html).not.toContain("sábados e domingos são incluídos");
  });
});
