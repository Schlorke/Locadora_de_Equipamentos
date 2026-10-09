import { Pressable, View } from 'react-native'

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  'aria-label': label,
}: {
  'aria-label'?: string
  checked?: boolean
  onCheckedChange?: (value: boolean) => void
  disabled?: boolean
}) {
  const on = checked === true
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: Boolean(disabled) }}
      disabled={Boolean(disabled)}
      onPress={() => onCheckedChange?.(!on)}
    >
      <View />
    </Pressable>
  )
}
