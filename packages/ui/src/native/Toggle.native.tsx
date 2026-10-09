import { useState } from "react";
import { Pressable, Text } from "react-native";
import type { ToggleProps } from "../contract/toggle";

export function Toggle({
  pressed: controlled,
  defaultPressed = false,
  onPressedChange,
  disabled,
  children,
}: ToggleProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultPressed);
  const pressed = controlled ?? uncontrolled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: pressed, disabled: Boolean(disabled) }}
      disabled={Boolean(disabled)}
      onPress={() => {
        const next = !pressed;
        if (controlled === undefined) setUncontrolled(next);
        onPressedChange?.(next);
      }}
    >
      {typeof children === "string" ? <Text>{children}</Text> : children}
    </Pressable>
  );
}
