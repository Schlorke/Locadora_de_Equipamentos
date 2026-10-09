import { ScrollView, View, Text } from 'react-native'
import { Button, Card, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { toastExamples } from '../model/examples'
export function TesteToastPage() {
  const theme = useTheme(),
    sections = [...new Set(toastExamples.map((example) => example.section))]
  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.md,
        gap: space.lg,
        backgroundColor: theme.background,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          color: theme.text,
          fontSize: typography.size.xl,
          fontWeight: typography.weight.semibold,
        }}
      >
        🎨 Teste Completo de Toasts Sonner
      </Text>
      <Text style={{ color: theme.textMuted }}>
        Laboratório de notificações
      </Text>
      {sections.map((section) => (
        <Card key={section}>
          <View style={{ gap: space.md }}>
            <Text
              accessibilityRole="header"
              style={{
                color: theme.text,
                fontSize: typography.size.lg,
                fontWeight: typography.weight.semibold,
              }}
            >
              {section}
            </Text>
            {toastExamples
              .filter((example) => example.section === section)
              .map((example) => (
                <Button
                  key={example.label}
                  variant={example.variant}
                  onClick={example.run}
                >
                  {example.label}
                </Button>
              ))}
          </View>
        </Card>
      ))}
    </ScrollView>
  )
}
