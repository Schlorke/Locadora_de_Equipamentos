import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Pressable, View } from "react-native";
import type {
  RadioGroupItemProps,
  RadioGroupProps,
} from "../contract/radio-group";

const RadioGroupContext = createContext<{
  value: string | undefined;
  setValue: (value: string) => void;
  disabled: boolean;
} | null>(null);

export function RadioGroup({
  value: controlled,
  defaultValue,
  onValueChange,
  disabled = false,
  children,
}: RadioGroupProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlled ?? uncontrolled;
  const setValue = (next: string) => {
    if (controlled === undefined) setUncontrolled(next);
    onValueChange?.(next);
  };
  const ctx = useMemo(
    () => ({ value, setValue, disabled }),
    [disabled, value],
  );
  return (
    <RadioGroupContext.Provider value={ctx}>
      <View accessibilityRole="radiogroup">{children}</View>
    </RadioGroupContext.Provider>
  );
}

export function RadioGroupItem({
  value,
  disabled,
  children,
}: RadioGroupItemProps) {
  const ctx = useContext(RadioGroupContext);
  const isDisabled = Boolean(disabled ?? ctx?.disabled);
  const selected = ctx?.value === value;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => ctx?.setValue(value)}
    >
      <View>{children as ReactNode}</View>
    </Pressable>
  );
}
