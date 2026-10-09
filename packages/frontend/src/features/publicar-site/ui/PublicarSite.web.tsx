'use client'

import { useRef } from 'react'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  Button,
  Link,
} from '@gb-locacoes/ui'
import type { PublicarSiteProps } from '../model/contract'
import type { PublicationProblem } from '../api/publication'
import { useSitePublication } from '../model/useSitePublication'

const messages: Record<PublicationProblem, string> = {
  session: 'Entre novamente para confirmar a publicação.',
  owner: 'Somente o dono atual pode publicar o site.',
  email: 'Verifique seu e-mail antes de publicar o site.',
  subscription:
    'Confira a assinatura e o acesso da locadora antes de publicar.',
  equipment: 'Cadastre o primeiro equipamento antes de publicar o site.',
  selection: 'Selecione a locadora e revise os primeiros passos.',
  origin: 'Abra o painel web da plataforma para confirmar a publicação.',
  uncertain:
    'Não foi possível confirmar o resultado. Consulte o checklist ou tente o mesmo pedido novamente. Não enviaremos outra tentativa automaticamente.',
}
export function PublicarSite(props: PublicarSiteProps) {
  if (
    props.checklist.items.some(
      (item) => item.id === 'PUBLISH_SITE' && item.done
    )
  )
    return null
  if (
    !props.checklist.items.some(
      (item) => item.id === 'FIRST_EQUIPMENT' && item.done
    )
  )
    return <p>Cadastre o primeiro equipamento antes de publicar o site.</p>
  return (
    <PublicationConfirmation
      {...props}
      key={JSON.stringify([props.scope, props.checklist])}
    />
  )
}
function PublicationConfirmation({
  scope,
  tenantName,
  onPublished,
}: PublicarSiteProps) {
  const model = useSitePublication(scope, onPublished)
  const trigger = useRef<HTMLButtonElement | null>(null)
  return (
    <>
      {model.state.kind === 'problem' ? (
        <div role="alert">
          <p>{messages[model.state.problem]}</p>
          {model.state.problem === 'session' ? (
            <Link href="/admin/login">Entrar novamente</Link>
          ) : null}
          {model.state.problem === 'subscription' ? (
            <Link href="/admin/assinatura">Consultar assinatura</Link>
          ) : null}
        </div>
      ) : null}
      {model.state.kind === 'accepted' ? (
        <p role="status">
          Publicação confirmada. Atualizando os primeiros passos...
        </p>
      ) : null}
      <AlertDialog
        open={model.dialogOpen}
        onOpenChange={(open) => {
          if (!open) model.dismiss()
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            ref={trigger}
            variant="default"
            disabled={model.busy}
            onClick={model.begin}
          >
            Publicar site
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            if (trigger.current?.isConnected && !trigger.current.disabled) {
              event.preventDefault()
              trigger.current.focus()
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar o site?</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4 p-4 md:p-6">
            <AlertDialogDescription>
              {tenantName
                ? `Você está confirmando a publicação do site de ${tenantName}. `
                : ''}
              Depois de publicar, o endereço do site não poderá ser alterado. Os
              pagamentos online são configurados separadamente.
            </AlertDialogDescription>
            {model.state.kind === 'uncertain' ? (
              <p role="alert">{messages.uncertain}</p>
            ) : null}
            {model.busy ? <p role="status">Confirmando publicação...</p> : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={model.busy}>Voltar</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="default"
                disabled={model.busy}
                onClick={(event) => {
                  event.preventDefault()
                  void model.confirm()
                }}
              >
                {model.state.kind === 'uncertain'
                  ? 'Tentar o mesmo pedido'
                  : 'Confirmar publicação'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
