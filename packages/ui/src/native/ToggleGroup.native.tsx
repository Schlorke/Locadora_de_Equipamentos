import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Pressable, Text, View } from "react-native";
import type {
  ToggleGroupItemProps,
  ToggleGroupProps,
} from "../contract/toggle-group";

const ToggleGroupContext = createContext<{
  type: "single" | "multiple";
  value: Set<string>;
  setValue: (value: string) => void;
  disabled: boolean;
} | null>(null);

function toSet(value: string | string[] | undefined): Set<string> {
  if (value === undefined) return new Set();
  return new Set(Array.isArray(value) ? value : [value]);
}

export function ToggleGroup({
  type = "single",
  value: controlled,
  defaultValue,
  onValueChange,
  disabled = false,
  children,
}: ToggleGroupProps) {
  const [uncontrolled, setUncontrolled] = useState(() => toSet(defaultValue));
  const value = controlled !== undefined ? toSet(controlled) : uncontrolled;

  const setValue = (itemValue: string) => {
    const next = new Set(value);
    if (type === "single") {
      if (next.has(itemValue)) next.clear();
      else {
        next.clear();
        next.add(itemValue);
      }
    } else if (next.has(itemValue)) {
      next.delete(itemValue);
    } else {
      next.add(itemValue);
    }
    if (controlled === undefined) setUncontrolled(next);
    const payload =
      type === "multiple" ? Array.from(next) : (Array.from(next)[0] ?? "");
    onValueChange?.(payload);
  };

  const ctx = useMemo(
    () => ({ type, value, setValue, disabled }),
    [disabled, type, value],
  );

  return (
    <ToggleGroupContext.Provider value={ctx}>
      <View accessibilityRole="toolbar">{children}</View>
    </ToggleGroupContext.Provider>
  );
}

export function ToggleGroupItem({
  value,
  disabled,
  children,
}: ToggleGroupItemProps) {
  const ctx = useContext(ToggleGroupContext);
  const isDisabled = Boolean(disabled ?? ctx?.disabled);
  const selected = ctx?.value.has(value) === true;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => ctx?.setValue(value)}
    >
      {typeof children === "string" ? (
        <Text>{children}</Text>
      ) : (
        (children as ReactNode)
      )}
    </Pressable>
  );
}
