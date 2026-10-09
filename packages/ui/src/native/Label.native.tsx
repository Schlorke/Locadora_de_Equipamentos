import { Text } from "react-native";
import { resolveTextStyle } from "../contract/text";
import type { LabelProps } from "../contract/form";
import { useTheme } from "../theme/ThemeProvider";

export function Label({ children, htmlFor }: LabelProps) {
  const style = resolveTextStyle(useTheme(), "sm", "default");
  return <Text nativeID={htmlFor?`${htmlFor}-label`:undefined} style={{ color: style.color, fontSize: style.fontSize, fontWeight: style.fontWeight }}>{children}</Text>;
}
