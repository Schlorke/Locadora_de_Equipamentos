import { Children, type ReactNode } from "react";
import { Text } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
/** RN requires text nodes to live inside Text, even when web accepts string children. */
export function NativeContent({children}:{children?:ReactNode}){const theme=useTheme();return Children.map(children,child=>typeof child==="string"||typeof child==="number"?<Text style={{color:theme.text}}>{child}</Text>:child);}
