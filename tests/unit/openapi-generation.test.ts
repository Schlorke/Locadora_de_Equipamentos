import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * OpenAPI da API compartilhada (C5/E15). A estrutura app/ e lib/ da raiz foi aposentada no bloco F:
 * `pnpm openapi:generate` lê apps/services/api e os esquemas públicos de @gb-locacoes/contracts/openapi,
 * gravando public/openapi.json (sincronizado com o web por tools/sync-web-public.mjs).
 * Os nove blocos @openapi do checkpoint público pré-exclusão ficam numa fixture documental congelada,
 * independente das rotas atuais. Os handlers e a superfície do serviço continuam conferidos pela AST
 * e pelos contratos versionados; a geração --check deve reproduzir a especificação sem regravá-la.
 */
const ROOT = path.resolve(import.meta.dirname, '../..')
const SERVICE_API = 'apps/services/api/src/app/api'
const SPEC = 'public/openapi.json'
const SCHEMAS_JSON = 'packages/contracts/src/openapi/public-schemas.json'
const API_SURFACE_FIXTURE = 'tests/security/fixtures/api-surface.json'
const HISTORICAL_ANNOTATIONS =
  'tests/fixtures/openapi/annotations.pre-exclusion.json'
const HISTORICAL_REVISION = '978ceb9244c81c7cb2888b798fad8ce90edad25e'
const HISTORICAL_CONTENT_SHA256 =
  'f85c2a0732d740414b355f0aad75cdd887f6ccced445c9a41fdd4ccc58bcac48'
const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]

/** E15: as nove anotações históricas do host raiz aposentado, congeladas antes da exclusão. */
const PORTED_OPENAPI = [
  'admin/dashboard',
  'admin/equipments',
  'admin/financial/aging',
  'admin/financial/revenue',
  'admin/quotes',
  'categories',
  'contact',
  'equipments',
  'quotes',
]

/**
 * Endpoints da superfície que a especificação não documenta: um handler único exportado com dois nomes
 * (`export { handle as GET, handle as POST }`). O gerador só lê `export function` e `export const`, e a especificação
 * gerada da raiz também não os tinha. A lista só encolhe: endpoint documentado aqui reprova.
 */
const UNDOCUMENTED: Record<string, string> = {
  'GET /api/admin/payment-account/create':
    'handle compartilhado por GET e POST (conta de recebimentos)',
  'POST /api/admin/payment-account/create':
    'handle compartilhado por GET e POST (conta de recebimentos)',
  'GET /api/admin/payment-account/recovery':
    'handle compartilhado por GET e POST (conta de recebimentos)',
  'POST /api/admin/payment-account/recovery':
    'handle compartilhado por GET e POST (conta de recebimentos)',
  'GET /api/auth/[...nextauth]':
    'handler de identidade compartilhado por GET e POST (NextAuth ou Better Auth)',
  'POST /api/auth/[...nextauth]':
    'handler de identidade compartilhado por GET e POST (NextAuth ou Better Auth)',
  'GET /api/auth/v2/[...all]':
    'handler de identidade compartilhado por GET e POST (Better Auth)',
  'POST /api/auth/v2/[...all]':
    'handler de identidade compartilhado por GET e POST (Better Auth)',
}

interface HistoricalAnnotations {
  origin: { revision: string }
  routes: Record<string, { blocks: string[] }>
}

interface Operation {
  summary?: string
  tags?: string[]
  parameters?: Array<{ name: string; in: string; required?: boolean }>
  requestBody?: {
    required?: boolean
    content: Record<string, { schema: { $ref?: string } }>
  }
  responses: Record<
    string,
    { content?: Record<string, { schema: { $ref?: string } }> }
  >
}
interface Spec {
  paths: Record<string, Record<string, Operation>>
}

const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const sha256 = (file: string) =>
  createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, file)))
    .digest('hex')
const spec = () => JSON.parse(read(SPEC)) as Spec

/** `GET /api/equipments/[id]` (superfície) → `GET /equipments/{id}` (operação da especificação, servidor `/api`). */
const toOperation = (endpoint: string) =>
  endpoint
    .replace(' /api/', ' /')
    .replace(/\[\[?\.\.\.(\w+)\]?\]/g, '{$1}')
    .replace(/\[(\w+)\]/g, '{$1}')

const documentedOperations = (document: Spec) =>
  Object.entries(document.paths)
    .flatMap(([route, item]) =>
      Object.keys(item)
        .filter((method) => HTTP_METHODS.includes(method.toUpperCase()))
        .map((method) => `${method.toUpperCase()} ${route}`)
    )
    .sort()

/** Blocos JSDoc com `@openapi` do arquivo, na ordem (CRLF normalizado). */
const openapiBlocks = (text: string) =>
  [...text.replace(/\r\n/g, '\n').matchAll(/\/\*\*[\s\S]*?\*\//g)]
    .map((match) => match[0])
    .filter((block) => block.includes('@openapi'))

/** Os handlers HTTP exportados (`export function GET`, `export const GET`) com o comentário que os precede. */
function exportedHandlers(file: string) {
  const text = read(file)
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const exported = (statement: ts.Statement) =>
    ts.canHaveModifiers(statement) &&
    (ts.getModifiers(statement) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    )
  const leading = (statement: ts.Statement) =>
    (ts.getLeadingCommentRanges(text, statement.getFullStart()) ?? [])
      .map((range) => text.slice(range.pos, range.end))
      .join('\n')
  return source.statements.flatMap((statement) => {
    if (!exported(statement)) return []
    const names = ts.isFunctionDeclaration(statement)
      ? [statement.name?.text ?? '']
      : ts.isVariableStatement(statement)
        ? statement.declarationList.declarations.map((declaration) =>
            ts.isIdentifier(declaration.name) ? declaration.name.text : ''
          )
        : []
    return names
      .filter((name) => HTTP_METHODS.includes(name))
      .map((name) => ({ name, comment: leading(statement) }))
  })
}

describe('OpenAPI gerado da API compartilhada', () => {
  it('o gerador lê o serviço e os esquemas de packages/contracts, nunca a raiz legada', () => {
    const config = JSON.parse(read('next.openapi.json')) as Record<
      string,
      unknown
    >
    expect(config.apiDir).toBe(`./${SERVICE_API}`)
    expect(config.schemaDir).toEqual([
      './apps/services/api/src',
      './packages/contracts/src/openapi',
    ])
    expect(config.schemaFiles).toEqual([`./${SCHEMAS_JSON}`])
    expect(config.outputDir).toBe('./public')
    expect(config.outputFile).toBe('openapi.json')
    const paths = [
      config.apiDir,
      config.outputDir,
      ...(config.schemaDir as string[]),
      ...(config.schemaFiles as string[]),
    ] as string[]
    for (const value of paths)
      expect(value, value).not.toMatch(/^\.\/(?:app|lib)(?:\/|$)/)
    // Os esquemas públicos saíram de lib/openapi para o contrato, por um ponto de entrada exato.
    expect(
      JSON.parse(read('packages/contracts/package.json')).exports['./openapi']
    ).toBe('./src/openapi/schemas.ts')
    expect(fs.existsSync(path.join(ROOT, 'lib/openapi'))).toBe(false)
    const scripts = JSON.parse(read('package.json')).scripts as Record<
      string,
      string
    >
    expect(scripts['openapi:generate']).toBe(
      'tsx scripts/generate-openapi-zod.ts'
    )
    expect(scripts['openapi:dev']).toBe(
      'tsx scripts/generate-openapi-zod.ts --watch'
    )
  })

  it('a especificação documenta a superfície da API compartilhada, salvo os handlers de dois nomes', () => {
    const surface = (
      JSON.parse(read(API_SURFACE_FIXTURE)) as { endpoints: string[] }
    ).endpoints
    for (const endpoint of Object.keys(UNDOCUMENTED))
      expect(surface, endpoint).toContain(endpoint)
    const expected = surface
      .filter((endpoint) => !(endpoint in UNDOCUMENTED))
      .map(toOperation)
      .sort()
    const documented = documentedOperations(spec())
    expect(documented).toEqual(expected)
    // A lista de exceções só encolhe: o que passou a ser documentado sai dela.
    expect(
      Object.keys(UNDOCUMENTED)
        .map(toOperation)
        .filter((operation) => documented.includes(operation))
    ).toEqual([])
  })

  it.each(PORTED_OPENAPI)(
    '%s preserva o bloco @openapi do checkpoint pré-exclusão no handler do serviço',
    (route) => {
      const service = `${SERVICE_API}/${route}/route.ts`
      const blocks = openapiBlocks(read(service))
      expect(blocks.length, service).toBeGreaterThan(0)
      // O bloco fica colado a um handler exportado, onde o gerador o lê.
      const handlers = exportedHandlers(service)
      for (const block of blocks)
        expect(
          handlers.some(({ comment }) =>
            comment.replace(/\r\n/g, '\n').includes(block)
          ),
          `${service}: bloco @openapi fora de um handler exportado`
        ).toBe(true)
      // O host raiz foi aposentado: o oracle independente vem dos nove blobs do checkpoint público pré-exclusão.
      const historical = JSON.parse(
        read(HISTORICAL_ANNOTATIONS)
      ) as HistoricalAnnotations
      expect(historical.origin.revision).toBe(HISTORICAL_REVISION)
      expect(Object.keys(historical.routes).sort()).toEqual(
        [...PORTED_OPENAPI].sort()
      )
      expect(
        createHash('sha256').update(JSON.stringify(historical)).digest('hex')
      ).toBe(HISTORICAL_CONTENT_SHA256)
      const expected = historical.routes[route]
      expect(expected, route).toBeDefined()
      expect(expected!.blocks.length, route).toBeGreaterThan(0)
      expect(blocks).toEqual(expected!.blocks)
    }
  )

  it('as operações públicas portadas mostram o contrato declarado nas rotas do serviço', () => {
    const paths = spec().paths
    const ref = (name: string) => `#/components/schemas/${name}`
    for (const [route, summary, tag, list] of [
      [
        '/categories',
        'Lista categorias da locadora selecionada.',
        'Categories',
        'PublicCategoryList',
      ],
      [
        '/equipments',
        'Lista equipamentos da locadora selecionada.',
        'Equipments',
        'PublicEquipmentList',
      ],
    ] as const) {
      const operation = paths[route]!.get!
      expect(operation.summary).toBe(summary)
      expect(operation.tags).toEqual([tag])
      expect(operation.parameters).toContainEqual(
        expect.objectContaining({
          name: 'tenantSlug',
          in: 'query',
          required: true,
        })
      )
      expect(
        operation.responses['200']?.content?.['application/json']?.schema.$ref
      ).toBe(ref(list))
      for (const status of ['404', '409'])
        expect(
          operation.responses[status]?.content?.['application/json']?.schema
            .$ref
        ).toBe(ref('PublicApiError'))
    }
    for (const [route, body, status, created] of [
      ['/quotes', 'PublicQuoteRequest', '201', 'PublicQuoteCreated'],
      ['/contact', 'PublicContactRequest', '202', 'PublicContactAccepted'],
    ] as const) {
      const operation = paths[route]!.post!
      expect(operation.requestBody?.required).toBe(true)
      expect(
        operation.requestBody?.content['application/json']?.schema.$ref
      ).toBe(ref(body))
      expect(
        operation.responses[status]?.content?.['application/json']?.schema.$ref
      ).toBe(ref(created))
    }
  })

  it('pnpm openapi:generate --check reproduz os arquivos versionados a partir do serviço, sem regravá-los', () => {
    const before = [sha256(SPEC), sha256(SCHEMAS_JSON)]
    const run = spawnSync(
      process.execPath,
      [
        path.join(ROOT, 'node_modules/tsx/dist/cli.mjs'),
        'scripts/generate-openapi-zod.ts',
        '--check',
      ],
      { cwd: ROOT, encoding: 'utf8', timeout: 170_000 }
    )
    expect(run.error).toBeUndefined()
    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0)
    expect(run.stdout).toContain('apps/services/api/src/app/api')
    expect([sha256(SPEC), sha256(SCHEMAS_JSON)]).toEqual(before)
  }, 180_000)
})
