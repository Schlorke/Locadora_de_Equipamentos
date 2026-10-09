// Ambiente fixo da linha de base visual (tests/visual). Compartilhado pelo playwright.visual.config.ts, pelo
// backend simulado e pelo spec: portas, hosts, relógio e viewports nunca variam entre execuções.

/** Porta do host web (`next dev` em apps/clients/web) e do backend simulado; faixa reservada 3100-3119. */
export const WEB_PORT = Number(process.env.VISUAL_WEB_PORT ?? 3100)
export const BACKEND_PORT = Number(process.env.VISUAL_BACKEND_PORT ?? 3101)

export const ROOT_DOMAIN = 'localhost'
/** Locadora da vitrine: `loc-a.localhost:<porta>` (adr-tenant-hosts: `{slug}.<raiz>`). */
export const TENANT = Object.freeze({
  id: 'org-visual-a',
  slug: 'loc-a',
  name: 'Locadora Alfa',
  city: 'Porto Alegre',
  state: 'RS',
  logoUrl: null,
})
export const TENANT_ORIGIN = `http://${TENANT.slug}.${ROOT_DOMAIN}:${WEB_PORT}`
/**
 * Locadora com o site em pausa (S13): o cartão responde com o modo PAUSED nos cabeçalhos e o proxy reescreve a vitrine
 * para a página de pausa, com 503 (onda 134: linha de base da pausa antes das páginas legais em pausa).
 */
export const PAUSED_TENANT = Object.freeze({
  id: 'org-visual-p',
  slug: 'loc-p',
  name: 'Locadora Pausada',
  city: 'Curitiba',
  state: 'PR',
  logoUrl: null,
})
export const PAUSED_TENANT_ORIGIN = `http://${PAUSED_TENANT.slug}.${ROOT_DOMAIN}:${WEB_PORT}`
/** Painel e laboratório: `app.<raiz>`. */
export const APP_ORIGIN = `http://app.${ROOT_DOMAIN}:${WEB_PORT}`
export const BACKEND_ORIGIN = `http://127.0.0.1:${BACKEND_PORT}`

/** Relógio do navegador: fixo e pausado; só avança em passos determinísticos (`page.clock.runFor`). */
export const FIXED_TIME = '2026-03-10T15:00:00.000Z'

export const VIEWPORTS = Object.freeze({
  mobile: {
    name: '390',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  },
  desktop: {
    name: '1440',
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
  },
})

/** Ambiente do `next dev`: desenvolvimento, domínio raiz local, laboratório ligado e login de cliente no host de locadora. */
export function webServerEnv() {
  return {
    PLATFORM_ENV: 'development',
    PLATFORM_ROOT_DOMAIN: ROOT_DOMAIN,
    PLATFORM_PUBLIC_PORT: String(WEB_PORT),
    PLATFORM_LABS_ENABLED: 'true',
    WEB_API_ORIGIN: BACKEND_ORIGIN,
    NEXT_PUBLIC_AUTH_MODE: 'better-auth',
    NEXT_TELEMETRY_DISABLED: '1',
    // `localhost` resolve para 127.0.0.1 (a mesma interface em que o Chromium encontra `*.localhost`).
    NODE_OPTIONS: '--dns-result-order=ipv4first',
  }
}
