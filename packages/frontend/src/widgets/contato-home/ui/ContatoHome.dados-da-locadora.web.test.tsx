// @vitest-environment jsdom
// Contato da vitrine só com os dados da própria locadora (achado 143; T12 da ADR adr-tenant-hosts): nada do horário
// nem do CNPJ da GB, que apareciam para qualquer locadora. Achado 147: o horário e o CNPJ voltam, lidos das
// configurações públicas e da organização da PRÓPRIA locadora, nas mesmas linhas da produção.
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdentidadePublicaProvider } from '../../../entities/organizacao'
import ContactSection from './ContatoHome.web'

const estado = vi.hoisted(() => ({ settings: {} as Record<string, unknown> }))
vi.mock('../../../entities/configuracao', async (original) => ({
  ...(await original<typeof import('../../../entities/configuracao')>()),
  usePublicSettings: () => ({ settings: estado.settings }),
}))
vi.mock('../../../features/mapa-loja', () => ({
  GoogleStoreLocator: ({ location }: { location?: unknown }) =>
    'MAPA:' + JSON.stringify(location),
}))

const CONTATO = {
  companyPhone: '(41) 3000-0000',
  whatsappNumber: '(41) 99999-0000',
  contactEmail: 'contato@locadora-nova.example.test',
  marketingEmail: '',
}
const aberto = (open: string, close: string) => ({ closed: false, open, close })
const HORARIO = {
  monday: aberto('08:00', '18:00'),
  tuesday: aberto('08:00', '18:00'),
  wednesday: aberto('08:00', '18:00'),
  thursday: aberto('08:00', '18:00'),
  friday: aberto('08:00', '18:00'),
  saturday: aberto('08:00', '12:00'),
  sunday: { closed: true },
}
const naVitrine = () =>
  renderToStaticMarkup(
    <IdentidadePublicaProvider
      value={{
        nome: 'Locadora Nova',
        cidade: 'Curitiba',
        uf: 'PR',
        logoUrl: null,
      }}
    >
      <ContactSection />
    </IdentidadePublicaProvider>
  )

beforeEach(() => {
  estado.settings = { ...CONTATO }
})

describe('Contato da home: dados da locadora', () => {
  it('sem horário nem CNPJ informados: o contato da locadora e nenhum horário, CNPJ ou dado da GB', () => {
    const html = naVitrine()
    expect(html).toContain('(41) 3000-0000')
    expect(html).toContain('contato@locadora-nova.example.test')
    expect(html).not.toMatch(
      /34\.780\.330|GB Loca|locacoesgb|Segunda a Sexta: 8h|Sábado: 8h|Horário de Funcionamento|CNPJ: /i
    )
  })

  it('com horário e CNPJ da própria locadora: o cartão volta com as linhas da produção', () => {
    estado.settings = {
      ...CONTATO,
      businessHours: HORARIO,
      legalIdentity: { legalName: null, cnpj: '11.222.333/0001-81' },
    }
    const html = naVitrine()
    expect(html).toContain('Horário de Funcionamento')
    expect(html).toContain(
      '<p>Segunda a Sexta: 8h às 18h</p><p>Sábado: 8h às 12h</p>'
    )
    expect(html).toContain(
      '<p class="text-sm text-orange-600 mt-2">CNPJ: 11.222.333/0001-81</p>'
    )
    // Domingo fechado não aparece no cartão (como na produção); nada da GB.
    expect(html).not.toMatch(/Domingo|34\.780\.330|GB Loca/)
  })

  it('nome empresarial diferente do nome da vitrine entra na linha do CNPJ', () => {
    estado.settings = {
      ...CONTATO,
      businessHours: HORARIO,
      legalIdentity: {
        legalName: 'Nova Equipamentos Ltda',
        cnpj: '11.222.333/0001-81',
      },
    }
    expect(naVitrine()).toContain(
      'Nova Equipamentos Ltda · CNPJ: 11.222.333/0001-81'
    )
  })

  it('só CNPJ, sem horário: o cartão de horário fica de fora (o CNPJ continua no rodapé)', () => {
    estado.settings = {
      ...CONTATO,
      legalIdentity: { legalName: null, cnpj: '11.222.333/0001-81' },
    }
    expect(naVitrine()).not.toMatch(
      /Horário de Funcionamento|CNPJ: |11.222.333/
    )
  })

  it('onda 134: sem compromisso nem local declarados, nem "Resposta rápida garantida" nem o cartão do mapa', () => {
    const html = naVitrine()
    expect(html).not.toContain('Resposta rápida garantida')
    expect(html).not.toContain('Automação comercial')
    expect(html).not.toContain('h-[320px] w-full bg-slate-100 animate-pulse')
  })

  it('onda 134: com o compromisso e o local da própria locadora, a linha da produção e o cartão do mapa', () => {
    estado.settings = {
      ...CONTATO,
      siteContent: {
        commitments: { fastResponseGuaranteed: true },
        storeLocation: {
          latitude: -25.43,
          longitude: -49.27,
          addressLine1: 'Rua Nova, 1',
        },
      },
    }
    const html = naVitrine()
    expect(html).toContain(
      '<p class="text-sm text-orange-600 mt-2">Resposta rápida garantida · Automação comercial</p>'
    )
    // No SSR o mapa ainda não montou: o cartão com o espaço reservado do mapa, como antes.
    expect(html).toContain(
      '<div class="h-[320px] w-full bg-slate-100 animate-pulse"></div>'
    )
  })
})
