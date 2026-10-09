// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { REQUIRED_SIGNUP_DOCUMENTS } from '@gb-locacoes/contracts/onboarding'
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  update: vi.fn(),
  signIn: vi.fn(),
  session: {
    data: { user: { id: 'owner-a', email: 'owner@example.test' } } as {
      user: { id: string; email: string }
    } | null,
    status: 'authenticated',
  },
}))
vi.mock('../../../shared/api', () => {
  const client = { request: mocks.request }
  return { useApiClient: () => client }
})
vi.mock('../../../entities/sessao', () => ({
  useSession: () => ({ ...mocks.session, update: mocks.update }),
}))
import { OnboardingPage } from './OnboardingPage.web'
import { useOnboarding } from '../model/use-onboarding.web'
const documents = REQUIRED_SIGNUP_DOCUMENTS.map((kind) => ({
  kind,
  version: '2026-10-04',
  textSha256: 'a'.repeat(64),
  text: 'Texto aprovado <script>escaped</script>',
}))
const plan = {
  planVersionId: 'plan-a',
  code: 'plano-a',
  name: 'Plano aprovado',
  version: 1,
  interval: 'MONTHLY',
  amount: '159.90',
  trialDays: 7,
  entitlements: {
    schema: 1,
    limits: { equipments: 10, staffSeats: 2 },
    features: {
      onlinePayments: true,
      customDomain: false,
      logistics: true,
      maintenance: true,
      contractSignature: true,
      whatsapp: false,
      emailInbox: false,
      merchantFeed: false,
    },
  },
}
const company = {
  cnpj: '12.345.678/0001-95',
  legalName: 'Empresa teste',
  tradeName: 'Locadora teste',
  companyType: 'MEI',
  phone: '11999999999',
  postalCode: '01001000',
  addressLine: 'Rua teste',
  addressNumber: '1',
  addressComplement: '',
  district: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  representationDeclared: true,
}
const receipt = {
  organization: {
    id: 'tenant-a',
    slug: 'locadora-teste',
    name: 'Locadora teste',
  },
  subscription: { status: 'TRIALING', trialEndsAt: '2026-10-11' },
  notices: [],
}
const props = { signInCredentials: mocks.signIn, captcha: () => null }
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  localStorage.clear()
  mocks.session.data = { user: { id: 'owner-a', email: 'owner@example.test' } }
  mocks.session.status = 'authenticated'
  mocks.signIn.mockResolvedValue({ ok: true })
  mocks.request.mockImplementation(async (path: string) => {
    if (path === '/api/onboarding/options')
      return {
        ok: true,
        status: 200,
        data: {
          mode: 'on',
          rootDomain: 'example.invalid',
          captchaSiteKey: 'public-fixture',
          documents,
        },
      }
    if (path === '/api/public/plans')
      return { ok: true, status: 200, data: { plans: [plan] } }
    if (path === '/api/auth/owner-account')
      return {
        ok: true,
        status: 200,
        data: { userId: mocks.session.data!.user.id, emailVerified: true },
      }
    if (path.startsWith('/api/onboarding/slug-availability'))
      return { ok: true, status: 200, data: { available: true } }
    if (path === '/api/onboarding/organizations')
      return { ok: true, status: 201, data: receipt }
    return { ok: true, status: 202, data: { message: 'Pedido recebido' } }
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('off never mounts inputs, captcha, plans or account fact reads', async () => {
  mocks.request.mockResolvedValue({
    ok: true,
    status: 200,
    data: { mode: 'off' },
  })
  const captcha = vi.fn()
  render(<OnboardingPage {...props} captcha={captcha} />)
  expect(await screen.findByText('Fale com a gente')).toBeTruthy()
  expect(screen.queryByLabelText('Senha')).toBeNull()
  expect(captcha).not.toHaveBeenCalled()
  expect(mocks.request.mock.calls.map(([path]) => path)).toEqual([
    '/api/onboarding/options',
  ])
})
it('blocks company progression until the authenticated verification fact is true', async () => {
  const original = mocks.request.getMockImplementation()!
  mocks.request.mockImplementation(async (path: string) =>
    path === '/api/auth/owner-account'
      ? {
          ok: true,
          status: 200,
          data: { userId: 'owner-a', emailVerified: false },
        }
      : original(path)
  )
  render(<OnboardingPage {...props} />)
  expect(await screen.findByText('Confirme seu e-mail')).toBeTruthy()
  expect(screen.queryByLabelText('CNPJ')).toBeNull()
  fireEvent.click(
    screen.getByRole('button', { name: 'Já confirmei meu e-mail' })
  )
  expect(await screen.findByText(/ainda não foi confirmado/)).toBeTruthy()
  expect(
    mocks.request.mock.calls.some(
      ([path]) => path === '/api/onboarding/organizations'
    )
  ).toBe(false)
})
async function ready() {
  const hook = renderHook(() => useOnboarding(props))
  await waitFor(() => expect(hook.result.current.step).toBe('COMPANY'))
  act(() => {
    hook.result.current.setCompany(company)
  })
  act(() => hook.result.current.advanceCompany())
  act(() => hook.result.current.setSlug('locadora-teste'))
  await act(async () => {
    await hook.result.current.checkSlug()
  })
  act(() => hook.result.current.setPlanVersionId(plan.planVersionId))
  act(() => hook.result.current.advancePlan())
  act(() => hook.result.current.setAccepted([...REQUIRED_SIGNUP_DOCUMENTS]))
  act(() => hook.result.current.advanceTerms())
  return hook
}
it('keeps drafts local, explicit terms unselected and creates only after confirmation with fresh captcha', async () => {
  const hook = await ready()
  expect(hook.result.current.step).toBe('CREATE')
  expect(
    mocks.request.mock.calls.some(
      ([path]) => path === '/api/onboarding/organizations'
    )
  ).toBe(false)
  await act(async () => {
    await hook.result.current.create()
  })
  expect(
    mocks.request.mock.calls.some(
      ([path]) => path === '/api/onboarding/organizations'
    )
  ).toBe(false)
  act(() => hook.result.current.setToken('fresh-token'))
  await act(async () => {
    await hook.result.current.create()
  })
  expect(hook.result.current.receipt).toEqual(receipt)
  const request = mocks.request.mock.calls.find(
    ([path]) => path === '/api/onboarding/organizations'
  )!
  expect(request[1].headers).toMatchObject({
    'X-Platform-Captcha': 'fresh-token',
    'Idempotency-Key': expect.any(String),
  })
  expect(JSON.parse(request[1].body).acceptances).toEqual(
    documents.map(({ kind, version, textSha256 }) => ({
      kind,
      version,
      textSha256,
    }))
  )
  expect(hook.result.current.token).toBeNull()
  expect(localStorage.length).toBe(0)
})
it('renders exact approved text escaped and keeps mandatory checkboxes clear', async () => {
  localStorage.setItem(
    'locadora.onboarding.v1.owner-a',
    JSON.stringify({
      version: 1,
      company,
      slug: 'locadora-teste',
      planVersionId: 'plan-a',
      pending: null,
    })
  )
  render(<OnboardingPage {...props} />)
  await screen.findByLabelText('CNPJ')
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Conferir e continuar' }))
  await screen.findByText('Escolha seu plano')
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(
    screen.getAllByText('Texto aprovado <script>escaped</script>')
  ).toHaveLength(4)
  expect(document.querySelector('script')).toBeNull()
  for (const box of screen.getAllByRole('checkbox'))
    expect(box.getAttribute('data-state')).toBe('unchecked')
  expect(
    (
      screen.getByRole('button', {
        name: 'Revisar cadastro',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true)
})
it('retains a single immutable key/body after uncertain delivery and blocks edits until manual retry', async () => {
  const original = mocks.request.getMockImplementation()!
  let fail = true
  mocks.request.mockImplementation(async (path: string, options: unknown) => {
    if (path === '/api/onboarding/organizations' && fail)
      throw new Error('network uncertainty')
    return original(path, options)
  })
  let hook = await ready()
  act(() => hook.result.current.setToken('token-one'))
  await act(async () => {
    await hook.result.current.create()
  })
  const pending = hook.result.current.pending
  expect(pending).toBeTruthy()
  act(() => hook.result.current.back())
  expect(hook.result.current.step).toBe('CREATE')
  expect(localStorage.getItem('locadora.onboarding.v1.owner-a')).not.toContain(
    'token-one'
  )
  hook.unmount()
  hook = renderHook(() => useOnboarding(props))
  await waitFor(() => expect(hook.result.current.step).toBe('CREATE'))
  expect(hook.result.current.pending).toEqual(pending)
  expect(
    mocks.request.mock.calls.filter(
      ([path]) => path === '/api/onboarding/organizations'
    )
  ).toHaveLength(1)
  fail = false
  act(() => hook.result.current.setToken('token-two'))
  await act(async () => {
    await hook.result.current.create()
  })
  const calls = mocks.request.mock.calls.filter(
    ([path]) => path === '/api/onboarding/organizations'
  )
  expect(calls[0]![1].body).toBe(calls[1]![1].body)
  expect(calls[0]![1].headers['Idempotency-Key']).toBe(
    calls[1]![1].headers['Idempotency-Key']
  )
  expect(hook.result.current.receipt).toEqual(receipt)
})
it('registers only the minimum account, clears the password and never creates a company automatically', async () => {
  mocks.session.data = null
  mocks.session.status = 'unauthenticated'
  const hook = renderHook(() => useOnboarding(props))
  await waitFor(() => expect(hook.result.current.options?.mode).toBe('on'))
  act(() => {
    hook.result.current.setAccess({
      name: 'Dono de teste',
      email: 'owner@example.test',
      password: 'synthetic-password',
    })
    hook.result.current.setToken('register-token')
  })
  await act(async () => {
    await hook.result.current.register()
  })
  expect(hook.result.current.step).toBe('EMAIL_VERIFICATION')
  expect(hook.result.current.access.password).toBe('')
  expect(hook.result.current.token).toBeNull()
  const call = mocks.request.mock.calls.find(
    ([path]) => path === '/api/auth/owner-register'
  )!
  expect(JSON.parse(call[1].body)).toEqual({
    name: 'Dono de teste',
    email: 'owner@example.test',
    password: 'synthetic-password',
  })
  expect(
    mocks.request.mock.calls.some(
      ([path]) => path === '/api/onboarding/organizations'
    )
  ).toBe(false)
  expect(localStorage.length).toBe(0)
})
it('resends verification with an empty body and prevents repeated requests during the server minute window', async () => {
  const original = mocks.request.getMockImplementation()!
  mocks.request.mockImplementation(async (path: string, options: unknown) =>
    path === '/api/auth/owner-account'
      ? {
          ok: true,
          status: 200,
          data: { userId: 'owner-a', emailVerified: false },
        }
      : original(path, options)
  )
  const hook = renderHook(() => useOnboarding(props))
  await waitFor(() => expect(hook.result.current.options?.mode).toBe('on'))
  await act(async () => {
    await hook.result.current.resend()
    await hook.result.current.resend()
  })
  const calls = mocks.request.mock.calls.filter(
    ([path]) => path === '/api/auth/owner-verification'
  )
  expect(calls).toHaveLength(1)
  expect(calls[0]![1].body).toBe('{}')
  expect(hook.result.current.resendSeconds).toBeGreaterThan(0)
})
it('ignores a previous owner options reload without clearing the new owner acceptances', async () => {
  const hook = await ready()
  const original = mocks.request.getMockImplementation()!
  let release: (value: unknown) => void = () => {}
  mocks.request.mockImplementation(async (path: string, options: unknown) =>
    path === '/api/onboarding/options'
      ? new Promise((resolve) => {
          release = resolve
        })
      : original(path, options)
  )
  let reloading: Promise<void> = Promise.resolve()
  act(() => {
    reloading = hook.result.current.reload()
  })
  mocks.session.data = { user: { id: 'owner-b', email: 'b@example.test' } }
  hook.rerender()
  await waitFor(() => expect(hook.result.current.step).toBe('COMPANY'))
  act(() => hook.result.current.setAccepted([...REQUIRED_SIGNUP_DOCUMENTS]))
  await act(async () => {
    release({
      ok: true,
      status: 200,
      data: {
        mode: 'on',
        rootDomain: 'example.invalid',
        captchaSiteKey: 'public-fixture',
        documents,
      },
    })
    await reloading
  })
  expect(hook.result.current.accepted).toEqual(REQUIRED_SIGNUP_DOCUMENTS)
  expect(hook.result.current.step).toBe('COMPANY')
})
it('discards the previous owner presentation and ignores delayed verification when identity changes', async () => {
  let release: (value: unknown) => void = () => {}
  const original = mocks.request.getMockImplementation()!
  mocks.request.mockImplementation(async (path: string) =>
    path === '/api/auth/owner-account' &&
    mocks.session.data?.user.id === 'owner-a'
      ? new Promise((resolve) => {
          release = resolve
        })
      : original(path)
  )
  const hook = renderHook(() => useOnboarding(props))
  await waitFor(() =>
    expect(
      mocks.request.mock.calls.some(
        ([path]) => path === '/api/auth/owner-account'
      )
    ).toBe(true)
  )
  mocks.session.data = { user: { id: 'owner-b', email: 'b@example.test' } }
  hook.rerender()
  await waitFor(() => expect(hook.result.current.step).toBe('COMPANY'))
  await act(async () =>
    release({
      ok: true,
      status: 200,
      data: { userId: 'owner-a', emailVerified: true },
    })
  )
  expect(hook.result.current.company.tradeName).toBe('')
  expect(hook.result.current.userId).toBe('owner-b')
})
