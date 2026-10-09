import { Pressable, Text } from "react-native";

export function FilterResetButton({
  onClick,
  title = "Resetar filtros",
}: {
  onClick?: () => void;
  title?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <Pressable accessibilityLabel={title} onPress={onClick}>
      <Text>{title}</Text>
    </Pressable>
  );
}
