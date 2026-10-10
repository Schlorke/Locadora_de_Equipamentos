import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Artefatos aposentados não aparecem como vivos em docs e comentários (achado 135 da revisão; entradas 171, 227 e 229
 * de docs/issues/known-issues.md). A faxina tirou a junção de apps/clients/web/public com o tools/link-web-public.mjs,
 * o gerador zod com o scripts/post-prisma-generate.js e a saída gerada de lib/validations, a pipeline do Style
 * Dictionary e o scripts/clean-install-windows.ps1, mas textos continuaram mandando usá-los: a entrada 171 (lida como
 * regra pelo AGENTS.md) dizia que a junção era "a única exceção existente", o next.config.mjs do host web e a ADR de
 * hosts falavam do link, e o design-system.md dava o Style Dictionary como implementado.
 *
 * Regra: cada artefato de RETIRED prova que saiu (arquivo, script, dependência ou link ausentes) e toda citação dele
 * precisa, na mesma unidade de leitura, de uma frase que cite o mesmo artefato e diga que ele saiu (saiu, removido,
 * apagado, substituído, virou, antigo, era, "não ... mais"...). Unidade de leitura: no Markdown, a seção de nível 1 ou
 * 2, e a introdução (antes do primeiro `##`) vale para o arquivo todo; nos demais arquivos, o arquivo inteiro. Frase é
 * o trecho até `.`, `!`, `?` ou `;`, um item de lista, uma linha de tabela, um cabeçalho, um parágrafo de comentário
 * ou uma linha de código.
 *
 * Alcance: tudo o que o git lista (versionado ou novo, sem o que ele ignora), menos os registros históricos que
 * docs/README.md declara ("Registros históricos (código da época)"), o CHANGELOG.md, o lockfile e as cópias de skills
 * de agentes. Do docs/issues/known-issues.md contam as entradas que as instruções de agente citam como regra
 * (AGENTS.md, CLAUDE.md, AGENTS.md dos hosts, .cursor/rules e docs/ai/); cada uma precisa da própria frase, porque a
 * introdução do arquivo avisa só das entradas antigas. Exceções em ALLOWED, com motivo; exceção sem uso reprova.
 *
 * Limite conhecido: a leitura é por palavra. Uma frase que cite o artefato e diga "saiu" por outro motivo passa.
 */
const ROOT = path.resolve(import.meta.dirname, '../..')
const KNOWN_ISSUES = 'docs/issues/known-issues.md'

/** Registros históricos de docs/README.md, o log de versões, o lockfile e cópias de skills de agentes. */
const OUT_OF_SCOPE: ReadonlyArray<RegExp> = [
  /^docs\/issues\/(?!known-issues(?:\.index)?\.md$)/,
  /^docs\/(?:internal|audit|migration|archive)\//,
  /^docs\/PROMPT_CURSOR_FINANCEIRO\.md$/,
  /^CHANGELOG\.md$/,
  /^pnpm-lock\.yaml$/,
  /^\.agents\//,
  /^\.claude\/skills\//,
  /^\.context-window\//,
  /^tests\/unit\/retired-artifacts\.test\.ts$/,
]

/** Os registros que o recorte acima trata como históricos, como docs/README.md os nomeia. */
const HISTORICAL_IN_README = [
  '`issues/`',
  '`known-issues.index.md`',
  '`issues/known-issues.md`',
  '`internal/`',
  '`audit/`',
  '`migration/`',
  '`archive/`',
  '`PROMPT_CURSOR_FINANCEIRO.md`',
]

/** Arquivos de agente cujas citações "entrada N" tornam a entrada N do known-issues uma regra viva. */
const AGENT_INSTRUCTIONS =
  /^(?:AGENTS|CLAUDE)\.md$|^apps\/clients\/[^/]+\/AGENTS\.md$|^\.cursor\/rules\/|^docs\/ai\//

const LINK_WORD =
  /(?<![\p{L}\p{N}_])(?:links?|junç(?:ão|ões)|junctions?|symlinks?)(?![\p{L}\p{N}_])/iu
const WEB_PUBLIC = /apps[/\\]clients[/\\]web[/\\]public(?![\w-])/

/**
 * Palavras que dizem que algo saiu. Não valem até duas palavras depois de não/nunca ("nunca deve ser apagada", "não foi
 * removido") nem logo depois de ser/será ("será removido"); "não ... mais" vale ("não existe mais").
 */
const RETIREMENT = new RegExp(
  String.raw`(?<![\p{L}\p{N}_])(?<!(?<![\p{L}])(?:(?:não|nunca|jamais|never|not)\s+(?:[^\s.;!?]+\s+){0,2}|(?:ser|será|serão|seria|be)\s+))` +
    String.raw`(?:saiu|saíram|saído|virou|viraram|removid[oa]s?|removeu|removeram|retirad[oa]s?|retirou|aposentad[oa]s?|aposentou|apagad[oa]s?|apagou|apagaram|substituíd[oa]s?|substitui|substituiu|antig[oa]s?|era|eram|acabou|removed|retired|replaced|deleted|former|no longer)(?![\p{L}\p{N}_])` +
    String.raw`|(?<![\p{L}\p{N}_])não\s+(?:\S+\s+)?mais(?![\p{L}\p{N}_])`,
  'iu'
)

type Manifest = {
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  pnpm?: { overrides?: Record<string, string> }
}

/** Os package.json do workspace (raiz, apps/clients/* e packages/*). */
function workspaceManifests(): Array<{ file: string; manifest: Manifest }> {
  const inside = (folder: string) =>
    fs.existsSync(path.join(ROOT, folder))
      ? fs
          .readdirSync(path.join(ROOT, folder))
          .map((name) => path.posix.join(folder, name, 'package.json'))
          .filter((file) => fs.existsSync(path.join(ROOT, file)))
      : []
  return ['package.json', ...inside('apps/clients'), ...inside('packages')].map(
    (file) => ({
      file,
      manifest: JSON.parse(
        fs.readFileSync(path.join(ROOT, file), 'utf8')
      ) as Manifest,
    })
  )
}

/** Provas de ausência, reusadas pelos artefatos. Cada função devolve o que ainda existe. */
const still = {
  files: (...files: string[]) =>
    files
      .filter((file) =>
        fs.lstatSync(path.join(ROOT, file), { throwIfNoEntry: false })
      )
      .map((file) => `${file} existe`),
  scripts: (name: RegExp, command: RegExp) =>
    workspaceManifests().flatMap(({ file, manifest }) =>
      Object.entries(manifest.scripts ?? {})
        .filter(([key, value]) => name.test(key) || command.test(value))
        .map(([key]) => `${file} scripts.${key}`)
    ),
  dependency: (name: string) =>
    workspaceManifests().flatMap(({ file, manifest }) =>
      [
        manifest.dependencies,
        manifest.devDependencies,
        manifest.optionalDependencies,
        manifest.peerDependencies,
        manifest.pnpm?.overrides,
      ].flatMap((entries) =>
        Object.keys(entries ?? {})
          .filter((key) => key === name || key.startsWith(`${name}>`))
          .map((key) => `${file} depende de ${key}`)
      )
    ),
}

type Retired = {
  id: string
  /** Trechos que citam o artefato. */
  patterns: ReadonlyArray<RegExp>
  /** Citação que só existe na frase inteira (as duas partes juntas). */
  sentence?: (text: string) => boolean
  /** O que ainda existe do artefato (vazio: saiu de verdade). */
  remains: () => string[]
}

/** The root app/lib and these exact artifacts were retired in F; host src/app and package sources remain. */
const RETIRED_ROOT_PATHS: ReadonlyArray<{
  id: string
  files: string[]
  patterns?: ReadonlyArray<RegExp>
}> = [
  {
    id: 'raiz legada app/',
    files: ['app'],
    patterns: [/(?<![\w./\\-])app\//, /@\/app(?:\/|(?=['"\s]))/],
  },
  {
    id: 'fachadas legadas lib/',
    files: ['lib'],
    patterns: [/(?<![\w./\\-])lib\//, /@\/lib(?:\/|(?=['"\s]))/],
  },
  {
    id: 'middleware legado middlewares/require-admin.ts',
    files: ['middlewares/require-admin.ts'],
  },
  {
    id: 'schema legado schemas/settings.schema.ts',
    files: ['schemas/settings.schema.ts'],
  },
  {
    id: 'tipos legados types/global.d.ts e types/google-maps-ecl.d.ts',
    files: ['types/global.d.ts', 'types/google-maps-ecl.d.ts'],
  },
  { id: 'proxy.ts da raiz', files: ['proxy.ts'] },
  { id: 'next.config.mjs da raiz', files: ['next.config.mjs'] },
  { id: 'vercel.json da raiz', files: ['vercel.json'] },
  { id: 'Dockerfile da raiz', files: ['Dockerfile'] },
  { id: 'components.json da raiz', files: ['components.json'] },
  {
    id: 'gerados next-env.d.ts e tsconfig.tsbuildinfo da raiz',
    files: ['next-env.d.ts', 'tsconfig.tsbuildinfo', '.next'],
  },
  {
    id: 'auxiliares antigos de build da raiz',
    files: [
      'scripts/patch-prisma.js',
      'scripts/fix-prisma-imports.js',
      'scripts/patch-next-env-for-typecheck.cjs',
    ],
  },
  {
    id: 'scripts avulsos antigos de DB/RLS/Supabase',
    files: [
      'scripts/check-supabase-performance.js',
      'scripts/supabase-diagnostics.js',
      'scripts/fix-rls-policies.js',
      'scripts/force-fix-rls.js',
      'scripts/final-rls-fix.js',
      'scripts/debug-policies.js',
      'scripts/alter-policies.js',
      'scripts/resolve-all-warnings.js',
      'scripts/monitor-index-usage.js',
      'scripts/diagnose-database.js',
      'scripts/diagnose-connection.js',
      'scripts/check-policies.js',
      'scripts/fix-persistent-policies.js',
      'scripts/fix-new-policies.js',
      'scripts/fix-insert-policies.js',
      'scripts/debug-persistent-warnings.js',
      'scripts/create-missing-index.js',
      'scripts/check-prisma.js',
      'scripts/prisma-client.js',
      'scripts/prisma-client.cjs',
      'scripts/safe-postinstall.js',
      'scripts/test-commit.js',
      'scripts/create-missing-categories.mjs',
      'scripts/check-equipments.mjs',
      'scripts/check-andaime-pricing.cjs',
      'scripts/check-duplicate-categories.cjs',
    ],
  },
]

/** Only a repository-root spelling; qualified hosts/packages and src/app must not match. */
function retiredRootMention(file: string): RegExp {
  const special = new Set([
    36, 40, 41, 42, 43, 46, 63, 91, 92, 93, 94, 123, 124, 125,
  ])
  const escaped = Array.from(file, (character) =>
    special.has(character.charCodeAt(0))
      ? String.fromCharCode(92) + character
      : character
  ).join('')
  return new RegExp('(?<![\\w./\\\\-])' + escaped + '(?![\\w/\\\\-]|\\.[\\w])')
}

const RETIRED: ReadonlyArray<Retired> = [
  ...RETIRED_ROOT_PATHS.map(({ id, files, patterns }): Retired => ({
    id,
    patterns: patterns ?? files.map(retiredRootMention),
    remains: () => still.files(...files),
  })),
  {
    id: 'junção de apps/clients/web/public (tools/link-web-public.mjs, pnpm link:web-public)',
    patterns: [/(?<![\w-])(?:tools\/)?link[-:]web-public(?:\.mjs)?(?![\w-])/],
    sentence: (text) => WEB_PUBLIC.test(text) && LINK_WORD.test(text),
    remains: () => {
      const stat = fs.lstatSync(path.join(ROOT, 'apps/clients/web/public'), {
        throwIfNoEntry: false,
      })
      return [
        ...still.files('tools/link-web-public.mjs'),
        ...still.scripts(/^link:web-public$/, /link-web-public/),
        ...(stat?.isSymbolicLink()
          ? ['apps/clients/web/public é um link (junção ou symlink)']
          : []),
      ]
    },
  },
  {
    id: 'gerador zod (prisma-zod-generator, scripts/post-prisma-generate.js, lib/validations/schemas e helpers)',
    patterns: [
      /prisma-zod-generator|generator zod|zod[- ]generator|zod schemas from prisma|auto-generated zod/i,
      /post-prisma-generate/,
      /lib\/validations\/(?:schemas|helpers)(?![\w-])/,
    ],
    remains: () => {
      const schema = fs.readFileSync(
        path.join(ROOT, 'prisma/schema.prisma'),
        'utf8'
      )
      return [
        ...still.files(
          'scripts/post-prisma-generate.js',
          'lib/validations/schemas',
          'lib/validations/helpers',
          'lib/validations/.prisma-zod-generator-manifest.json'
        ),
        ...still.scripts(/^$/, /post-prisma-generate|prisma-zod-generator/),
        ...still.dependency('prisma-zod-generator'),
        ...(/^\s*generator\s+zod\b|prisma-zod-generator/m.test(schema)
          ? ['prisma/schema.prisma tem o generator zod']
          : []),
      ]
    },
  },
  {
    id: 'pipeline do Style Dictionary (style-dictionary, design-tokens/output, scripts design-system:*-tokens)',
    patterns: [
      /style-dictionary|Style Dictionary/i,
      /design-tokens\/output(?![\w-])/,
      /design-system:(?:build|watch|\*)-tokens|(?:build|watch)-design-tokens/,
    ],
    remains: () => [
      ...still.files(
        'style-dictionary.config.js',
        'design-tokens/output',
        'scripts/build-design-tokens.js',
        'scripts/watch-design-tokens-simple.js'
      ),
      ...still.scripts(
        /^design-system:(?:build|watch)-tokens$/,
        /style-dictionary|(?:build|watch)-design-tokens/
      ),
      ...still.dependency('style-dictionary'),
    ],
  },
  {
    id: 'scripts/clean-install-windows.ps1',
    patterns: [/clean-install-windows/],
    remains: () => [
      ...still.files('scripts/clean-install-windows.ps1'),
      ...still.scripts(/^$/, /clean-install-windows/),
    ],
  },
]

/**
 * Frozen production data has a hash-verified historical caption, rather than edited source bytes.
 * This does not exclude a file or suppress its contents: every original sentence is still scanned.
 * The exact reference and four original Git blobs were independently preserved before F; any
 * changed byte, origin, path or new file has no historical caption and must fail validation.
 */
const FROZEN_PRODUCTION_DATA: ReadonlyArray<{
  file: string
  sha256: string
  normalizeCheckoutEol: boolean
}> = [
  {
    file: 'tests/visual/tailwind-parity/production-sources/app/globals.css.source',
    sha256: 'b0439afe3fbe76d7bbad974f25475b00aa461c61e72fd6fade62f47e3ec4af9b',
    normalizeCheckoutEol: false,
  },
  {
    file: 'tests/visual/tailwind-parity/production-sources/design-tokens/output/tokens-tailwind.json.source',
    sha256: 'bca88fd4fdd717c498ad6cf8f68768766cb8f89cb6305b9bc3af3804d8a14b5f',
    normalizeCheckoutEol: false,
  },
  {
    file: 'tests/visual/tailwind-parity/production-sources/postcss.config.cjs.source',
    sha256: '6f3215601b7292a13a7d9a35ef270dfaaaafedd85ea70222192e7368ac491c5d',
    normalizeCheckoutEol: false,
  },
  {
    file: 'tests/visual/tailwind-parity/production-sources/tailwind.config.cjs.source',
    sha256: 'de39c4557ab5cc3b9a119db16c47f640f9c00bf82a42384dd7249cdc8c54ac36',
    normalizeCheckoutEol: false,
  },
  {
    file: 'tests/visual/tailwind-parity/production-sources/manifest.json',
    sha256: '952888d44ea4326b5b40b95f65fd3d782ed44be128e2717de80b6bbcd86827a2',
    normalizeCheckoutEol: true,
  },
  {
    file: 'tests/visual/tailwind-parity/production.json',
    sha256: 'e99c1fb70945ba917d9a7721b4a6ac2ccae3f8d6579788aa5306f545654c5297',
    normalizeCheckoutEol: true,
  },
]
const FROZEN_DATA_CAPTION =
  'A antiga app/globals.css e a antiga pipeline do Style Dictionary (design-tokens/output/tokens-tailwind.json e design-system:build-tokens) foram retiradas. Estes bytes são dados históricos fixados da produção eb4c0098, não instruções atuais.'

function historicalDataText(file: string, bytes: Buffer): string {
  const recorded = FROZEN_PRODUCTION_DATA.find((record) => record.file === file)
  if (!recorded) return bytes.toString('utf8')
  const reference = recorded.normalizeCheckoutEol
    ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'))
    : bytes
  if (createHash('sha256').update(reference).digest('hex') !== recorded.sha256)
    throw new Error(`Historical production data diverged: ${file}`)
  return `// ${FROZEN_DATA_CAPTION}\n${bytes.toString('utf8')}`
}

/** Citações que ficam de propósito: arquivo, artefato (início do id) e motivo. */
const ALLOWED: ReadonlyArray<{
  file: string
  artifact: string
  reason: string
}> = [
  {
    file: 'tests/visual/support/tailwind-parity-fixture.mjs',
    artifact: 'pipeline do Style Dictionary',
    reason:
      'Lê o blob histórico fixado de design-tokens/output/tokens-tailwind.json pelo manifesto de origem/SHA/Git: é a fonte da produção, não uma pipeline ativa desta árvore (entradas 227 e 339).',
  },
  {
    file: 'tests/visual/README.md',
    artifact: 'pipeline do Style Dictionary',
    reason:
      'Linha datada (2026-09-29) do histórico da linha de base visual: registra o tailwind.config.cjs daquele dia.',
  },
  {
    file: 'tests/unit/hygiene-check.test.ts',
    artifact: 'gerador zod',
    reason:
      'Usa lib/validations/schemas/** só como texto de glob nos testes do leitor de glob do hygiene (entrada 227).',
  },
  {
    file: 'tailwind.config.cjs',
    artifact: 'pipeline do Style Dictionary',
    reason:
      'Comentário que explica por que os tokens do Style Dictionary não entravam como cor; a entrada 227 o deixou para o dono do arquivo, fora do lote fechamento-final.',
  },
  {
    file: 'packages/design-tokens/src/primitives.ts',
    artifact: 'pipeline do Style Dictionary',
    reason:
      'Chama de "Style Dictionary da raiz" o design-tokens/base.json, que fica (lido por primitives.test.ts e web-sources.ts); arquivo fora do lote fechamento-final.',
  },
]

const COMMENT_LINE = /^\s*(?:\/\/+|\/\*+|\*+\/?|#+(?![\w{[]))\s?/

/** Frases de um trecho. Markdown: até . ! ? ou ;, item de lista, linha de tabela e cabeçalho; código: parágrafo de comentário ou linha. */
function sentences(text: string, markdown: boolean): string[] {
  const split = (prose: string) =>
    prose
      .split(/(?<=[.!?;])\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
  if (markdown)
    return text
      .split(/\n(?=[ \t]*(?:[-*+]|\d+[.)]|\||#{1,6})\s)/)
      .flatMap(split)
  const found: string[] = []
  let comment: string[] = []
  const flush = () => {
    found.push(...split(comment.join('\n')))
    comment = []
  }
  for (const line of text.split('\n')) {
    if (COMMENT_LINE.test(line)) comment.push(line.replace(COMMENT_LINE, ''))
    else {
      flush()
      if (line.trim()) found.push(line.trim())
    }
  }
  flush()
  return found
}

function cites(sentence: string): Retired[] {
  return RETIRED.filter(
    (artifact) =>
      artifact.patterns.some((pattern) => pattern.test(sentence)) ||
      artifact.sentence?.(sentence) === true
  )
}

/** Artefatos que o trecho dá como saídos (frase que cita o artefato e diz que saiu). */
function retiredIn(text: string, markdown: boolean): Set<string> {
  return new Set(
    sentences(text, markdown)
      .filter((sentence) => RETIREMENT.test(sentence))
      .flatMap((sentence) => cites(sentence).map((artifact) => artifact.id))
  )
}

type Unit = { start: number; text: string }

/** Markdown em unidades: a introdução (antes do primeiro `##`) e cada seção de nível 1 ou 2; cercas de código não cortam. */
function markdownUnits(text: string): Unit[] {
  const units: Array<{ start: number; lines: string[] }> = [
    { start: 1, lines: [] },
  ]
  let fence: string | null = null
  text.split('\n').forEach((line, index) => {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    if (fence) {
      if (marker?.startsWith(fence)) fence = null
    } else if (marker) fence = marker
    else if (/^##\s/.test(line) || (/^#\s/.test(line) && units.length > 1))
      units.push({ start: index + 1, lines: [] })
    units.at(-1)!.lines.push(line)
  })
  return units.map((unit) => ({
    start: unit.start,
    text: unit.lines.join('\n'),
  }))
}

/** Entradas do known-issues que as instruções de agente citam ("entrada 171", "entradas 173, 174 e 187"). */
function citedEntries(texts: string[]): Set<string> {
  const entries = new Set<string>()
  for (const text of texts)
    for (const match of text.matchAll(
      /entradas?\s+(\d+(?:\s*(?:,|\be\b)\s*\d+)*)/giu
    ))
      for (const number of match[1]!.match(/\d+/g)!) entries.add(number)
  return entries
}

/**
 * Citações sem frase de retirada num arquivo, como "linha: artefato: frase". `liveEntries`: só para o known-issues,
 * as entradas lidas como regra (as outras não são lidas, e a introdução não cobre as lidas).
 */
function staleMentions(
  file: string,
  raw: string,
  liveEntries?: ReadonlySet<string>
): string[] {
  const text = raw.replace(/\r\n?/g, '\n')
  const markdown = /\.(?:md|mdc|mdx)$/i.test(file)
  const knownIssues = liveEntries !== undefined
  let units: Unit[] = markdown ? markdownUnits(text) : [{ start: 1, text }]
  const fileWide =
    markdown && !knownIssues
      ? retiredIn(units[0]!.text, true)
      : new Set<string>()
  if (knownIssues)
    units = units.filter((unit, index) => {
      if (index === 0) return true
      const entry = /^##\s+(\d+)\./.exec(unit.text)?.[1]
      return entry !== undefined && liveEntries.has(entry)
    })
  const problems: string[] = []
  for (const unit of units) {
    const covered = new Set([...fileWide, ...retiredIn(unit.text, markdown)])
    for (const sentence of sentences(unit.text, markdown))
      for (const artifact of cites(sentence))
        if (!covered.has(artifact.id)) {
          const at = unit.text.indexOf(sentence.split('\n')[0]!)
          const line =
            unit.start +
            (at < 0 ? 0 : unit.text.slice(0, at).split('\n').length - 1)
          problems.push(
            `${line}: ${artifact.id}: ${sentence.replace(/\s+/g, ' ').slice(0, 200)}`
          )
        }
  }
  return problems
}

/** Arquivos de texto que o git lista (versionados ou novos, sem os ignorados), fora do recorte histórico. */
function scannedFiles(): string[] {
  return execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
  )
    .split('\0')
    .filter((file) => file && !OUT_OF_SCOPE.some((rule) => rule.test(file)))
    .filter((file) =>
      fs.lstatSync(path.join(ROOT, file), { throwIfNoEntry: false })?.isFile()
    )
    .sort()
}

const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')

// O caso que varre o repositório roda o git e lê cada arquivo que ele lista (4.339 em 2026-10-07): isolado, de 1,3 a
// 1,4 s com cache quente e de 3,3 a 5,8 s frio (medido em 2026-10-07); sob a carga do pnpm test:unit completo, 3,4 s
// numa execução e 14,9, 18,3 e 28,7 s em outras, a última acima dos 20 s do padrão.
const REPO_SCAN = { timeout: 60_000 }

describe('artefatos aposentados não aparecem como vivos (achado 135)', () => {
  it('cada artefato da lista saiu de verdade (arquivo, script, dependência e link)', () => {
    const remains = RETIRED.flatMap((artifact) =>
      artifact.remains().map((problem) => `${artifact.id}: ${problem}`)
    )
    expect(remains).toEqual([])
  })

  it('o recorte histórico é o que docs/README.md declara', () => {
    const readme = read('docs/README.md')
    const section =
      /### [^\n]*Registros históricos[^\n]*\n([\s\S]*?)\n## /.exec(readme)?.[1]
    expect(section).toBeDefined()
    expect(
      HISTORICAL_IN_README.filter((name) => !section!.includes(name))
    ).toEqual([])
  })

  it(
    'docs, instruções de agente e comentários só citam os artefatos como saídos',
    REPO_SCAN,
    () => {
      const files = scannedFiles()
      // Controle: a varredura enxerga docs vivos, instruções, código e o known-issues.
      expect(files).toEqual(
        expect.arrayContaining([
          'AGENTS.md',
          'apps/clients/web/AGENTS.md',
          'apps/clients/web/next.config.mjs',
          'docs/architecture/adr-tenant-hosts.md',
          'docs/features/design-system.md',
          KNOWN_ISSUES,
          'tools/sync-web-public.mjs',
        ])
      )
      const live = citedEntries(
        files.filter((file) => AGENT_INSTRUCTIONS.test(file)).map(read)
      )
      // A entrada 171 é a regra 7 do AGENTS.md (junção, link e remoção recursiva).
      expect(live).toContain('171')
      const found = files.flatMap((file) => {
        const buffer = fs.readFileSync(path.join(ROOT, file))
        if (buffer.includes(0)) return []
        return staleMentions(
          file,
          historicalDataText(file, buffer),
          file === KNOWN_ISSUES ? live : undefined
        ).map((problem) => ({ file, problem }))
      })
      const allowed = (file: string, problem: string) =>
        ALLOWED.some(
          (entry) =>
            entry.file === file &&
            problem.includes(`: ${entry.artifact}`) &&
            entry.reason.length >= 20
        )
      expect(
        found
          .filter(({ file, problem }) => !allowed(file, problem))
          .map(({ file, problem }) => `${file}:${problem}`)
      ).toEqual([])
      // A lista de exceções só encolhe: exceção que não acha mais citação reprova.
      expect(
        ALLOWED.filter(
          (entry) =>
            !found.some(
              ({ file, problem }) =>
                file === entry.file && problem.includes(`: ${entry.artifact}`)
            )
        ).map((entry) => `${entry.file} (${entry.artifact})`)
      ).toEqual([])
    }
  )

  it('reconhece citação viva e aceita a que diz que o artefato saiu (controle do leitor)', () => {
    const md = (text: string) => staleMentions('x.md', text)
    const code = (text: string) => staleMentions('x.mjs', text)
    // Vivos: reprovam.
    for (const text of [
      '- A junção documentada de `apps/clients/web/public` (`pnpm link:web-public`) é\n  a única exceção existente e nunca deve ser apagada recursivamente.',
      'O `scripts/post-prisma-generate.js` será removido depois.',
      'O `style-dictionary` não foi removido.',
      'O `pnpm link:web-public` vai sair na próxima onda.',
      '`apps/clients/web/public` é um link ignorado pelo git.',
      'Rode `pnpm design-system:build-tokens` depois de mudar `base.json`.',
      '| **Style Dictionary** | ✅ Implementado | Gestão de tokens |',
      '1. `prebuild`: `prisma generate && node scripts/post-prisma-generate.js`',
      'O `foo.js` saiu. Rode `pnpm link:web-public` para criar a pasta.',
      '# Título\n\n## A\n\nO `style-dictionary` saiu.\n\n## B\n\nUse o `style-dictionary`.',
      'Rode `scripts/clean-install-windows.ps1`.',
      'Use app/api/cart/sync/route.ts.',
      'A app/admin/layout.tsx não foi removida.',
      'Importe @/lib/auth para autorizar.',
      'Execute scripts/fix-rls-policies.js.',
      'Edite o next.config.mjs da raiz.',
      'Use types/global.d.ts.',
    ])
      expect.soft(md(text), text).not.toEqual([])
    for (const text of [
      '// Assets de public/ vão ao backend: na Vercel o link apps/clients/web/public não existe.',
      '// Todo /api/* passa pelo proxy; a entrada /api saiu do fallback.\n// Assets de public/ vão ao backend antes do sistema de arquivos: na Vercel o link apps/clients/web/public não existe.',
      "const script = 'post-prisma-generate.js'",
    ])
      expect.soft(code(text), text).not.toEqual([])
    // Saídos, ou sem citação: passam.
    for (const text of [
      '- A junção de `apps/clients/web/public` (`pnpm link:web-public`) é a única\n  exceção.\n- **Atualização (2026-09-30)**: a exceção acabou; a junção e\n  `pnpm link:web-public` saíram.',
      '`apps/clients/web/public` era um link ignorado pelo git; hoje é uma cópia.',
      'A cópia `apps/clients/web/public` fica fora do git.',
      'A pipeline do Style Dictionary (`design-tokens/output/*` e os scripts\n`design-system:*-tokens`) saiu em 2026-09-30.',
      '# Guia\n\n> O `prisma-zod-generator` saiu na onda 9.\n\n## Instalar\n\n`pnpm add -D prisma-zod-generator`',
      'O antigo `scripts/clean-install-windows.ps1` rodava `taskkill`.',
      'Até `351-link-web-public` no registro de migração.',
      'O `generator zod` não existe mais no schema.',
      'A raiz app/ e as fachadas lib/ saíram no Bloco F.',
      'O antigo scripts/fix-rls-policies.js foi retirado.',
      'apps/services/api/src/app/api/cart/sync/route.ts continua no serviço.',
      'packages/frontend/src/app/styles/globals.web.css mantém o CSS.',
      'apps/clients/web/next.config.mjs e apps/services/api/next.config.mjs ficam.',
      'apps/services/api/vercel.json e apps/services/api/Dockerfile ficam.',
      'types/next-auth.d.ts continua como augmentation.',
      'Use types/global.d.ts.map.',
      'Use scripts/fix-rls-policies.js.map.',
    ])
      expect.soft(md(text), text).toEqual([])
    for (const text of [
      '// Assets de public/ vão ao backend (WEB_API_ORIGIN): a cópia\n// apps/clients/web/public (tools/sync-web-public.mjs) fica fora do git.',
      "/**\n * O antigo `generator zod` (prisma-zod-generator) gravava 2.800 arquivos.\n */\nconst block = 'generator zod {}'",
      'throw new Error(`${dest} é um link, resto do antigo tools/link-web-public.mjs.`)',
    ])
      expect.soft(code(text), text).toEqual([])
  })

  it('dados históricos fixados conservam todos os bytes e reprovam adulteração ou origem diferente', () => {
    for (const record of FROZEN_PRODUCTION_DATA) {
      const bytes = fs.readFileSync(path.join(ROOT, record.file))
      const contextual = historicalDataText(record.file, bytes)
      expect(contextual.endsWith(bytes.toString('utf8')), record.file).toBe(
        true
      )
      expect(staleMentions(record.file, contextual), record.file).toEqual([])
      expect(() =>
        historicalDataText(
          record.file,
          Buffer.concat([bytes, Buffer.from('changed')])
        )
      ).toThrow('Historical production data diverged')
    }
    const unregistered =
      'tests/visual/tailwind-parity/production-sources/new-fixture.source'
    const live = Buffer.from('Use app/api/cart/sync/route.ts.')
    expect(historicalDataText(unregistered, live)).toBe(live.toString())
    expect(
      staleMentions(unregistered, historicalDataText(unregistered, live))
    ).not.toEqual([])
    const manifestRecord = FROZEN_PRODUCTION_DATA.find((record) =>
      record.file.endsWith('/manifest.json')
    )!
    const forgedOrigin = fs
      .readFileSync(path.join(ROOT, manifestRecord.file), 'utf8')
      .replace(
        'eb4c0098d5d8686b8d72e9aaf560968bb65274e4',
        '1111111111111111111111111111111111111111'
      )
    expect(() =>
      historicalDataText(manifestRecord.file, Buffer.from(forgedOrigin))
    ).toThrow('Historical production data diverged')
    expect(() =>
      historicalDataText(
        manifestRecord.file,
        fs.readFileSync(path.join(ROOT, FROZEN_PRODUCTION_DATA[0]!.file))
      )
    ).toThrow('Historical production data diverged')
  })

  it('no known-issues, lê só as entradas citadas como regra, e a introdução não as cobre', () => {
    const text = [
      '# Problemas',
      '',
      '> Entradas antigas descrevem o código da época; `pnpm link:web-public` saiu.',
      '',
      '## 171. Incidente',
      '',
      '- A junção de `apps/clients/web/public` (`pnpm link:web-public`) é a única exceção.',
      '',
      '## 150. Antiga',
      '',
      '- Rode `pnpm link:web-public`.',
    ].join('\n')
    expect(staleMentions(KNOWN_ISSUES, text, new Set(['171']))).toHaveLength(1)
    expect(staleMentions(KNOWN_ISSUES, text, new Set(['150']))).toHaveLength(1)
    expect(staleMentions(KNOWN_ISSUES, text, new Set())).toEqual([])
    expect(
      citedEntries([
        'entrada 171 de `docs/issues/known-issues.md`',
        'entradas 173, 174 e 187',
      ])
    ).toEqual(new Set(['171', '173', '174', '187']))
  })
})
