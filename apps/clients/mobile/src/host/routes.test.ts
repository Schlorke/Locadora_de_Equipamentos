import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// Mesmo construtor de árvore que o expo-router usa em runtime (puro, sem React Native).
import { getRoutes } from 'expo-router/build/getRoutesCore'
import { stripGroupSegmentsFromPath } from 'expo-router/build/matchers'
// @ts-expect-error -- módulo CommonJS interno do expo-router sem declaração de tipos; é o filtro real do require.context.
import { EXPO_ROUTER_CTX_IGNORE } from 'expo-router/_ctx-shared'

const appDir = join(import.meta.dirname, '..', 'app')
// O require.context do expo-router só vê o que está no mapa de arquivos do Metro: a blockList do app fica de fora.
const metroBlockList: RegExp[] = [
  createRequire(import.meta.url)('../../metro.config.js').resolver.blockList,
].flat()
const inMetroFileMap = (key: string) =>
  !metroBlockList.some((pattern) => pattern.test(join(appDir, key)))

function contextKeys(dir: string, prefix = '.'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? contextKeys(dir + '/' + entry.name, prefix + '/' + entry.name)
      : [prefix + '/' + entry.name]
  )
}

interface Node {
  type: string
  route: string
  contextKey: string
  children: Node[]
  generated?: boolean
}
const filesInApp = contextKeys(appDir)
const keys = filesInApp
  .filter((key) => EXPO_ROUTER_CTX_IGNORE.test(key) && inMetroFileMap(key))
  .sort()
const context = Object.assign(() => ({ default: () => null }), {
  keys: () => keys,
  resolve: (key: string) => key,
  id: 'app',
})
const tree = getRoutes(context as never, {
  platform: 'android',
  ignoreEntryPoints: true,
  getSystemRoute: ({ route, type }: { route: string; type: string }) =>
    ({
      type,
      route,
      contextKey: 'system:' + route,
      children: [],
      dynamic: null,
      loadRoute: () => ({}),
    }) as never,
}) as unknown as Node

const screens = tree.children.filter(
  (node) => node.type === 'route' && !node.contextKey.startsWith('system:')
)
const toUrl = (route: string) =>
  '/' + stripGroupSegmentsFromPath(route).replace(/(^|\/)index$/, '')
const urls = screens
  .filter((node) => node.route !== '+not-found')
  .map((node) => toUrl(node.route))
  .sort()

// URLs do host web (apps/clients/web/src/app) que o app cobre, mais os destinos pós-login.
const WEB_MIRROR = {
  '(public)': [
    '/',
    '/api-docs',
    '/contato',
    '/cookies',
    '/equipamentos',
    '/equipamentos/[id]',
    '/orcamento',
    '/politica-devolucao',
    '/privacidade',
    '/termos',
  ],
  '(auth)': [
    '/admin/login',
    '/auth/callback',
    '/cadastro',
    '/entrar',
    '/login',
    '/recuperar-senha',
    '/reset-password',
  ],
  '(admin)': [
    '/admin/assinatura',
    '/admin',
    '/admin/dashboard',
    '/admin/permissions',
    '/admin/settings',
    '/admin/email',
    '/admin/whatsapp',
    '/admin/categorias',
    '/admin/rentals',
    '/admin/financeiro',
    '/admin/logistics',
    '/admin/maintenance',
    '/admin/orcamentos',
    '/admin/orcamentos/[id]',
    '/admin/equipamentos',
    '/admin/equipamentos/[id]',
    '/admin/equipamentos/novo',
    '/admin/equipamentos/[id]/editar',
  ],
  '(account)': [
    '/area-cliente',
    '/area-cliente/perfil',
    '/area-cliente/enderecos',
    '/area-cliente/notificacoes',
    '/area-cliente/historico',
    '/area-cliente/historico/[id]',
  ],
  '(labs)': [
    '/admin/teste-toast',
    '/catalog',
    '/grid-motion',
    '/playground/icon-customization',
  ],
}

describe('topologia de rotas do host Expo', () => {
  it('o expo-router aceita a árvore com um único layout raiz', () => {
    expect(tree.type).toBe('layout')
    expect(tree.contextKey).toBe('./_layout.tsx')
    expect(keys.filter((key) => key.endsWith('_layout.tsx'))).toEqual([
      './_layout.tsx',
    ])
  })

  it('cada tela fica no grupo do host web e responde pela mesma URL', () => {
    for (const [group, groupUrls] of Object.entries(WEB_MIRROR)) {
      const inGroup = screens
        .filter((node) => node.route.startsWith(group + '/'))
        .map((node) => toUrl(node.route))
        .sort()
      expect(inGroup, group).toEqual([...groupUrls].sort())
    }
    expect(urls).toEqual(Object.values(WEB_MIRROR).flat().sort())
  })

  it('nenhuma URL é servida por dois arquivos', () => {
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('as telas planas antigas não existem mais', () => {
    for (const legacy of [
      '/admin-login',
      '/admin-entrada',
      '/admin-permissions',
      '/admin-teste-toast',
      '/auth-callback',
      '/playground-icon-customization',
    ]) {
      expect(urls).not.toContain(legacy)
    }
  })

  it('testes ao lado das rotas ficam fora do mapa de arquivos do Metro e não viram tela', () => {
    const colocatedTests = filesInApp.filter((key) =>
      /\.(test|spec)\.[cm]?[jt]sx?$/.test(key)
    )
    expect(colocatedTests).toContain('./_layout.test.tsx')
    for (const key of colocatedTests) {
      // Sem a blockList, o filtro do require.context aceitaria o arquivo como rota.
      expect(EXPO_ROUTER_CTX_IGNORE.test(key), key).toBe(true)
      expect(inMetroFileMap(key), key).toBe(false)
      expect(keys, key).not.toContain(key)
    }
  })

  it('+not-found é a tela do app, não a gerada pelo roteador', () => {
    expect(
      screens.find((node) => node.route === '+not-found')?.contextKey
    ).toBe('./+not-found.tsx')
  })

  it('destinos de redirecionamento e o deep link do login social apontam para rotas existentes', () => {
    for (const href of [
      '/auth/callback',
      '/login',
      '/admin',
      '/admin/login',
      '/admin/dashboard',
      '/area-cliente',
      '/',
    ]) {
      expect(urls, href).toContain(href)
    }
  })
})
