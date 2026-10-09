import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {GridMotion} from "./GridMotion.web";
describe("GridMotion web",()=>{it("renders four rows and caps the grid at 28 items",()=>{
 const html=renderToStaticMarkup(<GridMotion gradientColor="navy" items={Array.from({length:29},(_,index)=>"Tile-"+index+";")}/>);
 expect(html.match(/class="grid grid-cols-7 gap-4"/g)).toHaveLength(4);
 expect(html).toContain("radial-gradient(circle, navy 0%, transparent 100%)");expect(html).toContain("Tile-27;");expect(html).not.toContain("Tile-28;");
})});
