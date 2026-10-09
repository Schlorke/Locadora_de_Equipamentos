import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Pilha de scroll", () => {
  it("usa distância 100, escala 0,85 e no celular gap 24", () => {
    const stack = readFileSync(new URL("./ScrollStack.web.tsx", import.meta.url), "utf8");
    const card = readFileSync(new URL("./ScrollStackBenefitCard.web.tsx", import.meta.url), "utf8");
    expect(stack).toContain("itemDistance = 100");
    expect(stack).toContain("itemScale = 0.03");
    expect(stack).toContain("itemStackDistance = 30");
    expect(stack).toContain("baseScale = 0.85");
    expect(stack).toContain("useWindowScroll = true");
    expect(stack).toContain("const mobileGap = 24");
    expect(stack).toContain("scroll-stack-card");
    expect(card).toContain("from-orange-500 to-orange-600");
    expect(card).toContain("{title}");
  });
});
