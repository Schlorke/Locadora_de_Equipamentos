'use client'

import { useId, useState } from 'react'
import {
  AlertDialogTrigger,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  RadioGroup,
  RadioGroupItem,
} from '@gb-locacoes/ui'
import type { useReactivationOffers } from '../model/use-reactivation-offers'
import type { useOwnerAction } from '../model/use-owner-action'
import { subscriptionMoney } from '../model/display'

export function ReactivationPlans({
  offers,
  model,
  scope,
  onBegin,
}: {
  offers: ReturnType<typeof useReactivationOffers>
  model: ReturnType<typeof useOwnerAction>
  scope: string
  onBegin(planVersionId: string, button: HTMLButtonElement): void
}) {
  const id = useId()
  const [selection, setSelection] = useState({ scope, planVersionId: '' })
  const plans = offers.state.kind === 'ready' ? offers.state.plans : []
  const uncertain = model.state.kind === 'uncertain'
  const selected =
    selection.scope === scope
      ? plans.find((plan) => plan.planVersionId === selection.planVersionId)
      : undefined
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reativar assinatura</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>
          Escolha um plano para iniciar uma nova assinatura, sem novo período de
          teste. O histórico anterior será preservado.
        </p>
        {offers.state.kind === 'loading' ? (
          <p role="status">Consultando planos disponíveis...</p>
        ) : null}
        {offers.state.kind === 'unavailable' ? (
          <div className="space-y-3">
            <p role="alert">
              Não foi possível consultar os planos disponíveis.
            </p>
            <Button
              variant="outline"
              disabled={model.dialogOpen || uncertain}
              onClick={offers.reload}
            >
              Consultar planos novamente
            </Button>
          </div>
        ) : null}
        {offers.state.kind === 'ready' && !plans.length ? (
          <p>Nenhum plano mensal disponível para reativação no momento.</p>
        ) : null}
        {plans.length ? (
          <RadioGroup
            aria-label="Plano para reativação"
            value={selected?.planVersionId ?? ''}
            disabled={model.dialogOpen || uncertain}
            onValueChange={(planVersionId) =>
              setSelection({ scope, planVersionId })
            }
          >
            {plans.map((plan, index) => (
              <div
                key={plan.planVersionId}
                className="flex items-start gap-3 rounded-lg border p-4"
              >
                <RadioGroupItem
                  id={`${id}-${index}`}
                  value={plan.planVersionId}
                />
                <Label htmlFor={`${id}-${index}`} className="space-y-2">
                  <span className="block">
                    {plan.name} · {subscriptionMoney(plan.amount)} / mês
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Modelos de equipamentos:{' '}
                    {plan.entitlements.limits.equipments ?? 'ilimitados'}.
                    Pessoas da equipe:{' '}
                    {plan.entitlements.limits.staffSeats ?? 'ilimitadas'}.
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        ) : null}
        <AlertDialogTrigger asChild>
          <Button
            variant="default"
            disabled={
              !model.canStart('reactivate') || (!selected && !uncertain)
            }
            onClick={(event) =>
              onBegin(selected?.planVersionId ?? '', event.currentTarget)
            }
          >
            Reativar assinatura
          </Button>
        </AlertDialogTrigger>
      </CardContent>
    </Card>
  )
}
