import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Chart", () => {
  it("mantém o container aspect-video, altura mínima e seletores Recharts", () => {
    const source = readFileSync(new URL("./Chart.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("flex aspect-video justify-center text-xs w-full");
    expect(source).toContain("stroke='#ccc'");
    expect(source).toContain("stroke='#fff'");
    expect(source).toContain('minHeight: "200px"');
    expect(source).toContain("min-h-[200px]");
    expect(source).toContain("useChart must be used within a <ChartContainer />");
    expect(source).toContain("grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50");
    const native = readFileSync(new URL("../native/Chart.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("aspect-video");
    expect(native).not.toContain("stroke='#ccc'");
    expect(native).toContain("react-native");
  });
});
