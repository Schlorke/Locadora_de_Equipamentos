import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Home cliente", () => {
  it("carrega vitrine e destaques sem SSR e com o pulso cinza", () => {
    const source = readFileSync(new URL("./HomeCliente.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("Vitrine.web");
    expect(source).toContain("Destaques.web");
    expect(source.match(/ssr: false/g)?.length).toBe(2);
    expect(source.match(/h-96 bg-gray-100 animate-pulse/g)?.length).toBe(2);
  });
});
