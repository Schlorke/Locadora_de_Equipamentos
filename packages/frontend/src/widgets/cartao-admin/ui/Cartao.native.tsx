import { View, Text } from "react-native";
import { border, radius, space, typography } from "@gb-locacoes/design-tokens";
import { useTheme } from "@gb-locacoes/ui";
import type { AdminCardProps } from "./contract";
export type { AdminCardProps } from "./contract";
export function AdminCard({children,title,subtitle,icon,variant="default"}:AdminCardProps){
  const theme=useTheme();
  return <View style={{padding:space.md,gap:space.md,borderRadius:radius.md,backgroundColor:theme.surface,borderWidth:variant==="glass"?border.hairline:border.none,borderColor:theme.border}}>
    {title||subtitle||icon?<View style={{flexDirection:"row",alignItems:"center",gap:space.sm}}>{icon}<View style={{flex:1,gap:space.xs}}>{title?<Text accessibilityRole="header" style={{color:theme.text,fontSize:typography.size.md,fontWeight: typography.weight.semibold}}>{title}</Text>:null}{subtitle?<Text style={{color:theme.textMuted}}>{subtitle}</Text>:null}</View></View>:null}
    {children}
  </View>;
}
