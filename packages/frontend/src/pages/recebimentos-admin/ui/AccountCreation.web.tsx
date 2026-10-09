'use client'
import { useEffect, useId, useRef, useState } from 'react'
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  CurrencyInput,
  Input,
  Label,
  Link,
} from '@gb-locacoes/ui'
import { BrazilianMobilePhoneSchema } from '@gb-locacoes/contracts/payment-account'
import type { PaymentAccountCreationOffer } from '@gb-locacoes/contracts/payment-account'
import type { ReceivingCreateProblem } from '../api/create-account'
import type { useAccountCreation } from '../model/use-account-creation'
import {
  valorDigitado,
  valorFormatado,
  type ValorFaturamento,
} from '../model/valor-faturamento'

type Blocker = NonNullable<PaymentAccountCreationOffer['blocker']>
type Outcome = NonNullable<PaymentAccountCreationOffer['lastRequestOutcome']>

const blockers: Record<Exclude<Blocker, 'CREATION_UNAVAILABLE'>, string> = {
  ACCOUNT_EXISTS:
    'Já existe uma integração de recebimentos para esta locadora. Fale com o suporte para trocar o acesso.',
  SUBSCRIPTION_RESTRICTED:
    'Regularize a assinatura para continuar com a conta de recebimentos.',
  MODULE_NOT_IN_PLAN: 'Seu plano não inclui pagamentos on-line.',
  FIRST_PAYMENT_REQUIRED:
    'A criação da conta de recebimentos fica disponível depois do pagamento da primeira mensalidade.',
  EMAIL_NOT_VERIFIED:
    'Confirme seu e-mail antes de pedir a conta de recebimentos.',
  PAYMENTS_NOTICE_REQUIRED:
    'O dono atual da locadora ainda não aceitou o aviso sobre a instituição de pagamentos parceira. Fale com o suporte.',
  COMPANY_DATA_INCOMPLETE:
    'Complete os dados da empresa (razão social, CNPJ, endereço e e-mail) antes de pedir a conta de recebimentos.',
  DOCUMENT_IN_USE:
    'Este CNPJ já tem uma conta de recebimentos em outra conta da plataforma. Fale com o suporte.',
}

const outcomes: Record<Outcome, string> = {
  REJECTED_DATA:
    'A instituição de pagamentos recusou o pedido anterior. Confira o celular e o faturamento e envie de novo.',
  REJECTED_PROVIDER:
    'A instituição de pagamentos não aceitou o pedido agora. Tente mais tarde ou fale com o suporte.',
  CANCELLED:
    'O pedido anterior foi cancelado e nenhuma conta foi criada. Confira os dados e envie de novo.',
}

const messages: Record<ReceivingCreateProblem, string> = {
  input: 'Confira o faturamento e o celular informados.',
  reauthentication:
    'Confirme sua identidade entrando novamente. Depois, consulte a conta e envie o pedido de novo.',
  session: 'Entre novamente para consultar a conta e enviar o pedido.',
  subscription:
    'Regularize a assinatura para continuar com a conta de recebimentos.',
  plan: 'Seu plano não inclui pagamentos on-line.',
  email: 'Confirme seu e-mail antes de pedir a conta de recebimentos.',
  owner: 'Somente o dono atual da locadora pode pedir a conta de recebimentos.',
  archived:
    'Esta locadora está arquivada. Consulte a assinatura para reativá-la.',
  selection:
    'Selecione a locadora e consulte a conta antes de enviar outro pedido.',
  document:
    'Este CNPJ já tem uma conta de recebimentos em outra conta da plataforma. Fale com o suporte.',
  changed:
    'Os dados da empresa mudaram depois que a página foi aberta. Consulte o estado atual e confira os dados de novo.',
  payment:
    'A criação da conta de recebimentos fica disponível depois do pagamento da primeira mensalidade.',
  notice:
    'O dono atual da locadora ainda não aceitou o aviso sobre a instituição de pagamentos parceira. Fale com o suporte.',
  existing:
    'Já existe uma conta ou integração de recebimentos para esta locadora. Consulte o estado atual.',
  unavailable:
    'A criação da conta de recebimentos não está disponível agora. Consulte o estado atual.',
  rate: 'Aguarde um pouco antes de tentar novamente.',
  uncertain:
    'Não foi possível confirmar o resultado. O pedido pode ter sido registrado. Consulte o estado atual antes de pedir de novo.',
}

/**
 * Owner request of the receiving account (ADR SaaS B.7.2, decision D-1: offered before the connection of an
 * existing account). The typed income and phone live only in this component; they are cleared on cancel,
 * page hide, unmount and any change of company, session or transport (the parent keys it by scope).
 */
export function AccountCreation({
  model,
  reauthenticationUrl,
}: {
  model: ReturnType<typeof useAccountCreation>
  reauthenticationUrl: string
}) {
  const { offer, state } = model
  const id = useId()
  const [income, setIncome] = useState<ValorFaturamento>(null)
  const [shown, setShown] = useState(0)
  // Set synchronously by the input event, before the field reports its value: a blur alone never counts.
  const typed = useRef(false)
  const [phone, setPhone] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const suggested = offer?.suggestedMobilePhone ?? ''
  const clear = (nextPhone: string) => {
    typed.current = false
    setIncome(null)
    setShown(0)
    setPhone(nextPhone)
    setConfirmed(false)
  }
  useEffect(() => {
    setPhone(suggested)
  }, [suggested])
  useEffect(() => {
    const hide = () => {
      typed.current = false
      setIncome(null)
      setShown(0)
      setPhone('')
      setConfirmed(false)
    }
    window.addEventListener('pagehide', hide)
    return () => window.removeEventListener('pagehide', hide)
  }, [])
  if (state.kind === 'accepted')
    return (
      <p role="status">
        Pedido recebido. A criação está em andamento; acompanhe a situação
        abaixo.
      </p>
    )
  const problem =
    state.kind === 'problem' ? (
      <Alert>
        <AlertDescription id={`${id}-problem`}>
          {messages[state.problem]}
        </AlertDescription>
        {state.problem === 'reauthentication' || state.problem === 'session' ? (
          <a
            className="text-primary underline underline-offset-4"
            href={reauthenticationUrl}
          >
            Entrar novamente
          </a>
        ) : null}
        {!model.editable ? (
          <Button variant="outline" onClick={model.refresh}>
            Consultar estado
          </Button>
        ) : null}
      </Alert>
    ) : null
  if (!offer || offer.blocker === 'CREATION_UNAVAILABLE') return problem
  const previous = offer.lastRequestOutcome ? (
    <Alert>
      <AlertDescription>{outcomes[offer.lastRequestOutcome]}</AlertDescription>
    </Alert>
  ) : null
  if (!offer.available || !offer.company) {
    const blocker = offer.blocker as Exclude<Blocker, 'CREATION_UNAVAILABLE'>
    return (
      <>
        {problem}
        <Card>
          <CardHeader>
            <CardTitle>Criar conta de recebimentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {previous}
            <p>{blockers[blocker]}</p>
            {blocker === 'SUBSCRIPTION_RESTRICTED' ? (
              <Link href="/admin/assinatura">Consultar assinatura</Link>
            ) : null}
          </CardContent>
        </Card>
      </>
    )
  }
  if (state.kind === 'problem' && !model.editable) return problem
  const company = offer.company
  const mobile = BrazilianMobilePhoneSchema.safeParse(phone)
  const pending = state.kind === 'pending'
  const value = income === null || income === 'invalid' ? null : income
  const ready = value !== null && mobile.success && confirmed && !pending
  const address = [
    company.address.street + ', ' + company.address.number,
    company.address.complement,
    company.address.district,
    'CEP ' + company.address.postalCode,
  ]
    .filter(Boolean)
    .join(' - ')
  return (
    <>
      {problem}
      <Card>
        <CardHeader>
          <CardTitle>Criar conta de recebimentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {previous}
          <p>
            A plataforma pede a conta de recebimentos da locadora à instituição
            de pagamentos parceira, com os dados abaixo.
          </p>
          {state.kind === 'idle' ? (
            <Button variant="default" onClick={model.begin}>
              Começar pedido
            </Button>
          ) : (
            <form
              className="space-y-4"
              aria-label="Pedido da conta de recebimentos"
              onSubmit={(event) => {
                event.preventDefault()
                if (!ready || !mobile.success) return
                const values = { incomeValue: value, mobilePhone: mobile.data }
                clear(suggested)
                void model.submit(values)
              }}
            >
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Razão social</dt>
                  <dd>{company.legalName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">CNPJ</dt>
                  <dd>{company.cnpj}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Endereço</dt>
                  <dd>{address}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">E-mail de acesso</dt>
                  <dd>{company.loginEmail}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">E-mail de contato</dt>
                  <dd>{company.email}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Site</dt>
                  <dd>{company.site}</dd>
                </div>
              </dl>
              <div className="space-y-2">
                <Label htmlFor={`${id}-income`}>
                  Faturamento mensal da empresa
                </Label>
                <CurrencyInput
                  id={`${id}-income`}
                  value={shown}
                  disabled={pending}
                  aria-describedby={`${id}-income-help`}
                  aria-invalid={income === 'invalid'}
                  onInput={() => {
                    typed.current = true
                  }}
                  onValueChange={(next) => {
                    // Only a value the owner typed counts; an untouched field is never sent as zero.
                    if (!typed.current) return
                    setShown(next)
                    setIncome(valorDigitado(next))
                  }}
                />
                <p
                  id={`${id}-income-help`}
                  className="text-sm text-muted-foreground"
                >
                  Valor informado por você, enviado à instituição de pagamentos
                  no cadastro e apagado da plataforma em seguida.
                </p>
                {income === null ? (
                  <p className="text-sm text-muted-foreground">
                    Informe o faturamento mensal.
                  </p>
                ) : income === 'invalid' ? (
                  <p className="text-sm text-muted-foreground">
                    Informe o faturamento mensal com até 10 dígitos antes da
                    vírgula.
                  </p>
                ) : (
                  <p>Faturamento informado: {valorFormatado(income)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-phone`}>Celular para contato</Label>
                <Input
                  id={`${id}-phone`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={phone}
                  disabled={pending}
                  aria-invalid={phone !== '' && !mobile.success}
                  aria-describedby={`${id}-phone-help`}
                  onChange={(event) => setPhone(event.target.value)}
                />
                <p
                  id={`${id}-phone-help`}
                  className="text-sm text-muted-foreground"
                >
                  Somente celular, com DDD.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`${id}-confirm`}
                  checked={confirmed}
                  disabled={pending}
                  onCheckedChange={(checked) => setConfirmed(checked === true)}
                />
                <Label htmlFor={`${id}-confirm`}>
                  Confirmo que os dados da empresa acima estão corretos
                </Label>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" variant="default" disabled={!ready}>
                  Criar conta de recebimentos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    clear(suggested)
                    model.dismiss()
                  }}
                >
                  Cancelar
                </Button>
              </div>
              {pending ? <p role="status">Enviando o pedido...</p> : null}
            </form>
          )}
        </CardContent>
      </Card>
    </>
  )
}
