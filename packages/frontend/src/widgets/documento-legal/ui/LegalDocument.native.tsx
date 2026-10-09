import { useRef, useState, type ComponentRef } from 'react'
import { ScrollView, View, Text } from 'react-native'
import { Button, Card, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import type { LegalDocumentProps } from './contract'
export function LegalDocument({
  title,
  subtitle,
  updatedAt,
  sections,
  introduction,
}: LegalDocumentProps) {
  const theme = useTheme(),
    scroll = useRef<ComponentRef<typeof ScrollView>>(null),
    positions = useRef<Record<string, number>>({}),
    [active, setActive] = useState(sections[0]?.id ?? '')
  const jump = (id: string) => {
    const y = positions.current[id]
    if (y !== undefined) {
      scroll.current?.scrollTo({ y, animated: true })
      setActive(id)
    }
  }
  return (
    <ScrollView
      ref={scroll}
      contentContainerStyle={{
        padding: space.md,
        gap: space.lg,
        backgroundColor: theme.background,
      }}
      scrollEventThrottle={100}
      onScroll={(event) => {
        const y = event.nativeEvent.contentOffset.y
        const nearest = Object.entries(positions.current).sort(
          (a, b) => Math.abs(a[1] - y) - Math.abs(b[1] - y)
        )[0]
        if (nearest) setActive(nearest[0])
      }}
    >
      <View
        style={{
          gap: space.sm,
          padding: space.lg,
          backgroundColor: theme.primary,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            color: theme.onPrimary,
            fontSize: typography.size.xl,
            fontWeight: typography.weight.semibold,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: theme.onPrimary }}>{subtitle}</Text>
        ) : null}
        {updatedAt ? (
          <Text style={{ color: theme.onPrimary }}>
            Última atualização: {updatedAt}
          </Text>
        ) : null}
      </View>
      <Card>
        <View style={{ gap: space.sm }}>
          <Text
            accessibilityRole="header"
            style={{ color: theme.text, fontWeight: typography.weight.semibold }}
          >
            Índice
          </Text>
          {sections.map((section, index) => (
            <Button
              key={section.id}
              variant={active === section.id ? 'default' : 'outline'}
              onClick={() => jump(section.id)}
            >
              {index + 1}. {section.title}
            </Button>
          ))}
        </View>
      </Card>
      {introduction}
      {sections.map((section) => (
        <View
          key={section.id}
          onLayout={(event) => {
            positions.current[section.id] = event.nativeEvent.layout.y
          }}
        >
          {section.content}
        </View>
      ))}
    </ScrollView>
  )
}
