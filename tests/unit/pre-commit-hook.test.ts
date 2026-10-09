import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * .husky/pre-commit (achado 129): o hook formata só o Markdown que vai no commit e re-adiciona só os arquivos que
 * ele mesmo mudou. O `git add .` de antes levava para o commit a mudança não preparada e o arquivo novo de quem
 * divide o checkout (outra pessoa ou outro agente). O hook roda como o husky o roda (`sh -e`, com o
 * node_modules/.bin do repositório no PATH), num repositório descartável com prettier e markdownlint de verdade.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const hook = path.join(repoRoot, '.husky', 'pre-commit')
const roots: string[] = []

afterEach(() => {
  // Pastas temporárias só com arquivos regulares criados pelo próprio teste.
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

const BAD_LIST = '# Título\n\n*   item um\n*   item dois\n'
const GOOD_LIST = '# Título\n\n- item um\n- item dois\n'

function repository() {
  const root = fs.mkdtempSync(path.join(path.resolve(os.tmpdir()), 'locadora-pre-commit-'))
  roots.push(root)
  // O git não sobe até um repositório acima da pasta temporária (o %TEMP% pode morar dentro de um).
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(root) }
  const pathKey = Object.keys(env).find((key) => key.toUpperCase() === 'PATH') ?? 'PATH'
  env[pathKey] = [path.join(repoRoot, 'node_modules', '.bin'), env[pathKey]].join(path.delimiter)
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' }).replace(/\n$/, '')
  const write = (file: string, body: string) => {
    const target = path.resolve(root, file)
    if (!target.startsWith(root + path.sep)) throw new Error('Fixture escaped temporary root')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, body)
  }
  const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
  git('init', '-q')
  if (path.resolve(git('rev-parse', '--show-toplevel')) !== path.resolve(root)) throw new Error('Fixture is not its own repository')
  for (const [key, value] of [
    ['user.name', 'Fixture'],
    ['user.email', 'fixture@example.test'],
    ['core.autocrlf', 'false'],
    ['commit.gpgsign', 'false'],
  ])
    git('config', key!, value!)
  const runHook = () => spawnSync('sh', ['-e', hook], { cwd: root, env, encoding: 'utf8' })
  const lines = (text: string) => text.split('\n').filter(Boolean).sort()
  return { root, git, write, read, runHook, lines }
}

describe('.husky/pre-commit', () => {
  it('formata e re-adiciona só o Markdown preparado; mudança não preparada, parte não preparada e arquivo novo ficam fora', () => {
    const repo = repository()
    repo.write('docs/preparado.md', '# Título\n\n- item antigo\n')
    repo.write('docs/alheio.md', GOOD_LIST)
    repo.write('docs/parcial.md', GOOD_LIST)
    repo.write('src/codigo.ts', 'export const a = 1\n')
    // Markdown já versionado fora do padrão e fora deste commit: o hook não reformata o repositório.
    repo.write('docs/legado.md', BAD_LIST)
    repo.git('add', '-A')
    repo.git('commit', '-q', '-m', 'base')

    // O commit: um Markdown mal formatado, preparado inteiro.
    repo.write('docs/preparado.md', BAD_LIST)
    repo.git('add', '--', 'docs/preparado.md')
    // Parcial: uma versão preparada e outra mudança por cima, não preparada.
    repo.write('docs/parcial.md', `${BAD_LIST}\n*   preparado\n`)
    repo.git('add', '--', 'docs/parcial.md')
    repo.write('docs/parcial.md', `${BAD_LIST}\n*   preparado\n\n*   não preparado\n`)
    // Trabalho de outra pessoa no mesmo checkout: mudanças não preparadas e um arquivo novo.
    repo.write('docs/alheio.md', BAD_LIST)
    repo.write('src/codigo.ts', 'export const a = 2\n')
    repo.write('docs/novo.md', BAD_LIST)

    const result = repo.runHook()
    expect(result.error, 'sh precisa existir (Git Bash no Windows)').toBeUndefined()
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)

    // Só o que já estava preparado continua no índice, e o formatado entra formatado.
    expect(repo.lines(repo.git('diff', '--cached', '--name-only'))).toEqual(['docs/parcial.md', 'docs/preparado.md'])
    expect(repo.git('show', ':docs/preparado.md')).toBe(GOOD_LIST.replace(/\n$/, ''))
    expect(repo.read('docs/preparado.md')).toBe(GOOD_LIST)
    // O parcial fica como estava: versão preparada e cópia de trabalho intactas.
    expect(repo.git('show', ':docs/parcial.md')).toBe(`${BAD_LIST}\n*   preparado`)
    expect(repo.read('docs/parcial.md')).toBe(`${BAD_LIST}\n*   preparado\n\n*   não preparado\n`)
    expect(result.stdout).toContain('docs/parcial.md tem mudança não preparada')
    // O que não estava preparado continua fora do índice e sem formatação.
    expect(repo.lines(repo.git('diff', '--name-only'))).toEqual(['docs/alheio.md', 'docs/parcial.md', 'src/codigo.ts'])
    expect(repo.read('docs/alheio.md')).toBe(BAD_LIST)
    expect(repo.git('ls-files', '--others', '--exclude-standard')).toBe('docs/novo.md')
    expect(repo.read('docs/novo.md')).toBe(BAD_LIST)
    expect(repo.read('docs/legado.md')).toBe(BAD_LIST)
  })

  it('sem Markdown preparado não formata nem adiciona nada', () => {
    const repo = repository()
    repo.write('docs/a.md', GOOD_LIST)
    repo.write('src/codigo.ts', 'export const a = 1\n')
    repo.git('add', '-A')
    repo.git('commit', '-q', '-m', 'base')
    repo.write('src/codigo.ts', 'export const a = 2\n')
    repo.git('add', '--', 'src/codigo.ts')
    repo.write('docs/a.md', BAD_LIST)

    const result = repo.runHook()
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
    expect(repo.git('diff', '--cached', '--name-only')).toBe('src/codigo.ts')
    expect(repo.read('docs/a.md')).toBe(BAD_LIST)
  })

  it('Markdown preparado que o .markdownlintignore ignora não vai ao markdownlint (ele imprimia a ajuda inteira no commit)', () => {
    const repo = repository()
    // As listas de ignorados reais do repositório: cópias de skills do instalador ficam fora dos dois formatadores.
    for (const file of ['.markdownlintignore', '.prettierignore']) repo.write(file, fs.readFileSync(path.join(repoRoot, file), 'utf8'))
    repo.write('docs/a.md', GOOD_LIST)
    repo.git('add', '-A')
    repo.git('commit', '-q', '-m', 'base')

    // Só Markdown ignorado no commit: o hook fica calado e não mexe nele.
    repo.write('.agents/skills/x/SKILL.md', BAD_LIST)
    repo.write('.claude/skills/y/com espaço.md', BAD_LIST)
    repo.git('add', '--', '.agents/skills/x/SKILL.md', '.claude/skills/y/com espaço.md')
    const alone = repo.runHook()
    expect(alone.status, `${alone.stdout}\n${alone.stderr}`).toBe(0)
    expect(`${alone.stdout}${alone.stderr}`).toBe('')
    expect(repo.read('.agents/skills/x/SKILL.md')).toBe(BAD_LIST)
    expect(repo.read('.claude/skills/y/com espaço.md')).toBe(BAD_LIST)

    // Com um Markdown não ignorado junto, só ele é formatado e re-adicionado.
    repo.write('docs/a.md', BAD_LIST)
    repo.git('add', '--', 'docs/a.md')
    const mixed = repo.runHook()
    expect(mixed.status, `${mixed.stdout}\n${mixed.stderr}`).toBe(0)
    expect(`${mixed.stdout}${mixed.stderr}`).toBe('')
    expect(repo.git('show', ':docs/a.md')).toBe(GOOD_LIST.replace(/\n$/, ''))
    expect(repo.read('.agents/skills/x/SKILL.md')).toBe(BAD_LIST)
    expect(repo.git('show', ':.agents/skills/x/SKILL.md')).toBe(BAD_LIST.replace(/\n$/, ''))
    expect(repo.lines(repo.git('diff', '--name-only'))).toEqual([])
  })

  it('reprova o commit quando o markdownlint acha erro que não corrige sozinho', () => {
    const repo = repository()
    repo.write('README.md', GOOD_LIST)
    repo.git('add', '-A')
    repo.git('commit', '-q', '-m', 'base')
    // MD041: a primeira linha não é um título (o --fix não resolve).
    repo.write('README.md', 'texto sem título\n')
    repo.git('add', '--', 'README.md')

    const result = repo.runHook()
    expect(result.status).not.toBe(0)
    expect(`${result.stdout}${result.stderr}`).toMatch(/MD041/)
  })
})
