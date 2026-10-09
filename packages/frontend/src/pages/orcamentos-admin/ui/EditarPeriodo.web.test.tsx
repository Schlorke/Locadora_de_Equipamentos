import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Diálogo de editar período do item", () => {
  it("mantém finais de semana, prévia e o calendário do seletor", () => {
    const source = readFileSync(
      new URL("./EditarPeriodo.web.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain("Editar período do item");
    expect(source).toContain('id="edit-item-include-weekends"');
    expect(source).toContain("includeWeekends: checked === true");
    expect(source).toContain("Inclui finais de semana");
    expect(source).toContain("Não inclui finais de semana");
    expect(source).toContain("Data início");
    expect(source).toContain("Data fim");
    expect(source).toContain("Selecione a data");
    expect(source).toContain("Defina as datas para ver a prévia e o valor");
    expect(source).toContain("preview.days === 1 ? 'dia' : 'dias'");
    expect(source).toContain("from '../../../widgets/seletor-data'");
    expect(source).not.toContain("equipamento-detalhe");
    expect(source).toContain("date.getDay() === 0 || date.getDay() === 6");
    expect(source).toContain("format(date, 'yyyy-MM-dd')");
    expect(source).toContain("isSaving ? 'Salvando...' : 'Salvar'");
    expect(source).toContain("!draft.startDate?.trim() || !draft.endDate?.trim()");
    expect(source).toContain('variant="outline"');
    expect(source).toContain('variant="default"');
    expect(source).toContain('aria-label="Fechar dialog"');
    expect(source).toContain("editingItem.equipment?.name ?? 'Equipamento'");
  });
});
