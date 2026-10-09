import { Text, View } from "react-native";
import { componentTokens, radius, space, typography } from "@gb-locacoes/design-tokens";
import { Children, type ReactNode } from "react";
import { useTheme } from "../theme/ThemeProvider";

export function Badge({ children, variant = "default" }: { children?: ReactNode; variant?: "default" | "secondary" | "destructive" | "outline" }) {
  const theme = useTheme();
  const button = componentTokens(theme).button;
  const backgroundColor = variant === "destructive" ? theme.danger : variant === "outline" ? "transparent" : button.background.primary;
  const color = variant === "outline" ? theme.text : button.color.primary;
  return (
    <View style={{ borderRadius: radius.lg, paddingHorizontal: space.sm, paddingVertical: space.xs, backgroundColor, flexDirection: "row", alignItems: "center", gap: space.xs }}>
      {Children.map(children, child => typeof child === "string" || typeof child === "number" ? <Text style={{ color, fontSize: typography.size.sm }}>{child}</Text> : child)}
    </View>
  );
}
