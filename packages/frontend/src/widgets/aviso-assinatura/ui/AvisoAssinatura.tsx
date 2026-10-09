'use client'

import { Badge, Card, Link, Stack, Text } from '@gb-locacoes/ui'
import {
  useOwnerSubscription,
  subscriptionPresentation,
} from '../../../entities/assinatura'

/** Faixa do dono; a equipe sem propriedade não recebe detalhes comerciais. */
export function OwnerSubscriptionNotice() {
  const { state } = useOwnerSubscription()
  if (state.kind !== 'ready') return null
  return (
    <Card>
      <Stack gap="sm">
        <Text heading={2}>Assinatura da plataforma</Text>
        {state.summary ? (
          <>
            <Badge variant="outline">
              {subscriptionPresentation[state.summary.status].label}
            </Badge>
            <Text>
              {subscriptionPresentation[state.summary.status].message}
            </Text>
          </>
        ) : (
          <Text>Esta locadora ainda não tem uma assinatura cadastrada.</Text>
        )}
        <Link href="/admin/assinatura">Consultar assinatura</Link>
      </Stack>
    </Card>
  )
}
