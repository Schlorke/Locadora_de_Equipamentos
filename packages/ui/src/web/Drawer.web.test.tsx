import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Drawer", () => {
  it("mantém vaul, bg-black/80 e bg-background no web; nativo sem Tailwind", () => {
    const source = readFileSync(new URL("./Drawer.web.tsx", import.meta.url), "utf8");
    expect(source).toContain('from "vaul"');
    expect(source).toContain("bg-black/80");
    expect(source).toContain(
      "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
    );
    expect(source).toContain("rounded-full bg-muted");
    const native = readFileSync(
      new URL("../native/Drawer.native.tsx", import.meta.url),
      "utf8",
    );
    expect(native).toContain("Modal");
    expect(native).toContain("Pressable");
    expect(native).not.toContain("bg-black/80");
    expect(native).not.toContain("className");
    expect(native).not.toContain("bg-background");
  });
});
