// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  ApiClientProvider,
  createHttpClient,
  type HttpClient,
} from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import { subscriptionTenant } from '../../../../../../tests/helpers/subscription-account'
import { RecebimentosAdminPage } from './RecebimentosPage.web'

// Wave 134 (S9): the owner asks for the receiving account (decision D-1: creation first, connection after).
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
// The design-system checkbox measures itself; jsdom has no ResizeObserver.
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})
const OFFER = '/api/admin/payment-account/create'
const version = 'a'.repeat(64)
const company = {
  legalName: 'Locadora Sintetica Ltda',
  cnpj: '11.222.333/0001-81',
  companyType: 'LIMITED',
  loginEmail: 'dono@example.test',
  email: 'contato@example.test',
  address: {
    street: 'Rua Sintetica',
    number: '100',
    complement: null,
    district: 'Centro',
    postalCode: '01001000',
  },
  site: 'https://alfa.locadora.example.test',
}
const offer = {
  available: true,
  blocker: null,
  model: 'STANDARD',
  company,
  suggestedMobilePhone: '11987654321',
  companyDataVersion: version,
  lastRequestOutcome: null,
}
const blocked = (
  blocker: string,
  lastRequestOutcome: string | null = null
) => ({
  available: false,
  blocker,
  model: null,
  company: null,
  suggestedMobilePhone: null,
  companyDataVersion: null,
  lastRequestOutcome,
})
const provisioning = {
  kind: 'STANDARD',
  status: 'PROVISIONING',
  environment: 'sandbox',
  healthIssue: null,
  providerStatusText: null,
  commercialInfoExpiresAt: null,
  commercialInfoExpired: false,
  approvedAt: null,
  lastSyncedAt: null,
}
type Fetcher = (path: string, init?: RequestInit) => Promise<Response>
function server(options: {
  offer?: unknown
  post?: Fetcher
  account?: () => unknown
}) {
  return vi.fn<Fetcher>(async (path, init) => {
    if (path === OFFER && init?.method === 'POST')
      return (
        options.post ??
        (async () => Response.json({ accepted: true }, { status: 202 }))
      )(path, init)
    if (path === OFFER)
      return Response.json(
        typeof options.offer === 'function'
          ? (options.offer as () => unknown)()
          : (options.offer ?? offer)
      )
    return Response.json({ account: options.account?.() ?? null })
  })
}
const posts = (fetcher: ReturnType<typeof server>) =>
  fetcher.mock.calls.filter((call) => call[1]?.method === 'POST')
const tree = (client: HttpClient, tenant = 'alfa', userId = 'owner-a') => (
  <ApiClientProvider client={client}>
    <FrontendSessionFixture tenant={subscriptionTenant(tenant)} userId={userId}>
      <RecebimentosAdminPage />
    </FrontendSessionFixture>
  </ApiClientProvider>
)
async function start() {
  fireEvent.click(await screen.findByRole('button', { name: 'Começar pedido' }))
  return {
    income: screen.getByLabelText(
      'Faturamento mensal da empresa'
    ) as HTMLInputElement,
    phone: screen.getByLabelText('Celular para contato') as HTMLInputElement,
    confirm: screen.getByRole('checkbox', {
      name: 'Confirmo que os dados da empresa acima estão corretos',
    }),
    send: screen.getByRole('button', { name: 'Criar conta de recebimentos' }),
  }
}
const type = (input: HTMLInputElement, digits: string) =>
  fireEvent.input(input, { target: { value: digits } })

it('offers the creation before the connection and shows exactly the company data that will be sent', async () => {
  const fetcher = server({})
  render(tree(createHttpClient({ fetcher })))
  await screen.findByRole('button', { name: 'Começar pedido' })
  const text = document.body.textContent ?? ''
  expect(text.indexOf('Criar conta de recebimentos')).toBeLessThan(
    text.indexOf('Conectar conta própria do Asaas')
  )
  await start()
  for (const shown of [
    'Locadora Sintetica Ltda',
    '11.222.333/0001-81',
    'Rua Sintetica, 100 - Centro - CEP 01001000',
    'dono@example.test',
    'contato@example.test',
    'https://alfa.locadora.example.test',
  ])
    expect(screen.getByText(shown)).toBeTruthy()
  expect(
    (screen.getByLabelText('Celular para contato') as HTMLInputElement).value
  ).toBe('11987654321')
  expect(posts(fetcher)).toHaveLength(0)
})

it('M29: an untouched income is never sent as zero; a typed zero is', async () => {
  const fetcher = server({})
  render(tree(createHttpClient({ fetcher })))
  const form = await start()
  fireEvent.click(form.confirm)
  // The field shows R$ 0,00 from the start; focusing and leaving it is not typing.
  fireEvent.focus(form.income)
  fireEvent.blur(form.income)
  expect(screen.getByText('Informe o faturamento mensal.')).toBeTruthy()
  expect((form.send as HTMLButtonElement).disabled).toBe(true)
  fireEvent.submit(form.send.closest('form')!)
  expect(posts(fetcher)).toHaveLength(0)
  type(form.income, '0')
  expect(screen.getByText('Faturamento informado: R$ 0,00')).toBeTruthy()
  expect((form.send as HTMLButtonElement).disabled).toBe(false)
  fireEvent.click(form.send)
  await waitFor(() => expect(posts(fetcher)).toHaveLength(1))
  expect(JSON.parse(String(posts(fetcher)[0]![1]!.body)).incomeValue).toBe(
    '0.00'
  )
})

it('sends the exact decimal string once, clears the form and rereads the account without simulating approval', async () => {
  let finish!: (response: Response) => void
  let accepted = false
  const fetcher = server({
    post: () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
    account: () => (accepted ? provisioning : null),
  })
  render(tree(createHttpClient({ fetcher })))
  const form = await start()
  type(form.income, '9876543')
  expect(screen.getByText('Faturamento informado: R$ 98.765,43')).toBeTruthy()
  expect((form.send as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(form.confirm)
  fireEvent.click(form.send)
  fireEvent.submit(form.send.closest('form')!)
  await waitFor(() => expect(posts(fetcher)).toHaveLength(1))
  expect(screen.getByText('Enviando o pedido...')).toBeTruthy()
  expect(posts(fetcher)[0]![1]!.cache).toBe('no-store')
  expect(JSON.parse(String(posts(fetcher)[0]![1]!.body))).toEqual({
    incomeValue: '98765.43',
    mobilePhone: '11987654321',
    companyDataConfirmed: true,
    companyDataVersion: version,
  })
  accepted = true
  await act(async () =>
    finish(Response.json({ accepted: true }, { status: 202 }))
  )
  await screen.findByText('Criação em andamento')
  expect(
    screen.getByText(
      'Pedido recebido. A criação está em andamento; acompanhe a situação abaixo.'
    )
  ).toBeTruthy()
  expect(screen.queryByText('Conta aprovada')).toBeNull()
  expect(screen.queryByLabelText('Faturamento mensal da empresa')).toBeNull()
  expect(posts(fetcher)).toHaveLength(1)
})

it.each(['after reading the account again', 'on the first reading'] as const)(
  'a request returned to the owner (D-3) %s shows the reason and a new empty form, not the acceptance',
  async (when) => {
    let stage: 'open' | 'provisioning' | 'returned' = 'open'
    const fetcher = server({
      offer: () =>
        stage === 'returned'
          ? { ...offer, lastRequestOutcome: 'REJECTED_DATA' }
          : offer,
      account: () => (stage === 'provisioning' ? provisioning : null),
      post: async () => {
        stage = when === 'on the first reading' ? 'returned' : 'provisioning'
        return Response.json({ accepted: true }, { status: 202 })
      },
    })
    render(tree(createHttpClient({ fetcher })))
    const form = await start()
    type(form.income, '9876543')
    fireEvent.click(form.confirm)
    fireEvent.click(form.send)
    await waitFor(() => expect(posts(fetcher)).toHaveLength(1))
    if (when === 'after reading the account again') {
      await screen.findByText('Criação em andamento')
      expect(
        screen.getByText(
          'Pedido recebido. A criação está em andamento; acompanhe a situação abaixo.'
        )
      ).toBeTruthy()
      // The worker returns the request: no current account, the outcome is in the offer.
      stage = 'returned'
      fireEvent.click(
        screen.getByRole('button', { name: 'Atualizar consulta' })
      )
    }
    await screen.findByText(
      /recusou o pedido anterior\. Confira o celular e o faturamento/
    )
    expect(
      screen.queryByText(
        'Pedido recebido. A criação está em andamento; acompanhe a situação abaixo.'
      )
    ).toBeNull()
    expect(
      screen.getByText(
        'Nenhuma conta de recebimentos conectada a esta locadora.'
      )
    ).toBeTruthy()
    // A new request starts from an empty form, by the owner; nothing is resent.
    const again = await start()
    expect(again.income.value.replace(/\s/g, '')).toBe('R$0,00')
    expect(screen.getByText('Informe o faturamento mensal.')).toBeTruthy()
    expect(posts(fetcher)).toHaveLength(1)
  }
)

it.each(['refused (503)', 'unreachable (network)'] as const)(
  'a returned request whose new offer is %s leaves the acceptance too',
  async (failure) => {
    let returned = false
    const fetcher = vi.fn<Fetcher>(async (path, init) => {
      if (path === OFFER && init?.method === 'POST') {
        returned = true
        return Response.json({ accepted: true }, { status: 202 })
      }
      if (path === OFFER && returned && failure === 'unreachable (network)')
        throw new TypeError('fetch failed')
      if (path === OFFER)
        return returned
          ? Response.json({ error: 'indisponível' }, { status: 503 })
          : Response.json(offer)
      return Response.json({ account: null })
    })
    render(tree(createHttpClient({ fetcher })))
    const form = await start()
    type(form.income, '9876543')
    fireEvent.click(form.confirm)
    fireEvent.click(form.send)
    await waitFor(() =>
      expect(
        fetcher.mock.calls.filter(
          (call) => call[0] === OFFER && call[1]?.method !== 'POST'
        )
      ).toHaveLength(2)
    )
    await screen.findByText(
      'Nenhuma conta de recebimentos conectada a esta locadora.'
    )
    await waitFor(() =>
      expect(
        screen.queryByText(
          'Pedido recebido. A criação está em andamento; acompanhe a situação abaixo.'
        )
      ).toBeNull()
    )
    expect(screen.queryByRole('button', { name: 'Começar pedido' })).toBeNull()
    expect(posts(fetcher)).toHaveLength(1)
  }
)

it('a value beyond Decimal(12, 2) is explained and never sent', async () => {
  const fetcher = server({})
  render(tree(createHttpClient({ fetcher })))
  const form = await start()
  fireEvent.click(form.confirm)
  type(form.income, '1000000000000')
  expect(
    screen.getByText(
      'Informe o faturamento mensal com até 10 dígitos antes da vírgula.'
    )
  ).toBeTruthy()
  expect(form.income.getAttribute('aria-invalid')).toBe('true')
  expect((form.send as HTMLButtonElement).disabled).toBe(true)
  fireEvent.submit(form.send.closest('form')!)
  expect(posts(fetcher)).toHaveLength(0)
  type(form.income, '999999999999')
  expect(
    screen.getByText('Faturamento informado: R$ 9.999.999.999,99')
  ).toBeTruthy()
  expect((form.send as HTMLButtonElement).disabled).toBe(false)
})

it('only a mobile phone is accepted and the confirmation is required', async () => {
  const fetcher = server({})
  render(tree(createHttpClient({ fetcher })))
  const form = await start()
  type(form.income, '100')
  fireEvent.change(form.phone, { target: { value: '(11) 3333-4444' } })
  fireEvent.click(form.confirm)
  expect((form.send as HTMLButtonElement).disabled).toBe(true)
  expect(form.phone.getAttribute('aria-invalid')).toBe('true')
  fireEvent.change(form.phone, { target: { value: '(21) 99876-5432' } })
  expect((form.send as HTMLButtonElement).disabled).toBe(false)
  fireEvent.click(form.confirm)
  expect((form.send as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(form.confirm)
  fireEvent.click(form.send)
  await waitFor(() => expect(posts(fetcher)).toHaveLength(1))
  expect(JSON.parse(String(posts(fetcher)[0]![1]!.body)).mobilePhone).toBe(
    '21998765432'
  )
})

it('M21: cancel, page hide, a company or session change and unmount clear the typed value, never persisted', async () => {
  const store = vi.spyOn(Storage.prototype, 'setItem')
  try {
    const fetcher = server({})
    const client = createHttpClient({ fetcher })
    const rendered = render(tree(client))
    let form = await start()
    type(form.income, '9876543')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    form = await start()
    expect(form.income.value.replace(/\s/g, '')).toBe('R$0,00')
    expect(screen.getByText('Informe o faturamento mensal.')).toBeTruthy()
    type(form.income, '9876543')
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(screen.getByText('Informe o faturamento mensal.')).toBeTruthy()
    type(form.income, '9876543')
    rendered.rerender(tree(client, 'bravo'))
    form = await start()
    expect(screen.getByText('Informe o faturamento mensal.')).toBeTruthy()
    type(form.income, '9876543')
    rendered.rerender(tree(client, 'bravo', 'owner-b'))
    await start()
    expect(screen.getByText('Informe o faturamento mensal.')).toBeTruthy()
    rendered.unmount()
    expect(store).not.toHaveBeenCalled()
    expect(document.location.href).not.toContain('98765')
    expect(posts(fetcher)).toHaveLength(0)
  } finally {
    store.mockRestore()
  }
})

it.each(['network', '503', 'invalid receipt'])(
  'M21: an uncertain %s only allows reading the state again, never another POST',
  async (failure) => {
    const fetcher = server({
      post: async () => {
        if (failure === 'network') throw new Error('98765.43')
        return Response.json(
          failure === '503'
            ? { error: '98765.43' }
            : { accepted: true, private: '98765.43' },
          { status: failure === '503' ? 503 : 202 }
        )
      },
    })
    render(tree(createHttpClient({ fetcher })))
    const form = await start()
    type(form.income, '9876543')
    fireEvent.click(form.confirm)
    fireEvent.click(form.send)
    await screen.findByText(/O pedido pode ter sido registrado/)
    expect(screen.queryByLabelText('Faturamento mensal da empresa')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Começar pedido' })).toBeNull()
    const reads = fetcher.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Consultar estado' }))
    await waitFor(() =>
      expect(fetcher.mock.calls.length).toBeGreaterThan(reads)
    )
    // A new request starts from an empty form, by the owner.
    const again = await start()
    expect(again.income.value.replace(/\s/g, '')).toBe('R$0,00')
    expect(posts(fetcher)).toHaveLength(1)
    expect(document.body.textContent).not.toContain('98765')
  }
)

it.each([
  [401, 'FRESH_SESSION_REQUIRED', /Confirme sua identidade/],
  [402, 'SUBSCRIPTION_RESTRICTED', /Regularize a assinatura/],
  [402, 'MODULE_NOT_IN_PLAN', /Seu plano não inclui pagamentos on-line/],
  [403, 'OWNER_REQUIRED', /Somente o dono atual/],
  [403, 'TENANT_ARCHIVED', /arquivada/],
  [403, 'EMAIL_NOT_VERIFIED', /Confirme seu e-mail/],
  [409, 'DOCUMENT_IN_USE', /em outra conta da plataforma/],
  [409, 'COMPANY_DATA_CHANGED', /Os dados da empresa mudaram/],
  [409, 'FIRST_PAYMENT_REQUIRED', /primeira mensalidade/],
  [409, 'PAYMENTS_NOTICE_REQUIRED', /aviso sobre a instituição/],
])(
  'shows %s %s in plain language, without echoing the request',
  async (status, code, message) => {
    const fetcher = server({
      post: async () =>
        Response.json({ code, error: '98765.43 11987654321' }, { status }),
    })
    render(tree(createHttpClient({ fetcher })))
    const form = await start()
    type(form.income, '9876543')
    fireEvent.click(form.confirm)
    fireEvent.click(form.send)
    await screen.findByText(message)
    expect(document.body.textContent).not.toContain('98765')
    if (status === 401)
      expect(
        screen
          .getByRole('link', { name: 'Entrar novamente' })
          .getAttribute('href')
      ).toContain('callbackUrl=%2Fadmin%2Frecebimentos')
  }
)

it.each([
  ['FIRST_PAYMENT_REQUIRED', /depois do pagamento da primeira mensalidade/],
  ['SUBSCRIPTION_RESTRICTED', /Regularize a assinatura/],
  ['MODULE_NOT_IN_PLAN', /Seu plano não inclui pagamentos on-line/],
  ['EMAIL_NOT_VERIFIED', /Confirme seu e-mail/],
  ['PAYMENTS_NOTICE_REQUIRED', /aviso sobre a instituição/],
  ['COMPANY_DATA_INCOMPLETE', /Complete os dados da empresa/],
  [
    'DOCUMENT_IN_USE',
    /em outra conta da plataforma; |em outra conta da plataforma\. Fale com o suporte/,
  ],
  ['ACCOUNT_EXISTS', /Fale com o suporte para trocar o acesso/],
])(
  'a %s offer explains the blocker without a form',
  async (blocker, message) => {
    render(
      tree(createHttpClient({ fetcher: server({ offer: blocked(blocker) }) }))
    )
    await screen.findByText(message)
    expect(screen.queryByRole('button', { name: 'Começar pedido' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Conectar conta própria' })
    ).toBeTruthy()
    if (blocker === 'SUBSCRIPTION_RESTRICTED')
      expect(
        screen
          .getByRole('link', { name: 'Consultar assinatura' })
          .getAttribute('href')
      ).toBe('/admin/assinatura')
  }
)

it.each([
  [
    'REJECTED_DATA',
    /recusou o pedido anterior\. Confira o celular e o faturamento/,
  ],
  ['REJECTED_PROVIDER', /não aceitou o pedido agora/],
  ['CANCELLED', /O pedido anterior foi cancelado e nenhuma conta foi criada/],
])(
  'the last request outcome %s is shown in plain language',
  async (outcome, message) => {
    render(
      tree(
        createHttpClient({
          fetcher: server({ offer: { ...offer, lastRequestOutcome: outcome } }),
        })
      )
    )
    await screen.findByText(message)
  }
)

it('never uses the words subconta, KYC or webhook in any state', async () => {
  const seen: string[] = []
  const states = [
    offer,
    { ...offer, lastRequestOutcome: 'REJECTED_DATA' },
    { ...offer, lastRequestOutcome: 'REJECTED_PROVIDER' },
    { ...offer, lastRequestOutcome: 'CANCELLED' },
    ...[
      'ACCOUNT_EXISTS',
      'SUBSCRIPTION_RESTRICTED',
      'MODULE_NOT_IN_PLAN',
      'FIRST_PAYMENT_REQUIRED',
      'EMAIL_NOT_VERIFIED',
      'PAYMENTS_NOTICE_REQUIRED',
      'COMPANY_DATA_INCOMPLETE',
      'DOCUMENT_IN_USE',
    ].map((blocker) => blocked(blocker, 'CANCELLED')),
  ]
  for (const state of states) {
    render(tree(createHttpClient({ fetcher: server({ offer: state }) })))
    await screen.findByText('Criar conta de recebimentos')
    if (state.available) await start()
    seen.push(document.body.textContent ?? '')
    cleanup()
  }
  render(
    tree(
      createHttpClient({
        fetcher: server({
          account: () => ({ ...provisioning, status: 'AWAITING_OWNER' }),
        }),
      })
    )
  )
  await screen.findByText(
    'Abra o e-mail que a instituição de pagamentos enviou para o seu e-mail de acesso e envie os documentos.'
  )
  seen.push(document.body.textContent ?? '')
  for (const text of seen) expect(text).not.toMatch(/subconta|kyc|webhook/i)
})
