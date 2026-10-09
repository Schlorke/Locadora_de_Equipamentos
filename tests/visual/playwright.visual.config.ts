/**
 * Linha de base visual do web (tests/visual/README.md): Chromium no host `apps/clients/web` em `next dev`, com a
 * vitrine em `loc-a.localhost` e o painel/laboratório em `app.localhost`, APIs simuladas e relógio fixo.
 *
 *   pnpm exec playwright test -c tests/visual/playwright.visual.config.ts   # captura em .tmp/visual/current
 *   node tools/visual-baseline/compare.mjs                                    # compara com tests/visual/baseline
 *
 * Portas 3100 (web) e 3101 (backend simulado), faixa reservada 3100-3119. `VISUAL_REUSE_SERVERS=1` reaproveita
 * servidores já no ar nessas portas (iteração local); sem ela, os dois são iniciados e encerrados aqui.
 *
 * Fica em tests/ (raiz não-runtime do arch.config.json): na raiz do repositório o `pnpm arch` exigiria uma
 * classificação nova. Caminhos relativos partem desta pasta.
 */
import { defineConfig } from 'playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BACKEND_PORT,
  VIEWPORTS,
  WEB_PORT,
  webServerEnv,
} from './support/env.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(here, '..', '..')

const reuseExistingServer = process.env.VISUAL_REUSE_SERVERS === '1'

export default defineConfig({
  testDir: here,
  testMatch: /\.spec\.ts$/,
  outputDir: path.join(repositoryRoot, '.tmp', 'visual', 'test-results'),
  // Um navegador por vez: o `next dev` compila rotas sob demanda e a ordem precisa ser estável.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30 * 60_000,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    headless: true,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'light',
    // Animações desligadas pelo próprio produto: carrosséis e revelações respeitam `prefers-reduced-motion`
    // (inclusive o bloco @media de movimento reduzido do CSS global, a exceção do css-important).
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
    // Um alvo que não aparece falha em 30 s em vez de esperar o timeout do teste.
    actionTimeout: 30_000,
    launchOptions: {
      // `*.localhost` sempre no loopback IPv4 do `next dev`; texto sem LCD/hinting para screenshots estáveis.
      args: [
        '--host-resolver-rules=MAP *.localhost 127.0.0.1',
        '--font-render-hinting=none',
        '--disable-lcd-text',
        '--force-color-profile=srgb',
      ],
    },
  },
  projects: [
    {
      name: VIEWPORTS.mobile.name,
      use: {
        viewport: VIEWPORTS.mobile.viewport,
        isMobile: VIEWPORTS.mobile.isMobile,
        hasTouch: VIEWPORTS.mobile.hasTouch,
      },
    },
    {
      name: VIEWPORTS.desktop.name,
      use: {
        viewport: VIEWPORTS.desktop.viewport,
        isMobile: VIEWPORTS.desktop.isMobile,
        hasTouch: VIEWPORTS.desktop.hasTouch,
      },
    },
  ],
  webServer: [
    {
      command: 'node support/mock-backend.mjs',
      cwd: here,
      url: `http://127.0.0.1:${BACKEND_PORT}/__visual/health`,
      reuseExistingServer,
      stdout: 'pipe',
      timeout: 30_000,
    },
    {
      // `localhost` como hostname: o proxy reescreve para `http://localhost:<porta>/…`, que precisa ser a origem do
      // próprio servidor para o Next tratar o rewrite como interno (com outro hostname ele vira proxy externo e trava).
      command: `node ../../../tools/sync-web-public.mjs && node node_modules/next/dist/bin/next dev --port ${WEB_PORT} --hostname localhost`,
      cwd: path.join(repositoryRoot, 'apps', 'clients', 'web'),
      env: webServerEnv(),
      // IP literal em development é o host `app`: `/` responde 307 para /admin quando o servidor está pronto.
      url: `http://127.0.0.1:${WEB_PORT}/`,
      reuseExistingServer,
      stdout: 'pipe',
      timeout: 5 * 60_000,
    },
  ],
})
