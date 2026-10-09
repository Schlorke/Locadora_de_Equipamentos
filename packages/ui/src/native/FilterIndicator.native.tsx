import { space } from "@gb-locacoes/design-tokens";
import { Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import type { FilterIndicatorProps } from "../contract/filter-indicator";

const sizeMap = {
  sm: space.sm + space.xs,
  md: space.md,
  lg: space.md + space.xs,
} as const;

export function FilterIndicator({
  isFiltered,
  size = "md",
}: FilterIndicatorProps) {
  const theme = useTheme();
  const iconSize = sizeMap[size];
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={isFiltered ? "Filtro ativo" : "Filtro inativo"}
      style={{
        height: space.xl + space.sm,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Text
        style={{
          color: isFiltered ? theme.focus : theme.textMuted,
          fontSize: iconSize,
        }}
      >
        ▽
      </Text>
    </View>
  );
}
