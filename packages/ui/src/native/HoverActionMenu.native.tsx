import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { border, space } from "@gb-locacoes/design-tokens";
import { useTheme } from "../theme/ThemeProvider";
import type {
  HoverActionMenuPosition,
  HoverActionMenuProps,
} from "../contract/hover-action-menu";

export function HoverActionMenu({
  children,
  position = "top-center",
  disabled,
  onClick,
  "aria-label": ariaLabel,
}: HoverActionMenuProps & { children: ReactNode; position?: HoverActionMenuPosition }) {
  const theme = useTheme();
  const isTop = position.startsWith("top");
  const isLeft = position.endsWith("left");
  const isRight = position.endsWith("right");

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        zIndex: 10,
        alignItems: "center",
        justifyContent: "center",
        ...(isTop ? { top: space.none } : { bottom: space.none }),
        ...(isLeft
          ? { left: space.none }
          : isRight
            ? { right: space.none }
            : { left: space.none, right: space.none }),
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ariaLabel}
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={Boolean(disabled)}
        onPress={disabled ? undefined : () => void onClick?.()}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: space.xs,
          paddingHorizontal: space.sm + space.xs,
          paddingVertical: space.xs,
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: border.hairline,
          borderRadius: space.xxl,
          opacity: pressed || disabled ? 0.7 : 1,
        })}
      >
        {children}
      </Pressable>
    </View>
  );
}
