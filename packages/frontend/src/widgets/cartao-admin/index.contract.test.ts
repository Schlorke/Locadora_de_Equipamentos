import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("contrato migracao cartao-admin", () => {
  it("exporta AdminCard pelo index publico do slice", () => {
    const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(index).toContain("export { AdminCard }");
    expect(index).toContain('from "./ui/Cartao"');
  });
});
