// @vitest-environment jsdom
// Estado inicial da revelação no contato da home: o cartão do formulário nasce escondido só sem movimento reduzido
// (classe motion-safe:opacity-0; com prefers-reduced-motion nasce visível, sem depender do JS), sem estilo inline,
// porque a transição do .contact-form é do CSS (styles/components.web.css) e vale também durante a revelação. Os
// títulos, cuja transição não é do CSS, continuam com transition: none até a revelação.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ContactSection from "./ContatoHome.web";

vi.mock("../../../entities/configuracao", async (original) => ({
  ...(await original<typeof import("../../../entities/configuracao")>()),
  usePublicSettings: () => ({ settings: {} }),
}));
vi.mock("../../../features/mapa-loja", () => ({ GoogleStoreLocator: () => null }));

describe("Contato da home: estado inicial da revelação", () => {
  it("o cartão do formulário nasce escondido só sem movimento reduzido, sem estilo inline; os títulos com transition none", () => {
    document.body.innerHTML = renderToStaticMarkup(<ContactSection />);
    const form = document.querySelector<HTMLElement>(".contact-form")!;
    expect(form.classList.contains("motion-safe:opacity-0")).toBe(true);
    expect(form.classList.contains("opacity-0")).toBe(false);
    expect(form.getAttribute("style")).toBeNull();
    for (const selector of [".section-title", ".section-subtitle", ".contact-info"]) {
      const element = document.querySelector<HTMLElement>(selector)!;
      expect(element.classList.contains("motion-safe:opacity-0"), selector).toBe(true);
      expect(element.style.opacity, selector).toBe("");
      expect(element.style.transform, selector).toBe("");
    }
    for (const selector of [".section-title", ".section-subtitle"])
      expect(document.querySelector<HTMLElement>(selector)!.style.transition, selector).toBe("none");
  });
});
