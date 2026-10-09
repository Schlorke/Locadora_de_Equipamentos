// Achado 145, item 7 (onda 132): o CSS global lê classes de apps/clients/web/src, mas o código só de servidor do host
// (proxy, roteamento, gateway server-only e Route Handlers) não renderiza classe; um nome solto ali (a constante
// `paused` da onda 131) virava utilitário. Confere que cada arquivo só de servidor cai num `@source not` do
// globals.web.css, que nenhum arquivo que renderiza classe é excluído e que o CSS compilado não traz o utilitário
// `.paused`. Controle positivo da onda 132: um arquivo temporário com `paused` em cada pasta excluída gerou `.paused`
// sem os `@source not` e não gerou com eles.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
const stylesDir = path.join(
  repo,
  'packages',
  'frontend',
  'src',
  'app',
  'styles'
)
const entry = path.join(stylesDir, 'globals.web.css')
const webSrc = path.join(repo, 'apps', 'clients', 'web', 'src')

/** `**` atravessa pastas, `*` não; o resto é literal. */
function globToRegExp(glob: string): RegExp {
  let out = ''
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]!
    if (glob.startsWith('**/', i)) {
      out += '(?:.*/)?'
      i += 2
    } else if (glob.startsWith('**', i)) {
      out += '.*'
      i += 1
    } else if (char === '*') out += '[^/]*'
    else out += char.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp('^' + out + '$')
}

const css = fs.readFileSync(entry, 'utf8')
const exclusions = [...css.matchAll(/^@source not '([^']+)';$/gm)].map(
  (match) =>
    globToRegExp(
      path.posix.join(stylesDir.split(path.sep).join('/'), match[1]!)
    )
)
const excluded = (file: string) =>
  exclusions.some((pattern) => pattern.test(file.split(path.sep).join('/')))

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) return []
    return entry.isDirectory()
      ? files(full)
      : /\.[jt]sx?$/.test(entry.name)
        ? [full]
        : []
  })
}

const SERVER_ONLY = (file: string) => {
  const rel = path.relative(webSrc, file).split(path.sep).join('/')
  return (
    rel === 'proxy.ts' ||
    rel.startsWith('host/routing/') ||
    rel.startsWith('host/server/') ||
    /(^|\/)route\.ts$/.test(rel)
  )
}

describe('@source do CSS global: código só de servidor do host web fora da varredura', () => {
  const all = files(webSrc).filter(
    (file) => !/\.(test|spec)\.[jt]sx?$/.test(file)
  )

  it('todo arquivo só de servidor do host web é excluído', () => {
    const server = all.filter(SERVER_ONLY)
    expect(server.length).toBeGreaterThan(5)
    expect(
      server
        .filter((file) => !excluded(file))
        .map((file) => path.relative(repo, file))
    ).toEqual([])
  })

  it('nenhum arquivo que pode renderizar classe é excluído (providers, ui, páginas e layouts continuam lidos)', () => {
    const rendering = all.filter((file) => !SERVER_ONLY(file))
    expect(rendering.length).toBeGreaterThan(20)
    expect(
      rendering.filter(excluded).map((file) => path.relative(repo, file))
    ).toEqual([])
  })

  it('os arquivos só de servidor não renderizam classe', () => {
    const withClass = all
      .filter(SERVER_ONLY)
      .filter((file) =>
        /className=|\bclass=/.test(fs.readFileSync(file, 'utf8'))
      )
    expect(withClass.map((file) => path.relative(repo, file))).toEqual([])
  })

  it('o CSS compilado como o build:web não traz o utilitário solto .paused', async () => {
    const requireRoot = createRequire(path.join(repo, 'package.json'))
    const postcss = requireRoot('postcss')
    const tailwind = requireRoot('@tailwindcss/postcss')
    const result = await postcss([
      tailwind({
        base: path.join(repo, 'apps', 'clients', 'web'),
        optimize: false,
      }),
    ]).process(css, { from: entry })
    const selectors: string[] = []
    result.root.walkRules((rule: { selectors: string[] }) =>
      selectors.push(...rule.selectors.map((s) => s.trim()))
    )
    expect(selectors.length).toBeGreaterThan(1000)
    expect(selectors).not.toContain('.paused')
  })
})
