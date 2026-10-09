import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ptBR } from "date-fns/locale";
import { Calendar } from "./Calendario.web";

describe("Calendario", () => {
  it("mantém os rótulos de mês e o padrão sem fim de semana", () => {
    const html = renderToStaticMarkup(
      createElement(Calendar, {
        mode: "single",
        month: new Date(2026, 0, 1),
        locale: ptBR,
        includeWeekends: false,
      }),
    );
    expect(html).toContain("Mês anterior");
    expect(html).toContain("Próximo mês");
    expect(html).toContain("janeiro");
  });
});
