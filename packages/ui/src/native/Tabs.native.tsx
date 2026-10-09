import { createContext, useContext, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type {
  TabsContentProps,
  TabsListProps,
  TabsProps,
  TabsTriggerProps,
} from "../contract/tabs";

const TabsContext = createContext<{
  value: string;
  setValue: (value: string) => void;
} | null>(null);

export function Tabs({
  value: controlled,
  defaultValue = "",
  onValueChange,
  children,
}: TabsProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlled ?? uncontrolled;
  const setValue = (next: string) => {
    if (controlled === undefined) setUncontrolled(next);
    onValueChange?.(next);
  };
  const ctx = useMemo(() => ({ value, setValue }), [value]);
  return <TabsContext.Provider value={ctx}>{children}</TabsContext.Provider>;
}

export function TabsList({ children }: TabsListProps) {
  return <View accessibilityRole="tablist">{children}</View>;
}

export function TabsTrigger({ value, disabled, children }: TabsTriggerProps) {
  const ctx = useContext(TabsContext);
  const selected = ctx?.value === value;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      disabled={Boolean(disabled)}
      onPress={() => ctx?.setValue(value)}
    >
      {typeof children === "string" ? <Text>{children}</Text> : children}
    </Pressable>
  );
}

export function TabsContent({ value, children }: TabsContentProps) {
  const ctx = useContext(TabsContext);
  if (ctx?.value !== value) return null;
  return <View>{children}</View>;
}
