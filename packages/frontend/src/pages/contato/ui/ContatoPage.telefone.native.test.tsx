// @vitest-environment jsdom
// Telefone e WhatsApp opcionais no contato do app. O app usa o mesmo modelo da web (`model/use-contact-page.ts`), que
// juntava os dois números com um " | " fixo ("(41) 3000-0000 | " sem WhatsApp, " | (41) …" sem telefone, " | " sem os
// dois). Aqui a tela nativa roda com o `ContactInfoCard` nativo real (o vitest resolve o índice do widget para a
// variante web; o Metro, para a `.native`, que é a que entra aqui): o modelo que ela recebe tem só os números
// informados, com o separador só entre os dois e sem o cartão "Telefone" quando não há nenhum, e os canais do app
// (botões "Telefone" e "WhatsApp") aparecem cada um só com o próprio número, sem separador sobrando.
vi.mock('lucide-react-native', async () => await import('lucide-react'))
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const captured = vi.hoisted(() => ({
  classes: [] as string[],
  settings: {} as Record<string, unknown>,
  modelo: null as null | {
    contactInfo: Array<{ icon: string; main: string; subtitle: string }>
  },
}))
vi.mock('react-native', async () =>
  (
    await import('../../../../../../tests/helpers/native-screen')
  ).createNativeHost(captured.classes)
)
vi.mock('@gb-locacoes/ui', async () =>
  (await import('../../../../../../tests/helpers/native-screen')).nativeUi()
)
vi.mock('../../../features/enviar-contato', () => ({
  ContactForm: () => <form aria-label="Formulário de contato" />,
}))
vi.mock(
  '../../../widgets/contato-empresa',
  async () =>
    import('../../../widgets/contato-empresa/ui/ContactInfoCard.native')
)
vi.mock('../../../entities/configuracao', async (original) => ({
  ...(await original<typeof import('../../../entities/configuracao')>()),
  usePublicSettings: () => ({
    settings: captured.settings,
    isLoading: false,
    error: null,
  }),
}))
// O modelo real, com o que ele entrega à tela nativa guardado para a prova.
vi.mock('../model/use-contact-page', async (original) => {
  const real = await original<typeof import('../model/use-contact-page')>()
  return {
    useContactPage: () => {
      const modelo = real.useContactPage()
      captured.modelo = modelo
      return modelo
    },
  }
})
import { IdentidadePublicaProvider } from '../../../entities/organizacao'
import { ContatoPage } from './ContatoPage.native'

const TELEFONE = '(41) 3000-0000'
const WHATSAPP = '(41) 99999-0000'
const BASE = {
  contactEmail: 'contato@locadora-nova.example.test',
  marketingEmail: '',
  companyAddress: 'Rua Nova, 1 - Centro, Curitiba - PR',
  siteContent: {},
}

afterEach(() => {
  cleanup()
  captured.classes.length = 0
  captured.modelo = null
})

it('telefone e WhatsApp opcionais: o modelo só com os números informados e os canais do app sem separador sobrando', () => {
  const casos: Array<{
    caso: string
    companyPhone: string
    whatsappNumber: string
    linha: string | null
  }> = [
    {
      caso: 'os dois',
      companyPhone: TELEFONE,
      whatsappNumber: WHATSAPP,
      linha: `${TELEFONE} | ${WHATSAPP}`,
    },
    {
      caso: 'sem WhatsApp',
      companyPhone: TELEFONE,
      whatsappNumber: '',
      linha: TELEFONE,
    },
    {
      caso: 'sem telefone',
      companyPhone: '',
      whatsappNumber: WHATSAPP,
      linha: WHATSAPP,
    },
    { caso: 'sem os dois', companyPhone: '', whatsappNumber: '', linha: null },
  ]
  for (const { caso, companyPhone, whatsappNumber, linha } of casos) {
    captured.settings = { ...BASE, companyPhone, whatsappNumber }
    render(
      <IdentidadePublicaProvider
        value={{
          nome: 'Locadora Nova',
          cidade: 'Curitiba',
          uf: 'PR',
          logoUrl: null,
        }}
      >
        <ContatoPage />
      </IdentidadePublicaProvider>
    )
    // O modelo que a tela nativa recebe (o mesmo da web).
    const telefone = captured.modelo?.contactInfo.find(
      (info) => info.icon === 'Phone'
    )
    expect(telefone?.main ?? null, caso).toBe(linha)
    // Os canais do app: cada botão só com o próprio número (o e-mail sempre, nesta locadora).
    expect(
      screen.getAllByRole('button').map((botao) => botao.textContent),
      caso
    ).toEqual([
      `E-mail: ${BASE.contactEmail}`,
      ...(companyPhone ? [`Telefone: ${TELEFONE}`] : []),
      ...(whatsappNumber ? [`WhatsApp: ${WHATSAPP}`] : []),
    ])
    // Nenhum texto da tela começa ou termina no separador, e o e-mail e o endereço continuam.
    const textos = [...document.body.querySelectorAll('*')].flatMap((no) =>
      [...no.childNodes]
        .filter((filho) => filho.nodeType === Node.TEXT_NODE)
        .map((filho) => (filho.textContent ?? '').trim())
        .filter(Boolean)
    )
    for (const texto of textos) expect(texto, caso).not.toMatch(/^\||\|$/)
    expect(document.body.textContent, caso).not.toContain(' | ')
    expect(document.body.textContent, caso).toContain(BASE.contactEmail)
    expect(document.body.textContent, caso).toContain(BASE.companyAddress)
    cleanup()
  }
  expect(captured.classes).toEqual([])
})
