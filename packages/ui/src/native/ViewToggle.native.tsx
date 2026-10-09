import type {ComponentType} from "react";
import { Pressable, Text, View } from "react-native";
import { space, border, radius } from "@gb-locacoes/design-tokens";
import { useTheme } from "../theme/ThemeProvider";
export function ViewToggle({options,value,onValueChange}:{options:{value:string;label:string;icon?:ComponentType<{className?:string}>}[];value:string;onValueChange?:(value:string)=>void}){const theme=useTheme();return <View style={{flexDirection:"row",gap:space.sm}}>{options.map(({icon:Icon,...option})=><Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{selected:value===option.value}} onPress={()=>onValueChange?.(option.value)} style={{padding:space.sm,borderWidth:border.hairline,borderColor:theme.border,borderRadius:radius.sm,backgroundColor:value===option.value?theme.surface:theme.background}}>{Icon?<Icon/>:null}<Text style={{color:theme.text}}>{option.label}</Text></Pressable>)}</View>;}
