import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Painel financeiro", () => {
  it("mantém o título e o suspense vazio", () => {
    const source = readFileSync(new URL("./FinanceiroPage.web.tsx", import.meta.url), "utf8");
    expect(source).toContain('title="Painel Financeiro"');
    expect(source).toContain('subtitle="Boletos, pagamentos, notas fiscais e lançamentos"');
    expect(source).toContain('title="Calendário Financeiro"');
    expect(source).toContain("<Suspense fallback={null}>");
    expect(source).toContain("export function AdminFinanceiroPageWrapper()");
    const route = readFileSync(
      new URL("../../../../../../app/admin/financeiro/page.tsx", import.meta.url),
      "utf8",
    );
    expect(route).toContain("from '@gb-locacoes/frontend/pages/financeiro'");
    expect(route).toContain("return <AdminFinanceiroPageWrapper />");
    // Onda 135 (A8): a mesma página no host web; a asserção sobre a raiz sai no bloco F.
    const webRoute = readFileSync(
      new URL(
        "../../../../../../apps/clients/web/src/app/(admin)/admin/financeiro/page.tsx",
        import.meta.url
      ),
      "utf8"
    );
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/financeiro["']/
    );
    expect(webRoute).toContain("return <AdminFinanceiroPageWrapper />");
  });
});
