import { Pressable, Text } from "react-native";

export function CloseButton({
  accessibilityLabel = "Close",
  onPress,
  onClick,
  "aria-label": label,
  disabled,
}: {
  accessibilityLabel?: string;
  onPress?: () => void;
  onClick?: () => void;
  "aria-label"?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={Boolean(disabled)}
      onPress={disabled ? undefined : onPress ?? onClick}
    >
      <Text>{accessibilityLabel}</Text>
    </Pressable>
  );
}
