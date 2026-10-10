import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Regra 7 do AGENTS.md e entrada 171 de docs/issues/known-issues.md (achado 133 da revisão): o `node_modules` do pnpm
 * é feito de links (junções, no Windows) para o store, e o checkout é dividido por pessoas e agentes. Nenhum script
 * do repositório pode derrubar todo processo Node pelo nome (`taskkill /f /im node.exe` e parentes: leva junto os
 * servidores e as ferramentas dos outros) nem apagar `node_modules` de forma recursiva (`rm -rf`, `Remove-Item
 * -Recurse`, `rmdir /s`, `rimraf`, `fs.rmSync(..., { recursive: true })`: atravessam as junções e esvaziam o store).
 * O caminho seguro está na seção "Limpeza segura" de docs/getting-started/troubleshooting.md.
 *
 * Alcance: tudo em scripts/ e tools/ (versionado ou não), os hooks do .husky/ e o campo "scripts" dos package.json do
 * workspace. Limite conhecido: a leitura é por texto, então um caminho montado em variável longe da chamada
 * (`const alvo = 'node_modules'` e, linhas depois, `fs.rmSync(alvo, ...)`) passa; o texto da chamada tem de citar
 * `node_modules`.
 */
const ROOT = path.resolve(import.meta.dirname, '../..')

/** Pastas percorridas (sem seguir link) e o que nunca se lê nelas. */
const SCANNED_FOLDERS = ['scripts', 'tools', '.husky']
const SKIPPED_FOLDERS = new Set(['node_modules', '.git'])

/** Comandos proibidos, cada um com o motivo. Um trecho que casa com `pattern` reprova o arquivo. */
const FORBIDDEN: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  {
    name: 'taskkill pelo nome da imagem do Node',
    pattern: /\btaskkill\b[^\n]*\/im\s+["']?node(?:\.exe)?\b/i,
  },
  {
    name: 'Stop-Process pelo nome do Node',
    pattern:
      /\b(?:Stop-Process|spps)\b[^\n]*-(?:Name|ProcessName)\s+["']?node(?:\.exe)?\b/i,
  },
  {
    name: 'Get-Process node encadeado a Stop-Process',
    pattern:
      /\b(?:Get-Process|gps|ps)\s+(?:-Name\s+)?["']?node(?:\.exe)?["']?[^\n]*\|\s*(?:Stop-Process|spps|kill)\b/i,
  },
  {
    name: 'pkill/killall do Node',
    pattern: /\b(?:pkill|killall)\b(?:\s+-\S+)*\s+["']?node(?:\.exe)?\b/i,
  },
  {
    name: 'wmic encerrando node.exe',
    pattern: /\bwmic\b[^\n]*node\.exe[^\n]*\b(?:delete|terminate)\b/i,
  },
  {
    name: 'rm recursivo em node_modules',
    pattern:
      /(?:^|[\s;&|(`"'])rm\s+(?:-{1,2}[\w-]*\s+)*?(?:-[a-z]*r[a-z]*|--recursive|-Recurse)\b[^\n;&|]*node_modules/i,
  },
  {
    name: 'Remove-Item -Recurse em node_modules',
    pattern:
      /\b(?:Remove-Item|ri|del|erase|rd|rmdir)\b(?:[^\n;|]*-r(?:ecurse)?\b[^\n;|]*node_modules|[^\n;|]*node_modules[^\n;|]*\s-r(?:ecurse)?\b)/i,
  },
  {
    name: 'rmdir /s em node_modules',
    pattern:
      /\b(?:rmdir|rd)\b(?:[^\n&|]*\/s\b[^\n&|]*node_modules|[^\n&|]*node_modules[^\n&|]*\/s\b)/i,
  },
  { name: 'rimraf em node_modules', pattern: /\brimraf\b[^\n]*node_modules/i },
]

/** Chamadas de remoção da API do Node (`rm`, `rmSync`, `rmdir`, `rmdirSync`, `fs.promises.rm`) com o texto dos argumentos. */
function removalCalls(text: string): string[] {
  const calls: string[] = []
  for (const match of text.matchAll(/\brm(?:dir)?(?:Sync)?\s*\(/g)) {
    let depth = 1
    let end = match.index + match[0].length
    while (end < text.length && depth > 0) {
      if (text[end] === '(') depth++
      else if (text[end] === ')') depth--
      end++
    }
    calls.push(text.slice(match.index, end))
  }
  return calls
}

/** O que o texto de um arquivo (ou de um script do package.json) tem de proibido, com a linha. */
function forbiddenCommands(text: string): string[] {
  const found: string[] = []
  const lineOf = (index: number) => text.slice(0, index).split('\n').length
  for (const { name, pattern } of FORBIDDEN)
    for (const match of text.matchAll(
      new RegExp(pattern.source, `${pattern.flags.replace('g', '')}gm`)
    ))
      found.push(`${lineOf(match.index)}: ${name}: ${match[0].trim()}`)
  for (const call of removalCalls(text))
    if (/node_modules/.test(call) && /\brecursive\s*:\s*true\b/.test(call))
      found.push(
        `${lineOf(text.indexOf(call))}: remoção recursiva de node_modules pela API do Node: ${call.replace(/\s+/g, ' ')}`
      )
  return found
}

/** Arquivos de texto das pastas vigiadas, sem seguir link e sem ler binário. */
function scannedFiles(): string[] {
  const files: string[] = []
  const walk = (relative: string) => {
    const absolute = path.join(ROOT, relative)
    const stat = fs.lstatSync(absolute, { throwIfNoEntry: false })
    if (!stat || stat.isSymbolicLink()) return
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort())
        if (!SKIPPED_FOLDERS.has(name)) walk(path.posix.join(relative, name))
    } else if (stat.isFile() && !fs.readFileSync(absolute).includes(0))
      files.push(relative)
  }
  for (const folder of SCANNED_FOLDERS) walk(folder)
  return files
}

/** Os package.json do workspace (raiz, apps/clients/* e packages/*). */
function workspaceManifests(): string[] {
  const inside = (folder: string) =>
    fs.existsSync(path.join(ROOT, folder))
      ? fs
          .readdirSync(path.join(ROOT, folder))
          .map((name) => path.posix.join(folder, name, 'package.json'))
          .filter((file) => fs.existsSync(path.join(ROOT, file)))
      : []
  return ['package.json', ...inside('apps/clients'), ...inside('packages')]
}

describe('scripts do repositório: nada de matar todo Node nem apagar node_modules à força (regra 7 do AGENTS.md)', () => {
  it('scripts/, tools/ e .husky/ não têm os comandos proibidos', () => {
    const files = scannedFiles()
    // A varredura enxerga as pastas de verdade (controle: sem isto, uma pasta vazia passaria calada).
    expect(files).toEqual(
      expect.arrayContaining([
        'tools/sync-web-public.mjs',
        'scripts/validate-docs-indexes.js',
        '.husky/pre-commit',
      ])
    )
    const offenders = files.flatMap((file) =>
      forbiddenCommands(fs.readFileSync(path.join(ROOT, file), 'utf8')).map(
        (problem) => `${file}:${problem}`
      )
    )
    expect(offenders).toEqual([])
  })

  it('os scripts dos package.json do workspace não têm os comandos proibidos', () => {
    const manifests = workspaceManifests()
    expect(manifests).toEqual(
      expect.arrayContaining([
        'package.json',
        'apps/clients/web/package.json',
        'packages/ui/package.json',
      ])
    )
    const offenders = manifests.flatMap((file) =>
      Object.entries(
        (JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')).scripts ??
          {}) as Record<string, string>
      ).flatMap(([name, command]) =>
        forbiddenCommands(command).map(
          (problem) => `${file} scripts.${name}: ${problem.replace(/^1: /, '')}`
        )
      )
    )
    expect(offenders).toEqual([])
  })

  it('reconhece cada forma proibida e deixa passar o procedimento seguro (controle do leitor)', () => {
    for (const command of [
      'taskkill /f /im node.exe 2>$null',
      'taskkill /IM "node.exe" /F',
      'Stop-Process -Name node -Force',
      'Get-Process node | Stop-Process',
      'pkill -f node',
      'killall node',
      "wmic process where name='node.exe' delete",
      'rm -rf node_modules',
      'rm -fr ./node_modules/.pnpm',
      'rm --recursive --force node_modules',
      'Remove-Item -Recurse -Force -ErrorAction SilentlyContinue node_modules',
      'Remove-Item node_modules -Recurse -Force',
      'Write-Host "Tente: Remove-Item -Recurse -Force node_modules; pnpm install"',
      'cmd /c rmdir /s /q node_modules',
      'rd node_modules /s /q',
      'npx rimraf node_modules',
      "fs.rmSync(path.join(root, 'node_modules'), { recursive: true, force: true })",
      "await fs.promises.rm('node_modules', {\n  recursive: true,\n})",
    ])
      expect.soft(forbiddenCommands(command), command).not.toEqual([])
    // A antiga .next da raiz foi retirada em F; o texto rm -rf .next abaixo é um controle do lexer, não limpeza executada.
    for (const command of [
      'pnpm install --force',
      'pnpm store prune',
      'Stop-Process -Id 1234',
      'taskkill /PID 1234 /F',
      'Get-ChildItem -Path "node_modules" -Recurse -Filter "rollup.win32-x64-msvc.node"',
      'rm -rf .next',
      'Remove-Item -Recurse -Force storybook-static',
      "fs.rmSync(path.join(root, 'node_modules', 'pacote.tgz'))",
      'fs.rmSync(directory, { recursive: true, force: true })',
      'cmd /c rmdir apps\\clients\\web\\public',
      'node tools/sync-web-public.mjs',
    ])
      expect.soft(forbiddenCommands(command), command).toEqual([])
  })
})
