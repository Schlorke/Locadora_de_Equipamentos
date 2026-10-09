import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("contrato entrar", () => {
  it("exporta EntrarPage pelo index público do slice", () => {
    const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(index).toContain('export { EntrarPage } from "./ui/EntrarPage"');
  });
});
