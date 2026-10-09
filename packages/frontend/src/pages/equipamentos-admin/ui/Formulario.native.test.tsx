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
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import { NavigationProvider } from '@gb-locacoes/ui'
import { NovoEquipamentoPage } from './Novo.native'
import { EditarEquipamentoPage } from './Editar.native'
import { DEFAULT_FORM_DATA } from '../model/tipos'
const captured = vi.hoisted(() => ({
  classes: [] as string[],
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('react-native', async () =>
  (
    await import('../../../../../../tests/helpers/native-screen')
  ).createNativeHost(captured.classes)
)
vi.mock('@gb-locacoes/ui', async () => ({
  ...(await (
    await import('../../../../../../tests/helpers/native-screen')
  ).nativeUi()),
  ...(await import('../../../../../ui/src/native/FilterSelect.native')),
  ...(await import('../../../../../ui/src/native/CurrencyInput.native')),
  ...(await import('../../../../../ui/src/native/Switch.native')),
  ...(await import('../../../../../ui/src/native/Textarea.native')),
  ...(await import('../../../../../ui/src/native/ImageUpload.native')),
}))
vi.mock('../../../shared/lib/toast', () => ({ toast: captured }))
const equipment = {
  ...DEFAULT_FORM_DATA,
  name: 'Betoneira',
  description: 'Concreto',
  categoryId: 'cat',
  pricePerDay: 25,
  images: ['/public.jpg'],
  partsLossCount: 2,
  partsLossHistory: [
    {
      date: '2026-09-10',
      description: 'Alça',
      quantity: 2,
      images: ['/private.jpg'],
    },
  ],
  monthlyRentalEnabled: false,
}
function setup(fail = false) {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) =>
    init?.method === 'PUT' || init?.method === 'POST'
      ? url.endsWith('/upload')
        ? Response.json({ url: '/uploaded.jpg' })
        : Response.json(fail ? { error: 'Negado' } : { id: 'eq' }, {
            status: fail ? 409 : 200,
          })
      : Response.json(
          url.endsWith('/categories')
            ? [{ id: 'cat', name: 'Concreto' }]
            : equipment
        )
  )
  return {
    fetcher,
    client: createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
      getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
    }),
  }
}
function tree(
  client: ReturnType<typeof createHttpClient>,
  editing = false,
  pickImages?: () => Promise<FormData[]>,
  user = 'ana',
  navigate = vi.fn()
) {
  return (
    <ApiClientProvider client={client}>
      <FrontendSessionFixture
        userId={user}
        tenant={{
          tenant: { id: 'alfa', slug: 'alfa', name: 'Alfa', status: 'ACTIVE' },
          membershipId: 'm',
          role: 'ADMIN',
        }}
      >
        <NavigationProvider navigate={navigate}>
          {editing ? (
            <EditarEquipamentoPage
              equipmentId="eq"
              pickImages={pickImages}
              image={({ src, alt }) => <img src={src} alt={alt} />}
            />
          ) : (
            <NovoEquipamentoPage
              pickImages={pickImages}
              image={({ src, alt }) => <img src={src} alt={alt} />}
            />
          )}
        </NavigationProvider>
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
}
const change = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } })
const bodies = (fetcher: ReturnType<typeof setup>['fetcher']) =>
  fetcher.mock.calls
    .filter(([, init]) => init?.body && typeof init.body === 'string')
    .map(([, init]) => JSON.parse(String(init?.body)))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  captured.classes.length = 0
})
it('cria com upload multipart configurado, todos os períodos, estoque e especificações sem DOM/Tailwind', async () => {
  const { client, fetcher } = setup(),
    pick = vi.fn(async () => {
      const body = new FormData()
      body.append('file', new Blob(['image'], { type: 'image/png' }))
      return [body]
    }),
    navigate = vi.fn()
  render(tree(client, false, pick, 'ana', navigate))
  await waitFor(() => expect(fetcher).toHaveBeenCalled())
  fireEvent.click(screen.getByRole('button', { name: 'Criar Equipamento' }))
  expect(captured.error).toHaveBeenCalledWith(
    'Campo obrigatório',
    expect.anything()
  )
  expect(bodies(fetcher)).toEqual([])
  change('Nome do Equipamento', 'Betoneira')
  change('Descrição', 'Concreto')
  fireEvent.click(
    screen.getByRole('combobox', { name: 'Selecione uma categoria' })
  )
  fireEvent.click(await screen.findByRole('radio', { name: 'Concreto' }))
  change('Preço por Dia (R$)', '2500')
  change('Estoque Máximo', '4')
  change('weekly — Desconto (%)', '120')
  expect(screen.getByLabelText('weekly — Desconto (%)')).toHaveProperty(
    'value',
    '100'
  )
  fireEvent.click(
    screen.getByRole('switch', { name: 'monthly — Usar valor direto' })
  )
  change('monthly — Valor direto (R$)', '50000')
  change('Nome da Especificação', 'Peso')
  change('Valor da Especificação', '40 kg')
  fireEvent.click(
    screen.getByRole('button', { name: 'Adicionar Especificação' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Escolher arquivos' }))
  await screen.findByText('Imagem principal')
  const upload = fetcher.mock.calls.find(([url]) => url.endsWith('/upload'))!
  expect(upload[0]).toBe('https://api.example.test/api/upload')
  expect(upload[1]?.body).toBeInstanceOf(FormData)
  expect(upload[1]?.headers).not.toHaveProperty('Content-Type')
  fireEvent.click(screen.getByRole('button', { name: 'Criar Equipamento' }))
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith('/admin/equipamentos')
  )
  expect(bodies(fetcher)[0]).toMatchObject({
    name: 'Betoneira',
    pricePerDay: 25,
    maxStock: 4,
    categoryId: 'cat',
    images: ['/uploaded.jpg'],
    weeklyDiscount: 100,
    monthlyDirectValue: 500,
    monthlyUseDirectValue: true,
    specifications: { Peso: '40 kg' },
    dailyRentalEnabled: true,
    biweeklyRentalEnabled: true,
  })
  expect(captured.classes).toEqual([])
})
it('edita perda e persiste contador/fotos internos; falha reverte histórico e permite retry', async () => {
  const { client, fetcher } = setup(true)
  render(tree(client, true))
  await screen.findByText('Editar Equipamento')
  expect(screen.getByText('Total de perdas: 2')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Editar Perda 1' }))
  change('Quantidade perdida', '3')
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar Perda' }))
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith(
      'Erro ao salvar registro',
      expect.anything()
    )
  )
  expect(screen.getByText('Total de perdas: 2')).toBeTruthy()
  const first = bodies(fetcher)[0]
  expect(first.images).toEqual(['/public.jpg'])
  expect(first.partsLossHistory[0].images).toEqual(['/private.jpg'])
  expect(first.partsLossCount).toBe(3)
  fetcher.mockImplementation(async (url: string, init?: RequestInit) =>
    init?.method === 'PUT'
      ? Response.json({ id: 'eq' })
      : Response.json(
          url.endsWith('/categories')
            ? [{ id: 'cat', name: 'Concreto' }]
            : equipment
        )
  )
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar Perda' }))
  await screen.findByText('Total de perdas: 3')
  expect(screen.getByLabelText('Descrição da perda')).toHaveProperty(
    'value',
    ''
  )
  expect(screen.getByRole('button', { name: 'Período Mensal' })).toHaveProperty(
    'disabled',
    true
  )
  expect(captured.classes).toEqual([])
})
it('registro novo exige data e calendário recusa amanhã; remoção cancela e confirma no contexto atual', async () => {
  const { client, fetcher } = setup()
  render(tree(client, true))
  await screen.findByText('Editar Equipamento')
  change('Descrição da perda', 'Parafuso')
  change('Quantidade perdida', '1')
  fireEvent.click(screen.getByRole('button', { name: 'Registrar Perda' }))
  expect(captured.warning).toHaveBeenCalled()
  fireEvent.click(
    screen.getByRole('button', { name: 'Selecione a data da perda' })
  )
  const today = new Date()
  fireEvent.click(screen.getByRole('button', { name: 'Próximo Mês' }))
  const future = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  expect(
    screen.getByRole('button', { name: future.toLocaleDateString('pt-BR') })
  ).toHaveProperty('disabled', true)
  fireEvent.click(screen.getByRole('button', { name: 'Mês Anterior' }))
  fireEvent.click(
    screen.getByRole('button', { name: today.toLocaleDateString('pt-BR') })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Registrar Perda' }))
  await screen.findByText('Total de perdas: 3')
  expect(bodies(fetcher)[0].partsLossHistory[1]).toMatchObject({
    description: 'Parafuso',
    quantity: 1,
    images: [],
  })
  fireEvent.click(screen.getByRole('button', { name: 'Remover Perda 2' }))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Cancelar Exclusão' })
  )
  expect(bodies(fetcher)).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Remover Perda 2' }))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Confirmar Exclusão' })
  )
  await screen.findByText('Total de perdas: 2')
  expect(bodies(fetcher)).toHaveLength(2)
})
it('seleção de arquivo aberta antes de trocar o usuário não envia HTTP nem contamina a tela nova', async () => {
  const { client, fetcher } = setup()
  let finish!: (files: FormData[]) => void
  const pick = () =>
      new Promise<FormData[]>((resolve) => {
        finish = resolve
      }),
    view = render(tree(client, false, pick))
  await waitFor(() => expect(fetcher).toHaveBeenCalled())
  fireEvent.click(screen.getByRole('button', { name: 'Escolher arquivos' }))
  view.rerender(tree(client, false, pick, 'bruno'))
  await act(async () => finish([new FormData()]))
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/upload'))).toEqual(
    []
  )
  expect(screen.queryByText('Imagem principal')).toBeNull()
})
it('cancelar o rascunho de perda enquanto o picker está aberto não repõe fotos; confirmação antiga não grava', async () => {
  const { client, fetcher } = setup()
  let finish!: (files: FormData[]) => void
  const pick = () =>
      new Promise<FormData[]>((resolve) => {
        finish = resolve
      }),
    view = render(tree(client, true, pick))
  await screen.findByText('Editar Equipamento')
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Escolher arquivos' })[1]!
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Cancelar Registro de Perda' })
  )
  await act(async () => finish([new FormData()]))
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/upload'))).toEqual(
    []
  )
  fireEvent.click(screen.getByRole('button', { name: 'Remover Perda 1' }))
  await screen.findByRole('button', { name: 'Confirmar Exclusão' })
  view.rerender(tree(client, true, pick, 'bruno'))
  await screen.findByText('Editar Equipamento')
  expect(bodies(fetcher)).toEqual([])
})
