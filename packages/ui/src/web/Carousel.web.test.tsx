import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Carousel", () => {
  it("mantém Embla, setas e overflow-hidden no web; native sem Tailwind Embla", () => {
    const source = readFileSync(new URL("./Carousel.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("embla-carousel-react");
    expect(source).toContain("overflow-hidden");
    expect(source).toContain("Previous slide");
    expect(source).toContain("Next slide");
    const native = readFileSync(new URL("../native/Carousel.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("overflow-hidden");
    expect(native).not.toContain("embla-carousel-react");
    expect(native).not.toContain("className");
  });
});
