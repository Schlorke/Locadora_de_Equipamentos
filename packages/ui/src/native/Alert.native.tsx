import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { border, space } from "@gb-locacoes/design-tokens";
import { useTheme } from "../theme/ThemeProvider";

export function Alert({ children, variant="default" }: { children?: ReactNode; variant?:"default"|"destructive" }) {
  const theme = useTheme();
  return (
    <View accessibilityRole="alert" style={{ borderColor: variant==="destructive"?theme.danger:theme.border, borderWidth: border.hairline, padding: space.md }}>
      {children}
    </View>
  );
}
export function AlertTitle({ children }: { children?: ReactNode }) {
  return <Text>{children}</Text>;
}
export function AlertDescription({ children }: { children?: ReactNode }) {
  return <Text>{children}</Text>;
}
