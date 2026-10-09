'use client'
import { useEffect, useId, useRef } from 'react'
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@gb-locacoes/ui'
import type { ReceivingConnectProblem } from '../api/connect-account'
import type { useAccountConnection } from '../model/use-account-connection'

const messages: Record<ReceivingConnectProblem, string> = {
  key: 'Informe uma chave de API do Asaas com formato válido.',
  rejected:
    'A instituição de pagamentos recusou essa chave. Confira o acesso na sua conta Asaas antes de tentar novamente.',
  environment:
    'A chave pertence a um ambiente diferente do configurado na plataforma. Confira a chave com o suporte.',
  reauthentication:
    'Confirme sua identidade entrando novamente. Depois, consulte a conta e revise a conexão.',
  session: 'Entre novamente para consultar a conta e revisar a conexão.',
  email: 'Confirme seu e-mail antes de conectar a conta de recebimentos.',
  owner:
    'Somente o dono atual da locadora pode conectar a conta de recebimentos.',
  archived:
    'Esta locadora está arquivada. Consulte a assinatura para reativá-la.',
  selection:
    'Selecione a locadora e consulte a conta antes de iniciar outra conexão.',
  company:
    'O CNPJ da locadora precisa ser válido e estar atualizado antes da conexão. Revise os dados da empresa no cadastro.',
  document:
    'O CNPJ da conta Asaas não corresponde ao da locadora. Use a conta da própria empresa.',
  changed:
    'Os dados da locadora mudaram. Consulte o estado atual antes de revisar a conexão.',
  existing:
    'Já existe uma conta ou integração de recebimentos para esta locadora. Consulte o estado atual; a troca de acesso precisa de um fluxo separado.',
  rate: 'Aguarde um pouco antes de tentar novamente. A chave foi apagada deste formulário.',
  uncertain:
    'Não foi possível confirmar o resultado. O pedido pode ter sido registrado. Consulte o estado atual antes de procurar o suporte; não envie outra chave.',
}

export function AccountConnection({
  model,
  available,
  tenantName,
  reauthenticationUrl,
  reload,
}: {
  model: ReturnType<typeof useAccountConnection>
  available: boolean
  tenantName?: string
  reauthenticationUrl: string
  reload(): void
}) {
  const { state } = model
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const field = input.current
    if (model.editable) field?.focus()
    const clear = () => {
      if (field) field.value = ''
    }
    window.addEventListener('pagehide', clear)
    return () => {
      clear()
      window.removeEventListener('pagehide', clear)
    }
  }, [available, model.editable])
  const fieldProblem =
    state.kind === 'problem' &&
    ['key', 'rejected', 'environment'].includes(state.problem)
  return (
    <>
      {state.kind === 'accepted' ? (
        <p role="status">
          Pedido de conexão aceito. A configuração e a aprovação dos
          recebimentos ainda precisam ser confirmadas. Consulte o estado da
          conta.
        </p>
      ) : null}
      {state.kind === 'problem' ? (
        <Alert>
          <AlertDescription id={`${id}-problem`}>
            {messages[state.problem]}
          </AlertDescription>
          {state.problem === 'reauthentication' ||
          state.problem === 'session' ? (
            <a
              className="text-primary underline underline-offset-4"
              href={reauthenticationUrl}
            >
              Entrar novamente
            </a>
          ) : null}
          {!model.editable ? (
            <Button variant="outline" onClick={reload}>
              Consultar estado
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {available &&
      state.kind !== 'accepted' &&
      (state.kind === 'idle' || model.editable || state.kind === 'pending') ? (
        <Card>
          <CardHeader>
            <CardTitle>Conectar conta própria do Asaas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Use a conta Asaas que já pertence{' '}
              {tenantName ? `a ${tenantName}` : 'à locadora'}, com o mesmo CNPJ
              cadastrado na plataforma. Esta ação conecta uma conta existente.
            </p>
            {state.kind === 'idle' ? (
              <Button variant="default" onClick={model.begin}>
                Conectar conta própria
              </Button>
            ) : (
              <form
                className="space-y-4"
                aria-label="Conexão da conta de recebimentos"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!input.current) return
                  const apiKey = input.current.value
                  input.current.value = ''
                  void model.submit(apiKey)
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor={id}>Chave de API do Asaas</Label>
                  <Input
                    id={id}
                    ref={input}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    autoCapitalize="none"
                    disabled={state.kind === 'pending'}
                    aria-invalid={fieldProblem}
                    aria-describedby={`${id}-help${fieldProblem ? ` ${id}-problem` : ''}`}
                  />
                  <p
                    id={`${id}-help`}
                    className="text-sm text-muted-foreground"
                  >
                    A chave será enviada somente ao confirmar e apagada deste
                    formulário. A aprovação para receber pagamentos é consultada
                    separadamente.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="submit"
                    variant="default"
                    disabled={state.kind === 'pending'}
                  >
                    Confirmar conexão
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={state.kind === 'pending'}
                    onClick={() => {
                      if (input.current) input.current.value = ''
                      model.dismiss()
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
                {state.kind === 'pending' ? (
                  <p role="status">Conectando a conta...</p>
                ) : null}
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
