'use client'
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@gb-locacoes/ui'
import { AdminPageHeader } from '../../../widgets/cabecalho-admin'
import { reauthenticationHref } from '../../../features/entrar'
import { useAccountConnection } from '../model/use-account-connection'
import { useAccountCreation } from '../model/use-account-creation'
import { AccountConnection } from './AccountConnection.web'
import { AccountCreation } from './AccountCreation.web'
import { AccountRecovery } from './AccountRecovery.web'
import {
  useReceivingAccount,
  receivingStatus,
  receivingHealth,
  receivingKind,
  receivingProblems,
} from '../../../entities/conta-recebimentos'

const date = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
export function RecebimentosAdminPage() {
  const { state, reload, scope, tenantName, tenantSlug } = useReceivingAccount()
  const available = state.kind === 'ready' && state.account === null
  const connection = useAccountConnection({ scope, available, reload })
  const creation = useAccountCreation({ scope, enabled: available, reload })
  const reauthenticationUrl = reauthenticationHref(
    '/admin/recebimentos',
    tenantSlug ? `?locadora=${encodeURIComponent(tenantSlug)}` : ''
  )
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Recebimentos"
        subtitle={
          tenantName
            ? `Conta de recebimentos de ${tenantName}`
            : 'Conta de recebimentos da locadora'
        }
      />
      <p>
        Os pagamentos dos clientes pertencem à locadora. A mensalidade da
        plataforma é consultada em Assinatura.
      </p>
      <AccountCreation
        key={'creation:' + scope}
        model={creation}
        reauthenticationUrl={reauthenticationUrl}
      />
      <AccountConnection
        key={scope}
        model={connection}
        available={available}
        tenantName={tenantName}
        reload={reload}
        reauthenticationUrl={reauthenticationUrl}
      />
      {state.kind === 'loading' ? (
        <p role="status">Consultando a conta de recebimentos...</p>
      ) : null}
      {state.kind === 'problem' ? (
        <Alert>
          <AlertDescription>
            {receivingProblems[state.problem]}
          </AlertDescription>
          {state.problem === 'unavailable' ? (
            <Button variant="outline" onClick={reload}>
              Tentar novamente
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {state.kind === 'ready' ? (
        <>
          <Button variant="outline" onClick={reload}>
            Atualizar consulta
          </Button>
          {state.account ? (
            <Card>
              <CardHeader>
                <CardTitle>Conta de recebimentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline">
                    {receivingStatus[state.account.status].label}
                  </Badge>
                  <Badge variant="outline">
                    {state.account.environment === 'sandbox'
                      ? 'Ambiente de testes'
                      : 'Ambiente de produção'}
                  </Badge>
                </div>
                <p>{receivingStatus[state.account.status].message}</p>
                {state.account.kind === 'STANDARD' &&
                state.account.status === 'AWAITING_OWNER' ? (
                  <p>
                    Abra o e-mail que a instituição de pagamentos enviou para o
                    seu e-mail de acesso e envie os documentos.
                  </p>
                ) : null}
                <p>{receivingKind[state.account.kind]}</p>
                {state.account.healthIssue ? (
                  <Alert>
                    <AlertDescription>
                      {receivingHealth[state.account.healthIssue]}
                    </AlertDescription>
                  </Alert>
                ) : null}
                {state.account.providerStatusText ? (
                  <p>{state.account.providerStatusText}</p>
                ) : null}
                <dl className="grid gap-4 sm:grid-cols-2">
                  {state.account.lastSyncedAt ? (
                    <div>
                      <dt className="text-muted-foreground">
                        Última confirmação
                      </dt>
                      <dd>{date(state.account.lastSyncedAt)}</dd>
                    </div>
                  ) : (
                    <div>
                      <dt className="text-muted-foreground">
                        Última confirmação
                      </dt>
                      <dd>Ainda não registrada</dd>
                    </div>
                  )}
                  {state.account.commercialInfoExpiresAt ? (
                    <div>
                      <dt className="text-muted-foreground">
                        Confirmar dados até
                      </dt>
                      <dd>{date(state.account.commercialInfoExpiresAt)}</dd>
                    </div>
                  ) : null}
                </dl>
                {state.account.kind === 'CONNECTED' &&
                state.account.healthIssue === 'WEBHOOK_INTERRUPTED' ? (
                  <AccountRecovery
                    scope={scope}
                    reauthenticationUrl={reauthenticationHref(
                      '/admin/recebimentos',
                      tenantSlug
                        ? `?locadora=${encodeURIComponent(tenantSlug)}`
                        : ''
                    )}
                  />
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <AlertDescription>
                Nenhuma conta de recebimentos conectada a esta locadora.
              </AlertDescription>
            </Alert>
          )}
        </>
      ) : null}
    </div>
  )
}
