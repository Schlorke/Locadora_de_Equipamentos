import { Pressable, Text, View } from 'react-native'
import { space, radius, border, typography } from '@gb-locacoes/design-tokens'
import { useTheme } from '../theme/ThemeProvider'
export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  'aria-label': label,
}: {
  checked?: boolean | 'indeterminate'
  onCheckedChange?: (value: boolean) => void
  disabled?: boolean
  'aria-label'?: string
}) {
  const theme = useTheme(),
    on = checked === true
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{
        checked: checked === 'indeterminate' ? 'mixed' : on,
        disabled: Boolean(disabled),
      }}
      disabled={disabled}
      onPress={() => onCheckedChange?.(!on)}
      style={{
        minWidth: space.xxl,
        minHeight: space.xxl,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: space.lg,
          height: space.lg,
          borderRadius: radius.sm,
          borderWidth: border.hairline,
          borderColor: theme.border,
          backgroundColor: on ? theme.secondary : theme.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: on ? theme.onSecondary : theme.text,
            fontSize: typography.size.md,
          }}
        >
          {checked === 'indeterminate' ? '−' : on ? '✓' : ''}
        </Text>
      </View>
    </Pressable>
  )
}
