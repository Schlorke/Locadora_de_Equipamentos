import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const methods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
const ignored = new Set(['node_modules', '.next', 'dist', 'dist-export', '.expo', '.git'])
const relative = (file) => path.relative(root, file).split(path.sep).join('/')

function files(directory) {
  let entries
  try { entries = readdirSync(directory, { withFileTypes: true }) } catch { return [] }
  return entries.flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? (ignored.has(entry.name) ? [] : files(file)) : [file]
  })
}

function endpoint(file) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const exports = []
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name &&
        statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
        methods.has(statement.name.text)) exports.push(statement.name.text)
    if (ts.isVariableStatement(statement) &&
        statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && methods.has(declaration.name.text)) exports.push(declaration.name.text)
      }
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const specifier of statement.exportClause.elements) {
        if (methods.has(specifier.name.text)) exports.push(specifier.name.text)
      }
    }
  }
  return { file: relative(file), methods: [...new Set(exports)].sort() }
}

const WEB_APP_DIR = 'apps/clients/web/src/app'
const ROUTE_GROUP = /^\(.+\)$/

/**
 * Host e URL visível de uma página do host web (docs/architecture/adr-tenant-hosts.md, 4.2 e 4.3). Grupos `(x)` não
 * entram na URL; `[locadora]` é o segmento interno do host de locadora e `plataforma` o do apex (o proxy reescreve
 * para eles); as demais páginas são servidas no host `app`.
 */
export function webVisibleRoute(fileInApp) {
  const segments = fileInApp.split('/').slice(0, -1)
  const visible = segments.filter((segment) => !ROUTE_GROUP.test(segment))
  let host = 'app'
  if (visible[0] === '[locadora]') { host = 'tenant'; visible.shift() }
  else if (visible[0] === 'plataforma') { host = 'apex'; visible.shift() }
  return { host, url: '/' + visible.join('/'), groups: segments.filter((segment) => ROUTE_GROUP.test(segment)) }
}

const surfaces = Object.fromEntries([
  ['legacy', 'app'], ['api', 'apps/services/api/src/app'], ['web', WEB_APP_DIR], ['mobile', 'apps/clients/mobile/src/app'],
].map(([name, directory]) => {
  const entries = files(path.join(root, directory))
  const pages = entries.filter((file) => name === 'mobile'
    ? /\.(tsx|jsx)$/.test(file) && !/[_+]/.test(path.basename(file)[0])
    : /[/\\]page\.(tsx|jsx)$/.test(file)).map(relative).sort()
  return [name, {
    pages,
    endpoints: entries.filter((file) => /[/\\]route\.(ts|js)$/.test(file)).map(endpoint),
    // Host web: host (tenant, app, apex) e URL visível de cada página.
    ...(name === 'web' ? { routes: pages.map((file) => ({ file, ...webVisibleRoute(file.slice(WEB_APP_DIR.length + 1)) })) } : {}),
  }]
}))
const inventory = {
  generatedAt: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  note: 'Source inventory only. Route presence does not prove platform parity or authorization.',
  surfaces,
}
const outputFlag = process.argv.indexOf('--output')
if (process.argv.includes('--web-routes')) console.log(JSON.stringify(surfaces.web.routes, null, 2))
else if (outputFlag !== -1) {
  const output = path.resolve(root, process.argv[outputFlag + 1])
  if (!output.startsWith(root + path.sep)) throw new Error('Output must stay inside the workspace')
  mkdirSync(path.dirname(output), { recursive: true })
  writeFileSync(output, JSON.stringify(inventory, null, 2) + '\n')
  console.log(`Inventory written to ${relative(output)}`)
} else console.log(JSON.stringify(inventory, null, 2))
