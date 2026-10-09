import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Text, TextInput, View } from "react-native";
import type {
  InputOTPGroupProps,
  InputOTPProps,
  InputOTPSeparatorProps,
  InputOTPSlotProps,
} from "../contract/input-otp";

const InputOTPContext = createContext<{
  value: string;
  maxLength: number;
} | null>(null);

export function InputOTP({
  maxLength = 6,
  value: controlled,
  defaultValue = "",
  onChange,
  disabled,
  children,
}: InputOTPProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlled ?? uncontrolled;
  const ctx = useMemo(() => ({ value, maxLength }), [maxLength, value]);
  return (
    <InputOTPContext.Provider value={ctx}>
      <View>
        <TextInput
          accessibilityLabel="OTP"
          editable={!disabled}
          keyboardType="number-pad"
          maxLength={maxLength}
          value={value}
          onChangeText={(next) => {
            if (controlled === undefined) setUncontrolled(next);
            onChange?.(next);
          }}
        />
        {children}
      </View>
    </InputOTPContext.Provider>
  );
}

export function InputOTPGroup({ children }: InputOTPGroupProps) {
  return <View>{children}</View>;
}

export function InputOTPSlot({ index }: InputOTPSlotProps) {
  const ctx = useContext(InputOTPContext);
  const char = ctx?.value[index] ?? "";
  return (
    <View accessibilityRole="text">
      <Text>{char}</Text>
    </View>
  );
}

export function InputOTPSeparator({ children }: InputOTPSeparatorProps) {
  return <View accessibilityRole="none">{children as ReactNode}</View>;
}
