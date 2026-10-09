import { Text } from "react-native";

export function StatusTooltip({
  status,
  label,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  return <Text>{label || status}</Text>;
}
