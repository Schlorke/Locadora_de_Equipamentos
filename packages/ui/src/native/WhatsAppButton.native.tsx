import { Pressable, Text } from "react-native";
import type { WhatsAppButtonProps } from "../contract/whatsapp-button";

export function WhatsAppButton({
  onClick,
  disabled = false,
  children,
}: WhatsAppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onClick}
    >
      <Text>{children || "Solicitar Orçamento"}</Text>
    </Pressable>
  );
}
