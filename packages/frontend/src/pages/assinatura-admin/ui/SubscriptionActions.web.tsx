'use client'

import { useRef } from 'react'
import type { SubscriptionSummary } from '@gb-locacoes/contracts/subscription'
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from '@gb-locacoes/ui'
import type { useOwnerAction } from '../model/use-owner-action'
import type { useReactivationOffers } from '../model/use-reactivation-offers'
import type { OwnerActionProblem } from '../api/owner-action'
import { subscriptionMoney } from '../model/display'
import { ReactivationPlans } from './ReactivationPlans.web'

const messages: Record<OwnerActionProblem, string> = {
  reauthentication:
    'Confirme sua identidade entrando novamente. Depois, revise a assinatura e confirme o pedido.',
  session: 'Entre na sua conta novamente para revisar a assinatura.',
  owner: 'Somente o dono atual da locadora pode executar este pedido.',
  selection: 'Selecione a locadora antes de confirmar um novo pedido.',
  changed:
    'O estado da assinatura mudou. Consulte o resumo atualizado antes de confirmar um novo pedido.',
  profile:
    'Complete os dados de cobrança da locadora antes de solicitar a ativação.',
  legal:
    'Os aceites dos termos da plataforma estão incompletos. Conclua o cadastro antes de solicitar a ativação.',
  configuration:
    'A ativação está indisponível no momento. Procure o suporte da plataforma.',
  offer:
    'O plano escolhido não está disponível. Consulte os planos e revise o pedido antes de confirmar novamente.',
  rate: 'Aguarde um pouco antes de tentar novamente. O pedido será repetido com a mesma identificação.',
  uncertain:
    'Não foi possível confirmar o resultado. O pedido pode ter sido registrado. Ao tentar novamente, repetiremos o mesmo pedido, sem criar outro.',
}

/** Chave efêmera criada só após a intenção explícita; não vai para URL/storage. */
export function newOwnerActionKey(): string {
  return crypto.randomUUID()
}

export function SubscriptionActions({
  model,
  summary,
  reauthenticationUrl,
  offers,
  scope,
}: {
  model: ReturnType<typeof useOwnerAction>
  summary: SubscriptionSummary | null | undefined
  reauthenticationUrl: string
  offers: ReturnType<typeof useReactivationOffers>
  scope: string
}) {
  const { state } = model
  const trigger = useRef<HTMLButtonElement | null>(null)
  const activate = 'intent' in state && state.intent.action === 'activate'
  const reactivation =
    'intent' in state && state.intent.action === 'reactivate'
      ? state.intent.plan
      : null
  const undo =
    'intent' in state
      ? state.intent.action === 'undo-cancel'
      : model.action === 'undo-cancel'
  return (
    <>
      {state.kind === 'accepted' ? (
        <p role="status">
          {state.action === 'reactivate'
            ? 'Pedido de reativação registrado. A nova assinatura depende da conciliação anterior e da confirmação do pagamento. Consulte o resumo e as faturas.'
            : state.action === 'activate'
              ? 'Pedido de ativação registrado. Consulte as faturas; o pagamento ainda precisa ser confirmado.'
              : 'Pedido registrado. Confira o estado atualizado da assinatura.'}
        </p>
      ) : null}
      {state.kind === 'problem' ? (
        <Alert>
          <AlertDescription>{messages[state.problem]}</AlertDescription>
          {state.problem === 'reauthentication' ||
          state.problem === 'session' ? (
            <a
              className="text-primary underline underline-offset-4"
              href={reauthenticationUrl}
            >
              Entrar novamente
            </a>
          ) : null}
        </Alert>
      ) : null}
      <AlertDialog
        open={model.dialogOpen}
        onOpenChange={(open) => {
          if (!open) model.dismiss()
        }}
      >
        {model.canReactivate ? (
          <ReactivationPlans
            offers={offers}
            model={model}
            scope={scope}
            onBegin={(planVersionId, button) => {
              trigger.current = button
              model.begin('reactivate', planVersionId)
            }}
          />
        ) : null}
        {model.canActivate ? (
          <AlertDialogTrigger asChild>
            <Button
              variant="default"
              disabled={!model.canStart('activate')}
              onClick={(event) => {
                trigger.current = event.currentTarget
                model.begin('activate')
              }}
            >
              Ativar assinatura
            </Button>
          </AlertDialogTrigger>
        ) : null}
        {model.action ? (
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              disabled={!model.canStart(model.action)}
              onClick={(event) => {
                trigger.current = event.currentTarget
                model.begin()
              }}
            >
              {model.action === 'undo-cancel'
                ? 'Desfazer cancelamento'
                : 'Cancelar assinatura'}
            </Button>
          </AlertDialogTrigger>
        ) : null}
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            if (trigger.current?.isConnected && !trigger.current.disabled) {
              event.preventDefault()
              trigger.current.focus()
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reactivation
                ? 'Reativar a assinatura?'
                : activate
                  ? 'Ativar a assinatura?'
                  : undo
                    ? 'Desfazer o cancelamento?'
                    : 'Cancelar a assinatura?'}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4 p-4 md:p-6">
            <AlertDialogDescription>
              {reactivation
                ? `Você está solicitando uma nova assinatura do plano ${reactivation.name} por ${subscriptionMoney(reactivation.amount)} por mês, sem novo período de teste. As faturas vencidas da assinatura anterior serão perdoadas; pagamentos já realizados serão preservados. A nova cobrança só será emitida após a conciliação anterior. O pagamento é confirmado separadamente.`
                : activate
                  ? summary
                    ? `Você está solicitando a cobrança mensal do plano ${summary.plan.name} por ${subscriptionMoney(summary.plan.amount)}. Se o teste ainda estiver vigente, a primeira cobrança terá vencimento no fim dele. O pagamento é confirmado separadamente.`
                    : 'Consulte o resumo atualizado antes de solicitar a ativação.'
                  : undo
                    ? 'O servidor verificará se ainda é possível manter a assinatura. Confira o resumo atualizado após o pedido.'
                    : 'O período pago ou de cortesia vigente será preservado. Um teste sem período pago pode encerrar imediatamente. Faturas e dívidas existentes não serão apagadas. Confira o resumo atualizado após o pedido.'}
            </AlertDialogDescription>
            {state.kind === 'uncertain' ? (
              <p role="alert">{messages[state.problem]}</p>
            ) : null}
            {model.isBusy ? <p role="status">Registrando pedido...</p> : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={model.isBusy}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={model.isBusy}
              onClick={(event) => {
                event.preventDefault()
                void model.confirm()
              }}
            >
              {state.kind === 'uncertain'
                ? 'Repetir o mesmo pedido'
                : reactivation
                  ? 'Confirmar reativação'
                  : activate
                    ? 'Confirmar ativação'
                    : undo
                      ? 'Confirmar desfazimento'
                      : 'Confirmar cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
