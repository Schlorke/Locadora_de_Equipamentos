import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("partes do hero", () => {
  it("o primeiro slide continua prioritário e a onda some quando é none", () => {
    const background = readFileSync(new URL("./HeroBackgroundCarousel.web.tsx", import.meta.url), "utf8");
    const dots = readFileSync(new URL("./HeroCarouselDots.web.tsx", import.meta.url), "utf8");
    const wave = readFileSync(new URL("./HeroWaveAnimation.web.tsx", import.meta.url), "utf8");
    expect(background).toContain("currentImage === 0");
    expect(background).toContain("fetchPriority={isPrimarySlide ? 'high' : 'auto'}");
    expect(background).toContain("alt={`Slide ${currentImage + 1}`}");
    expect(dots).toContain("h-3 w-3 rounded-full");
    expect(dots).toContain("Ir para imagem");
    expect(wave).toContain("waveAnimation === 'none'");
    expect(wave).toContain("waveAnimation === 'animated'");
    expect(wave).toContain('viewBox="0 0 1200 120"');
    expect(wave).toContain("rgb(249, 250, 251)");
  });
});
