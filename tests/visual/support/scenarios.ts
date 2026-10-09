/**
 * Rotas e estados da linha de base visual. Cada estado parte de uma navegação nova (contexto novo), executa a
 * interação e grava só o que mudou em relação à captura base da mesma rota. Um estado que não encontra o seu alvo
 * falha o teste: a cobertura nunca some em silêncio.
 */
import type { Locator, Page } from 'playwright/test'
import { EQUIPMENTS } from './fixtures.mjs'
import {
  APP_ORIGIN,
  PAUSED_TENANT_ORIGIN,
  TENANT,
  TENANT_ORIGIN,
} from './env.mjs'

export type ViewportName = '390' | '1440'

export interface StateDefinition {
  name: string
  /** Estados que dependem do layout (menu móvel, alternadores só com ícone) valem só nestes viewports. */
  viewports?: ViewportName[]
  /** `settle`: espera a página parar (rede, animações, DOM) entre dois gestos do mesmo estado. */
  run: (_page: Page, _settle: () => Promise<void>) => Promise<void>
  /** Exigência sobre o estado já parado, antes da captura (sem avançar o relógio); lança se não for cumprida. */
  check?: (_page: Page) => Promise<void>
}

/** Sessão das APIs simuladas: o painel no host `app` (admin), o visitante (anonymous) e a cliente da vitrine (client). */
export type VisualSession = 'admin' | 'anonymous' | 'client'

export interface Scenario {
  id: string
  origin: string
  path: string
  /**
   * Sessão das APIs simuladas; o padrão segue o host: `admin` no `app`, `anonymous` na vitrine (onda 135, A9: a área do
   * cliente usa `client`, e as telas de conta do `app`, `anonymous`).
   */
  session?: VisualSession
  /** Chaves de localStorage gravadas antes da primeira página (carrinho da vitrine). */
  localStorage?: Record<string, string>
  /** Status HTTP esperado da página quando não é o de sucesso (a pausa responde 503, S13). */
  status?: number
  states: StateDefinition[]
}

/** Foco por teclado (`:focus-visible`): foca o anterior e volta com Tab. */
export async function focusByKeyboard(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded()
  await target.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
}

/**
 * Diálogo aberto por clique do mouse: o foco inicial, que o diálogo move por código (em geral para o X), fica dentro
 * do diálogo e sem anel, porque o anel de foco é só do teclado. O estado falha se o elemento focado tiver contorno.
 */
async function expectNoRingOnInitialFocus(page: Page) {
  const focused = await page.evaluate(() => {
    const element = document.activeElement
    if (!element || !element.closest('[role="dialog"]')) return null
    const style = getComputedStyle(element)
    return {
      tag: element.tagName.toLowerCase(),
      label: element.getAttribute('aria-label') ?? '',
      outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
      none: style.outlineStyle === 'none',
    }
  })
  if (!focused)
    throw new Error('diálogo aberto por clique: o foco inicial não está no diálogo')
  if (!focused.none)
    throw new Error(
      `diálogo aberto por clique: o foco inicial (${focused.tag} "${focused.label}") mostra anel: ${focused.outline}`
    )
}

async function hover(target: Locator) {
  await target.scrollIntoViewIfNeeded()
  await target.hover()
}

const cartItem = EQUIPMENTS[1]!
/** Carrinho do visitante anônimo da locadora (`cart:` + escopo [slug, usuário], como em features/carrinho). */
const cartSeed = {
  [`cart:${encodeURIComponent(JSON.stringify([TENANT.slug, 'anonymous']))}`]:
    JSON.stringify({
      state: {
        items: [
          {
            equipmentId: cartItem.id,
            equipmentName: cartItem.name,
            pricePerDay: cartItem.pricePerDay,
            quantity: 1,
            days: 7,
            maxStock: 5,
            description: cartItem.description,
            category: { name: cartItem.category.name },
            images: cartItem.images,
            startDate: '2026-03-16T12:00:00.000Z',
            endDate: '2026-03-22T12:00:00.000Z',
            includeWeekends: false,
            weeklyDiscount: 10,
          },
        ],
      },
      version: 0,
    }),
}

/**
 * Cenários que faltavam na linha de base (onda 135, A9; E21 do plano de aposentadoria da raiz): a área do cliente com
 * a moldura do host web (A5), as telas de conta do host `app` e as telas do painel que não eram capturadas. Só a
 * página, sem estados; a moldura do painel é a da entrada 295 (AdminLayoutShell), que a linha de base antiga do painel
 * ainda não tem.
 */
const MISSING_SCENARIOS: Scenario[] = [
  // --- Área do cliente (host da locadora, sessão de cliente) ---
  ...(
    [
      ['conta/area-cliente', '/area-cliente'],
      ['conta/perfil', '/area-cliente/perfil'],
      ['conta/enderecos', '/area-cliente/enderecos'],
      ['conta/historico', '/area-cliente/historico'],
      ['conta/historico-detalhe', '/area-cliente/historico/rental-visual-2'],
      ['conta/notificacoes', '/area-cliente/notificacoes'],
    ] as const
  ).map(([id, path]) => ({
    id,
    origin: TENANT_ORIGIN,
    path,
    session: 'client' as const,
    states: [],
  })),
  // --- Telas de conta do host app (visitante) ---
  ...(
    [
      ['acesso/login', '/login'],
      ['acesso/recuperar-senha', '/recuperar-senha'],
      ['acesso/reset-password', '/reset-password?token=visual-token'],
      ['acesso/comecar', '/comecar'],
    ] as const
  ).map(([id, path]) => ({
    id,
    origin: APP_ORIGIN,
    path,
    session: 'anonymous' as const,
    states: [],
  })),
  // --- Painel (host app, sessão ADMIN) ---
  ...(
    [
      ['painel/email', '/admin/email'],
      ['painel/logistica', '/admin/logistics'],
      ['painel/manutencao', '/admin/maintenance'],
      ['painel/permissoes', '/admin/permissions'],
      ['painel/whatsapp', '/admin/whatsapp'],
      ['painel/assinatura', '/admin/assinatura'],
      ['painel/equipamento-detalhe', `/admin/equipamentos/${EQUIPMENTS[1]!.id}`],
      [
        'painel/equipamento-editar',
        `/admin/equipamentos/${EQUIPMENTS[1]!.id}/editar`,
      ],
      ['painel/orcamento-detalhe', '/admin/orcamentos/quote-visual-1'],
    ] as const
  ).map(([id, path]) => ({ id, origin: APP_ORIGIN, path, states: [] })),
]

export const SCENARIOS: Scenario[] = [
  // --- Vitrine (host da locadora) ---
  {
    id: 'vitrine/home',
    origin: TENANT_ORIGIN,
    path: '/',
    states: [
      {
        name: 'foco-teclado-cabecalho',
        run: async (page) => {
          for (let i = 0; i < 3; i += 1) await page.keyboard.press('Tab')
        },
      },
      {
        name: 'hover-cta-catalogo',
        viewports: ['1440'],
        run: async (page) =>
          hover(
            page
              .getByRole('link', { name: 'Ver Catálogo de Equipamentos' })
              .first()
          ),
      },
      {
        name: 'aba-fases-da-obra',
        run: async (page) =>
          page.getByRole('tab', { name: 'Fases da obra' }).click(),
      },
      {
        name: 'busca-aberta',
        viewports: ['1440'],
        run: async (page) =>
          page
            .getByRole('button', { name: 'Abrir busca de equipamentos' })
            .click(),
      },
      {
        name: 'menu-movel-aberto',
        viewports: ['390'],
        run: async (page) =>
          page.getByRole('button', { name: 'Abrir menu' }).click(),
      },
      {
        name: 'whatsapp-aberto',
        run: async (page) =>
          page.getByRole('button', { name: 'Abrir chat do WhatsApp' }).click(),
      },
    ],
  },
  {
    id: 'vitrine/equipamentos',
    origin: TENANT_ORIGIN,
    path: '/equipamentos',
    states: [
      {
        name: 'select-categoria-aberto',
        run: async (page) =>
          page.getByRole('button', { name: 'Todas as categorias' }).click(),
      },
      {
        name: 'hover-cartao',
        viewports: ['1440'],
        run: async (page) =>
          hover(page.getByRole('heading', { name: EQUIPMENTS[0]!.name })),
      },
      {
        name: 'foco-teclado-busca',
        run: async (page) =>
          focusByKeyboard(
            page,
            page.getByRole('textbox', { name: 'Buscar equipamentos...' })
          ),
      },
    ],
  },
  {
    id: 'vitrine/equipamento-detalhe',
    origin: TENANT_ORIGIN,
    path: `/equipamentos/${EQUIPMENTS[1]!.id}`,
    states: [
      {
        name: 'checkbox-fins-de-semana',
        run: async (page) =>
          page
            .getByRole('checkbox', { name: 'Incluir finais de semana' })
            .click(),
      },
      {
        name: 'calendario-aberto',
        run: async (page) =>
          page
            .getByRole('button', { name: 'Selecione as datas de início e fim' })
            .click(),
      },
      {
        name: 'hover-periodo',
        viewports: ['1440'],
        run: async (page) =>
          hover(page.getByRole('button', { name: /^Quinzenal/ })),
      },
      {
        name: 'foco-teclado-periodo',
        run: async (page) =>
          focusByKeyboard(page, page.getByRole('button', { name: /^Mensal/ })),
      },
    ],
  },
  {
    id: 'vitrine/orcamento',
    origin: TENANT_ORIGIN,
    path: '/orcamento',
    localStorage: cartSeed,
    states: [
      {
        name: 'select-entrega-aberto',
        run: async (page) =>
          page
            .getByRole('combobox')
            .filter({ hasText: 'Selecione o tipo de entrega' })
            .click(),
      },
      {
        name: 'foco-teclado-nome',
        run: async (page) =>
          focusByKeyboard(
            page,
            page.getByRole('textbox', { name: 'Nome Completo *' })
          ),
      },
    ],
  },
  {
    id: 'vitrine/contato',
    origin: TENANT_ORIGIN,
    path: '/contato',
    states: [
      {
        name: 'foco-teclado-nome',
        run: async (page) =>
          focusByKeyboard(
            page,
            page.getByRole('textbox', { name: 'Nome Completo *' })
          ),
      },
      {
        name: 'hover-enviar',
        viewports: ['1440'],
        run: async (page) =>
          hover(page.getByRole('button', { name: 'Enviar Solicitação' })),
      },
    ],
  },
  {
    id: 'vitrine/entrar',
    origin: TENANT_ORIGIN,
    path: '/entrar',
    states: [
      {
        name: 'foco-teclado-email',
        run: async (page) =>
          focusByKeyboard(
            page,
            page.getByRole('textbox', { name: 'Digite seu e-mail' })
          ),
      },
      {
        name: 'hover-entrar',
        viewports: ['1440'],
        run: async (page) =>
          hover(page.getByRole('button', { name: 'Entrar no Sistema' })),
      },
    ],
  },
  // Páginas legais e pausa (onda 134, B0): referência antes de os textos legais virem do documento de cada locadora e
  // de as páginas legais ficarem no ar na pausa. Só a página, sem estados.
  {
    id: 'vitrine/termos',
    origin: TENANT_ORIGIN,
    path: '/termos',
    states: [],
  },
  {
    id: 'vitrine/privacidade',
    origin: TENANT_ORIGIN,
    path: '/privacidade',
    states: [],
  },
  {
    id: 'vitrine/politica-devolucao',
    origin: TENANT_ORIGIN,
    path: '/politica-devolucao',
    states: [],
  },
  {
    id: 'vitrine/cookies',
    origin: TENANT_ORIGIN,
    path: '/cookies',
    states: [],
  },
  {
    id: 'vitrine/site-pausado',
    origin: PAUSED_TENANT_ORIGIN,
    path: '/',
    status: 503,
    states: [],
  },
  // Termos em pausa (onda 134, B9; decisão do dono de 2026-10-06, item 4): a página legal continua no ar, com HTTP 200,
  // dentro da moldura neutra da locadora e com os links dos documentos publicados.
  {
    id: 'vitrine/termos-pausado',
    origin: PAUSED_TENANT_ORIGIN,
    path: '/termos',
    states: [],
  },
  // --- Painel (host app) ---
  {
    id: 'painel/dashboard',
    origin: APP_ORIGIN,
    path: '/admin/dashboard',
    states: [
      {
        name: 'select-locadora-aberto',
        run: async (page) => page.getByRole('combobox').first().click(),
      },
      {
        name: 'foco-teclado',
        run: async (page) => {
          for (let i = 0; i < 2; i += 1) await page.keyboard.press('Tab')
        },
      },
      {
        name: 'hover-atalho',
        viewports: ['1440'],
        run: async (page) =>
          hover(page.getByRole('link', { name: /Adicionar Equipamento/ })),
      },
    ],
  },
  {
    id: 'painel/equipamentos',
    origin: APP_ORIGIN,
    path: '/admin/equipamentos',
    states: [
      {
        name: 'select-categoria-aberto',
        run: async (page) =>
          page.getByRole('button', { name: 'Todas as categorias' }).click(),
      },
      {
        // Seletor da barra de filtros (FILTER_FIELD_FRAME) pelo teclado: borda azul e halo, sem o anel do navegador,
        // como na produção (focus:outline-hidden; outline-0 sozinho só dá a largura, styles/outline.web.css).
        name: 'foco-teclado-categoria',
        run: async (page) =>
          focusByKeyboard(
            page,
            page.getByRole('button', { name: 'Todas as categorias' })
          ),
      },
      {
        name: 'hover-cartao',
        viewports: ['1440'],
        run: async (page) =>
          hover(page.getByRole('heading', { name: EQUIPMENTS[1]!.name })),
      },
      {
        name: 'foco-teclado-busca',
        run: async (page) =>
          focusByKeyboard(
            page,
            page.getByRole('textbox', { name: 'Buscar equipamentos...' })
          ),
      },
    ],
  },
  {
    id: 'painel/equipamento-novo',
    origin: APP_ORIGIN,
    path: '/admin/equipamentos/novo',
    states: [
      {
        name: 'select-categoria-aberto',
        run: async (page) =>
          page.getByRole('button', { name: 'Escolha uma categoria' }).click(),
      },
      {
        name: 'checkbox-desativar-diario',
        run: async (page) =>
          page
            .getByRole('checkbox', { name: 'Desativar locação por dia' })
            .click(),
      },
      {
        name: 'switch-disponivel-desligado',
        run: async (page) =>
          page
            .getByRole('switch', {
              name: 'Equipamento disponível para locação',
            })
            .click(),
      },
      {
        name: 'foco-teclado-nome',
        run: async (page) =>
          focusByKeyboard(
            page,
            page.getByRole('textbox', { name: 'Nome do Equipamento *' })
          ),
      },
    ],
  },
  {
    id: 'painel/orcamentos',
    origin: APP_ORIGIN,
    path: '/admin/orcamentos',
    states: [
      {
        name: 'visao-tabela',
        viewports: ['1440'],
        run: async (page) =>
          page.getByRole('button', { name: 'Tabela' }).click(),
      },
      {
        name: 'select-status-aberto',
        run: async (page) =>
          page.getByRole('button', { name: 'Todos os status' }).click(),
      },
      {
        // Diálogo aberto por clique do mouse no nome do cliente (texto não focável): o X recebe o foco inicial por
        // código e não mostra anel.
        name: 'dialog-orcamento-aberto',
        run: async (page) => page.getByText('Construtora Beta').first().click(),
        check: expectNoRingOnInitialFocus,
      },
    ],
  },
  {
    id: 'painel/locacoes',
    origin: APP_ORIGIN,
    path: '/admin/rentals',
    states: [
      {
        name: 'filtro-ativa',
        run: async (page) =>
          page.getByRole('button', { name: 'Filtrar por Ativa' }).click(),
      },
      {
        name: 'visao-calendario',
        viewports: ['1440'],
        run: async (page) =>
          page.getByRole('button', { name: 'Calendário' }).click(),
      },
      {
        name: 'select-periodo-aberto',
        run: async (page) =>
          page.getByRole('button', { name: 'Todos os períodos' }).click(),
      },
    ],
  },
  {
    id: 'painel/financeiro',
    origin: APP_ORIGIN,
    path: '/admin/financeiro',
    states: [
      {
        name: 'aba-dashboard',
        viewports: ['1440'],
        run: async (page) =>
          page.getByRole('button', { name: 'Dashboard' }).click(),
      },
      {
        name: 'checkbox-lancamento',
        viewports: ['1440'],
        // O checkbox fica sob o avatar do cliente e aparece no hover dele, como para o usuário.
        run: async (page) => {
          const checkbox = page.getByRole('checkbox', {
            name: 'Selecionar Construtora Beta',
          })
          await checkbox.scrollIntoViewIfNeeded()
          const box = await checkbox.boundingBox()
          if (!box) throw new Error('checkbox do lançamento sem caixa')
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
          await checkbox.click()
        },
      },
      {
        name: 'dropdown-exportacao-aberto',
        run: async (page) =>
          page
            .getByRole('button', { name: 'Selecionar formato de exportação' })
            .click(),
      },
      {
        name: 'avancadas-select-regime-aberto',
        // O regime fica na seção recolhível "Configurações avançadas".
        run: async (page, settle) => {
          await page
            .getByRole('button', { name: 'Configurações avançadas' })
            .click()
          // A seção abre com transição de altura: o select só abre na posição final.
          await settle()
          await page.getByRole('button', { name: 'Regime' }).click()
        },
      },
    ],
  },
  {
    id: 'painel/configuracoes',
    origin: APP_ORIGIN,
    path: '/admin/settings',
    states: [
      {
        name: 'secao-redes-sociais',
        run: async (page) =>
          page
            .getByRole('button', { name: 'Configurar Redes Sociais' })
            .click(),
      },
      {
        name: 'toast-salvo',
        run: async (page) =>
          page.getByRole('button', { name: 'Salvar Alterações' }).click(),
      },
      {
        name: 'foco-teclado-telefone',
        run: async (page) =>
          focusByKeyboard(
            page,
            page.getByRole('textbox', { name: 'Telefone Fixo' })
          ),
      },
      // Seções novas (onda 134, B10): horário, conteúdo do site, compromissos e textos legais da locadora.
      {
        name: 'secao-horario',
        run: async (page) =>
          page
            .getByRole('button', {
              name: 'Configurar Horário de Funcionamento',
            })
            .click(),
      },
      {
        name: 'secao-conteudo',
        run: async (page) =>
          page
            .getByRole('button', { name: 'Configurar Conteúdo do Site' })
            .click(),
      },
      {
        name: 'secao-compromissos',
        run: async (page) =>
          page
            .getByRole('button', { name: 'Configurar O que você garante' })
            .click(),
      },
      {
        name: 'secao-textos-legais',
        run: async (page) =>
          page
            .getByRole('button', { name: 'Configurar Textos Legais' })
            .click(),
      },
    ],
  },
  {
    id: 'painel/categorias',
    origin: APP_ORIGIN,
    path: '/admin/categorias',
    states: [
      {
        // Diálogo aberto por clique do mouse no botão: o foco inicial não mostra anel.
        name: 'dialog-nova-categoria',
        run: async (page) =>
          page.getByRole('button', { name: 'Nova Categoria' }).click(),
        check: expectNoRingOnInitialFocus,
      },
      {
        name: 'hover-categoria',
        viewports: ['1440'],
        run: async (page) =>
          hover(page.getByRole('button', { name: 'Andaimes' })),
      },
    ],
  },
  ...MISSING_SCENARIOS,
]

/**
 * Interações extras de receitas do /catalog cujo estado só aparece depois de um gesto (`recipe`: a área da receita;
 * `touch`: viewport de toque). Sem coordenadas de ponteiro: a 390 px a linha de receitas estoura a largura e o
 * teste de acerto do Playwright erra o alvo; foco e clique despachado abrem o mesmo estado que o usuário vê.
 */
export const CATALOG_GESTURES: Record<
  string,
  (_recipe: Locator, _touch: boolean) => Promise<void>
> = {
  SonnerToaster: async (recipe) =>
    recipe
      .getByRole('button', { name: 'Mostrar notificação' })
      .dispatchEvent('click'),
  // A dica abre com o foco no gatilho (Radix Tooltip), como no teclado.
  Tooltip: async (recipe) =>
    recipe.getByRole('button', { name: 'Ajuda', exact: true }).focus(),
  HybridTooltip: async (recipe, touch) => {
    // No toque o gatilho é um wrapper (role=button) em volta do botão, que abre no clique; no ponteiro, a dica abre no foco.
    const trigger = recipe.getByRole('button', { name: 'Ajuda híbrida' }).last()
    if (touch) await trigger.dispatchEvent('click')
    else await trigger.focus()
  },
}

export const CATALOG = {
  id: 'labs/catalog',
  origin: APP_ORIGIN,
  path: '/catalog',
}
