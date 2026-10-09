import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Dialog", () => {
  it("mantém o recuo do diálogo aninhado e o viewport com overscroll contido", () => {
    const source = readFileSync(new URL("./Dialog.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("-data-[nested-parent]:translate-y-[0.85rem]");
    expect(source).toContain("data-[nested-parent]:scale-[0.985]");
    expect(source).toContain("z-[var(--layer-dialog)]");
    expect(source).toContain("z-[var(--layer-dialog-backdrop)]");
    expect(source).toContain("bg-black/60");
    expect(source).toContain("max-w-lg");
    expect(source).toContain("variant?: DialogPopupVariant");
    expect(source).toContain("overscrollBehavior: 'contain'");
    const native = readFileSync(new URL("../native/Dialog.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("translate-y-[0.85rem]");
  });
});
