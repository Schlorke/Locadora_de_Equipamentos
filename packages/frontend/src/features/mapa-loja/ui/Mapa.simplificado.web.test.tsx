// @vitest-environment jsdom
// Modo simplificado do localizador (home): o estilo entra no Shadow DOM do gmpx-store-locator como folha adotada no
// fim da lista (depois da folha do componente), sem <style> injetado e sem !important. O componente real vem da CDN
// do Google; aqui um elemento de teste com o mesmo nome faz o papel dele (shadow root com a folha do componente).
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleStoreLocator } from "./Mapa.web";

vi.mock("next/script", () => ({ default: () => null }));

const componentSheet = new CSSStyleSheet();
componentSheet.replaceSync("#locations-panel-list .section-name { margin: 1.8em 0 1em 1.5em }");

beforeAll(() => {
  class TestStoreLocator extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      // O jsdom não implementa adoptedStyleSheets; o Lit adota a folha do componente ao criar a raiz.
      Object.defineProperty(root, "adoptedStyleSheets", { value: [componentSheet], writable: true, configurable: true });
      root.innerHTML = '<div id="locations-panel-list"><div class="section-name">All locations (1)</div></div>';
    }
  }
  customElements.define("gmpx-store-locator", TestStoreLocator);
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "AIzaChaveLocalDeTeste");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

// Local da própria locadora (achado 143: sem local não há mapa).
const LOCAL = { title: "Locadora Alfa", address1: "Rua A, 10", coords: { lat: -25.4, lng: -49.3 } };

const shadowOf = (container: HTMLElement) => container.querySelector("gmpx-store-locator")!.shadowRoot!;

describe("GoogleStoreLocator simplificado", () => {
  it("adota a folha do modo simplificado depois da folha do componente, sem <style> no Shadow DOM", async () => {
    const { container } = render(<GoogleStoreLocator location={LOCAL} simplified />);
    const root = shadowOf(container);
    expect(root.adoptedStyleSheets).toEqual([componentSheet]);
    await vi.advanceTimersByTimeAsync(500);
    expect(root.adoptedStyleSheets).toHaveLength(2);
    expect(root.adoptedStyleSheets[0]).toBe(componentSheet);
    const added = root.adoptedStyleSheets[1]!;
    const text = Array.from(added.cssRules, (rule) => rule.cssText).join("\n");
    expect(text).toContain(".section-name");
    expect(text).not.toMatch(/important/i);
    expect(root.querySelector("style")).toBeNull();
    // Continua adotada uma vez só (o intervalo para depois da primeira adoção).
    await vi.advanceTimersByTimeAsync(5000);
    expect(root.adoptedStyleSheets).toHaveLength(2);
  });

  it("fora do modo simplificado não mexe no Shadow DOM", async () => {
    const { container } = render(<GoogleStoreLocator location={LOCAL} />);
    await vi.advanceTimersByTimeAsync(5000);
    const root = shadowOf(container);
    expect(root.adoptedStyleSheets).toEqual([componentSheet]);
    expect(root.querySelector("style")).toBeNull();
  });
});
