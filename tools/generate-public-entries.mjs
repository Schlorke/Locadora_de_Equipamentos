#!/usr/bin/env node
/**
 * Gera apps/clients/web/src/host/routing/public-entries.generated.ts a partir das entradas de primeiro nível de
 * public/ na raiz (desenho docs/architecture/adr-tenant-hosts.md, seção 4.2).
 *
 * O proxy do host web é puro: não lê o disco em tempo de requisição. A lista gerada diz quais caminhos são
 * arquivos estáticos (seguem para `next`, e o `rewrites().beforeFiles` do next.config os leva ao backend) e quais
 * diretórios ficam fora do matcher do proxy. O teste de sincronia (public-entries.test.ts) compara o arquivo
 * gerado com o conteúdo atual de public/; rode este script sempre que um arquivo entrar ou sair de lá.
 *
 * Uso: node tools/generate-public-entries.mjs [--check]
 *   --check  não grava; sai com 1 se o arquivo gerado estiver desatualizado.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(root, 'public')
const output = path.join(root, 'apps', 'clients', 'web', 'src', 'host', 'routing', 'public-entries.generated.ts')

/** Entradas de primeiro nível de public/, separadas em arquivos e diretórios, em ordem estável. */
export function readPublicEntries(directory = publicDir) {
  const files = []
  const directories = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const isDirectory = entry.isSymbolicLink()
      ? fs.statSync(path.join(directory, entry.name)).isDirectory()
      : entry.isDirectory()
    ;(isDirectory ? directories : files).push(entry.name)
  }
  const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
  return { files: files.sort(byCodePoint), directories: directories.sort(byCodePoint) }
}

export function renderPublicEntries({ files, directories }) {
  const list = (values) => values.map((value) => `  ${JSON.stringify(value)},`).join('\n')
  return [
    '// Gerado por tools/generate-public-entries.mjs a partir de public/ (raiz). Não edite à mão:',
    '// rode `node tools/generate-public-entries.mjs` depois de incluir ou remover uma entrada de public/.',
    '',
    '/** Arquivos de primeiro nível de public/ (nome exato, sem a barra inicial). */',
    'export const PUBLIC_FILES: readonly string[] = [',
    list(files),
    ']',
    '',
    '/** Diretórios de primeiro nível de public/. Ficam fora do matcher do proxy e são slugs reservados. */',
    'export const PUBLIC_DIRECTORIES: readonly string[] = [',
    list(directories),
    ']',
    '',
  ].join('\n')
}

function main() {
  const expected = renderPublicEntries(readPublicEntries())
  const current = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : null
  if (process.argv.includes('--check')) {
    if (current !== expected) {
      console.error(`[generate-public-entries] desatualizado: ${path.relative(root, output)}`)
      process.exit(1)
    }
    console.log('[generate-public-entries] em dia')
    return
  }
  if (current === expected) {
    console.log('[generate-public-entries] nada a fazer')
    return
  }
  fs.writeFileSync(output, expected)
  console.log(`[generate-public-entries] gravado ${path.relative(root, output)}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
