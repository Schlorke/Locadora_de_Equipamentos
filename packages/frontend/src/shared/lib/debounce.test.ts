import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("useDebounce", () => {
  it("mantém atraso padrão em ms e API sem imports de plataforma", () => {
    const source = readFileSync(new URL("./debounce.ts", import.meta.url), "utf8");
    expect(source).toContain("export function useDebounce<T>(value: T, delay: number = 350): T");
    expect(source).toContain("setTimeout");
    expect(source).toContain("clearTimeout");
    expect(source).toContain("from 'react'");
    expect(source).not.toContain("next/");
    expect(source).not.toContain("react-dom");
    expect(source).not.toContain("react-native");
  });
});
