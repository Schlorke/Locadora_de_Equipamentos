import { Pressable, Text } from 'react-native'
import { Children, forwardRef, type ComponentRef } from 'react'
import { space } from '@gb-locacoes/design-tokens'
import { resolveButtonStyle, type ButtonProps } from '../contract/button'
import { useTheme } from '../theme/ThemeProvider'

export const Button = forwardRef<ComponentRef<typeof Pressable>, ButtonProps>(
  function Button(
    {
      children,
      onClick,
      variant = 'default',
      disabled,
      testID,
      'aria-label': accessibleLabel,
    },
    ref
  ) {
    const s = resolveButtonStyle(useTheme(), variant, { disabled })
    const label =
      accessibleLabel ??
      (typeof children === 'string' || typeof children === 'number'
        ? String(children)
        : undefined)
    return (
      <Pressable
        ref={ref}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={Boolean(disabled)}
        onPress={disabled ? undefined : onClick}
        style={({ pressed }) => ({
          backgroundColor: s.backgroundColor,
          borderColor: s.borderColor,
          borderWidth: s.borderWidth,
          opacity: pressed ? 0.85 : s.opacity,
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          borderRadius: s.borderRadius,
          flexDirection: 'row',
          gap: space.sm,
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        {Children.map(children, (child) =>
          typeof child === 'string' || typeof child === 'number' ? (
            <Text
              style={{
                color: s.color,
                fontSize: s.fontSize,
                fontWeight: s.fontWeight,
              }}
            >
              {child}
            </Text>
          ) : (
            child
          )
        )}
      </Pressable>
    )
  }
)
