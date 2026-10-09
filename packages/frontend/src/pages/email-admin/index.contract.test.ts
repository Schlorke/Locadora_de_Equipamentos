import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("contrato email-admin", () => {
  it("exporta AdminEmailPage pelo index público do slice", () => {
    const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    // Onda 135 (A6): o carregamento da rota (AdminEmailLoading) sai pela mesma entrada.
    expect(index).toContain(
      'export { AdminEmailPage, AdminEmailLoading } from "./ui/EmailAdminPage.web"',
    );
  });
});
