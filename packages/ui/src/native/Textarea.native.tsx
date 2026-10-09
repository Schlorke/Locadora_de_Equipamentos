import { TextInput } from 'react-native'
import { border, radius, space } from '@gb-locacoes/design-tokens'
import { resolveTextStyle } from '../contract/text'
import type { TextareaProps } from '../contract/form'
import { useTheme } from '../theme/ThemeProvider'

export function Textarea({
  value,
  placeholder,
  disabled,
  onChangeText,
  'aria-label': label,
}: TextareaProps) {
  const theme = useTheme()
  const text = resolveTextStyle(theme, 'sm', 'default')
  return (
    <TextInput
      accessibilityLabel={label}
      value={value}
      placeholder={placeholder}
      editable={!disabled}
      multiline
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
  )
}
