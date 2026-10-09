import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Tabela de logística", () => {
  it("inicia a entrega agendada e conclui a que está em trânsito", () => {
    const source = readFileSync(new URL("./Tabela.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("Exibir");
    expect(source).toContain("Editar");
    expect(source).toContain("delivery.status === 'SCHEDULED'");
    expect(source).toContain("onUpdateStatus(delivery.id, 'IN_TRANSIT')");
    expect(source).toContain("Iniciar");
    expect(source).toContain("delivery.status === 'IN_TRANSIT'");
    expect(source).toContain("onUpdateStatus(delivery.id, 'COMPLETED')");
    expect(source).toContain("Concluir");
    const page = readFileSync(new URL("./LogisticaPage.web.tsx", import.meta.url), "utf8");
    expect(page).toContain("from './Tabela.web'");
    expect(source).toContain("from './Utilidades'");
    expect(source).not.toContain("components/admin/logistics");
  });
});
