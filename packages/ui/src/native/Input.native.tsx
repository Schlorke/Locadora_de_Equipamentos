import { border, radius, space } from "@gb-locacoes/design-tokens";
import { Pressable, Text, TextInput, View } from "react-native";
import { resolveTextStyle } from "../contract/text";
import type { InputProps } from "../contract/input";
import { useTheme } from "../theme/ThemeProvider";

export function Input({ value, placeholder, disabled, type, onChangeText, testID, id, "aria-label": label, "aria-labelledby": labelledBy }: InputProps) {
  const theme = useTheme();
  const text = resolveTextStyle(theme, "md", "default");
  return (
    <View>
      <TextInput
        testID={testID}
        nativeID={id}
        accessibilityLabel={label}
        accessibilityLabelledBy={labelledBy ?? (id?`${id}-label`:undefined)}
        value={value}
        placeholder={placeholder}
        editable={!disabled}
        keyboardType={type === "number" ? "numeric" : type === "email" ? "email-address" : "default"}
        secureTextEntry={type === "password"}
        autoCapitalize={type === "email" || type === "password" ? "none" : "sentences"}
        onChangeText={disabled ? undefined : onChangeText}
        accessibilityState={{ disabled: Boolean(disabled) }}
        style={{
          color: text.color,
          fontSize: text.fontSize,
          borderColor: theme.border,
          borderWidth: border.hairline,
          borderRadius: radius.sm,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          opacity: disabled ? 0.5 : 1,
        }}
      />
      {type === "number" ? (
        <View>
          <Pressable accessibilityRole="button" accessibilityLabel="Incrementar" disabled={Boolean(disabled)} onPress={()=>onChangeText?.(String((Number(value)||0)+1))}>
            <Text>Incrementar</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Decrementar" disabled={Boolean(disabled)} onPress={()=>onChangeText?.(String((Number(value)||0)-1))}>
            <Text>Decrementar</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
