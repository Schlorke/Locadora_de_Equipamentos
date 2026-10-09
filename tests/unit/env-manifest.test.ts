import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import ts from 'typescript'
import { afterAll, describe, expect, it } from 'vitest'
import { createImportResolver, sourceFacts } from '../../tools/arch-runtime.mjs'
import { resolveFallbackSource } from '../helpers/fallback-source'

/**
 * Manifestos de variáveis de ambiente dos projetos do corte (plano da onda 135, C2; runbook
 * docs/operations/runbook-corte-raiz-legada.md): docs/operations/manifesto-variaveis.md tem uma tabela por projeto
 * (API, web e fallback-raiz). Cada tabela tem de bater com o que o código daquele projeto lê: o fecho de imports a
 * partir das entradas do host (o mesmo resolvedor do `pnpm arch`), varrido atrás de `process.env.X`, `env.X`,
 * `env['X']`, `env[CONSTANTE]`, `read('X')` e desestruturação de um ambiente. Variável lida e ausente do manifesto
 * reprova (a "conferência com rg process.env" do plano, automática); variável do manifesto que ninguém lê também.
 * Uma família dinâmica (`PLATFORM_SECRETS_KEK_<ID>`) precisa ter o prefixo citado no código do projeto.
 * O .env.example de cada host novo lista exatamente as variáveis configuráveis do seu manifesto.
 */
const ROOT = path.resolve(import.meta.dirname, '../..')
const MANIFEST = 'docs/operations/manifesto-variaveis.md'
const SKIP = new Set([
  'node_modules',
  '.next',
  'dist',
  'dist-export',
  'build',
  '.expo',
  'android',
  'ios',
  '.turbo',
  'coverage',
  'out',
])
const CONFIGURE = ['sim', 'opcional', 'não', 'automática'] as const
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/
const READER = /^(?:read|readVariable|readEnv|env|getEnv)$/
// Assets do not contain runtime environment reads and are deliberately absent from the tag snapshot.
const ASSET_IMPORT =
  /\.(?:css|scss|sass|less|svg|png|jpg|jpeg|gif|webp|avif|ico|json|glb|gltf|woff2?|ttf|mp3|mp4)$/i
const CREDENTIAL_PREFIX = 'LOCADORA_INTEGRATION_<ID>'
const CREDENTIAL_SUFFIXES = new Set([
  '_SECRET',
  '_VERIFY_TOKEN',
  '_API_KEY',
  '_ENVIRONMENT',
  '_USER_AGENT',
])
const testFile = (file: string) =>
  /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) ||
  file.split(path.sep).includes('__tests__')

type Package = {
  name: string
  dir: string
  runtime: string | null
  exports: unknown
}
function workspacePackages(root = ROOT): Package[] {
  const found: Package[] = []
  const visit = (directory: string, depth: number) => {
    if (depth > 3) return
    const entries = fs.readdirSync(directory, { withFileTypes: true })
    if (
      directory !== root &&
      entries.some((entry) => entry.isFile() && entry.name === 'package.json')
    ) {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(directory, 'package.json'), 'utf8')
      )
      found.push({
        name: manifest.name,
        dir: directory,
        runtime: manifest.contextWindow?.runtime ?? null,
        exports: manifest.exports ?? null,
      })
    }
    for (const entry of entries)
      if (
        entry.isDirectory() &&
        !SKIP.has(entry.name) &&
        !entry.name.startsWith('.')
      )
        visit(path.join(directory, entry.name), depth + 1)
  }
  for (const top of ['apps', 'packages']) {
    const directory = path.join(root, top)
    if (fs.existsSync(directory)) visit(directory, 1)
  }
  return found
}

function sources(directory: string, root = ROOT): string[] {
  const found: string[] = []
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name) && !entry.name.startsWith('.')) walk(file)
      } else if (
        /\.[cm]?[jt]sx?$/.test(entry.name) &&
        !entry.name.endsWith('.d.ts') &&
        !testFile(file)
      )
        found.push(file)
    }
  }
  walk(path.join(root, directory))
  return found
}

/** Arquivos de runtime alcançáveis a partir das entradas (imports relativos, aliases e entradas de pacote). */
function closure(entries: string[], root = ROOT): string[] {
  const resolver = createImportResolver(root, workspacePackages(root))
  const seen = new Set<string>()
  const pending = entries.map((entry) => path.resolve(root, entry))
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (seen.has(file)) continue
    seen.add(file)
    const facts = sourceFacts(fs.readFileSync(file, 'utf8'), file)
    for (const imported of facts.imports as { spec: string }[]) {
      if (ASSET_IMPORT.test(imported.spec)) continue
      const result = resolver.resolve(file, imported.spec, 'web')
      if (result.kind === 'unresolved')
        throw new Error(
          `Environment inventory cannot resolve ${imported.spec} from ${path.relative(root, file)}: ${'reason' in result ? result.reason : 'unresolved import'}`
        )
      if (
        result.kind === 'local' &&
        /\.[cm]?[jt]sx?$/.test(result.file) &&
        !testFile(result.file)
      )
        pending.push(result.file)
    }
  }
  return [...seen]
}

/** Nomes de variáveis que o arquivo lê de um ambiente. */
function environmentReads(file: string, source: string): Set<string> {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const names = new Set<string>()
  const constants = new Map<string, string>()
  const credentialFile = file
    .replaceAll('\\', '/')
    .endsWith('/runtime/integration-credentials.ts')
  let credentialPrefixValidated = false
  const environment = (expression: ts.Expression) => {
    const text = expression.getText(ast).replace(/\s+/g, '')
    return (
      text === 'process.env' ||
      /(?:^|\.)(?:env|environment|source|vars)(?:\(\))?$/i.test(text) ||
      /(?:^|\.)getEnv\(\)$/.test(text)
    )
  }
  const collectConstants = (node: ts.Node) => {
    if (
      ts.isRegularExpressionLiteral(node) &&
      node.text === '/^env:LOCADORA_INTEGRATION_[A-Z0-9_]+$/'
    )
      credentialPrefixValidated = true
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isStringLiteralLike(node.initializer) &&
      ENV_NAME.test(node.initializer.text)
    )
      constants.set(node.name.text, node.initializer.text)
    ts.forEachChild(node, collectConstants)
  }
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ENV_NAME.test(node.name.text) &&
      environment(node.expression)
    )
      names.add(node.name.text)
    if (ts.isElementAccessExpression(node) && environment(node.expression)) {
      const key = node.argumentExpression
      const name = ts.isStringLiteralLike(key)
        ? key.text
        : ts.isIdentifier(key)
          ? constants.get(key.text)
          : undefined
      if (name && ENV_NAME.test(name)) names.add(name)
      else if (credentialFile) {
        if (
          !credentialPrefixValidated ||
          !ts.isTemplateExpression(key) ||
          key.head.text !== '' ||
          key.templateSpans.length !== 1
        )
          throw new Error(
            `Unclassified dynamic integration environment read in ${file}`
          )
        const span = key.templateSpans[0]!
        if (
          !ts.isIdentifier(span.expression) ||
          span.expression.text !== 'name' ||
          !CREDENTIAL_SUFFIXES.has(span.literal.text)
        )
          throw new Error(
            `Unclassified dynamic integration environment read in ${file}`
          )
        names.add(CREDENTIAL_PREFIX + span.literal.text)
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : ''
      if (READER.test(name))
        for (const argument of node.arguments)
          if (ts.isStringLiteralLike(argument) && ENV_NAME.test(argument.text))
            names.add(argument.text)
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isObjectBindingPattern(node.name) &&
      environment(node.initializer)
    )
      for (const element of node.name.elements) {
        const key = element.propertyName ?? element.name
        if (ts.isIdentifier(key) && ENV_NAME.test(key.text)) names.add(key.text)
      }
    ts.forEachChild(node, visit)
  }
  collectConstants(ast)
  visit(ast)
  return names
}

type Row = { name: string; configure: string }
function missingReads(
  read: ReadonlyMap<string, string>,
  rows: readonly Row[]
): string[] {
  const listed = new Set(rows.map((row) => row.name))
  return [...read]
    .filter(([name]) => !listed.has(name))
    .map(([name, file]) => `${name} (${file})`)
}

function staleRows(
  rows: readonly Row[],
  read: ReadonlyMap<string, string>,
  text: readonly string[]
): string[] {
  return rows
    .filter((row) =>
      isFamily(row.name) && !isCredentialFamily(row.name)
        ? !text.some((source) =>
            source.includes(row.name.replace(/<[^>]+>.*$/, ''))
          )
        : !read.has(row.name)
    )
    .map((row) => row.name)
}

function manifestRows(project: string): Row[] {
  const text = fs.readFileSync(path.join(ROOT, MANIFEST), 'utf8')
  const block = new RegExp(
    `<!-- manifesto:${project} -->([\\s\\S]*?)<!-- /manifesto:${project} -->`
  ).exec(text)?.[1]
  expect(block, `${MANIFEST}: bloco manifesto:${project}`).toBeDefined()
  return [...block!.matchAll(/^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|/gm)].map(
    (match) => ({
      name: match[1]!,
      configure: match[2]!
        .trim()
        .toLowerCase()
        .split(/[\s,(]/)[0]!,
    })
  )
}
const isFamily = (name: string) => /<[^>]+>/.test(name)
const isCredentialFamily = (name: string) =>
  name.startsWith(CREDENTIAL_PREFIX + '_')

const fallback = resolveFallbackSource(ROOT)
afterAll(() => fallback.cleanup())

const PROJECTS = {
  api: {
    root: ROOT,
    entries: [
      ...sources('apps/services/api/src'),
      path.join(ROOT, 'apps/services/api/next.config.mjs'),
    ],
    example: 'apps/services/api/.env.example',
  },
  web: {
    root: ROOT,
    entries: [
      ...sources('apps/clients/web/src'),
      path.join(ROOT, 'apps/clients/web/next.config.mjs'),
    ],
    example: 'apps/clients/web/.env.example',
  },
  // O fallback-raiz é a raiz legada da tag de pré-exclusão, publicada sem domínio e sem agenda (runbook, 7.1-4).
  'fallback-raiz': {
    root: fallback.root,
    entries: [
      ...sources('app', fallback.root),
      path.join(fallback.root, 'proxy.ts'),
      path.join(fallback.root, 'next.config.mjs'),
    ],
    example: null,
  },
} as const

describe.each(Object.entries(PROJECTS))(
  'manifesto de variáveis: %s',
  (project, { root, entries, example }) => {
    const { read, text } = (() => {
      try {
        const files = closure([...entries], root)
        const read = new Map<string, string>()
        const text = files.map((file) => fs.readFileSync(file, 'utf8'))
        files.forEach((file, index) => {
          for (const name of environmentReads(file, text[index]!))
            if (!read.has(name))
              read.set(
                name,
                path.relative(root, file).split(path.sep).join('/')
              )
        })
        return { read, text }
      } catch (error) {
        // Collection can fail before afterAll runs. Never leave a failed tag inventory's snapshot behind.
        fallback.cleanup()
        throw error
      }
    })()
    const rows = manifestRows(project)

    it('cada linha tem nome único e um valor de "Configurar" conhecido', () => {
      expect(rows.length).toBeGreaterThan(0)
      const names = rows.map((row) => row.name)
      expect(names.filter((name, i) => names.indexOf(name) !== i)).toEqual([])
      expect(
        rows.filter(
          (row) =>
            !CONFIGURE.includes(row.configure as (typeof CONFIGURE)[number])
        )
      ).toEqual([])
    })

    it('toda variável lida pelo código do projeto está no manifesto', () => {
      expect(missingReads(read, rows)).toEqual([])
    })

    it('toda linha do manifesto é lida pelo código do projeto (credenciais: sufixo exato)', () => {
      expect(staleRows(rows, read, text)).toEqual([])
    })

    if (example)
      it(`${example} lista exatamente as variáveis configuráveis do manifesto`, () => {
        const keys = [
          ...fs
            .readFileSync(path.join(ROOT, example), 'utf8')
            .matchAll(/^([A-Z][A-Z0-9_]*)=/gm),
        ].map((match) => match[1]!)
        const configurable = rows
          .filter(
            (row) =>
              !isFamily(row.name) &&
              (row.configure === 'sim' || row.configure === 'opcional')
          )
          .map((row) => row.name)
        // Um exemplo de família (PLATFORM_SECRETS_KEK_K1) vale pela linha da família configurável.
        const families = rows
          .filter(
            (row) =>
              isFamily(row.name) &&
              (row.configure === 'sim' || row.configure === 'opcional')
          )
          .map(
            (row) =>
              new RegExp(`^${row.name.replace(/<[^>]+>/g, '[A-Z0-9_]+')}$`)
          )
        expect(keys.filter((key, i) => keys.indexOf(key) !== i)).toEqual([])
        expect(
          keys
            .filter(
              (key) =>
                rows.some((row) => row.name === key) ||
                !families.some((family) => family.test(key))
            )
            .sort()
        ).toEqual([...configurable].sort())
      })
  }
)

describe('fonte do manifesto fallback-raiz', () => {
  it(`declara ${fallback.origin}${fallback.revision ? ` (${fallback.revision})` : ' (tag ainda ausente)'}`, () => {
    if (fallback.origin === 'pre-tag-checkout') {
      expect(fallback.root).toBe(ROOT)
      expect(fallback.revision).toBeNull()
    } else {
      expect(fallback.root).not.toBe(ROOT)
      expect(fallback.revision).toMatch(/^[a-f0-9]{40,64}$/)
    }
  })
})

describe('fecho de imports da fonte selecionada', () => {
  function withSourceFixture(source: string, verify: (root: string) => void) {
    const root = fs.mkdtempSync(path.join(tmpdir(), 'locadora-env-closure-'))
    const files = [
      ['package.json', JSON.stringify({ name: 'fixture' })],
      [
        'tsconfig.json',
        JSON.stringify({ compilerOptions: { paths: { '@/*': ['./*'] } } }),
      ],
      ['app/route.ts', source],
      [
        'lib/config.ts',
        'export const required = process.env.FROM_SELECTED_SOURCE',
      ],
    ] as const
    fs.mkdirSync(path.join(root, 'app'))
    fs.mkdirSync(path.join(root, 'lib'))
    try {
      for (const [file, contents] of files)
        fs.writeFileSync(path.join(root, file), contents)
      verify(root)
    } finally {
      // This fixture creates only these regular files/directories; no recursive removal or linked checkout.
      for (const [file] of [...files].reverse())
        if (fs.existsSync(path.join(root, file)))
          fs.unlinkSync(path.join(root, file))
      fs.rmdirSync(path.join(root, 'app'))
      fs.rmdirSync(path.join(root, 'lib'))
      fs.rmdirSync(root)
    }
  }

  it('resolve a fonte e o alias no root selecionado, sem consultar o checkout atual', () => {
    withSourceFixture("import '@/lib/config'", (root) => {
      const files = closure(['app/route.ts'], root)
      expect(files).toContain(path.join(root, 'lib/config.ts'))
      expect(files.every((file) => file.startsWith(root + path.sep))).toBe(true)
      expect([
        ...environmentReads(files[1]!, fs.readFileSync(files[1]!, 'utf8')),
      ]).toEqual(['FROM_SELECTED_SOURCE'])
    })
  })

  it.each(['../lib/missing', '@/lib/missing'])(
    'recusa fonte JS local ausente em %s, sem confundir asset ausente',
    (specifier) => {
      withSourceFixture(
        `import '../assets/not-extracted.svg'; import '${specifier}'`,
        (root) => {
          expect(() => closure(['app/route.ts'], root)).toThrow(
            /Environment inventory cannot resolve/
          )
        }
      )
    }
  )

  it('não exige extrair assets para inventariar a fonte', () => {
    withSourceFixture("import '../assets/not-extracted.svg'", (root) => {
      expect(closure(['app/route.ts'], root)).toEqual([
        path.join(root, 'app/route.ts'),
      ])
    })
  })
})

describe('extração das leituras de ambiente', () => {
  it.each([
    'process.env.CI',
    "process.env['CI']",
    'const { CI } = process.env',
    "read('CI')",
    'env.A',
  ])('reconhece nome curto em %s', (source) => {
    expect([...environmentReads('x.ts', source)]).toEqual([
      source === 'env.A' ? 'A' : 'CI',
    ])
  })

  it('reconhece as formas usadas no código e ignora o resto', () => {
    const source = [
      "const KEY = 'PLATFORM_ASAAS_OUTBOUND_DISABLED'",
      'process.env.A_ONE',
      "process.env['B_TWO']",
      'env.C_THREE',
      'environment().D_FOUR',
      'getEnv().E_FIVE',
      'env[KEY]',
      "read('F_SIX')",
      "readVariable(env, 'G_SEVEN')",
      'const { H_EIGHT, I_NINE: renamed } = process.env',
      "settings.NOT_ENV; translate('NOT_EITHER'); const code = 'NOR_THIS'",
    ].join('\n')
    expect([...environmentReads('x.ts', source)].sort()).toEqual([
      'A_ONE',
      'B_TWO',
      'C_THREE',
      'D_FOUR',
      'E_FIVE',
      'F_SIX',
      'G_SEVEN',
      'H_EIGHT',
      'I_NINE',
      'PLATFORM_ASAAS_OUTBOUND_DISABLED',
    ])
  })
})

describe('famílias dinâmicas das credenciais de integração', () => {
  const file = 'packages/backend/src/runtime/integration-credentials.ts'
  const families = [
    'LOCADORA_INTEGRATION_<ID>_SECRET',
    'LOCADORA_INTEGRATION_<ID>_VERIFY_TOKEN',
    'LOCADORA_INTEGRATION_<ID>_API_KEY',
    'LOCADORA_INTEGRATION_<ID>_ENVIRONMENT',
    'LOCADORA_INTEGRATION_<ID>_USER_AGENT',
  ]
  const source = (reads: readonly string[]) =>
    [
      'if (!/^env:LOCADORA_INTEGRATION_[A-Z0-9_]+$/.test(ref)) return null',
      ...reads,
    ].join('\n')
  const reads = [
    'getEnv()[`${name}_SECRET`]',
    'getEnv()[`${name}_VERIFY_TOKEN`]',
    'getEnv()[`${name}_API_KEY`]',
    'getEnv()[`${name}_ENVIRONMENT`]',
    'getEnv()[`${name}_USER_AGENT`]',
  ]
  const rows = families.map((name) => ({ name, configure: 'opcional' }))
  const inventory = (body: string) =>
    new Map([...environmentReads(file, body)].map((name) => [name, file]))

  it('extrai os cinco sufixos reais como famílias e confere nos dois sentidos', () => {
    const text = source(reads)
    const read = inventory(text)
    expect([...read.keys()].sort()).toEqual([...families].sort())
    expect(missingReads(read, rows)).toEqual([])
    expect(staleRows(rows, read, [text])).toEqual([])
  })

  it('recusa família lida que falta no manifesto', () => {
    expect(
      missingReads(
        inventory(source(reads)),
        rows.filter((row) => !row.name.endsWith('_API_KEY'))
      )
    ).toEqual([`LOCADORA_INTEGRATION_<ID>_API_KEY (${file})`])
  })

  it('recusa família documentada sem leitura, mesmo com o prefixo citado no código', () => {
    const text = source(reads.filter((read) => !read.includes('_USER_AGENT')))
    expect(staleRows(rows, inventory(text), [text])).toEqual([
      'LOCADORA_INTEGRATION_<ID>_USER_AGENT',
    ])
  })

  it.each([
    'getEnv()[`${name}_UNKNOWN`]',
    'getEnv()[`${other}_SECRET`]',
    'getEnv()[`${name}_${suffix}`]',
    'getEnv()[key]',
  ])('recusa acesso dinâmico não classificado: %s', (read) => {
    expect(() => environmentReads(file, source([read]))).toThrow(
      /Unclassified dynamic integration environment read/
    )
  })

  it('não inventa prefixo de família se o resolver não restringe a referência', () => {
    expect(() => environmentReads(file, reads.join('\n'))).toThrow(
      /Unclassified dynamic integration environment read/
    )
  })
})
