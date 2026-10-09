import { View } from "react-native";
import type { AspectRatioProps } from "../contract/aspect-ratio";

export function AspectRatio({ ratio = 1, children }: AspectRatioProps) {
  return <View style={{ aspectRatio: ratio }}>{children}</View>;
}
