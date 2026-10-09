'use client'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Link,
} from '@gb-locacoes/ui'
import {
  REQUIRED_SIGNUP_DOCUMENTS,
  type LegalDocumentKind,
} from '@gb-locacoes/contracts/onboarding'
import { useOnboarding } from '../model/use-onboarding.web'
import type { OnboardingPageProps } from '../model/contracts'
import { CompanyFields } from './CompanyFields.web'

const titles = {
  ACCOUNT: 'Seu acesso',
  EMAIL_VERIFICATION: 'Confirme seu e-mail',
  COMPANY: 'Sua empresa',
  SITE_ADDRESS: 'Endereço do seu site',
  PLAN: 'Escolha seu plano',
  TERMS: 'Termos',
  CREATE: 'Criar minha locadora',
}
const documentNames: Record<LegalDocumentKind, string> = {
  PLATFORM_TERMS: 'Termos de Uso',
  PRIVACY_POLICY: 'Política de Privacidade',
  DATA_PROCESSING_AGREEMENT: 'Acordo de Tratamento de Dados',
  PAYMENTS_PARTNER_NOTICE: 'Aviso do parceiro de pagamentos',
  MARKETING_OPT_IN: 'Receber comunicações de marketing (opcional)',
}
export function OnboardingPage(props: OnboardingPageProps) {
  const model = useOnboarding(props)
  const { options, step, access, company, busy, error, message } = model
  const accountInputs = (includeName: boolean) => (
    <>
      {includeName && (
        <div className="space-y-2">
          <Label htmlFor="owner-name">Nome</Label>
          <Input
            id="owner-name"
            value={access.name}
            autoComplete="name"
            maxLength={200}
            disabled={busy}
            onChange={(event) =>
              model.setAccess({ ...access, name: event.target.value })
            }
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="owner-email">E-mail</Label>
        <Input
          id="owner-email"
          type="email"
          autoComplete="email"
          maxLength={254}
          value={access.email}
          disabled={busy}
          onChange={(event) =>
            model.setAccess({ ...access, email: event.target.value })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="owner-password">Senha</Label>
        <Input
          id="owner-password"
          type="password"
          value={access.password}
          maxLength={128}
          autoComplete={includeName ? 'new-password' : 'current-password'}
          disabled={busy}
          onChange={(event) =>
            model.setAccess({ ...access, password: event.target.value })
          }
        />
        {includeName && (
          <p className="text-sm text-muted-foreground">
            Use pelo menos dez caracteres.
          </p>
        )}
      </div>
    </>
  )
  const captcha =
    options?.mode === 'on'
      ? props.captcha({
          siteKey: options.captchaSiteKey,
          attempt: model.attempt,
          onToken: model.setToken,
        })
      : null
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Cadastre sua locadora</h1>
      {error && (
        <p role="alert" className="mb-4 text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mb-4 text-muted-foreground">
          {message}
        </p>
      )}
      {!options ? (
        <div>
          <p>Carregando o cadastro...</p>
          {error && (
            <Button onClick={() => void model.reload()} disabled={busy}>
              Tentar novamente
            </Button>
          )}
        </div>
      ) : options.mode === 'off' ? (
        <Card>
          <CardHeader>
            <CardTitle>Fale com a gente</CardTitle>
          </CardHeader>
          <CardContent>
            <p>O cadastro de novas locadoras ainda não está aberto.</p>
          </CardContent>
        </Card>
      ) : model.receipt ? (
        <Card>
          <CardHeader>
            <CardTitle>Locadora criada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{model.receipt.organization.name}</p>
            <p>
              {model.receipt.organization.slug}.{options.rootDomain}
            </p>
            <p>
              {model.receipt.subscription.status === 'TRIALING'
                ? 'Seu período de teste termina em ' +
                  model.receipt.subscription.trialEndsAt +
                  '.'
                : 'Conclua a assinatura no painel para continuar.'}
            </p>
            {model.receipt.notices.includes('TRIAL_ALREADY_USED') && (
              <p>
                O período de teste já foi utilizado para esta conta ou empresa.
              </p>
            )}
            <p>
              Configure os equipamentos, a marca e os recebimentos no painel. A
              criação não publica seu site nem ativa pagamentos.
            </p>
            <Link href="/admin">Abrir painel</Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{titles[step]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4" aria-busy={busy}>
            {step === 'ACCOUNT' && (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void model.register()
                }}
              >
                {accountInputs(true)}
                {captcha}
                <Button type="submit" disabled={busy || !model.token}>
                  Criar meu acesso
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    // Existing accounts enter the verification step through the same credential engine.
                    void model.login()
                  }}
                >
                  Já tenho conta — entrar
                </Button>
              </form>
            )}
            {step === 'EMAIL_VERIFICATION' && (
              <>
                <p>
                  Abra o link enviado para o seu e-mail. A confirmação será
                  conferida no servidor.
                </p>
                {!model.userId ? (
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void model.login()
                    }}
                  >
                    {accountInputs(false)}
                    <Button type="submit" disabled={busy}>
                      Entrar para continuar
                    </Button>
                    <Link href="/recuperar-senha">Esqueci minha senha</Link>
                  </form>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busy} onClick={() => void model.verify()}>
                      Já confirmei meu e-mail
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || model.resendSeconds > 0}
                      onClick={() => void model.resend()}
                    >
                      {model.resendSeconds
                        ? 'Reenviar em ' + model.resendSeconds + ' s'
                        : 'Reenviar verificação'}
                    </Button>
                  </div>
                )}
              </>
            )}
            {step === 'COMPANY' && (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  model.advanceCompany()
                }}
              >
                <CompanyFields
                  value={company}
                  change={model.setCompany}
                  disabled={busy}
                />
                <p className="text-sm text-muted-foreground">
                  O rascunho fica neste navegador. Nenhuma empresa é criada
                  nesta etapa.
                </p>
                <Button type="submit" disabled={busy}>
                  Continuar
                </Button>
              </form>
            )}
            {step === 'SITE_ADDRESS' && (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void model.checkSlug()
                }}
              >
                <Label htmlFor="site-slug">Endereço do site</Label>
                <Input
                  id="site-slug"
                  value={model.slug}
                  maxLength={63}
                  autoComplete="off"
                  disabled={busy}
                  onChange={(event) => model.setSlug(event.target.value)}
                />
                <p>
                  {model.slug || 'sua-locadora'}.{options.rootDomain}
                </p>
                {model.suggestions.length > 0 && (
                  <div>
                    <p>Outras opções:</p>
                    {model.suggestions.map((slug) => (
                      <Button
                        key={slug}
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => model.setSlug(slug)}
                      >
                        {slug}
                      </Button>
                    ))}
                  </div>
                )}
                <Button type="submit" disabled={busy}>
                  Conferir e continuar
                </Button>
              </form>
            )}
            {step === 'PLAN' && (
              <>
                {!model.plans.length && (
                  <p>Nenhum plano disponível no momento.</p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {model.plans.map((plan) => (
                    <Card key={plan.planVersionId}>
                      <CardHeader>
                        <CardTitle>{plan.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p>R$ {plan.amount.replace('.', ',')} por mês</p>
                        {plan.trialDays > 0 && (
                          <p>
                            Até {plan.trialDays} dias de teste, conforme
                            elegibilidade.
                          </p>
                        )}
                        <p>
                          Equipamentos:{' '}
                          {plan.entitlements.limits.equipments ?? 'ilimitados'}
                        </p>
                        <p>
                          Pessoas da equipe:{' '}
                          {plan.entitlements.limits.staffSeats ?? 'ilimitadas'}
                        </p>
                        <Button
                          variant={
                            model.planVersionId === plan.planVersionId
                              ? 'default'
                              : 'outline'
                          }
                          disabled={busy}
                          aria-pressed={
                            model.planVersionId === plan.planVersionId
                          }
                          onClick={() =>
                            model.setPlanVersionId(plan.planVersionId)
                          }
                        >
                          Escolher {plan.name}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Button
                  disabled={busy || !model.planVersionId}
                  onClick={model.advancePlan}
                >
                  Continuar
                </Button>
              </>
            )}
            {step === 'TERMS' && (
              <>
                {options.documents.map((document) => (
                  <section key={document.kind} className="space-y-2">
                    <details className="rounded-md border p-4">
                      <summary>
                        {documentNames[document.kind]} — {document.version}
                      </summary>
                      <p className="whitespace-pre-wrap text-sm">
                        {document.text}
                      </p>
                    </details>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={'term-' + document.kind}
                        disabled={busy}
                        checked={model.accepted.includes(document.kind)}
                        onCheckedChange={(checked) =>
                          model.setAccepted(
                            checked === true
                              ? [...model.accepted, document.kind]
                              : model.accepted.filter(
                                  (kind) => kind !== document.kind
                                )
                          )
                        }
                      />
                      <Label htmlFor={'term-' + document.kind}>
                        {document.kind === 'MARKETING_OPT_IN'
                          ? documentNames[document.kind]
                          : 'Li e aceito: ' + documentNames[document.kind]}
                      </Label>
                    </div>
                  </section>
                ))}
                <Button
                  disabled={
                    busy ||
                    !REQUIRED_SIGNUP_DOCUMENTS.every((kind) =>
                      model.accepted.includes(kind)
                    )
                  }
                  onClick={model.advanceTerms}
                >
                  Revisar cadastro
                </Button>
              </>
            )}
            {step === 'CREATE' && (
              <>
                <p>
                  {company.tradeName} — {model.slug}.{options.rootDomain}
                </p>
                <p>
                  Plano:{' '}
                  {model.plans.find(
                    (plan) => plan.planVersionId === model.planVersionId
                  )?.name ?? 'Pedido em confirmação'}
                </p>
                <p>
                  A criação confirma os dados e aceites. Você configurará o site
                  e os recebimentos no painel.
                </p>
                {model.pending && (
                  <p role="status">
                    O resultado do pedido precisa ser confirmado. Repetir usa o
                    mesmo pedido; os dados ficam bloqueados.
                  </p>
                )}
                {captcha}
                <Button
                  disabled={busy || !model.token}
                  onClick={() => void model.create()}
                >
                  {model.pending
                    ? 'Confirmar resultado do pedido'
                    : 'Criar minha locadora'}
                </Button>
              </>
            )}
            {!['ACCOUNT', 'EMAIL_VERIFICATION', 'COMPANY'].includes(step) && (
              <Button
                variant="outline"
                disabled={busy || Boolean(model.pending)}
                onClick={model.back}
              >
                Voltar
              </Button>
            )}
            <Button
              variant="outline"
              disabled={busy || Boolean(model.pending)}
              onClick={() => void model.reload()}
            >
              Atualizar opções
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
