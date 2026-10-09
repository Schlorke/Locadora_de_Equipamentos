import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("WhatsAppButton", () => {
  it("mantém bg-green-600 e texto Solicitar Orçamento no web; native sem Tailwind verde", () => {
    const source = readFileSync(
      new URL("./WhatsAppButton.web.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("bg-green-600 hover:bg-green-700 text-white");
    expect(source).toContain("Solicitar Orçamento");
    expect(source).toContain("MessageCircle");
    const native = readFileSync(
      new URL("../native/WhatsAppButton.native.tsx", import.meta.url),
      "utf8",
    );
    expect(native).not.toContain("bg-green-600");
    expect(native).not.toContain("className");
    expect(native).toContain("Solicitar Orçamento");
  });
});
