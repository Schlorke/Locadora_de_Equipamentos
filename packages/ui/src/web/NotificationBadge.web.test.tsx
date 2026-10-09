import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Selo de notificação", () => {
  it("esconde o zero, corta em 99 e pinta o ponto de vermelho", () => {
    const source = readFileSync(new URL("./NotificationBadge.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("maxCount = 99");
    expect(source).toContain("showZero = false");
    expect(source).toContain("variant = 'default'");
    expect(source).toContain("size = 'md'");
    expect(source).toContain("if (!isMounted) return null");
    expect(source).toContain("if (count === 0 && !showZero) return null");
    expect(source).toContain("count > maxCount ? `${maxCount}+`");
    expect(source).toContain("bg-red-500");
    expect(source).toContain("duration: 0.2");
    expect(source).toContain("scale: [1, 1.2, 1]");
    expect(source).toContain("duration: 1, repeat: Infinity");
    expect(source).toContain("'relative inline-block'");
    expect(source).toContain("md: 'h-5 w-5 text-xs'");
    const native = readFileSync(new URL("../native/NotificationBadge.native.tsx", import.meta.url), "utf8");
    expect(native).toContain("maxCount = 99");
    expect(native).not.toContain("bg-red-500");
  });
});
