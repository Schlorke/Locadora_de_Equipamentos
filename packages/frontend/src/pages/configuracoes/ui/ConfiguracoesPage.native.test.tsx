// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AdminConfiguracoesPage } from './ConfiguracoesPage.native'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import { operationsTenant } from '../../../../../../tests/helpers/operation-fixtures'
import {
  Toaster,
  toast,
} from '../../../../../ui/src/native/SonnerToaster.native'
import { nativeToastStore } from '../../../../../ui/src/contract/toast-store'
const capture = vi.hoisted(() => ({ classes: [] as string[] }))
vi.mock('react-native', async () =>
  (
    await import('../../../../../../tests/helpers/native-screen')
  ).createNativeHost(capture.classes)
)
vi.mock('@gb-locacoes/ui', async () => ({
  ...(await (
    await import('../../../../../../tests/helpers/native-screen')
  ).nativeUi()),
  ...(await import('../../../../../ui/src/native/Textarea.native')),
  ...(await import('../../../../../ui/src/native/Switch.native')),
  ...(await import('../../../../../ui/src/native/ImageUpload.native')),
  ...(await import('../../../../../ui/src/native/AlertDialog.native')),
}))
vi.mock(
  '../../../shared/lib/toast',
  async () => await import('../../../../../ui/src/native/SonnerToaster.native')
)
afterEach(() => {
  cleanup()
  toast.dismiss()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  capture.classes.length = 0
})
const saved = {
  companyPhone: 'fone',
  whatsappNumber: 'celular',
  contactEmail: 'local@example.test',
  marketingEmail: 'sales@example.test',
  aboutUsText: 'Descrição anterior',
  seoDescription: 'Descrição anterior',
  seoTitle: 'Título anterior',
  themeColorPrimary: '#ea580c',
  supportChat: false,
  heroCarousel: [
    {
      id: 'h1',
      imageUrl: 'https://img.example.test/one.png',
      title: 'Metadados existentes',
    },
    { id: 'h2', imageUrl: 'https://img.example.test/two.png' },
  ],
  socialLinks: { instagram: 'https://instagram.example.test' },
  businessHours: { monday: { closed: false, open: '08:00', close: '18:00' } },
  uploadLimits: { maxFiles: 10 },
}
function setup(
  options: {
    denySave?: boolean
    denyUpload?: boolean
    pick?: () => Promise<
      Array<{ multipart: FormData; type: string; size: number }>
    >
    legal?: (url: string, init?: RequestInit) => Response
  } = {}
) {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) =>
    options.legal && String(url).includes('/legal-documents/')
      ? options.legal(String(url), init)
      : String(url).endsWith('/upload')
        ? Response.json(
            options.denyUpload
              ? { error: 'Não autorizado' }
              : { url: 'https://img.example.test/upload.png' },
            { status: options.denyUpload ? 403 : 200 }
          )
        : Response.json(
            init?.method === 'PUT'
              ? options.denySave
                ? { success: false, error: 'Alteração recusada' }
                : { success: true }
              : { success: true, data: saved },
            { status: init?.method === 'PUT' && options.denySave ? 403 : 200 }
          )
  )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ Authorization: 'Bearer fixture' }),
  })
  const pick =
    options.pick ??
    vi.fn(async () => [
      { multipart: new FormData(), type: 'image/png', size: 10 },
    ])
  const node = (id = 'alfa') => (
    <FrontendSessionFixture tenant={operationsTenant(id)}>
      <ApiClientProvider client={client}>
        <AdminConfiguracoesPage
          pickImages={pick}
          image={({ src, alt }) => <img src={src} alt={alt} />}
        />
        <Toaster />
      </ApiClientProvider>
    </FrontendSessionFixture>
  )
  const view = render(node())
  return { fetcher, pick, view, node }
}
const tab = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }))
const save = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }))
const writes = (fetcher: ReturnType<typeof setup>['fetcher']) =>
  fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT')
it('edita empresa, formata telefone, sincroniza descrição e envia formulário completo sem perder campos ocultos', async () => {
  const { fetcher } = setup()
  await screen.findByLabelText('Telefone Fixo')
  fireEvent.change(screen.getByLabelText('Telefone Fixo'), {
    target: { value: '512313626212345' },
  })
  expect(
    (screen.getByLabelText('Telefone Fixo') as HTMLInputElement).value
  ).toBe('(51) 23136-2621')
  fireEvent.change(screen.getByLabelText('Sobre Nós / Descrição SEO'), {
    target: { value: 'Nova descrição' },
  })
  save()
  await screen.findByText(
    'Configurações de Informações da Empresa atualizadas com sucesso.'
  )
  const [url, init] = writes(fetcher)[0]!
  expect(url).toBe('https://api.example.test/api/admin/settings')
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fixture')
  const body = JSON.parse(String(init?.body))
  expect(body).toMatchObject({
    companyPhone: '(51) 23136-2621',
    aboutUsText: 'Nova descrição',
    seoDescription: 'Nova descrição',
    heroCarousel: saved.heroCarousel,
    businessHours: saved.businessHours,
    uploadLimits: saved.uploadLimits,
    socialLinks: saved.socialLinks,
    supportChat: false,
  })
  expect(capture.classes).toEqual([])
  expect(document.querySelector('strong')).toBeNull()
})
it('carrossel ordena/remove/adiciona URLs e salva a onda, conservando a semântica de URLs sem metadados do web', async () => {
  const { fetcher } = setup()
  await screen.findByLabelText('Telefone Fixo')
  tab('Carrossel Principal')
  fireEvent.click(
    screen.getByRole('button', { name: 'Mover imagem 2 para antes' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Remover imagem 2' }))
  fireEvent.change(screen.getByLabelText('URL — Carousel Principal'), {
    target: { value: 'https://img.example.test/three.png' },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Adicionar imagem por URL' })
  )
  tab('Estática')
  save()
  await waitFor(() => expect(writes(fetcher)).toHaveLength(1))
  expect(JSON.parse(String(writes(fetcher)[0]![1]?.body))).toMatchObject({
    waveAnimation: 'static',
    heroCarousel: [
      { imageUrl: 'https://img.example.test/two.png' },
      { imageUrl: 'https://img.example.test/three.png' },
    ],
  })
})
it('expõe as seções originais, contador SEO e switches reais; código customizado é texto e a matriz de settings não ganha regras', async () => {
  const { fetcher } = setup()
  await screen.findByLabelText('Telefone Fixo')
  tab('Redes Sociais')
  expect(screen.getByText(/Campos para Instagram/)).toBeTruthy()
  tab('SEO & Meta Tags')
  fireEvent.change(screen.getByLabelText('Meta Descrição'), {
    target: { value: 'a'.repeat(161) },
  })
  expect(screen.getByText('161/160')).toBeTruthy()
  tab('Configurações do Sistema')
  fireEvent.click(screen.getByRole('switch', { name: 'Modo Manutenção' }))
  fireEvent.click(screen.getByRole('switch', { name: 'Chat de Suporte' }))
  fireEvent.change(screen.getByLabelText('Idioma Padrão'), {
    target: { value: 'pt-BR' },
  })
  save()
  await waitFor(() => expect(writes(fetcher)).toHaveLength(1))
  expect(JSON.parse(String(writes(fetcher)[0]![1]?.body))).toMatchObject({
    maintenanceMode: true,
    supportChat: true,
    seoDescription: 'a'.repeat(161),
  })
  tab('Configurações Personalizadas')
  fireEvent.change(screen.getByLabelText('CSS Customizado'), {
    target: { value: '.card { display: flex; }' },
  })
  fireEvent.change(screen.getByLabelText('JavaScript Customizado'), {
    target: { value: 'window.__settingsExecuted = true' },
  })
  save()
  await waitFor(() => expect(writes(fetcher)).toHaveLength(2))
  expect(JSON.parse(String(writes(fetcher)[1]![1]?.body)).customJs).toBe(
    'window.__settingsExecuted = true'
  )
  expect(
    (window as unknown as Record<string, unknown>).__settingsExecuted
  ).toBeUndefined()
})
it('reset só grava após confirmar, restaura apenas a seção e cancelar preserva o formulário', async () => {
  const { fetcher } = setup()
  await screen.findByLabelText('Telefone Fixo')
  fireEvent.change(screen.getByLabelText('Telefone Fixo'), {
    target: { value: '51912345678' },
  })
  tab('Resetar')
  expect(writes(fetcher)).toHaveLength(0)
  tab('Cancelar')
  expect(
    (screen.getByLabelText('Telefone Fixo') as HTMLInputElement).value
  ).toBe('(51) 91234-5678')
  tab('Resetar')
  tab('Confirmar')
  await screen.findByText(
    /foram restauradas aos valores padrão e salvas com sucesso/
  )
  const body = JSON.parse(String(writes(fetcher)[0]![1]?.body))
  // Achado 143: o padrão restaurado é vazio; o teste anterior afirmava o telefone da GB no reset de qualquer locadora.
  expect(body.companyPhone).toBe('')
  expect(body.heroCarousel).toEqual(saved.heroCarousel)
  expect(body.uploadLimits).toEqual(saved.uploadLimits)
})
it('logo e carrossel sobem multipart autenticado; type=logo é exclusivo do logo', async () => {
  const { fetcher, pick } = setup()
  await screen.findByLabelText('Telefone Fixo')
  tab('Fazer Upload de Imagem')
  await screen.findByText('Logo enviado com sucesso.')
  expect(pick).toHaveBeenCalledWith(false)
  const upload = fetcher.mock.calls.find(([url]) => url.endsWith('/upload'))!
  expect((upload[1]?.body as FormData).get('type')).toBe('logo')
  expect(new Headers(upload[1]?.headers).get('Content-Type')).toBeNull()
  expect((screen.getByLabelText('URL do Logo') as HTMLInputElement).value).toBe(
    'https://img.example.test/upload.png'
  )
  tab('Carrossel Principal')
  tab('Escolher arquivos')
  await screen.findByAltText('Imagem 3')
  expect(pick).toHaveBeenLastCalledWith(true)
  save()
  await waitFor(() => expect(writes(fetcher)).toHaveLength(1))
  expect(
    JSON.parse(String(writes(fetcher)[0]![1]?.body)).heroCarousel[2]
  ).toEqual({ imageUrl: 'https://img.example.test/upload.png' })
})
it('403 não mostra sucesso, e troca de locadora limpa formulário e confirmação antiga', async () => {
  const { fetcher, view, node } = setup({ denySave: true, denyUpload: true })
  await screen.findByLabelText('Telefone Fixo')
  tab('Fazer Upload de Imagem')
  await screen.findByText('Não foi possível fazer upload da imagem.')
  expect((screen.getByLabelText('URL do Logo') as HTMLInputElement).value).toBe(
    ''
  )
  save()
  await screen.findByText(/403|Alteração recusada/)
  expect(screen.queryByText(/atualizadas com sucesso/)).toBeNull()
  tab('Resetar')
  const old = nativeToastStore
    .getSnapshot()
    .find((entry) => entry.type === 'warning')?.action
  if (
    !old ||
    typeof old !== 'object' ||
    !('onClick' in old) ||
    typeof old.onClick !== 'function'
  )
    throw new Error('Confirmação não foi criada')
  view.rerender(node('bravo'))
  await screen.findByLabelText('Telefone Fixo')
  await act(async () => old.onClick())
  await act(async () => {
    await new Promise((r) => setTimeout(r, 130))
  })
  expect(writes(fetcher)).toHaveLength(1)
  expect(capture.classes).toEqual([])
})
it('seleção tardia de arquivos ao trocar a seção não inicia upload', async () => {
  let finish!: (
    v: Array<{ multipart: FormData; type: string; size: number }>
  ) => void
  const pick = vi.fn(
    () =>
      new Promise<Array<{ multipart: FormData; type: string; size: number }>>(
        (resolve) => {
          finish = resolve
        }
      )
  )
  const { fetcher } = setup({ pick })
  await screen.findByLabelText('Telefone Fixo')
  tab('Fazer Upload de Imagem')
  await waitFor(() => expect(pick).toHaveBeenCalledOnce())
  tab('Carrossel Principal')
  tab('Informações da Empresa')
  await act(async () =>
    finish([{ multipart: new FormData(), type: 'image/png', size: 10 }])
  )
  expect(fetcher.mock.calls.every(([url]) => !url.endsWith('/upload'))).toBe(
    true
  )
})

it('recusa logo inválido e seleção acima do limite antes de qualquer upload', async () => {
  const pick = vi
    .fn()
    .mockResolvedValueOnce([
      { multipart: new FormData(), type: 'text/plain', size: 10 },
    ])
    .mockResolvedValueOnce([
      {
        multipart: new FormData(),
        type: 'image/png',
        size: 5 * 1024 * 1024 + 1,
      },
    ])
    .mockResolvedValueOnce(
      Array.from({ length: 9 }, () => ({
        multipart: new FormData(),
        type: 'image/png',
        size: 10,
      }))
    )
  const { fetcher } = setup({ pick })
  await screen.findByLabelText('Telefone Fixo')
  tab('Fazer Upload de Imagem')
  await screen.findByText('Por favor, selecione um arquivo de imagem válido.')
  tab('Fazer Upload de Imagem')
  await screen.findByText('A imagem deve ter no máximo 5MB.')
  tab('Carrossel Principal')
  tab('Escolher arquivos')
  await screen.findByText('Quantidade de imagens excede o limite disponível.')
  expect(
    fetcher.mock.calls.filter(([url]) => url.endsWith('/upload'))
  ).toHaveLength(0)
})

// Onda 134 (B10): as seções novas do painel no app, com o mesmo modelo da web.
it('expõe as dez seções do painel; horário inválido não envia e o válido sai com o resto do formulário', async () => {
  const { fetcher } = setup()
  await screen.findByLabelText('Telefone Fixo')
  for (const nome of [
    'Informações da Empresa',
    'Carrossel Principal',
    'Redes Sociais',
    'SEO & Meta Tags',
    'Configurações do Sistema',
    'Configurações Personalizadas',
    'Horário de Funcionamento',
    'Conteúdo do Site',
    'O que você garante',
    'Textos Legais',
  ])
    expect(screen.getByRole('button', { name: nome })).toBeTruthy()
  tab('Horário de Funcionamento')
  expect(
    (screen.getByLabelText('Segunda-feira: abertura') as HTMLInputElement).value
  ).toBe('08:00')
  fireEvent.change(screen.getByLabelText('Segunda-feira: fechamento'), {
    target: { value: '07:00' },
  })
  save()
  expect(
    await screen.findByText('O fechamento precisa ser depois da abertura.')
  ).toBeTruthy()
  expect(writes(fetcher)).toHaveLength(0)
  fireEvent.change(screen.getByLabelText('Segunda-feira: fechamento'), {
    target: { value: '12:00' },
  })
  tab('Copiar segunda-feira para os dias úteis')
  save()
  await waitFor(() => expect(writes(fetcher)).toHaveLength(1))
  const body = JSON.parse(String(writes(fetcher)[0]![1]?.body))
  expect(body.businessHours.monday).toEqual({
    closed: false,
    open: '08:00',
    close: '12:00',
  })
  expect(body.businessHours.friday).toEqual({
    closed: false,
    open: '08:00',
    close: '12:00',
  })
  expect(body.businessHours.saturday).toBeUndefined()
  expect(body).toMatchObject({
    companyPhone: 'fone',
    heroCarousel: saved.heroCarousel,
  })
  expect(capture.classes).toEqual([])
})

it('conteúdo do site e compromissos: número inválido avisa; compromisso ligado aparece na prévia e sai no siteContent', async () => {
  const { fetcher } = setup()
  await screen.findByLabelText('Telefone Fixo')
  tab('Conteúdo do Site')
  fireEvent.change(screen.getByLabelText('Anos de mercado'), {
    target: { value: 'muitos' },
  })
  save()
  await waitFor(() =>
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
  )
  expect(writes(fetcher)).toHaveLength(0)
  fireEvent.change(screen.getByLabelText('Anos de mercado'), {
    target: { value: '15' },
  })
  tab('O que você garante')
  expect(
    screen.getByText(/Nenhum compromisso ligado: o site não faz promessas/)
  ).toBeTruthy()
  fireEvent.click(
    screen.getByRole('switch', { name: 'Suporte técnico 24 horas' })
  )
  expect(
    screen.queryByText(/Nenhum compromisso ligado: o site não faz promessas/)
  ).toBeNull()
  save()
  await waitFor(() => expect(writes(fetcher)).toHaveLength(1))
  const body = JSON.parse(String(writes(fetcher)[0]![1]?.body))
  expect(body.siteContent.experienceYears).toBe(15)
  expect(body.siteContent.commitments).toEqual({ support24h: true })
  expect(body.companyPhone).toBe('fone')
})

it('textos legais: sem Salvar/Resetar do formulário; avisa Termos ausentes e só publica depois da confirmação', async () => {
  const { fetcher } = setup({
    legal: (url, init) =>
      init?.method === 'PUT'
        ? Response.json({
            kind: 'terms',
            document: JSON.parse(String(init.body)).document,
            publishedAt: '2026-10-07T12:00:00.000Z',
          })
        : Response.json({ kind: 'x', document: null, publishedAt: null }),
  })
  await screen.findByLabelText('Telefone Fixo')
  tab('Textos Legais')
  expect(
    await screen.findByText(/Os Termos de Uso não estão publicados/)
  ).toBeTruthy()
  expect(
    screen.getByText(/A Política de Privacidade não está publicada/)
  ).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Salvar Alterações' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Resetar' })).toBeNull()
  fireEvent.change(screen.getByLabelText('Seção 1: título'), {
    target: { value: 'Uso' },
  })
  fireEvent.change(screen.getByLabelText('Seção 1: texto'), {
    target: { value: 'Regras da locadora.' },
  })
  tab('Publicar')
  expect(await screen.findByText('Publicar esta versão?')).toBeTruthy()
  const legais = () =>
    fetcher.mock.calls.filter(
      ([url, init]) =>
        String(url).includes('/legal-documents/') && init?.method === 'PUT'
    )
  expect(legais()).toHaveLength(0)
  fireEvent.click(screen.getAllByRole('button', { name: 'Publicar' }).at(-1)!)
  await waitFor(() => expect(legais()).toHaveLength(1))
  const [url, init] = legais()[0]!
  expect(url).toBe(
    'https://api.example.test/api/admin/settings/legal-documents/terms'
  )
  expect(JSON.parse(String(init?.body)).document.sections[0]).toMatchObject({
    title: 'Uso',
    blocks: [{ type: 'paragraph', text: 'Regras da locadora.' }],
  })
  await waitFor(() =>
    expect(
      screen.queryByText(/Os Termos de Uso não estão publicados/)
    ).toBeNull()
  )
  expect(
    writes(fetcher).filter(([u]) => String(u).endsWith('/settings'))
  ).toHaveLength(0)
})
// Onda 135, A11 (decisão do dono D4): no app, a seção "SEO & Meta Tags" também edita a medição e a verificação da
// locadora, com as mesmas regras da web: ID inválido mostra o erro e não envia; válido vai no siteContent.
it('SEO no app: medição e verificação da locadora vão no siteContent; ID inválido não envia', async () => {
  const { fetcher } = setup()
  await screen.findByLabelText('Telefone Fixo')
  tab('SEO & Meta Tags')
  fireEvent.change(screen.getByLabelText('ID do Google Analytics 4'), {
    target: { value: 'UA-1234-5' },
  })
  save()
  expect(
    await screen.findByText(/O ID do Google Analytics 4 começa com G-/)
  ).toBeTruthy()
  expect(writes(fetcher)).toHaveLength(0)
  fireEvent.change(screen.getByLabelText('ID do Google Analytics 4'), {
    target: { value: 'G-5ABCDE1234' },
  })
  fireEvent.change(
    screen.getByLabelText('Código de verificação do Google Search Console'),
    { target: { value: 'abcDEF0123456789_-xyzABCDEFGHIJ012345678' } }
  )
  save()
  await waitFor(() => expect(writes(fetcher)).toHaveLength(1))
  expect(
    JSON.parse(String(writes(fetcher)[0]![1]?.body)).siteContent
  ).toMatchObject({
    googleAnalyticsId: 'G-5ABCDE1234',
    googleSiteVerification: 'abcDEF0123456789_-xyzABCDEFGHIJ012345678',
  })
})
