import { View } from "react-native";
import { border } from "@gb-locacoes/design-tokens";
import type { SeparatorProps } from "../contract/form";
import { useTheme } from "../theme/ThemeProvider";

export function Separator({ orientation = "horizontal" }: SeparatorProps) {
  const theme = useTheme();
  const horizontal = orientation === "horizontal";
  return (
    <View
      accessibilityRole="none"
      style={{
        backgroundColor: theme.border,
        height: horizontal ? border.hairline : "100%",
        width: horizontal ? "100%" : border.hairline,
      }}
    />
  );
}
