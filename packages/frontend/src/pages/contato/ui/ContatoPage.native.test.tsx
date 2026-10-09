// @vitest-environment jsdom
// Contato do app (onda 134): o mesmo modelo da web (`model/use-contact-page.ts`). O app passa a mostrar o horário e o
// CNPJ da própria locadora (pendência da onda 133) e os números, serviços e selos só com o conteúdo e os compromissos
// que ela declarou no painel (D-E: desligados por padrão).
vi.mock('lucide-react-native', async () => await import('lucide-react'))
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const captured = vi.hoisted(() => ({
  classes: [] as string[],
  settings: {} as Record<string, unknown>,
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
vi.mock('../../../widgets/contato-empresa', () => ({
  ContactInfoCard: () => <section aria-label="Canais de contato" />,
}))
vi.mock('../../../entities/configuracao', async (original) => ({
  ...(await original<typeof import('../../../entities/configuracao')>()),
  usePublicSettings: () => ({
    settings: captured.settings,
    isLoading: false,
    error: null,
  }),
}))
import { IdentidadePublicaProvider } from '../../../entities/organizacao'
import { ContatoPage } from './ContatoPage.native'

const BASE = {
  companyPhone: '(41) 3000-0000',
  whatsappNumber: '(41) 99999-0000',
  contactEmail: 'contato@locadora-nova.example.test',
  marketingEmail: '',
  companyAddress: 'Rua Nova, 1 - Centro, Curitiba - PR',
  siteContent: {},
}
const aberto = (open: string, close: string) => ({ closed: false, open, close })

function renderizar() {
  return render(
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
}

afterEach(() => {
  cleanup()
  captured.classes.length = 0
})

it('Locadora Nova sem conteúdo: sem números, horário, CNPJ, serviços de compromisso, selos nem "Onde estamos"', () => {
  captured.settings = { ...BASE }
  renderizar()
  const texto = document.body.textContent ?? ''
  expect(texto).toContain('Entre em Contato')
  expect(texto).toContain('Atendimento Especializado')
  expect(texto).not.toMatch(
    /Anos de Experiência|Projetos Realizados|Equipamentos Disponíveis|Suporte Técnico|Horário de Funcionamento|CNPJ|Agendamento Flexível|Qualidade Garantida|Consultoria Gratuita|Entrega Rápida|Suporte 24h|Onde estamos/
  )
  expect(captured.classes).toEqual([])
})

it('com horário, CNPJ, conteúdo, compromissos e local da locadora: o app mostra o mesmo que a web', () => {
  captured.settings = {
    ...BASE,
    businessHours: {
      monday: aberto('08:00', '18:00'),
      tuesday: aberto('08:00', '18:00'),
      wednesday: aberto('08:00', '18:00'),
      thursday: aberto('08:00', '18:00'),
      friday: aberto('08:00', '18:00'),
      saturday: aberto('08:00', '12:00'),
      sunday: { closed: true },
    },
    legalIdentity: {
      legalName: 'Nova Equipamentos Ltda',
      cnpj: '11.222.333/0001-81',
    },
    siteContent: {
      experienceYears: 7,
      projectsCompleted: 340,
      fleetSize: 60,
      commitments: {
        support24h: true,
        flexibleScheduling: true,
        freeConsulting: true,
        certifiedEquipment: true,
      },
      storeLocation: {
        latitude: -25.43,
        longitude: -49.27,
        addressLine1: 'Rua Nova, 1',
        addressLine2: 'Curitiba, PR',
      },
    },
  }
  renderizar()
  for (const numero of [
    '7+ Anos de Experiência',
    '340+ Projetos Realizados',
    '60+ Equipamentos Disponíveis',
    '24h Suporte Técnico',
  ])
    expect(screen.getByText(numero)).toBeTruthy()
  expect(screen.getByText('Horário de Funcionamento')).toBeTruthy()
  expect(screen.getByText('Segunda a Sexta: 8h às 18h')).toBeTruthy()
  expect(screen.getByText('Sábado: 8h às 12h • Domingo: Fechado')).toBeTruthy()
  expect(
    screen.getByText('Nova Equipamentos Ltda · CNPJ: 11.222.333/0001-81')
  ).toBeTruthy()
  expect(screen.getByText('Agendamento Flexível')).toBeTruthy()
  expect(screen.getByText('Qualidade Garantida')).toBeTruthy()
  expect(screen.getByText('Onde estamos')).toBeTruthy()
  expect(screen.getByText('Rua Nova, 1')).toBeTruthy()
  expect(screen.getByText('Curitiba, PR')).toBeTruthy()
  expect(screen.getByText('Consultoria Gratuita')).toBeTruthy()
  expect(screen.getByText('Suporte 24h')).toBeTruthy()
  // Entrega rápida não foi declarada: o selo não aparece.
  expect(screen.queryByText('Entrega Rápida')).toBeNull()
  expect(captured.classes).toEqual([])
})

// Parte dos dias úteis abertos e sem horário. O app mostra as faixas do horário da própria locadora e, como em
// 55763c1e, não tem o subtítulo do cartão "Telefone" da web ("Atendimento de segunda a sexta", "WhatsApp disponível"):
// os canais ficam no `ContactInfoCard`, com o botão do WhatsApp só com o número. A regra do subtítulo é provada na web
// (`ContatoPage.test.tsx`), que é quem o mostra.
it('parte dos dias úteis abertos: as faixas da locadora, sem promessa de segunda a sexta', () => {
  captured.settings = {
    ...BASE,
    whatsappNumber: '',
    businessHours: {
      monday: aberto('08:00', '18:00'),
      tuesday: aberto('08:00', '18:00'),
      wednesday: aberto('08:00', '18:00'),
      thursday: aberto('08:00', '18:00'),
      friday: { closed: true },
      saturday: aberto('08:00', '12:00'),
    },
  }
  renderizar()
  expect(screen.getByText('Horário de Funcionamento')).toBeTruthy()
  expect(screen.getByText('Segunda a Quinta: 8h às 18h')).toBeTruthy()
  expect(screen.getByText('Sexta: Fechado • Sábado: 8h às 12h')).toBeTruthy()
  const texto = document.body.textContent ?? ''
  expect(texto).not.toMatch(
    /Segunda a Sexta|segunda a sexta|WhatsApp disponível/
  )
  expect(captured.classes).toEqual([])
})

it('sem horário: sem o cartão de horário e sem promessa no telefone, com ou sem WhatsApp', () => {
  for (const whatsappNumber of [BASE.whatsappNumber, '']) {
    captured.settings = { ...BASE, whatsappNumber }
    renderizar()
    const texto = document.body.textContent ?? ''
    expect(texto).toContain('Entre em Contato')
    expect(texto).not.toMatch(
      /Horário de Funcionamento|segunda a sexta|WhatsApp disponível/
    )
    cleanup()
  }
  expect(captured.classes).toEqual([])
})
