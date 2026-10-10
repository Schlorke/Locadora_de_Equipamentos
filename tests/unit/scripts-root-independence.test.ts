import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Os scripts operacionais (`scripts/**`, inclusive os que o package.json chama) não podem voltar a importar a raiz
 * antiga retirada em F (plano da onda 135, seções 6.1 e 6.2): `app/`, `lib/`, `middlewares/`, `schemas/`, `types/`
 * ou `proxy.ts`, nem por `@/` nem por caminho relativo. Os antigos lib/storage-utils.ts (COD-03) e
 * lib/google-merchant/* (COD-04) foram retirados; as quarentenas portadas pertencem a `scripts/ops/`.
 * Prisma/Supabase usam `@gb-locacoes/backend/runtime` e orçamento `@gb-locacoes/backend/quotations`.
 * Só o import é cobrado (declaração, `export … from`, `import()`, `require()` e `import('…')` de tipo); texto que
 * apenas cita o caminho, como o antigo reescritor scripts/fix-prisma-imports.js retirado em F, não conta.
 */
const ROOT = path.resolve(import.meta.dirname, '../..')
const LEGACY_ROOTS = ['app', 'lib', 'middlewares', 'schemas', 'types', 'proxy']
/** Ainda importam a raiz e têm item próprio no plano; saem desta lista quando o item fecha (a lista só encolhe). */
const PENDING: Record<string, string> = {}

function scriptFiles(directory: string): string[] {
  return fs
    .readdirSync(path.join(ROOT, directory), { withFileTypes: true })
    .flatMap((entry) => {
      const relative = `${directory}/${entry.name}`
      if (entry.isDirectory()) return scriptFiles(relative)
      return /\.(?:[cm]?[jt]s|tsx)$/.test(entry.name) ? [relative] : []
    })
}

/** Especificadores importados de verdade pelo arquivo (não strings soltas). */
function importedSpecifiers(file: string, source: string): string[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      found.push(node.moduleSpecifier.text)
    else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require')) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    )
      found.push(node.arguments[0].text)
    else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    )
      found.push(node.argument.literal.text)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return found
}

/** O especificador leva à raiz antiga retirada? Exemplos sintéticos: `@/lib/x`, `../lib/x`, `../../app/x`, `../proxy`. */
function reachesLegacyRoot(file: string, specifier: string): boolean {
  let target: string
  if (specifier.startsWith('@/')) target = specifier.slice(2)
  else if (specifier.startsWith('.'))
    target = path.posix.normalize(
      path.posix.join(path.posix.dirname(file), specifier)
    )
  else return false
  const first = target.split('/')[0]!.replace(/\.[cm]?[jt]sx?$/, '')
  return LEGACY_ROOTS.includes(first)
}

describe('scripts operacionais sem a raiz legada', () => {
  it('reconhece só import real e só a raiz legada', () => {
    // Os imports de app/lib/middleware/proxy antigos retirados abaixo são textos adversariais passados ao parser,
    // sem escrever arquivos ou carregar essas fachadas no runtime. O controle string mantém o mesmo texto sem import.
    const source = [
      "import a from '@/lib/prisma'",
      "export { b } from '../lib/x'",
      "const c = await import('../app/api/route')",
      "const d = require('@/middlewares/require-admin')",
      "type E = typeof import('../proxy')",
      'const text = "import { prisma } from \'@/lib/prisma\'"',
      "import f from '@gb-locacoes/backend/runtime'",
      "import g from './ops/storage-utils'",
      "import h from '../tools/library'",
    ].join('\n')
    const specifiers = importedSpecifiers('scripts/x.ts', source)
    expect(specifiers).not.toContain("import { prisma } from '@/lib/prisma'")
    expect(
      specifiers.filter((specifier) =>
        reachesLegacyRoot('scripts/x.ts', specifier)
      )
    ).toEqual([
      '@/lib/prisma',
      '../lib/x',
      '../app/api/route',
      '@/middlewares/require-admin',
      '../proxy',
    ])
    // Dentro de scripts/, "./lib/x" e "../lib/x" (a partir de scripts/ops) não saem para a raiz.
    expect(reachesLegacyRoot('scripts/ops/y.ts', '../lib/x')).toBe(false)
    expect(reachesLegacyRoot('scripts/ops/y.ts', '../../lib/x')).toBe(true)
  })

  it('nenhum script importa a raiz legada, salvo os itens pendentes do plano', () => {
    const offenders = scriptFiles('scripts')
      .filter((file) =>
        importedSpecifiers(
          file,
          fs.readFileSync(path.join(ROOT, file), 'utf8')
        ).some((specifier) => reachesLegacyRoot(file, specifier))
      )
      .sort()
    expect(offenders.filter((file) => !(file in PENDING))).toEqual([])
    // Pendência resolvida sai da lista: a exceção não sobrevive ao item.
    expect(
      Object.keys(PENDING).filter((file) => !offenders.includes(file))
    ).toEqual([])
  })

  it('os scripts do package.json existem e não dependem da raiz legada', () => {
    const scripts = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    ).scripts as Record<string, string>
    const targets = [
      ...new Set(
        Object.values(scripts).flatMap((command) =>
          [...command.matchAll(/\bscripts\/[\w./-]+\.(?:[cm]?[jt]s)\b/g)].map(
            (match) => match[0]
          )
        )
      ),
    ]
    expect(targets).toEqual(
      expect.arrayContaining([
        'scripts/backfill-quote-codes.ts',
        'scripts/dedupe-quote-boleto-payments.ts',
      ])
    )
    for (const file of targets) {
      expect(fs.existsSync(path.join(ROOT, file)), file).toBe(true)
      if (file in PENDING) continue
      const legacy = importedSpecifiers(
        file,
        fs.readFileSync(path.join(ROOT, file), 'utf8')
      ).filter((specifier) => reachesLegacyRoot(file, specifier))
      expect(legacy, file).toEqual([])
    }
  })
})
