import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminCard } from "./Cartao";
describe("Cartão admin",()=>{
  it("renders content and headers without losing each variant treatment",()=>{
    for(const [variant,expected] of [["default","hover:scale-[1.02]"],["elevated","hover:scale-[1.03]"],["glass","bg-white/10"],["flat","duration-200"]] as const){
      const html=renderToStaticMarkup(<AdminCard variant={variant} title="Equipamentos" subtitle="Ativos"><span>Conteúdo</span></AdminCard>);
      expect(html).toContain(expected);expect(html).toContain("Equipamentos");expect(html).toContain("Ativos");expect(html).toContain("Conteúdo");
      if(variant==="flat")expect(html).not.toContain("hover:scale-");
    }
  });
});
