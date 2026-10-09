import { Pressable, ScrollView, Text, View } from "react-native";
import type {
  CarouselContentProps,
  CarouselItemProps,
  CarouselNextProps,
  CarouselPreviousProps,
  CarouselProps,
} from "../contract/carousel";

export function Carousel({ children, orientation = "horizontal" }: CarouselProps) {
  return (
    <View accessibilityRole="none" accessibilityLabel={`carousel-${orientation}`}>
      {children}
    </View>
  );
}

export function CarouselContent({ children }: CarouselContentProps) {
  return <ScrollView horizontal>{children}</ScrollView>;
}

export function CarouselItem({ children }: CarouselItemProps) {
  return <View>{children}</View>;
}

export function CarouselPrevious({ onClick, disabled }: CarouselPreviousProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Previous slide"
      disabled={disabled}
      onPress={onClick}
    >
      <Text>‹</Text>
    </Pressable>
  );
}

export function CarouselNext({ onClick, disabled }: CarouselNextProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Next slide"
      disabled={disabled}
      onPress={onClick}
    >
      <Text>›</Text>
    </Pressable>
  );
}

export type CarouselApi = unknown;
