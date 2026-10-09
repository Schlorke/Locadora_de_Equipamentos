import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { themes } from "@gb-locacoes/design-tokens";
import { ctaVariantNames, resolveCTAButtonStyle } from "../contract/cta-button";

describe("CTAButton", () => {
  it("preserva variantes primary secondary outline ghost e orange-600 na web", () => {
    const source = readFileSync(new URL("./CTAButton.web.tsx", import.meta.url), "utf8");
    expect(ctaVariantNames).toEqual(["primary", "secondary", "outline", "ghost"]);
    expect(source).toContain("bg-orange-600 hover:bg-orange-700");
    expect(source).toContain("border-orange-600");
    expect(source).toContain("text-orange-600");
    expect(source).toContain("bg-gray-600 hover:bg-gray-700");
    expect(source).toContain('trackingId="request-quote"');
    expect(source).toContain("Solicitar Orçamento");
    expect(source).toContain("bg-green-600 hover:bg-green-700 text-white");
    expect(source).toContain("event_category: \"CTA\"");
    expect(source).toContain("from-orange-500 via-orange-600 to-orange-700");
  });

  it("resolve primary nativo com token primary #ea580c sem classes Tailwind", () => {
    const style = resolveCTAButtonStyle(themes.light, "primary", "md", {});
    expect(style.backgroundColor.toUpperCase()).toBe(themes.light.primary.toUpperCase());
    expect(themes.light.primary.toUpperCase()).toBe("#EA580C");
    const native = readFileSync(new URL("../native/CTAButton.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("bg-orange-600");
    expect(native).not.toContain("hover:scale-105");
    expect(native).toContain("resolveCTAButtonStyle");
  });
});
