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
import { ENTITLEMENT_FEATURES } from '@gb-locacoes/contracts/entitlements'
import type { EntitlementFeature } from '@gb-locacoes/contracts/entitlements'
import {
  useOwnerSubscription,
  ownerReadMessages,
  subscriptionPresentation,
} from '../../../entities/assinatura'
import { AdminPageHeader } from '../../../widgets/cabecalho-admin'
import { reauthenticationHref } from '../../../features/entrar'
import { useOwnerAction } from '../model/use-owner-action'
import { useReactivationOffers } from '../model/use-reactivation-offers'
import {
  SubscriptionActions,
  newOwnerActionKey,
} from './SubscriptionActions.web'
import {
  invoiceLabels,
  subscriptionDate,
  subscriptionMoney,
} from '../model/display'

const featureLabels: Record<EntitlementFeature, string> = {
  onlinePayments: 'Pagamentos online',
  customDomain: 'Domínio próprio',
  logistics: 'Logística',
  maintenance: 'Manutenção',
  contractSignature: 'Assinatura de contratos',
  whatsapp: 'WhatsApp',
  emailInbox: 'Caixa de e-mail',
  merchantFeed: 'Catálogo no Google',
}
export function AssinaturaAdminPage() {
  const account = useOwnerSubscription({ includeInvoices: true }),
    { state } = account
  const summary = state.kind === 'ready' ? state.summary : undefined
  const offers = useReactivationOffers(
    JSON.stringify([account.scope, summary]),
    summary?.status === 'CANCELED'
  )
  const actions = useOwnerAction({
    scope: account.scope,
    summary,
    reload: account.reload,
    newKey: newOwnerActionKey,
    offers: offers.state.kind === 'ready' ? offers.state.plans : undefined,
  })
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Assinatura"
        subtitle={
          account.tenantName
            ? `Plano e faturas de ${account.tenantName}`
            : 'Plano e faturas da locadora'
        }
      />
      <SubscriptionActions
        model={actions}
        summary={summary}
        offers={offers}
        scope={account.scope}
        reauthenticationUrl={reauthenticationHref(
          '/admin/assinatura',
          account.tenantSlug
            ? `?locadora=${encodeURIComponent(account.tenantSlug)}`
            : ''
        )}
      />
      {state.kind === 'loading' ? (
        <p role="status">Consultando assinatura e faturas...</p>
      ) : null}
      {state.kind === 'problem' ? (
        <Alert>
          <AlertDescription>
            {ownerReadMessages[state.problem]}
          </AlertDescription>
          {state.problem === 'unavailable' ? (
            <Button variant="outline" onClick={account.reload}>
              Tentar novamente
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {state.kind === 'ready' ? (
        <>
          <Button
            variant="outline"
            disabled={actions.dialogOpen}
            onClick={account.reload}
          >
            Atualizar consulta
          </Button>
          {state.summary ? (
            <>
              <Alert>
                <AlertDescription>
                  {subscriptionPresentation[state.summary.status].message}
                </AlertDescription>
              </Alert>
              <Card>
                <CardHeader>
                  <CardTitle>Plano atual</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold">
                      {state.summary.plan.name}
                    </h2>
                    <Badge variant="outline">
                      {subscriptionPresentation[state.summary.status].label}
                    </Badge>
                  </div>
                  <p>
                    {state.summary.billingMode === 'COMPLIMENTARY'
                      ? 'Cortesia'
                      : `${subscriptionMoney(state.summary.plan.amount)} / ${state.summary.plan.interval === 'MONTHLY' ? 'mês' : 'ano'}`}
                  </p>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    {state.summary.currentPeriodStart ? (
                      <div>
                        <dt className="text-muted-foreground">
                          Início do período
                        </dt>
                        <dd>
                          {subscriptionDate(state.summary.currentPeriodStart)}
                        </dd>
                      </div>
                    ) : null}
                    {state.summary.currentPeriodEnd ? (
                      <div>
                        <dt className="text-muted-foreground">
                          Fim do período
                        </dt>
                        <dd>
                          {subscriptionDate(state.summary.currentPeriodEnd)}
                        </dd>
                      </div>
                    ) : null}
                    {state.summary.trialEndsAt ? (
                      <div>
                        <dt className="text-muted-foreground">Teste até</dt>
                        <dd>{subscriptionDate(state.summary.trialEndsAt)}</dd>
                      </div>
                    ) : null}
                    {state.summary.graceEndsAt ? (
                      <div>
                        <dt className="text-muted-foreground">
                          Prazo para regularizar
                        </dt>
                        <dd>{subscriptionDate(state.summary.graceEndsAt)}</dd>
                      </div>
                    ) : null}
                    {state.summary.complimentaryUntil ? (
                      <div>
                        <dt className="text-muted-foreground">Cortesia até</dt>
                        <dd>
                          {subscriptionDate(state.summary.complimentaryUntil)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {state.summary.cancelAtPeriodEnd ? (
                    <p>Cancelamento agendado para o fim do período atual.</p>
                  ) : null}
                  {state.summary.scheduledPlan ? (
                    <p>
                      Plano agendado: {state.summary.scheduledPlan.name}, a
                      partir de{' '}
                      {subscriptionDate(state.summary.scheduledChangeAt)}.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Uso e recursos do plano</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt>Modelos de equipamentos</dt>
                      <dd>
                        {state.summary.usage.equipments} de{' '}
                        {state.summary.entitlements.limits.equipments ??
                          'ilimitados'}
                      </dd>
                    </div>
                    <div>
                      <dt>Pessoas da equipe</dt>
                      <dd>
                        {state.summary.usage.staffSeats} de{' '}
                        {state.summary.entitlements.limits.staffSeats ??
                          'ilimitadas'}
                      </dd>
                    </div>
                  </dl>
                  <p className="text-sm text-muted-foreground">
                    O uso da equipe inclui o dono. Clientes e unidades de
                    equipamento não entram nessas contagens.
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {ENTITLEMENT_FEATURES.map((feature) => (
                      <li key={feature}>
                        {featureLabels[feature]}:{' '}
                        {state.summary!.entitlements.features[feature]
                          ? 'Incluído'
                          : 'Não incluído'}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </>
          ) : (
            <Alert>
              <AlertDescription>
                Esta locadora ainda não tem uma assinatura cadastrada.
              </AlertDescription>
            </Alert>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Faturas da plataforma</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Até 100 faturas mais recentes da assinatura, incluindo o
                histórico de planos anteriores.
              </p>
              {!state.invoices?.length ? (
                <p>Nenhuma fatura cadastrada.</p>
              ) : (
                <ul className="space-y-4">
                  {state.invoices.map((invoice) => (
                    <li
                      key={invoice.id}
                      className="rounded-lg border p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="font-semibold">
                          {invoice.kind === 'ADJUSTMENT'
                            ? 'Ajuste da assinatura'
                            : 'Fatura da assinatura'}{' '}
                          · {subscriptionDate(invoice.dueDate)}
                        </h3>
                        <Badge variant="outline">
                          {invoiceLabels[invoice.status]}
                        </Badge>
                      </div>
                      <p>{subscriptionMoney(invoice.amount)}</p>
                      {invoice.periodStart && invoice.periodEnd ? (
                        <p className="text-sm text-muted-foreground">
                          Período: {subscriptionDate(invoice.periodStart)} a{' '}
                          {subscriptionDate(invoice.periodEnd)}
                        </p>
                      ) : null}
                      {invoice.invoiceUrl ? (
                        <a
                          className="text-primary underline underline-offset-4"
                          href={invoice.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                        >
                          Ver fatura no Asaas{' '}
                          <span className="sr-only">
                            com vencimento em{' '}
                            {subscriptionDate(invoice.dueDate)} (abre em nova
                            aba)
                          </span>
                        </a>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Link da fatura indisponível.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
