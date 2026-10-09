import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Selo de status", () => {
  it("usa o rótulo informado, espera 120 ms e só vira custom com fundo", () => {
    const source = readFileSync(new URL("./StatusTooltip.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("label || definition?.label || status");
    expect(source).toContain("className?.includes('bg-')");
    expect(source).toContain("? 'custom' : 'outline'");
    expect(source).toContain('side="top"');
    expect(source).toContain("delayDuration={120}");
    expect(source).toContain("h-3.5 w-3.5 text-slate-500");
    const native = readFileSync(new URL("../native/StatusTooltip.native.tsx", import.meta.url), "utf8");
    expect(native).toContain("label || status");
    expect(native).not.toContain("delayDuration");
  });
});
