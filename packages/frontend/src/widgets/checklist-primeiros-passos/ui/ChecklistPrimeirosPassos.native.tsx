import { Card, Stack, Text, Badge, Button } from '@gb-locacoes/ui'
import { PublicarSite } from '../../../features/publicar-site'
import { usePrimeirosPassos } from '../model/usePrimeirosPassos'
import { checklistLabels, checklistProblems } from '../model/presentation'

export function ChecklistPrimeirosPassos({
  openPanel,
}: { openPanel?(slug: string): Promise<void> } = {}) {
  const account = usePrimeirosPassos()
  const { state } = account
  const checklist = state.kind === 'ready' ? state.checklist : null
  if (
    !account.eligible ||
    (state.kind === 'problem' && state.problem === 'owner')
  )
    return null
  if (state.kind === 'ready' && !state.checklist) return null
  return (
    <Card>
      <Stack gap="md">
        <Text heading={2}>Primeiros passos</Text>
        {state.kind === 'loading' ? (
          <Text>Consultando primeiros passos...</Text>
        ) : null}
        {state.kind === 'problem' ? (
          <Stack gap="sm">
            <Text tone="danger">{checklistProblems[state.problem]}</Text>
            <Button variant="outline" onClick={account.reload}>
              Tentar novamente
            </Button>
          </Stack>
        ) : null}
        {checklist ? (
          <>
            <Text>Configure a locadora e acompanhe cada etapa confirmada.</Text>
            {checklist.items.map((item) => (
              <Stack key={item.id} gap="sm">
                <Text>{checklistLabels[item.id]}</Text>
                <Badge variant="outline">
                  {item.done ? 'Concluído' : 'Pendente'}
                </Badge>
              </Stack>
            ))}
            {checklist.items.some((item) => !item.done) ? (
              <PublicarSite
                scope={account.scope}
                checklist={checklist}
                tenantName={account.tenantName}
                tenantSlug={account.tenantSlug}
                onPublished={account.reload}
                openPanel={openPanel}
              />
            ) : null}
            <Button variant="outline" onClick={account.reload}>
              Atualizar primeiros passos
            </Button>
          </>
        ) : null}
      </Stack>
    </Card>
  )
}
