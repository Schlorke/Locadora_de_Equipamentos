import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Calendário de orçamentos", () => {
  it("marca pendente e rejeitado no dia do evento e usa o total do orçamento", () => {
    const source = readFileSync(
      new URL("./Calendario.web.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain("Calendário de Orçamentos");
    expect(source).toContain("quote.status === 'pending'");
    expect(source).toContain("quote.status === 'rejected'");
    expect(source).toContain("pending: '#F97316'");
    expect(source).toContain("approved: '#22c55e'");
    expect(source).toContain("rejected: '#ef4444'");
    expect(source).toContain("|| '#6B7280'");
    expect(source).toContain("type: 'rental'");
    expect(source).toContain("isPendingRequest: isPending || isRejected");
    expect(source).toContain("total: quote.totalPrice");
    expect(source).toContain("defaultViewMode=\"weekly\"");
    expect(source).toContain("h-[500px]");
    expect(source).toContain("ssr: false");
    expect(source).toContain("'Equipamentos'");
    expect(source).toContain("delay: 0.2");
    expect(source).not.toContain("../../packages/frontend");
  });
});
