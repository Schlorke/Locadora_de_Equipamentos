import { useState } from 'react'
import { ScrollView, Text, View, ActivityIndicator } from 'react-native'
import { Button, Card, Badge, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import {
  useOwnerSubscription,
  ownerReadMessages,
  subscriptionPresentation,
} from '../../../entities/assinatura'
import { AdminPageHeader } from '../../../widgets/cabecalho-admin'

interface AssinaturaAdminPageProps {
  openPanel(slug: string): Promise<void>
}
export function AssinaturaAdminPage(props: AssinaturaAdminPageProps) {
  const account = useOwnerSubscription(),
    theme = useTheme()
  return (
    <SubscriptionContent
      key={account.scope}
      {...props}
      account={account}
      theme={theme}
    />
  )
}
function SubscriptionContent({
  openPanel,
  account,
  theme,
}: AssinaturaAdminPageProps & {
  account: ReturnType<typeof useOwnerSubscription>
  theme: ReturnType<typeof useTheme>
}) {
  const [opening, setOpening] = useState(false),
    [error, setError] = useState(false)
  const { state } = account
  async function open() {
    if (!account.tenantSlug || opening) return
    setOpening(true)
    setError(false)
    try {
      await openPanel(account.tenantSlug)
    } catch {
      setError(true)
    } finally {
      setOpening(false)
    }
  }
  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.md,
        gap: space.lg,
        backgroundColor: theme.background,
      }}
    >
      <AdminPageHeader title="Assinatura" subtitle={account.tenantName} />
      {state.kind === 'loading' ? (
        <ActivityIndicator color={theme.primary} />
      ) : null}
      {state.kind === 'problem' ? (
        <View style={{ gap: space.md }}>
          <Text accessibilityRole="alert" style={{ color: theme.text }}>
            {ownerReadMessages[state.problem]}
          </Text>
          {state.problem === 'unavailable' ? (
            <Button variant="outline" onClick={account.reload}>
              Tentar novamente
            </Button>
          ) : null}
        </View>
      ) : null}
      {state.kind === 'ready' ? (
        <Card>
          <View style={{ gap: space.md }}>
            {state.summary ? (
              <>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: theme.text,
                    fontSize: typography.size.lg,
                    fontWeight: typography.weight.semibold,
                  }}
                >
                  {state.summary.plan.name}
                </Text>
                <Badge variant="outline">
                  {subscriptionPresentation[state.summary.status].label}
                </Badge>
                <Text style={{ color: theme.text }}>
                  {subscriptionPresentation[state.summary.status].message}
                </Text>
              </>
            ) : (
              <Text style={{ color: theme.text }}>
                Esta locadora ainda não tem uma assinatura cadastrada.
              </Text>
            )}
            <Text style={{ color: theme.textMuted }}>
              Consulte as faturas e os detalhes da assinatura no painel web. O
              navegador pode solicitar seu login.
            </Text>
            <Button onClick={() => void open()} disabled={opening}>
              {opening ? 'Abrindo painel...' : 'Abrir assinatura no navegador'}
            </Button>
            {error ? (
              <Text accessibilityRole="alert" style={{ color: theme.danger }}>
                Não foi possível abrir o painel. Verifique a configuração do
                aplicativo e tente novamente.
              </Text>
            ) : null}
            <Button variant="outline" onClick={account.reload}>
              Atualizar consulta
            </Button>
          </View>
        </Card>
      ) : null}
    </ScrollView>
  )
}
