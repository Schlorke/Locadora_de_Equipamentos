/**
 * Linha de base visual do web atual (antes da refatoração de CSS). Para cada rota e viewport grava o estilo
 * computado de cada elemento visível (tests/visual/support/capture.ts) e os estados interativos que o CSS global
 * mira; screenshots de apoio ficam na pasta de saída, fora do versionamento.
 *
 *   pnpm exec playwright test -c tests/visual/playwright.visual.config.ts            (saída: .tmp/visual/current)
 *   VISUAL_OUT=<pasta> pnpm exec playwright test -c tests/visual/playwright.visual.config.ts
 *   node tools/visual-baseline/compare.mjs --current <pasta>
 *
 * Determinismo: APIs simuladas (fixtures.mjs), relógio pausado que só avança em passos fixos, Math.random com
 * semente, animações CSS/WAAPI encerradas e o carrossel 3D preso no placeholder (os chunks de three.js ficam sem
 * resposta; o componente não é alterado).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type Request,
  type TestInfo,
} from 'playwright/test'
import { catalog } from '../../packages/ui/src/catalog'
import {
  captureInPage,
  freezeAnimations,
  installDeterminism,
  mutationCount,
  type CaptureFile,
  type CaptureScope,
  type CapturedElement,
} from './support/capture'
import {
  APP_ORIGIN,
  FIXED_TIME,
  PAUSED_TENANT_ORIGIN,
  TENANT_ORIGIN,
} from './support/env.mjs'
import { apiResponse } from './support/fixtures.mjs'
import {
  CATALOG,
  CATALOG_GESTURES,
  SCENARIOS,
  type Scenario,
  type ViewportName,
  type VisualSession,
} from './support/scenarios'
import { writeCaptureFile } from '../../tools/visual-baseline/format.mjs'
import { createHeavyChunkMatcher } from './support/heavy-chunks.mjs'
import { isVisualRscPrefetch } from './support/prefetch.mjs'
import {
  assertFullCatalogCaptures,
  parseCatalogRecipeFilter,
} from './support/catalog-recipes.mjs'

const REPOSITORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
const OUT = path.resolve(
  REPOSITORY,
  process.env.VISUAL_OUT ?? path.join('.tmp', 'visual', 'current')
)
const STEP_MS = 500
/** A mesma dependência 3D retida no dev e no build declarado: placeholder, sem alterar Canvas/produto. */
const isHeavyChunk = createHeavyChunkMatcher()
const HOSTS = new Set([
  new URL(TENANT_ORIGIN).host,
  new URL(PAUSED_TENANT_ORIGIN).host,
  new URL(APP_ORIGIN).host,
])
const SCREENSHOT_STYLE = 'nextjs-portal { display: none; }'

interface Prepared {
  context: BrowserContext
  page: Page
  unmapped: Set<string>
  idle: () => Promise<void>
  /** Esperas que esgotaram sem a página parar (registradas no arquivo; a comparação dupla mostra se importam). */
  unstable: number
}

async function prepare(
  browser: Browser,
  testInfo: TestInfo,
  origin: string,
  localStorage?: Record<string, string>,
  sessionOverride?: VisualSession
): Promise<Prepared> {
  const use = testInfo.project.use
  const context = await browser.newContext({
    viewport: use.viewport ?? null,
    isMobile: use.isMobile,
    hasTouch: use.hasTouch,
    deviceScaleFactor: use.deviceScaleFactor,
    locale: use.locale,
    timezoneId: use.timezoneId,
    colorScheme: use.colorScheme,
    reducedMotion: use.reducedMotion,
    serviceWorkers: 'block',
  })
  await installDeterminism(context, localStorage)
  const unmapped = new Set<string>()
  const session: VisualSession =
    sessionOverride ??
    (new URL(origin).host === new URL(APP_ORIGIN).host ? 'admin' : 'anonymous')
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (!HOSTS.has(url.host)) return route.abort('blockedbyclient')
    if (
      isVisualRscPrefetch({
        production: process.env.VISUAL_CAPTURE_MODE === 'production',
        method: request.method(),
        resourceType: request.resourceType(),
        isNavigationRequest: request.isNavigationRequest(),
        pathname: url.pathname,
        headers: request.headers(),
      })
    ) {
      testInfo.annotations.push({
        type: 'aborted-prefetch',
        description: `GET ${url.pathname} (rsc, next-router-prefetch)`,
      })
      return route.abort('blockedbyclient')
    }
    if (url.pathname.startsWith('/api/')) {
      const answer = apiResponse({
        method: request.method(),
        pathname: url.pathname,
        session,
      })
      if (!answer) unmapped.add(`${request.method()} ${url.pathname}`)
      // Os dados só chegam com as fontes carregadas: medições de texto (gráficos, quebras) usam sempre a fonte
      // final, e não a de fallback conforme a corrida entre a rede das fontes e a resposta simulada.
      try {
        await request
          .frame()
          .evaluate(() =>
            Promise.all(
              Array.from(document.fonts, (face) =>
                face.load().catch(() => undefined)
              )
            ).then(() => undefined)
          )
      } catch {
        /* quadro navegando ou fechado: responde sem esperar */
      }
      return route.fulfill({
        status: answer?.status ?? 404,
        ...(answer?.headers ? { headers: answer.headers } : {}),
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(
          answer ? answer.body : { error: 'visual: sem fixture' }
        ),
      })
    }
    // Nunca respondidos: o import dinâmico do carrossel 3D não termina.
    if (isHeavyChunk(url.pathname)) return
    if (url.pathname === '/sw.js')
      return route.fulfill({ status: 404, body: '' })
    return route.continue()
  })
  const page = await context.newPage()
  const inflight = new Set<string>()
  const pendingFacts = new Map<string, object>()
  const track = (request: Request) => {
    const url = request.url()
    if (!url.startsWith('data:') && !isHeavyChunk(new URL(url).pathname)) {
      inflight.add(url)
      const headers = request.headers()
      const bounded = (value: string | undefined) =>
        value === undefined
          ? null
          : /^[0-9]{1,2}$/.test(value)
            ? value
            : 'present'
      pendingFacts.set(url, {
        pathname: new URL(url).pathname,
        method: request.method(),
        resourceType: request.resourceType(),
        isNavigationRequest: request.isNavigationRequest(),
        rsc: bounded(headers.rsc),
        prefetch: bounded(headers['next-router-prefetch']),
        segmentPrefetch: headers['next-router-segment-prefetch'] !== undefined,
      })
    }
  }
  page.on('request', track)
  page.on('requestfinished', (request) => inflight.delete(request.url()))
  page.on('requestfailed', (request) => inflight.delete(request.url()))
  page.on('pageerror', (error) =>
    testInfo.annotations.push({
      type: 'pageerror',
      description: error.message.slice(0, 200),
    })
  )
  const idle = async () => {
    const deadline =
      Date.now() + (process.env.VISUAL_DIAGNOSTICS === '1' ? 20_000 : 180_000)
    let quietSince = 0
    for (;;) {
      if (inflight.size === 0) {
        if (!quietSince) quietSince = Date.now()
        if (Date.now() - quietSince >= 60) return
      } else quietSince = 0
      if (Date.now() > deadline) {
        testInfo.annotations.push({
          type: 'pending-network',
          description: JSON.stringify(
            [...inflight].slice(0, 5).map((url) => pendingFacts.get(url))
          ),
        })
        throw new Error(
          `rede não ficou ociosa: ${[...inflight].slice(0, 5).join(', ')}`
        )
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }
  const start = Date.parse(FIXED_TIME)
  await page.clock.install({ time: start })
  await page.clock.pauseAt(start + 1000)
  return { context, page, unmapped, idle, unstable: 0 }
}

/**
 * Espera a página parar em tempo real com o relógio falso parado: rede ociosa, animações do compositor encerradas
 * (transitionend dispara agora, não depois) e nenhuma mutação do DOM por uma janela. Assim cada passo do relógio
 * começa do mesmo estado, qualquer que seja a velocidade da rede, da compilação do `next dev` ou dos observers.
 */
async function quiet(prepared: Prepared) {
  const { page, idle } = prepared
  for (let round = 0; round < 200; round += 1) {
    await idle()
    const before = await mutationCount(page)
    const frozen = await freezeAnimations(page)
    await page.waitForTimeout(80)
    await idle()
    if (frozen === 0 && (await mutationCount(page)) === before) return
  }
  prepared.unstable += 1
}

/** Avança o relógio falso em passos fixos; antes de cada passo e no fim, a página precisa estar parada. */
async function settle(prepared: Prepared, steps: number) {
  for (let step = 0; step < steps; step += 1) {
    await quiet(prepared)
    await prepared.page.clock.runFor(STEP_MS)
  }
  await prepared.page.evaluate(async () => {
    await document.fonts.ready
  })
  await quiet(prepared)
}

async function open(prepared: Prepared, url: string, status?: number) {
  const response = await prepared.page.goto(url, {
    // The intentionally unresolved lazy 3D import may precede window.load.
    // Explicit idle/fonts/DOM settling below still waits for every other resource.
    waitUntil: 'domcontentloaded',
    timeout: 300_000,
  })
  // A pausa responde 503 de propósito (S13); o resto, sempre abaixo de 400.
  if (
    !response ||
    (status === undefined
      ? response.status() >= 400
      : response.status() !== status)
  )
    throw new Error(`${url} respondeu ${response?.status()}`)
  await settle(prepared, 8)
}

const capture = (page: Page, scope: CaptureScope) =>
  page.evaluate(captureInPage, scope)

function delta(base: CapturedElement[], state: CapturedElement[]) {
  const before = new Map(
    base.map(([key, , style]) => [key, JSON.stringify(style)])
  )
  const present = new Set(state.map(([key]) => key))
  return {
    changed: state.filter(
      ([key, , style]) => before.get(key) !== JSON.stringify(style)
    ),
    removed: base.map(([key]) => key).filter((key) => !present.has(key)),
  }
}

function outputPaths(viewport: string, id: string) {
  return {
    json: path.join(OUT, viewport, `${id}.json`),
    shots: path.join(OUT, 'screenshots', viewport, id),
  }
}

async function shoot(page: Page, file: string, fullPage: boolean) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await page.screenshot({
    path: file,
    fullPage,
    style: SCREENSHOT_STYLE,
    animations: 'disabled',
    caret: 'hide',
    ...(file.endsWith('.jpg') ? { type: 'jpeg', quality: 70 } : {}),
  })
}

/**
 * Roda na página: clica o botão de texto `text` na linha de botões da receita (`recipes`: a linha com todas as
 * receitas) ou na linha cujos botões são exatamente os estados informados.
 */
function clickRecipeButton({
  row,
  text,
}: {
  row: 'recipes' | string[]
  text: string
}) {
  const rows = Array.from(document.querySelectorAll('div')).filter(
    (candidate) =>
      candidate.children.length > 0 &&
      Array.from(candidate.children).every(
        (child) => child.tagName === 'BUTTON'
      )
  )
  const target =
    row === 'recipes'
      ? rows.find((candidate) => candidate.children.length >= 60)
      : rows.find(
          (candidate) =>
            candidate.children.length === row.length &&
            Array.from(candidate.children).every(
              (child, index) => child.textContent === row[index]
            )
        )
  const button = Array.from(target?.children ?? []).find(
    (child) => child.textContent === text
  ) as HTMLElement | undefined
  if (!button) throw new Error(`botão "${text}" não encontrado no /catalog`)
  button.click()
}

function runScenario(scenario: Scenario) {
  test(scenario.id, async ({ browser }, testInfo) => {
    const viewport = testInfo.project.name as ViewportName
    const url = scenario.origin + scenario.path
    const { json, shots } = outputPaths(viewport, scenario.id)
    const file: CaptureFile = {
      version: 1,
      scenario: scenario.id,
      viewport,
      url,
      captures: {},
      unmappedApis: [],
      unstableWaits: 0,
    }
    const unmapped = new Set<string>()

    const base = await prepare(
      browser,
      testInfo,
      scenario.origin,
      scenario.localStorage,
      scenario.session
    )
    await open(base, url, scenario.status)
    // Mesmo tempo de relógio dos estados (que acomodam a interação em 4 passos): o que muda com o tempo
    // (texto rotativo, contadores) fica igual e o delta mostra só a interação.
    await settle(base, 4)
    const baseElements = await capture(base.page, { kind: 'document' })
    file.captures.base = { kind: 'full', elements: baseElements }
    await shoot(base.page, path.join(shots, 'base.png'), true)
    base.unmapped.forEach((entry) => unmapped.add(entry))
    file.unstableWaits += base.unstable
    await base.context.close()

    for (const state of scenario.states) {
      if (state.viewports && !state.viewports.includes(viewport)) continue
      const prepared = await prepare(
        browser,
        testInfo,
        scenario.origin,
        scenario.localStorage,
        scenario.session
      )
      await open(prepared, url, scenario.status)
      await state.run(prepared.page, () => settle(prepared, 1))
      await settle(prepared, 4)
      await state.check?.(prepared.page)
      const elements = await capture(prepared.page, { kind: 'document' })
      file.captures[`estado:${state.name}`] = {
        kind: 'delta',
        of: 'base',
        ...delta(baseElements, elements),
      }
      await shoot(prepared.page, path.join(shots, `${state.name}.jpg`), false)
      prepared.unmapped.forEach((entry) => unmapped.add(entry))
      file.unstableWaits += prepared.unstable
      await prepared.context.close()
    }
    file.unmappedApis = [...unmapped].sort()
    writeCaptureFile(json, file)
  })
}

test.describe('linha de base visual', () => {
  for (const scenario of SCENARIOS) runScenario(scenario)

  test(CATALOG.id, async ({ browser }, testInfo) => {
    const viewport = testInfo.project.name as ViewportName
    const url = CATALOG.origin + CATALOG.path
    const { json, shots } = outputPaths(viewport, CATALOG.id)
    const file: CaptureFile = {
      version: 1,
      scenario: CATALOG.id,
      viewport,
      url,
      captures: {},
      unmappedApis: [],
      unstableWaits: 0,
    }
    const unmapped = new Set<string>()

    // Aquecimento descartado: a primeira página deste viewport com o menu do usuário logado no cabeçalho
    // público compila sob demanda o que as rotas anteriores não pediram.
    const warmUp = await prepare(browser, testInfo, CATALOG.origin)
    await open(warmUp, url)
    await warmUp.context.close()

    const shell = await prepare(browser, testInfo, CATALOG.origin)
    await open(shell, url)
    // Mesmo tempo de relógio das bases das rotas.
    await settle(shell, 4)
    file.captures.base = {
      kind: 'full',
      elements: await capture(shell.page, { kind: 'document' }),
    }
    await shoot(shell.page, path.join(shots, 'base.png'), true)
    shell.unmapped.forEach((entry) => unmapped.add(entry))
    file.unstableWaits += shell.unstable
    await shell.context.close()

    // Cada receita numa navegação nova; os estados trocam pelo botão (a receita remonta pela `key`).
    // VISUAL_CATALOG_RECIPES=Button,Dialog restringe a iteração (depuração); a comparação acusa o que faltar.
    const only = parseCatalogRecipeFilter(process.env.VISUAL_CATALOG_RECIPES)
    for (const [recipe, entry] of Object.entries(catalog)) {
      if (only?.length && !only.includes(recipe)) continue
      const prepared = await prepare(browser, testInfo, CATALOG.origin)
      await open(prepared, url)
      for (const state of entry.states) {
        // Botão da receita (volta ao primeiro estado) e depois o do estado; a receita remonta pela `key`.
        await prepared.page.evaluate(clickRecipeButton, {
          row: 'recipes' as const,
          text: entry.title,
        })
        await settle(prepared, 1)
        await prepared.page.evaluate(clickRecipeButton, {
          row: [...entry.states],
          text: state,
        })
        await settle(prepared, 3)
        const marker = `${recipe} / ${state}`
        // Toda receita é capturada com o título do estado no topo da tela: a mesma rolagem em todos os estados (e
        // nenhuma rolagem depois de abrir uma dica, que o Radix fecharia).
        await prepared.page
          .getByText(marker, { exact: true })
          .evaluate((element) =>
            element.scrollIntoView({ block: 'start', behavior: 'instant' })
          )
        await settle(prepared, 1)
        const gesture = CATALOG_GESTURES[recipe]
        if (gesture) {
          await gesture(
            prepared.page
              .getByText(marker, { exact: true })
              .locator('xpath=following-sibling::*[1]'),
            testInfo.project.use.hasTouch === true
          )
          await settle(prepared, 3)
        }
        file.captures[`receita:${recipe}/${state}`] = {
          kind: 'scoped',
          elements: await capture(prepared.page, { kind: 'recipe', marker }),
        }
        await shoot(
          prepared.page,
          path.join(shots, `${recipe}--${state}.jpg`),
          false
        )
        // Fecha o que ficou aberto (menus, diálogos) antes do próximo estado.
        await prepared.page.keyboard.press('Escape')
      }
      prepared.unmapped.forEach((item) => unmapped.add(item))
      file.unstableWaits += prepared.unstable
      await prepared.context.close()
    }
    file.unmappedApis = [...unmapped].sort()
    if (!only?.length) assertFullCatalogCaptures(file.captures, catalog)
    writeCaptureFile(json, file)
  })
})
