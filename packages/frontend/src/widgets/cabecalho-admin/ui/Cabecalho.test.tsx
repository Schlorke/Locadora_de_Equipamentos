import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminPageHeader } from "./Cabecalho";
describe("Cabeçalho das páginas admin",()=> {
  it("renders the original web treatment and optional information badge",()=>{
    const markup=renderToStaticMarkup(<AdminPageHeader title="Locações" subtitle="Acompanhe os contratos" infoBadge={{icon:<span>✓</span>,text:"Atualizado"}}/>);
    expect(markup).toContain("from-orange-500 via-orange-600 to-orange-700");
    expect(markup).toContain("<h1");expect(markup).toContain("Locações");expect(markup).toContain("Atualizado");
    expect(renderToStaticMarkup(<AdminPageHeader title="Locações"/>)).not.toContain("Atualizado");
  });
});
