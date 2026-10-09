"use client";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { ChartPlotProps } from "../contract/chart";
export function ChartPlot({data,series,children}:ChartPlotProps) {
 return <BarChart data={data}><CartesianGrid vertical={false}/><XAxis dataKey="label"/><YAxis/><Bar dataKey="value" name={series} fill={`var(--color-${series})`}/>{children}</BarChart>;
}
