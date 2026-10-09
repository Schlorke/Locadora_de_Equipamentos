import { View } from "react-native";
import type { ProgressProps } from "../contract/progress";

export function Progress({ value }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View />
    </View>
  );
}
