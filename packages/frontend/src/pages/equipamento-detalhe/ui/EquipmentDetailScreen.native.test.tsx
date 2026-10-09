// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  historyTree,
  nativeHistoryApi,
} from '../../../../../../tests/helpers/customer-history'
const captured = vi.hoisted(() => ({
  classes: [] as string[],
  info: vi.fn(),
  success: vi.fn(),
  navigate: vi.fn(),
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
  ...(await import('../../../../../ui/src/native/AlertDialog.native')),
  ...(await import('../../../../../ui/src/native/Checkbox.native')),
  ...(await import('../../../../../ui/src/native/Select.native')),
  toast: captured,
}))
import { EquipmentDetailScreen } from './EquipmentDetailScreen.native'
const equipment = {
  id: 'eq-1',
  name: 'Betoneira Alfa',
  description: 'Para sua obra.',
  pricePerDay: 100,
  images: ['/one.png', '/two.png'],
  category: { id: 'cat', name: 'Obra' },
}
const image = ({ src, alt }: { src: string; alt: string; height: number }) => (
  <img src={src} alt={alt} />
)
/** Configurações públicas da locadora com os compromissos declarados (onda 134, D-E: desligados por padrão). */
const SETTINGS = {
  siteContent: {
    commitments: {
      certifiedEquipment: true,
      freeDelivery: true,
      fastDelivery: true,
      sameDayDelivery: true,
      support24h: true,
    },
    experienceYears: 7,
    reviews: {
      rating: 4.6,
      count: 52,
      sourceName: 'Google',
      sourceUrl: 'https://g.example.test/locadora',
    },
  },
}
const porRota =
  (settings: unknown, detalhe: unknown = equipment) =>
  async (input: string | URL | Request) =>
    Response.json(
      String(input).includes('/api/settings/public') ? settings : detalhe
    )
afterEach(() => {
  cleanup()
  captured.classes.length = 0
})

it('usa detalhe da locadora pelo transporte, navega galeria e compartilha por porta do host', async () => {
  const fetcher = vi.fn(porRota(SETTINGS))
  const share = vi.fn(async () => {})
  render(
    historyTree(
      <EquipmentDetailScreen
        id="eq-1"
        tenantSlug="alfa"
        image={image}
        onShare={share}
      />,
      nativeHistoryApi(fetcher),
      'ana',
      'alfa',
      captured.navigate
    )
  )
  expect(await screen.findByText('Betoneira Alfa')).toBeTruthy()
  expect(fetcher.mock.calls.map((call) => String(call[0]))).toContain(
    'https://api.example.test/api/equipments/eq-1?tenantSlug=alfa'
  )
  expect(screen.getByRole('img').getAttribute('src')).toBe('/one.png')
  fireEvent.click(screen.getByRole('button', { name: 'Próxima imagem' }))
  expect(screen.getByRole('img').getAttribute('src')).toBe('/two.png')
  fireEvent.click(screen.getByRole('button', { name: 'Ampliar imagem' }))
  expect(screen.getAllByRole('img')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Fechar imagem' }))
  expect(screen.getAllByRole('img')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }))
  await act(async () => {})
  expect(share).toHaveBeenCalledWith('Betoneira Alfa')
  expect(
    await screen.findByText('Manutenção preventiva', { exact: false })
  ).toBeTruthy()
  // Onda 134: a linha do topo é a mesma da web, só com os compromissos declarados (antes, "Entrega Rápida" no app).
  expect(
    screen.getByText(
      'Equipamento Certificado · Entrega Gratuita · Suporte Garantido'
    )
  ).toBeTruthy()
  expect(
    screen.getByText('Mais de 7 anos de experiência no mercado')
  ).toBeTruthy()
  expect(
    screen.getByText(
      'Todos os equipamentos passam por rigorosa inspeção e possuem certificações de segurança'
    )
  ).toBeTruthy()
  // Nota só com a fonte declarada (D-A).
  expect(screen.getByText('4.6 de 5 (52 avaliações no')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Google' })).toBeTruthy()
  // Sem a nota fixa nem a região da GB (achado 143); o app ainda não recebe a cidade da locadora: texto neutro.
  expect(document.body.textContent).not.toMatch(/4\.8|127 avalia|Porto Alegre/)
  expect(
    screen.getByText('Entrega no mesmo dia na região metropolitana')
  ).toBeTruthy()
  expect(screen.getByText('Entrega na região')).toBeTruthy()
  expect(captured.classes).toEqual([])
})

it('Locadora Nova sem compromisso declarado: nenhuma promessa do modelo no app (D-E)', async () => {
  const fetcher = vi.fn(porRota({ siteContent: {} }))
  render(
    historyTree(
      <EquipmentDetailScreen id="eq-1" tenantSlug="alfa" image={image} />,
      nativeHistoryApi(fetcher)
    )
  )
  expect(await screen.findByText('Betoneira Alfa')).toBeTruthy()
  await act(async () => {})
  expect(document.body.textContent).not.toMatch(
    /Equipamento Certificado|Entrega Gratuita|Entrega Rápida|Suporte Garantido|Manutenção preventiva|Suporte técnico 24h|Entrega e retirada|Incluído na locação|Por que escolher|avaliações/
  )
})

it('não apresenta resposta antiga após mudar a locadora/registro', async () => {
  let complete!: (response: Response) => void
  const fetcher = vi.fn(async (url: string | URL | Request) =>
    String(url).includes('tenantSlug=alfa')
      ? await new Promise<Response>((resolve) => {
          complete = resolve
        })
      : Response.json({ ...equipment, id: 'eq-2', name: 'Betoneira Bravo' })
  )
  const client = nativeHistoryApi(fetcher)
  const r = render(
    historyTree(
      <EquipmentDetailScreen id="eq-1" tenantSlug="alfa" image={image} />,
      client
    )
  )
  await act(async () => {})
  r.rerender(
    historyTree(
      <EquipmentDetailScreen id="eq-2" tenantSlug="bravo" image={image} />,
      client,
      'bia',
      'bravo'
    )
  )
  expect(await screen.findByText('Betoneira Bravo')).toBeTruthy()
  await act(async () => {
    complete(Response.json(equipment))
  })
  expect(screen.queryByText('Betoneira Alfa')).toBeNull()
  expect(screen.getByText('Betoneira Bravo')).toBeTruthy()
})

it('falha permite tentar novamente e 404 permanece neutro', async () => {
  const fetcher = vi.fn(async () => Response.json({}, { status: 503 }))
  const client = nativeHistoryApi(fetcher)
  render(
    historyTree(
      <EquipmentDetailScreen id="eq-1" tenantSlug="alfa" image={image} />,
      client
    )
  )
  expect(await screen.findByRole('alert')).toBeTruthy()
  fetcher.mockImplementation(async () => Response.json({}, { status: 404 }))
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(await screen.findByText('Equipamento não encontrado.')).toBeTruthy()
  expect(
    screen.queryByRole('button', { name: 'Solicitar Orçamento Grátis' })
  ).toBeNull()
})
