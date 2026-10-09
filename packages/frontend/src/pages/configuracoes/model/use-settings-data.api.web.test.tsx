// @vitest-environment jsdom
import type { ChangeEvent } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { useSettingsData } from './use-settings-data.web'
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}))
vi.mock('sonner', () => ({ toast }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
function input(file: File) {
  return {
    target: { files: [file] },
  } as unknown as ChangeEvent<HTMLInputElement>
}
it('carrega settings, sobe logo multipart e salva o formulário completo', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) =>
    String(url).endsWith('/upload')
      ? Response.json({ url: 'https://images.example.test/logo.webp' })
      : Response.json(
          init?.method === 'PUT'
            ? { success: true }
            : {
                success: true,
                data: { companyPhone: 'phone', supportChat: false },
              }
        )
  )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  const hook = renderHook(useSettingsData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() => expect(hook.result.current.isLoadingData).toBe(false))
  expect(hook.result.current.formData.supportChat).toBe(false)
  const file = new File(['image'], 'logo.png', { type: 'image/png' })
  await act(async () => hook.result.current.handleLogoUpload(input(file)))
  const upload = fetcher.mock.calls.find(([url]) =>
    String(url).endsWith('/upload')
  )!
  expect(upload[1]?.body).toBeInstanceOf(FormData)
  expect((upload[1]?.body as FormData).get('type')).toBe('logo')
  expect(upload[1]?.headers).not.toHaveProperty('Content-Type')
  expect(hook.result.current.formData.companyIconUrl).toBe(
    'https://images.example.test/logo.webp'
  )
  await act(async () => hook.result.current.saveSection('company'))
  const save = fetcher.mock.calls.find(([, init]) => init?.method === 'PUT')!
  // Onda 134: o formulário inteiro vai com o conteúdo do site (vazio, sem dado) e o horário (vazio).
  expect(JSON.parse(String(save[1]?.body))).toEqual({
    ...hook.result.current.formData,
    businessHours: {},
    siteContent: {},
  })
})

// Onda 134 (B10): horário, conteúdo e compromissos no PUT do formulário inteiro. Seção com erro não envia; salvar
// outra seção com um deles inválido reenvia o último salvo (nunca apaga o que o dono gravou).
it('horário, conteúdo e compromissos vão no PUT; seção inválida não envia; outra seção reenvia o salvo', async () => {
  const gravado = {
    businessHours: { monday: { closed: false, open: '08:00', close: '18:00' } },
    siteContent: { experienceYears: 7, commitments: { support24h: true } },
  }
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (_url, init) =>
      Response.json(
        init?.method === 'PUT'
          ? { success: true }
          : { success: true, data: gravado }
      )
    )
  const client = createHttpClient({ fetcher })
  const hook = renderHook(useSettingsData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() => expect(hook.result.current.isLoadingData).toBe(false))
  expect(hook.result.current.conteudo.experienceYears).toBe('7')
  expect(hook.result.current.horario.monday).toEqual({
    fechado: false,
    abre: '08:00',
    fecha: '18:00',
  })
  const puts = () =>
    fetcher.mock.calls
      .filter(([, init]) => init?.method === 'PUT')
      .map(([, init]) => JSON.parse(String(init?.body)))

  // Seção de conteúdo com erro: nada enviado e o erro no campo.
  act(() =>
    hook.result.current.atualizarConteudo({
      ...hook.result.current.conteudo,
      experienceYears: '999',
    })
  )
  await act(async () => hook.result.current.saveSection('content'))
  expect(puts()).toHaveLength(0)
  expect(hook.result.current.errosDoConteudo.experienceYears).toBe(
    'Informe um número inteiro de 1 a 150.'
  )

  // Outra seção salva com o conteúdo inválido: reenvia o conteúdo salvo.
  await act(async () => hook.result.current.saveSection('company'))
  expect(puts()[0]).toMatchObject(gravado)

  // Compromissos e horário válidos vão no PUT.
  act(() => {
    hook.result.current.atualizarConteudo({
      ...hook.result.current.conteudo,
      experienceYears: '8',
      commitments: {
        ...hook.result.current.conteudo.commitments,
        freeDelivery: true,
      },
    })
    hook.result.current.atualizarHorario({
      ...hook.result.current.horario,
      sunday: { fechado: true, abre: '', fecha: '' },
    })
  })
  await act(async () => hook.result.current.saveSection('commitments'))
  expect(puts()[1]).toMatchObject({
    businessHours: {
      monday: { closed: false, open: '08:00', close: '18:00' },
      sunday: { closed: true },
    },
    siteContent: {
      experienceYears: 8,
      commitments: { freeDelivery: true, support24h: true },
    },
  })

  // Horário inválido: a seção não envia.
  act(() =>
    hook.result.current.atualizarHorario({
      ...hook.result.current.horario,
      tuesday: { fechado: false, abre: '09:00', fecha: '' },
    })
  )
  await act(async () => hook.result.current.saveSection('hours'))
  expect(puts()).toHaveLength(2)
  expect(hook.result.current.errosDoHorario.tuesday).toBe(
    'Informe a abertura e o fechamento.'
  )
})
it('não permite confirmar um reset criado numa tela já encerrada', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ success: true, data: {} }))
  const client = createHttpClient({ fetcher })
  const hook = renderHook(useSettingsData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() => expect(hook.result.current.isLoadingData).toBe(false))
  await act(async () => hook.result.current.resetSection('company'))
  const options = toast.warning.mock.calls[0]![1] as {
    action: { onClick: () => Promise<void> }
  }
  hook.unmount()
  await options.action.onClick()
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(toast.success).not.toHaveBeenCalled()
})
it('resposta tardia do upload não aplica logo nem toast na tela encerrada', async () => {
  let finish!: (r: Response) => void
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) =>
    String(url).endsWith('/upload')
      ? new Promise((resolve) => {
          finish = resolve
        })
      : Response.json({ success: true, data: {} })
  )
  const client = createHttpClient({ fetcher })
  const hook = renderHook(useSettingsData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() => expect(hook.result.current.isLoadingData).toBe(false))
  let pending!: Promise<void>
  act(() => {
    pending = hook.result.current.handleLogoUpload(
      input(new File(['x'], 'x.png', { type: 'image/png' }))
    )
  })
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  hook.unmount()
  await act(async () => {
    finish(Response.json({ url: 'https://old.example.test/logo' }))
    await pending
  })
  expect(toast.success).not.toHaveBeenCalled()
  expect(toast.error).not.toHaveBeenCalled()
})

it('"Usar minhas categorias": até 8 nomes da locadora, sem repetição, nos destaques do rodapé', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (url) =>
      String(url).endsWith('/api/admin/categories')
        ? Response.json(
            [
              'Andaimes',
              'Betoneiras',
              'Andaimes',
              'x'.repeat(61),
              'A',
              'B',
              'C',
              'D',
              'E',
              'F',
              'G',
            ].map((name, id) => ({ id, name }))
          )
        : Response.json({ success: true, data: {} })
    )
  const client = createHttpClient({ fetcher })
  const hook = renderHook(useSettingsData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() => expect(hook.result.current.isLoadingData).toBe(false))
  await act(async () => hook.result.current.usarMinhasCategorias())
  expect(hook.result.current.conteudo.footerHighlights).toBe(
    'Andaimes\nBetoneiras\nA\nB\nC\nD\nE\nF'
  )
})

// Onda 135, A11 (decisão do dono D4): a seção "SEO & Meta Tags" grava a medição e a verificação no `siteContent`. ID
// inválido mostra o erro e não envia (nunca descartado em silêncio); restaurar o conteúdo do site não apaga a medição, e
// restaurar o SEO só apaga a medição.
it('SEO grava medição e verificação no siteContent; inválido não envia; cada restauração só apaga a própria seção', async () => {
  const GA = 'G-5ABCDE1234'
  const META = 'abcdefghij0123456789abcdefghij'
  const gravado = {
    siteContent: { experienceYears: 7, googleAdsId: 'AW-123456789' },
  }
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (_url, init) =>
      Response.json(
        init?.method === 'PUT'
          ? { success: true }
          : { success: true, data: gravado }
      )
    )
  const client = createHttpClient({ fetcher })
  const hook = renderHook(useSettingsData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() => expect(hook.result.current.isLoadingData).toBe(false))
  expect(hook.result.current.conteudo.googleAdsId).toBe('AW-123456789')
  const puts = () =>
    fetcher.mock.calls
      .filter(([, init]) => init?.method === 'PUT')
      .map(([, init]) => JSON.parse(String(init?.body)))

  // ID fora do formato: o erro aparece no campo e nada é enviado.
  act(() =>
    hook.result.current.atualizarConteudo({
      ...hook.result.current.conteudo,
      googleAnalyticsId: 'UA-1234-5',
    })
  )
  await act(async () => hook.result.current.saveSection('seo'))
  expect(puts()).toHaveLength(0)
  expect(hook.result.current.errosDoConteudo.googleAnalyticsId).toMatch(/G-/)

  // Válidos (a meta da Meta colada inteira): vão no siteContent, junto do resto do conteúdo.
  act(() =>
    hook.result.current.atualizarConteudo({
      ...hook.result.current.conteudo,
      googleAnalyticsId: GA,
      facebookDomainVerification: `<meta name="facebook-domain-verification" content="${META}" />`,
    })
  )
  await act(async () => hook.result.current.saveSection('seo'))
  expect(puts()[0]!.siteContent).toEqual({
    experienceYears: 7,
    googleAnalyticsId: GA,
    googleAdsId: 'AW-123456789',
    facebookDomainVerification: META,
  })

  const restaurar = async (secao: 'content' | 'seo') => {
    toast.warning.mockClear()
    await act(async () => hook.result.current.resetSection(secao))
    const options = toast.warning.mock.calls[0]![1] as {
      action: { onClick: () => Promise<void> }
    }
    await act(async () => options.action.onClick())
  }
  // Restaurar o conteúdo do site apaga os números, não a medição.
  await restaurar('content')
  expect(puts()[1]!.siteContent).toEqual({
    googleAnalyticsId: GA,
    googleAdsId: 'AW-123456789',
    facebookDomainVerification: META,
  })
  // Restaurar o SEO apaga só a medição e a verificação.
  act(() =>
    hook.result.current.atualizarConteudo({
      ...hook.result.current.conteudo,
      experienceYears: '9',
    })
  )
  await restaurar('seo')
  expect(puts()[2]!.siteContent).toEqual({ experienceYears: 9 })
})
