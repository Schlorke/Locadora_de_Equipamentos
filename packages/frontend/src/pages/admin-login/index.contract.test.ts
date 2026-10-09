import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("contrato admin-login", () => {
  it("exporta AdminLoginPage pelo index público do slice", () => {
    const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(index).toContain('export { AdminLoginPage } from "./ui/AdminLoginPage"');
  });
});
