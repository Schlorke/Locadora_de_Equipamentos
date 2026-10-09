import { Text, View } from "react-native";
import type { ReactNode } from "react";
import { space,border,typography } from "@gb-locacoes/design-tokens";
import { useTheme } from "../theme/ThemeProvider";
function Section({children}:{children?:ReactNode}){return <View>{children}</View>;}
export const Table=Section,TableHeader=Section,TableBody=Section,TableFooter=Section;
export function TableRow({children}:{children?:ReactNode}){const theme=useTheme();return <View style={{flexDirection:"row",borderBottomWidth:border.hairline,borderBottomColor:theme.border}}>{children}</View>;}
export function TableCell({children,colSpan=1}:{children?:ReactNode;colSpan?:number}){const theme=useTheme();return <View style={{flex:colSpan,padding:space.sm}}><Text style={{color:theme.text}}>{children}</Text></View>;}
export function TableHead({children}:{children?:ReactNode}){const theme=useTheme();return <View style={{flex:1,padding:space.sm}}><Text style={{color:theme.text,fontWeight:typography.weight.semibold}}>{children}</Text></View>;}
export function TableCaption({children}:{children?:ReactNode}){const theme=useTheme();return <Text style={{color:theme.textMuted}}>{children}</Text>;}
