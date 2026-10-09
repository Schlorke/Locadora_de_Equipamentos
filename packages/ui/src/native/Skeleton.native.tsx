import { View } from "react-native";
import { radius,space } from "@gb-locacoes/design-tokens";
import { useTheme } from "../theme/ThemeProvider";
export function Skeleton({width,height=space.lg}:{width?:number;height?:number}){const theme=useTheme();return <View accessibilityLabel="Carregando" style={{width:width??"100%",height,borderRadius:radius.sm,backgroundColor:theme.border}}/>;}
