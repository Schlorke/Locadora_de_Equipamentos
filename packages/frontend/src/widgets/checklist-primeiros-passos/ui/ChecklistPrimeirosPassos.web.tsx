'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Link,
  Badge,
} from '@gb-locacoes/ui'
import { PublicarSite } from '../../../features/publicar-site'
import { usePrimeirosPassos } from '../model/usePrimeirosPassos'
import {
  checklistLabels,
  checklistLinks,
  checklistProblems,
} from '../model/presentation'

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
      <CardHeader>
        <CardTitle>Primeiros passos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.kind === 'loading' ? (
          <p role="status">Consultando primeiros passos...</p>
        ) : null}
        {state.kind === 'problem' ? (
          <div role="alert">
            <p>{checklistProblems[state.problem]}</p>
            {state.problem === 'session' ? (
              <Link href="/admin/login">Entrar novamente</Link>
            ) : null}
            <Button variant="outline" onClick={account.reload}>
              Tentar novamente
            </Button>
          </div>
        ) : null}
        {checklist ? (
          <>
            <p>Configure a locadora e acompanhe cada etapa confirmada.</p>
            <ol aria-label="Etapas de configuração" className="space-y-4">
              {checklist.items.map((item) => {
                const link = checklistLinks[item.id]
                return (
                  <li key={item.id} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{checklistLabels[item.id]}</span>
                      <Badge variant="outline">
                        {item.done ? 'Concluído' : 'Pendente'}
                      </Badge>
                    </div>
                    {!item.done && link ? (
                      <Link href={link.href}>{link.label}</Link>
                    ) : null}
                    {!item.done && item.id === 'PUBLISH_SITE' ? (
                      <PublicarSite
                        scope={account.scope}
                        checklist={checklist}
                        tenantName={account.tenantName}
                        tenantSlug={account.tenantSlug}
                        onPublished={account.reload}
                        openPanel={openPanel}
                      />
                    ) : null}
                    {!item.done &&
                    [
                      'ACTIVATE_ONLINE_PAYMENTS',
                      'CONFIRM_COMMERCIAL_INFO',
                    ].includes(item.id) ? (
                      <p>
                        A configuração dos recebimentos ainda não está
                        disponível nesta interface.
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ol>
            <Button variant="outline" onClick={account.reload}>
              Atualizar primeiros passos
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
