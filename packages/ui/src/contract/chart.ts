import type { ComponentType, ReactNode } from "react";

/** Temas do gráfico (a implementação web liga cada um ao seletor CSS dele). */
type ChartTheme = "light" | "dark";

/** Configuração tipada de séries/cores do gráfico (shadcn/recharts). */
export type ChartConfig = Record<
  string,
  {
    label?: ReactNode;
    icon?: ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<ChartTheme, string> }
  )
>;

/** Recorte compartilhado. O web aceita também atributos de div e children do ResponsiveContainer. */
export interface ChartContainerProps {
  config: ChartConfig;
  children?: ReactNode;
  className?: string;
  id?: string;
}

export interface ChartPlotProps {
 data: Array<{label:string;value:number}>;
 series: string;
 children?: ReactNode;
}
