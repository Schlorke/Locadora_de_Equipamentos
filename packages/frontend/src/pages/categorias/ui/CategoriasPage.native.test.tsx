// @vitest-environment jsdom
vi.mock('lucide-react-native', async () => await import('lucide-react'))
vi.mock('react-native-svg', () => {
  const Shape = ({ children }: { children?: import('react').ReactNode }) => (
    <span>{children}</span>
  )
  return {
    default: Shape,
    Path: Shape,
    Circle: Shape,
    Rect: Shape,
    Line: Shape,
    Polygon: Shape,
    Polyline: Shape,
    Ellipse: Shape,
    G: Shape,
    Defs: Shape,
    ClipPath: Shape,
    SvgXml: Shape,
    SvgUri: Shape,
  }
})
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
import { AdminCategoriesPage } from './CategoriasPage.native'
const captured = vi.hoisted(() => ({
  classes: [] as string[],
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock('react-native', async () => {
  const native = (
    await import('../../../../../../tests/helpers/native-screen')
  ).createNativeHost(captured.classes)
  const React = await import('react')
  const ScrollView = React.forwardRef<
    { scrollTo: () => void },
    { children?: import('react').ReactNode }
  >(function ScrollView(props, ref) {
    React.useImperativeHandle(ref, () => ({ scrollTo: () => {} }))
    return <div>{props.children}</div>
  })
  return {
    ...native,
    ScrollView,
    TextInput: (props: {
      value?: string
      accessibilityLabel?: string
      placeholder?: string
      editable?: boolean
      onChangeText?: (text: string) => void
    }) => (
      <input
        value={props.value}
        aria-label={props.accessibilityLabel}
        placeholder={props.placeholder}
        disabled={props.editable === false}
        onChange={(e) => props.onChangeText?.(e.target.value)}
      />
    ),
    Alert: {
      alert: (
        _title: string,
        _body: string,
        buttons: { onPress?: () => void }[]
      ) => buttons.at(-1)?.onPress?.(),
    },
    SectionList: ({
      sections,
      renderItem,
      renderSectionHeader,
    }: {
      sections: { title: string; data: string[][] }[]
      renderItem: ({ item }: { item: string[] }) => import('react').ReactNode
      renderSectionHeader: ({
        section,
      }: {
        section: { title: string }
      }) => import('react').ReactNode
    }) => (
      <div>
        {sections.map((section, i) => (
          <div key={i}>
            {renderSectionHeader?.({ section })}
            {section.data.slice(0, 2).map((item, j) => (
              <div key={j}>{renderItem({ item })}</div>
            ))}
          </div>
        ))}
      </div>
    ),
  }
})
vi.mock('@gb-locacoes/ui', async () => ({
  ...(await (
    await import('../../../../../../tests/helpers/native-screen')
  ).nativeUi()),
  ...(await import('../../../../../ui/src/native/Textarea.native')),
  ...(await import('../../../../../ui/src/icons/custom.native')),
}))
vi.mock('../../../shared/lib/toast', () => ({ toast: captured }))
vi.mock('../../../shared/lib/category-design.native', async () => {
  const original = await vi.importActual<
    typeof import('../../../shared/lib/category-design.native')
  >('../../../shared/lib/category-design.native')
  return {
    ...original,
    renderCategoryIcon: (
      design: import('../../../shared/lib/category-design-model').CategoryDesign
    ) => (
      <span data-testid="category-icon">
        {design.customIcon.emoji ??
          design.customIcon.svgContent ??
          design.customIcon.url ??
          design.icon}
      </span>
    ),
  }
})
vi.mock('../../../shared/storage', () => ({
  keyValueStorage: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}))
const categories = Array.from({ length: 10 }, (_, i) => ({
  id: 'cat' + i,
  name: 'Categoria ' + i,
  createdAt: '2026-10-03',
  description: 'Obra ' + i,
  _count: { equipments: i },
}))
function setup(fail = false) {
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'GET') return Response.json({ categories })
    return Response.json(
      fail ? { error: 'Categoria em uso' } : { id: 'saved' },
      { status: fail ? 409 : 200 }
    )
  })
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
  pickSvg?: () => Promise<import('../model/category-form').SvgFileInput | null>,
  user = 'ana'
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
        <AdminCategoriesPage pickSvg={pickSvg} />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
}
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  captured.classes.length = 0
})
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const writes = (fetcher: ReturnType<typeof setup>['fetcher']) =>
  fetcher.mock.calls.filter(([, init]) => init?.method !== 'GET')
it('pagina nove por vez, busca por descrição, detalhe e exclusão só após confirmação', async () => {
  const { client, fetcher } = setup()
  render(tree(client))
  await screen.findByRole('button', { name: 'Visualizar Categoria 0' })
  expect(
    screen.queryByRole('button', { name: 'Visualizar Categoria 9' })
  ).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
  await screen.findByRole('button', { name: 'Visualizar Categoria 9' })
  fireEvent.click(
    screen.getByRole('button', { name: 'Visualizar Categoria 9' })
  )
  expect(await screen.findByText('ID da Categoria: cat9')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
  change('Buscar categorias', 'Obra 3')
  await screen.findByRole('button', { name: 'Excluir Categoria 3' })
  expect(screen.queryByRole('button', { name: 'Próximo' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Categoria 3' }))
  expect(writes(fetcher)).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar Exclusão' }))
  expect(writes(fetcher)).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Categoria 3' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar Exclusão' }))
  await waitFor(() => expect(writes(fetcher)).toHaveLength(1))
  expect(writes(fetcher)[0]).toMatchObject([
    'https://api.example.test/api/admin/categories/cat3',
    {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'x-tenant-id': 'alfa' },
    },
  ])
  expect(captured.classes).toEqual([])
})
it('cria e edita, conserva campos, placement, cores, limites e erro 409', async () => {
  const { client, fetcher } = setup()
  render(tree(client))
  await screen.findByRole('button', { name: 'Editar Categoria 2' })
  fireEvent.click(screen.getByRole('button', { name: 'Editar Categoria 2' }))
  expect(screen.getByLabelText('Nome da categoria')).toHaveProperty(
    'value',
    'Categoria 2'
  )
  change('Nome da categoria', 'x'.repeat(60))
  expect(screen.getByLabelText('Nome da categoria')).toHaveProperty(
    'value',
    'x'.repeat(50)
  )
  change('Nome da categoria', 'Fundação')
  change('Descrição (Opcional)', 'd'.repeat(230))
  change('Cor de fundo', '#123456')
  change('Cor da fonte', '#654321')
  change('Cor do ícone', '#abcdef')
  fireEvent.click(screen.getByRole('button', { name: 'Fases da obra' }))
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar Categoria' }))
  await waitFor(() => expect(writes(fetcher)).toHaveLength(1))
  expect(JSON.parse(String(writes(fetcher)[0]![1]!.body))).toMatchObject({
    name: 'Fundação',
    description: 'd'.repeat(200),
    backgroundColor: '#123456',
    bgColor: '#123456',
    fontColor: '#654321',
    iconColor: '#abcdef',
    placement: 'phases',
    icon: 'Tag',
    customIcon: null,
  })
  expect(writes(fetcher)[0]![0]).toBe(
    'https://api.example.test/api/admin/categories/cat2'
  )
  await waitFor(() =>
    expect(screen.queryByLabelText('Nome da categoria')).toBeNull()
  )
  fireEvent.click(screen.getByRole('button', { name: 'Nova Categoria' }))
  change('Nome da categoria', 'Nova')
  change('Cor de fundo', 'invalid')
  expect(
    screen.getByRole('button', { name: 'Criar Categoria' })
  ).toHaveProperty('disabled', true)
  change('Cor de fundo', '#123456')
  fireEvent.click(screen.getByRole('button', { name: 'Criar Categoria' }))
  await waitFor(() => expect(writes(fetcher)).toHaveLength(2))
  expect(writes(fetcher)[1]![1]!.method).toBe('POST')
  cleanup()
  const failed = setup(true)
  render(tree(failed.client))
  await screen.findByRole('button', { name: 'Nova Categoria' })
  fireEvent.click(screen.getByRole('button', { name: 'Nova Categoria' }))
  change('Nome da categoria', 'Duplicada')
  fireEvent.click(screen.getByRole('button', { name: 'Criar Categoria' }))
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith('Erro ao salvar categoria', {
      description: 'Categoria já existente',
    })
  )
  expect(screen.getByLabelText('Nome da categoria')).toHaveProperty(
    'value',
    'Duplicada'
  )
})
it('seleção SVG valida o limite, sanitiza, exige nome e envia o ícone só depois de salvar', async () => {
  const { client, fetcher } = setup()
  const pick = vi.fn(async () => ({
    name: 'Obra.svg',
    type: 'image/svg+xml',
    size: 25,
    read: async () =>
      '<svg><script>bad()</script><path onclick="bad()" /></svg>',
  }))
  render(tree(client, pick))
  await screen.findByRole('button', { name: 'Nova Categoria' })
  fireEvent.click(screen.getByRole('button', { name: 'Nova Categoria' }))
  change('Nome da categoria', 'SVG')
  fireEvent.click(screen.getByRole('button', { name: 'Personalizar ícone' }))
  fireEvent.click(screen.getByRole('button', { name: 'Fazer Upload' }))
  fireEvent.click(screen.getByRole('button', { name: 'Upload' }))
  fireEvent.click(
    screen.getByRole('button', { name: 'Selecionar arquivo SVG' })
  )
  await screen.findByText('Pré-visualização')
  const name = screen.getByPlaceholderText('Defina um nome descritivo')
  fireEvent.change(name, { target: { value: '' } })
  expect(screen.getByRole('button', { name: 'Salvar ícone' })).toHaveProperty(
    'disabled',
    true
  )
  fireEvent.change(name, { target: { value: ' Símbolo ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar ícone' }))
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Criar Categoria' }))
  await waitFor(() => expect(writes(fetcher)).toHaveLength(1))
  expect(JSON.parse(String(writes(fetcher)[0]![1]!.body))).toMatchObject({
    icon: null,
    customIcon: {
      source: 'upload',
      name: 'Símbolo',
      fileName: 'Obra.svg',
      svgContent: '<svg><path /></svg>',
    },
  })
  expect(pick).toHaveBeenCalledTimes(1)
  expect(captured.classes).toEqual([])
})
it('trocar sessão enquanto o seletor aguarda não lê nem aplica arquivo antigo', async () => {
  const { client } = setup()
  let finish!: (value: import('../model/category-form').SvgFileInput) => void
  const read = vi.fn(async () => '<svg/>'),
    pick = () =>
      new Promise<import('../model/category-form').SvgFileInput>((resolve) => {
        finish = resolve
      })
  const view = render(tree(client, pick))
  await screen.findByRole('button', { name: 'Nova Categoria' })
  fireEvent.click(screen.getByRole('button', { name: 'Nova Categoria' }))
  fireEvent.click(screen.getByRole('button', { name: 'Personalizar ícone' }))
  fireEvent.click(screen.getByRole('button', { name: 'Fazer Upload' }))
  fireEvent.click(screen.getByRole('button', { name: 'Upload' }))
  fireEvent.click(
    screen.getByRole('button', { name: 'Selecionar arquivo SVG' })
  )
  view.rerender(tree(client, pick, 'bia'))
  await act(async () =>
    finish({ name: 'old.svg', type: 'image/svg+xml', size: 4, read })
  )
  expect(read).not.toHaveBeenCalled()
  expect(screen.queryByLabelText('Nome da categoria')).toBeNull()
  expect(captured.error).not.toHaveBeenCalled()
})

vi.mock('../../../widgets/personalizar-icone', async () => ({
  ...(await import('../../../widgets/personalizar-icone/ui/Bloco.native')),
  ...(await import('../../../widgets/personalizar-icone/model/dados')),
  ...(await import('../../../widgets/personalizar-icone/model/emoji-recents')),
  ...(await import('../../../widgets/personalizar-icone/model/icon-recents')),
}))
