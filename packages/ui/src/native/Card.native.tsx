import { NativeContent } from "./native-content.native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { border, radius, space } from "@gb-locacoes/design-tokens";
import { useTheme } from "../theme/ThemeProvider";

function Surface({ children }: { children?: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        borderWidth: border.hairline,
        borderColor: theme.border,
        borderRadius: radius.md,
        backgroundColor: theme.surface,
        padding: space.md,
      }}
    >
      <NativeContent>{children}</NativeContent>
    </View>
  );
}

export function Card({ children }: { children?: ReactNode }) {
  return <Surface><NativeContent>{children}</NativeContent></Surface>;
}
export function CardHeader({ children }: { children?: ReactNode }) {
  return <View><NativeContent>{children}</NativeContent></View>;
}
export function CardTitle({ children }: { children?: ReactNode }) {
  return <View><NativeContent>{children}</NativeContent></View>;
}
export function CardDescription({ children }: { children?: ReactNode }) {
  return <View><NativeContent>{children}</NativeContent></View>;
}
export function CardContent({ children }: { children?: ReactNode }) {
  return <View><NativeContent>{children}</NativeContent></View>;
}
export function CardFooter({ children }: { children?: ReactNode }) {
  return <View><NativeContent>{children}</NativeContent></View>;
}
