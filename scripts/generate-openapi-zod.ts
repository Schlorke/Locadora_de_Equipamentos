#!/usr/bin/env tsx
/**
 * Especificação OpenAPI da API compartilhada (onda 135, C5; E15 do plano de aposentadoria da raiz legada).
 *
 * 1. Converte os esquemas públicos de `@gb-locacoes/contracts/openapi` em JSON Schema (OpenAPI 3.0) e grava
 *    `packages/contracts/src/openapi/public-schemas.json`, que o next-openapi-gen lê como `schemaFiles`: a conversão
 *    do próprio Zod preserva os esquemas herdados (`.extend`), que a inferência estática da CLI perde.
 * 2. Roda o next-openapi-gen com o `next.openapi.json` da raiz (rotas de `apps/services/api`, esquemas de
 *    `packages/contracts`, saída em `public/openapi.json`). Os caminhos do arquivo são relativos à raiz do
 *    repositório; aqui eles viram absolutos e a CLI roda com o diretório do serviço como `cwd`, porque ela também
 *    varre `<cwd>/app/api` e `<cwd>/src/app/api` além do `apiDir`: na raiz, isso leria as rotas da raiz legada.
 *    O cache em disco da CLI fica desligado (OPENAPI_GEN_CACHE=0) para a saída depender só do código atual: o
 *    cache não acompanha os tipos de packages/backend que a inferência de resposta lê.
 *
 * Uso: pnpm openapi:generate [--check | --watch]
 *   --check  gera numa pasta temporária, compara com os dois arquivos versionados (o mesmo JSON em forma canônica:
 *            sem depender do fim de linha, da ordem das chaves nem da ordem dos arrays) e sai com 1 se diferirem;
 *            não regrava nada no repositório.
 *   --watch  regenera a especificação a cada mudança (pnpm openapi:dev).
 */
import { spawnSync, type SpawnSyncOptions } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import * as publicSchemas from '@gb-locacoes/contracts/openapi'
import { stabilizeOpenApiSymbols } from './openapi-symbols.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = path.join(ROOT, 'next.openapi.json')
const SERVICE = path.join(ROOT, 'apps/services/api')
/** O bin declarado pelo próprio pacote (a dependência de desenvolvimento da raiz). */
const CLI = (() => {
  const manifest = fileURLToPath(
    import.meta.resolve('next-openapi-gen/package.json')
  )
  const { bin } = JSON.parse(fs.readFileSync(manifest, 'utf8')) as {
    bin: Record<string, string>
  }
  return path.join(path.dirname(manifest), bin['next-openapi-gen']!)
})()
/** Pasta de trabalho da CLI na raiz (manifesto de diagnósticos), já coberta pelo .gitignore. */
const WORKSPACE = path.join(ROOT, '.openapi-gen')

type GeneratorConfig = Record<string, unknown> & {
  apiDir: string
  schemaDir: string[]
  schemaFiles: string[]
  outputDir: string
  outputFile: string
}

const slash = (file: string) => file.split(path.sep).join('/')
const fromRoot = (file: string) => slash(path.resolve(ROOT, file))

function readConfig(): GeneratorConfig {
  return JSON.parse(fs.readFileSync(CONFIG, 'utf8')) as GeneratorConfig
}

/** O JSON Schema de cada esquema público, no formato `components.schemas` que a CLI aceita em `schemaFiles`. */
function publicSchemaDocument(): string {
  const schemas = Object.fromEntries(
    Object.entries(publicSchemas).map(([name, schema]) => [
      name,
      z.toJSONSchema(schema, {
        target: 'openapi-3.0',
        io: 'input',
        unrepresentable: 'any',
      }),
    ])
  )
  return JSON.stringify({ components: { schemas } }, null, 2) + '\n'
}

/**
 * A configuração da CLI com os caminhos absolutos. `schemaFile` troca o arquivo de esquemas versionado pelo gerado
 * agora (modo --check); `outputDir` e `workspace` mandam a saída e o manifesto para outra pasta.
 */
function absoluteConfig(
  config: GeneratorConfig,
  target: { outputDir: string; workspace: string; schemaFile?: string }
): GeneratorConfig {
  const [versionedSchemas] = config.schemaFiles
  return {
    ...config,
    apiDir: fromRoot(config.apiDir),
    schemaDir: config.schemaDir.map(fromRoot),
    schemaFiles: config.schemaFiles.map((file) =>
      target.schemaFile && file === versionedSchemas
        ? slash(target.schemaFile)
        : fromRoot(file)
    ),
    outputDir: slash(target.outputDir),
    generatedDir: slash(target.workspace),
  }
}

/** Roda a CLI a partir do diretório do serviço com a configuração gravada em `configFile`. */
function runCli(
  configFile: string,
  extra: string[],
  stdio: SpawnSyncOptions['stdio']
) {
  const result = spawnSync(
    process.execPath,
    [CLI, 'generate', '--config', slash(configFile), ...extra],
    {
      cwd: SERVICE,
      stdio,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, OPENAPI_GEN_CACHE: '0' },
    }
  )
  if (result.error) throw result.error
  return result
}

/** The public documentBuilt hook runs before every write, including each --watch generation. */
function writeCliConfig(configFile: string, config: GeneratorConfig) {
  const normalizer = import.meta.resolve('./openapi-symbols.mjs')
  fs.writeFileSync(
    configFile,
    `import { stabilizeOpenApiSymbols } from ${JSON.stringify(normalizer)}\n` +
      `const config = ${JSON.stringify(config, null, 2)}\n` +
      'config.hooks = { documentBuilt({ document }) {\n' +
      '  Object.assign(document, stabilizeOpenApiSymbols(document))\n' +
      '} }\nexport default config\n'
  )
}

/**
 * Forma canônica para o --check: chaves em ordem e cada array como conjunto. Em OpenAPI, `anyOf`, `enum`,
 * `required`, `parameters` e `tags` não dependem da ordem, e a ordem dos membros de uma união inferida pelo
 * TypeScript pode variar entre plataformas (a CI roda em Linux); conteúdo diferente continua diferente.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value))
    return value
      .map((item) => {
        const normalized = canonical(item)
        return [JSON.stringify(normalized), normalized] as const
      })
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, normalized]) => normalized)
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])])
    )
  return value
}
const sameDocument = (a: unknown, b: unknown) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

/** Operações (método + caminho) de uma especificação, para o resumo de diferença do --check. */
function operations(document: unknown): string[] {
  const paths =
    (document as { paths?: Record<string, Record<string, unknown>> }).paths ??
    {}
  return Object.entries(paths).flatMap(([route, item]) =>
    Object.keys(item).map((method) => `${method.toUpperCase()} ${route}`)
  )
}

function describeDifference(fresh: unknown, versioned: unknown): string[] {
  const now = new Set(operations(fresh))
  const before = new Set(operations(versioned))
  const lines = [
    ...[...now].filter((op) => !before.has(op)).map((op) => `  + ${op}`),
    ...[...before].filter((op) => !now.has(op)).map((op) => `  - ${op}`),
  ]
  const freshPaths = (fresh as { paths?: Record<string, unknown> }).paths ?? {}
  const versionedPaths =
    (versioned as { paths?: Record<string, unknown> }).paths ?? {}
  for (const route of Object.keys(freshPaths))
    if (
      route in versionedPaths &&
      !sameDocument(freshPaths[route], versionedPaths[route])
    )
      lines.push(`  ~ ${route}`)
  return lines.length > 0 ? lines : ['  ~ (fora de paths)']
}

function removeCheckFolder(folder: string) {
  // Só arquivos que esta execução criou, um por um; nada recursivo (AGENTS.md, regra 7).
  for (const entry of fs.readdirSync(folder, { withFileTypes: true }))
    if (entry.isFile()) fs.unlinkSync(path.join(folder, entry.name))
  try {
    fs.rmdirSync(folder)
  } catch {
    console.warn(`Pasta temporária mantida (não estava vazia): ${folder}`)
  }
}

function check(config: GeneratorConfig): number {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-openapi-check-'))
  try {
    const schemaFile = path.join(folder, 'public-schemas.json')
    fs.writeFileSync(schemaFile, publicSchemaDocument())
    const configFile = path.join(folder, 'next.openapi.mjs')
    writeCliConfig(
      configFile,
      absoluteConfig(config, {
        outputDir: folder,
        workspace: folder,
        schemaFile,
      })
    )
    const result = runCli(configFile, [], 'pipe')
    if (result.status !== 0) {
      process.stdout.write(String(result.stdout ?? ''))
      process.stderr.write(String(result.stderr ?? ''))
      console.error('openapi:generate --check: a geração falhou.')
      return result.status ?? 1
    }
    const pairs = [
      [schemaFile, path.resolve(ROOT, config.schemaFiles[0]!)],
      [
        path.join(folder, config.outputFile),
        path.resolve(ROOT, config.outputDir, config.outputFile),
      ],
    ] as const
    let stale = 0
    for (const [generated, versioned] of pairs) {
      const fresh = JSON.parse(fs.readFileSync(generated, 'utf8')) as unknown
      if (!sameDocument(fresh, stabilizeOpenApiSymbols(fresh)))
        throw new Error(
          'OpenAPI generation left unstable TypeScript symbol names.'
        )
      const current = fs.existsSync(versioned)
        ? (JSON.parse(fs.readFileSync(versioned, 'utf8')) as unknown)
        : null
      if (current !== null && sameDocument(fresh, current)) continue
      stale++
      console.error(
        `${slash(path.relative(ROOT, versioned))} difere do que as rotas geram:`
      )
      console.error(
        current === null
          ? '  (arquivo ausente)'
          : describeDifference(fresh, current).join('\n')
      )
    }
    if (stale > 0) {
      console.error('Rode pnpm openapi:generate e versione o resultado.')
      return 1
    }
    console.log(
      `OpenAPI em dia: ${slash(path.relative(ROOT, pairs[1][1]))} e ` +
        `${slash(path.relative(ROOT, pairs[0][1]))} saem de ${config.apiDir.replace(/^\.\//, '')}.`
    )
    return 0
  } finally {
    removeCheckFolder(folder)
  }
}

function generate(config: GeneratorConfig, watch: boolean): number {
  fs.writeFileSync(
    path.resolve(ROOT, config.schemaFiles[0]!),
    publicSchemaDocument()
  )
  fs.mkdirSync(WORKSPACE, { recursive: true })
  const configFile = path.join(WORKSPACE, 'next.openapi.service.mjs')
  writeCliConfig(
    configFile,
    absoluteConfig(config, {
      outputDir: path.resolve(ROOT, config.outputDir),
      workspace: WORKSPACE,
    })
  )
  console.log(
    `OpenAPI a partir de ${config.apiDir.replace(/^\.\//, '')} (cwd ${slash(path.relative(ROOT, SERVICE))}).`
  )
  return runCli(configFile, watch ? ['--watch'] : [], 'inherit').status ?? 1
}

const args = process.argv.slice(2)
const unknown = args.filter((arg) => arg !== '--check' && arg !== '--watch')
if (
  unknown.length > 0 ||
  (args.includes('--check') && args.includes('--watch'))
) {
  console.error('Uso: tsx scripts/generate-openapi-zod.ts [--check | --watch]')
  process.exitCode = 2
} else {
  const config = readConfig()
  process.exitCode = args.includes('--check')
    ? check(config)
    : generate(config, args.includes('--watch'))
}
