"use client";
import * as C from "@gb-locacoes/ui";
import { themes } from "@gb-locacoes/design-tokens";
export function CatalogChart({empty}:{empty:boolean}) {
 const data=empty?[]:[{label:"A",value:12},{label:"B",value:18},{label:"C",value:8}];
 return <C.Stack><C.ChartContainer config={{value:{label:"Quantidade",color:themes.light.primary}}}><C.ChartPlot data={data} series="value"><C.ChartTooltip content={<C.ChartTooltipContent/>}/><C.ChartLegend content={<C.ChartLegendContent/>}/></C.ChartPlot></C.ChartContainer>{empty?<C.Text>Nenhum dado para exibir</C.Text>:null}</C.Stack>;
}
