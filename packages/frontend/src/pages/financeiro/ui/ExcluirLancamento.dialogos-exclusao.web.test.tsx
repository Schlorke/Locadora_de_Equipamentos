import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Diálogos de exclusão financeira", () => {
  it("mantém as confirmações de lançamento e de reajuste", () => {
    const entry = readFileSync(
      new URL("./ExcluirLancamento.web.tsx", import.meta.url),
      "utf8"
    );
    const adjustment = readFileSync(
      new URL("./ExcluirReajuste.web.tsx", import.meta.url),
      "utf8"
    );
    expect(entry).toContain("Excluir lançamento?");
    expect(entry).toContain(
      "Esta ação não pode ser desfeita. O lançamento será removido"
    );
    expect(entry).toContain("permanentemente.");
    expect(entry).toContain("aria-label=\"Fechar\"");
    expect(entry).toContain("variant=\"outline\"");
    expect(entry).toContain("Cancelar");
    expect(entry).toContain("isDeleting ? 'Excluindo...' : 'Excluir'");
    expect(adjustment).toContain("Excluir reajuste?");
    expect(adjustment).toContain(
      "O valor total do orçamento será recalculado e a"
    );
    expect(adjustment).toContain("justificativa atualizada. Esta ação não pode ser desfeita.");
    expect(adjustment).toContain("aria-label=\"Fechar\"");
  });
});
