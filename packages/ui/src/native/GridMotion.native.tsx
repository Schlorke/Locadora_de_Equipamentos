import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  AccessibilityInfo,
  Image,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg'
import { componentTokens,  radius, space, typography } from '@gb-locacoes/design-tokens'
import { useTheme } from '../theme/ThemeProvider'
import type { GridMotionProps } from '../contract/grid-motion'
const TOTAL_ITEMS = 28,
  COLS = 7,
  ROWS = 4
export function GridMotion({ items = [], gradientColor }: GridMotionProps) {
  const theme = useTheme(),
    { width } = useWindowDimensions(),
    positions = useRef(
      Array.from({ length: ROWS }, () => new Animated.Value(0))
    ).current
  const [reduceMotion, setReduceMotion] = useState(false),
    offset = useRef(0)
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    )
    return () => subscription.remove()
  }, [])
  const move = (x: number) => {
    offset.current = Math.max(-150, Math.min(150, x))
    positions.forEach((position, index) => {
      Animated.timing(position, {
        toValue: offset.current * (index % 2 === 0 ? 1 : -1),
        duration: reduceMotion ? 0 : ([1400, 1200, 1100, 1000][index] ?? 1000),
        useNativeDriver: true,
      }).start()
    })
  }
  const values = items.length
    ? items.slice(0, TOTAL_ITEMS)
    : Array.from({ length: TOTAL_ITEMS }, (_, index) => 'Item ' + (index + 1))
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Grade de itens em movimento"
      accessibilityActions={[
        { name: 'increment', label: 'Mover à direita' },
        { name: 'decrement', label: 'Mover à esquerda' },
      ]}
      onAccessibilityAction={(event) =>
        move(
          offset.current +
            (event.nativeEvent.actionName === 'increment'
              ? space.xxl
              : -space.xxl)
        )
      }
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderMove={(event) =>
        move((event.nativeEvent.locationX / width) * 300 - 150)
      }
      onResponderRelease={() => move(0)}
      style={{ flex: 1, overflow: 'hidden', backgroundColor: theme.background }}
    >
      <View
        pointerEvents="none"
        style={{ position: 'absolute', width: '100%', height: '100%' }}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="grid-background" cx="50%" cy="50%" r="70%">
              <Stop offset="0" stopColor={gradientColor ?? theme.secondary} />
              <Stop
                offset="1"
                stopColor={gradientColor ?? theme.secondary}
                stopOpacity={0}
              />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#grid-background)" />
        </Svg>
      </View>
      <View style={{ flex: 1, gap: space.md, paddingVertical: space.md }}>
        {Array.from({ length: ROWS }, (_, row) => (
          <Animated.View
            key={row}
            style={{
              flex: 1,
              flexDirection: 'row',
              gap: space.md,
              width: width + 300,
              marginLeft: -componentTokens(theme).gridMotion.rowOffset,
              transform: [{ translateX: positions[row] ?? 0 }],
            }}
          >
            {Array.from({ length: COLS }, (_, column) => {
              const content = values[row * COLS + column]
              return (
                <View
                  key={column}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    borderRadius: radius.sm,
                    backgroundColor: theme.surface,
                  }}
                >
                  {typeof content === 'string' && /^https?:/.test(content) ? (
                    <Image
                      source={{ uri: content }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ) : typeof content === 'string' ||
                    typeof content === 'number' ? (
                    <Text
                      style={{
                        color: theme.text,
                        fontSize: typography.size.sm,
                        textAlign: 'center',
                        padding: space.sm,
                      }}
                    >
                      {content}
                    </Text>
                  ) : (
                    content
                  )}
                </View>
              )
            })}
          </Animated.View>
        ))}
      </View>
    </View>
  )
}
