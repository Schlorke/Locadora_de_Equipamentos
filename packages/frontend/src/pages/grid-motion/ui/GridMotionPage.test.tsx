import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {PLATFORM} from "@gb-locacoes/contracts/platform";
import {GridMotionPage} from "./GridMotionPage";
describe("GridMotion product laboratory",()=>{it("renders the shared icon collection and interaction instruction",()=>{
 const html=renderToStaticMarkup(<GridMotionPage/>);
 for(const text of [PLATFORM.displayName,"Mova o mouse para ver a mágica acontecer","Andaimes","Concretagem","Compressores","Demolição","Limpeza","Terraplenagem","Altura","Transporte","Elétrica","Tubular"])expect(html).toContain(text);
 expect(html.match(/class="grid grid-cols-7 gap-4"/g)).toHaveLength(4);
})});
