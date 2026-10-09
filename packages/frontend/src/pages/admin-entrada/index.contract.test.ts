import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("contrato migracao admin-entrada", () => {
  it("exporta AdminIndexPage pelo index publico do slice", () => {
    const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(index).toContain("export { AdminIndexPage }");
    expect(index).toContain('from "./ui/AdminIndexPage"');
  });
});
