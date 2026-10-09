import { useState } from "react";
import { View } from "react-native";
import type { SliderProps } from "../contract/slider";

export function Slider({
  value: controlled,
  defaultValue = [0],
  onValueChange,
  min = 0,
  max = 100,
  disabled,
}: SliderProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlled ?? uncontrolled;
  const now = value[0] ?? min;
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityValue={{ min, max, now }}
      onAccessibilityAction={(event) => {
        if (disabled) return;
        const step = 1;
        let next: number;
        if (event.nativeEvent.actionName === "increment") {
          next = Math.min(max, now + step);
        } else if (event.nativeEvent.actionName === "decrement") {
          next = Math.max(min, now - step);
        } else {
          return;
        }
        const nextValue = [next];
        if (controlled === undefined) setUncontrolled(nextValue);
        onValueChange?.(nextValue);
      }}
      accessible
      accessibilityActions={[
        { name: "increment" },
        { name: "decrement" },
      ]}
    >
      <View />
      <View />
    </View>
  );
}
