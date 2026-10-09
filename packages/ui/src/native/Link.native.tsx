import type { ReactNode } from "react";
import { Linking, Pressable, Text } from "react-native";
import { useNavigate } from "../contract/navigation";
import { useTheme } from "../theme/ThemeProvider";

export function Link({ href, children }: { href: string; children?: ReactNode }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const onPress = () => {
    if (navigate) return navigate(href);
    return Linking.openURL(href);
  };
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={typeof children === "string" ? children : href}>
      <Text style={{ color: theme.primary }}>{children}</Text>
    </Pressable>
  );
}
