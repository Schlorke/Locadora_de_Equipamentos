import { Text, View } from "react-native";
import type { ReactNode } from "react";

export function NotificationBadge({
  count,
  maxCount = 99,
  showZero = false,
}: {
  count: number;
  variant?: "default" | "dot" | "pulse";
  size?: "sm" | "md" | "lg";
  showZero?: boolean;
  maxCount?: number;
}) {
  if (count === 0 && !showZero) return null;
  const displayCount = count > maxCount ? `${maxCount}+` : String(count);
  return <Text>{displayCount}</Text>;
}

export function NotificationBadgeWrapper({
  children,
  count,
}: {
  children?: ReactNode;
  count: number;
  variant?: "default" | "dot" | "pulse";
  size?: "sm" | "md" | "lg";
  showZero?: boolean;
  maxCount?: number;
}) {
  return (
    <View>
      {children}
      <NotificationBadge count={count} />
    </View>
  );
}
