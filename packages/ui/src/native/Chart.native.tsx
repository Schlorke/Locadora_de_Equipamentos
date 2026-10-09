import { createContext, useContext, useState, isValidElement, cloneElement, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { border, radius, space, typography } from "@gb-locacoes/design-tokens";
import type { ChartConfig, ChartContainerProps, ChartPlotProps } from "../contract/chart";
import { useTheme } from "../theme/ThemeProvider";
export type { ChartConfig } from "../contract/chart";
interface Payload {dataKey?:string;name?:string;value?:number|string;color?:string;payload?:Record<string,unknown>}
const ChartContext=createContext<{config:ChartConfig;payload:Payload[];label?:string;select:(payload:Payload[],label:string)=>void}|null>(null);
function useChart(){const context=useContext(ChartContext);if(!context)throw new Error("Chart parts require ChartContainer");return context;}
export function ChartContainer({children,config}:ChartContainerProps) {
 const [selected,setSelected]=useState<{payload:Payload[];label?:string}>({payload:[]});
 return <ChartContext.Provider value={{config,...selected,select:(payload,label)=>setSelected({payload,label})}}><View style={{gap:space.sm}}>{children}</View></ChartContext.Provider>;
}
/** Web emits CSS variables; native resolves the same configuration through context. */
export function ChartStyle(_props:{id:string;config:ChartConfig}){return null;}
export function ChartPlot({data,series,children}:ChartPlotProps){
 const {config,select}=useChart();const theme=useTheme();const max=Math.max(...data.map(p=>p.value),1);
 const color=config[series]?.color??config[series]?.theme?.light??theme.primary;
 return <View style={{gap:space.sm}}>{data.map((point,index)=><Pressable key={`${point.label}-${index}`} accessibilityRole="button" accessibilityLabel={`${point.label}: ${point.value}`} onPress={()=>select([{dataKey:series,name:series,value:point.value,color}],point.label)} style={{gap:space.xs}}><Text style={{color:theme.text}}>{point.label}: {point.value}</Text><View style={{height:space.md,width:`${Math.max(0,point.value)/max*100}%`,backgroundColor:color,borderRadius:radius.sm}}/></Pressable>)}{children}</View>;
}
export function ChartTooltip({content,children}:{content?:ReactNode;children?:ReactNode}) {
 const context=useChart();if(!context.payload.length)return null;
 return isValidElement<{active?:boolean;payload?:Payload[];label?:string}>(content)?cloneElement(content,{active:true,payload:context.payload,label:context.label}):children??<ChartTooltipContent active payload={context.payload} label={context.label}/>;
}
export function ChartTooltipContent({active,payload=[],label,hideLabel=false,hideIndicator=false,formatter}:{active?:boolean;payload?:Payload[];label?:string;hideLabel?:boolean;hideIndicator?:boolean;formatter?:(value:number|string|undefined,name:string|undefined,item:Payload)=>ReactNode;children?:ReactNode}) {
 const {config}=useChart();const theme=useTheme();if(!active||!payload.length)return null;
 return <View accessibilityRole="summary" style={{padding:space.sm,borderRadius:radius.sm,borderWidth:border.hairline,borderColor:theme.border,backgroundColor:theme.surface,gap:space.xs}}>{!hideLabel&&label?<Text style={{color:theme.text}}>{label}</Text>:null}{payload.map((item,i)=><View key={i} style={{flexDirection:"row",gap:space.sm,alignItems:"center"}}>{!hideIndicator?<View style={{width:space.sm,height:space.sm,backgroundColor:item.color??theme.primary}}/>:null}<Text style={{color:theme.text,fontSize:typography.size.sm}}>{formatter?formatter(item.value,item.name,item):<>{config[item.dataKey??item.name??""]?.label??item.name}: {item.value}</>}</Text></View>)}</View>;
}
export function ChartLegend({content,children}:{content?:ReactNode;children?:ReactNode}){
 const {config}=useChart();const payload=Object.entries(config).map(([name,item])=>({name,value:name,color:item.color??item.theme?.light,dataKey:name}));
 return isValidElement<{payload?:Payload[]}>(content)?cloneElement(content,{payload}):children??<ChartLegendContent payload={payload}/>;
}
export function ChartLegendContent({payload,hideIcon=false}:{payload?:Payload[];hideIcon?:boolean;children?:ReactNode}){
 const {config}=useChart();const theme=useTheme();const entries=payload??Object.keys(config).map(name=>({name,dataKey:name,color:config[name]?.color}));
 return <View style={{flexDirection:"row",gap:space.md}}>{entries.map((item,i)=>{const entry=config[item.dataKey??item.name??""];const Icon=entry?.icon;return <View key={i} style={{flexDirection:"row",gap:space.xs,alignItems:"center"}}>{hideIcon?null:Icon?<Icon/>:<View style={{width:space.sm,height:space.sm,backgroundColor:item.color??theme.primary}}/>}<Text style={{color:theme.text,fontSize:typography.size.sm}}>{entry?.label??item.name}</Text></View>;})}</View>;
}
