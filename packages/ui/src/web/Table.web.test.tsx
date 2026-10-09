import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Table", () => {
  it("mantém o cabeçalho h-12 e a linha com hover muted", () => {
    const source = readFileSync(new URL("./Table.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("w-full caption-bottom text-sm");
    expect(source).toContain("[&_tr]:border-b");
    expect(source).toContain("[&_tr:last-child]:border-0");
    expect(source).toContain("hover:bg-muted/50 data-[state=selected]:bg-muted");
    expect(source).toContain("h-12 px-4 text-left");
    expect(source).toContain("p-4 align-middle");
    const native = readFileSync(new URL("../native/Table.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("h-12 px-4");
  });
});
