import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Kanban de orçamentos", () => {
  it("mostra status rejeitado, total e horário em pt-BR", () => {
    const source = readFileSync(new URL("./Kanban.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("status === 'rejected'");
    expect(source).toContain("equipamento(s)");
    expect(source).toContain("finalTotal ??");
    expect(source).toContain("originalTotal ??");
    expect(source).toContain("toLocaleTimeString('pt-BR'");
    expect(source).toContain("hour: '2-digit'");
    expect(source).toContain("minute: '2-digit'");
    expect(source).toContain("columnsPerRow={{ mobile: 1, tablet: 2, desktop: 4, xl: 4 }}");
    expect(source).toContain("delay: 0.28");
    expect(source).toContain("h-64 animate-pulse");
    expect(source).toContain("ssr: false");
    expect(source).toContain("../../../widgets/navegador-mes");
    expect(source).not.toContain("../../packages/frontend");
  });
});
