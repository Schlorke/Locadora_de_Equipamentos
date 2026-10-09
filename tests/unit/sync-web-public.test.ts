// tools/sync-web-public.mjs: public/ da raiz vira uma CÓPIA real em apps/clients/web/public (achado 130 da revisão;
// substitui a junção NTFS de tools/link-web-public.mjs, contra a regra 7 do AGENTS.md e a entrada 171 dos known-issues).
// Os links destes testes apontam só para pastas do próprio diretório temporário, nunca para o repositório, e a
// limpeza remove cada link sozinho antes de apagar arquivo por arquivo (nada recursivo atravessa link).
// Execuções simultâneas (predev/prebuild em paralelo, agentes no mesmo checkout) são serializadas pelo trinco
// apps/clients/web/.sync-web-public.lock: antes dele, a segunda quebrava com EEXIST no mkdir ou EBUSY no copyfile.
import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SENTINEL,
  SyncRefusal,
  syncWebPublic,
  webPublicPaths,
} from '../../tools/sync-web-public.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const tool = path.join(repoRoot, 'tools', 'sync-web-public.mjs')

const created: string[] = []

/** Trinco que serializa as execuções; fica ao lado do destino (em apps/clients/web), nunca dentro dele. */
const LOCK_NAME = '.sync-web-public.lock'
const lockPath = (destination: string) =>
  path.join(path.dirname(destination), LOCK_NAME)
/** Processo do sistema que existe e que um usuário comum não pode sinalizar (EPERM): conta como vivo. */
const SYSTEM_PID = process.platform === 'win32' ? 4 : 1

/** Conteúdo de trinco como a ferramenta grava, com o dono informado. */
function lockContent(
  pid: number,
  overrides: Record<string, unknown> = {}
): string {
  return (
    JSON.stringify({
      tool: 'sync-web-public',
      pid,
      host: os.hostname(),
      platform: process.platform,
      token: `teste-${pid}`,
      since: new Date().toISOString(),
      ...overrides,
    }) + '\n'
  )
}

/** Pid de um processo que já terminou (não é reaproveitado no intervalo de um teste). */
function deadPid(): number {
  return spawnSync(process.execPath, ['-e', '']).pid
}

/** Envelhece um arquivo (data de modificação no passado). */
function age(file: string, ms: number): void {
  const past = new Date(Date.now() - ms)
  fs.utimesSync(file, past, past)
}

/** Apaga uma árvore sem nunca seguir link: o link sai sozinho (unlink), o resto arquivo por arquivo. */
function removeTree(target: string): void {
  let stat: fs.Stats
  try {
    stat = fs.lstatSync(target)
  } catch {
    return
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fs.unlinkSync(target)
    return
  }
  for (const name of fs.readdirSync(target)) removeTree(path.join(target, name))
  fs.rmdirSync(target)
}

afterEach(() => {
  for (const dir of created.splice(0)) removeTree(dir)
})

function write(file: string, content: string | Buffer, mtime?: Date): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  if (mtime) fs.utimesSync(file, mtime, mtime)
}

/** Repositório mínimo: public/ com arquivo binário, texto e subpasta; apps/clients/web sem public/. */
function makeRepo() {
  const base = fs.mkdtempSync(
    path.join(path.resolve(os.tmpdir()), 'sync-web-public-')
  )
  created.push(base)
  const root = path.join(base, 'repo')
  const outside = path.join(base, 'fora')
  const { source, destination } = webPublicPaths(root)
  const old = new Date('2026-01-02T03:04:05.000Z')
  write(
    path.join(source, 'favicon.ico'),
    Buffer.from([0, 1, 2, 3, 254, 255]),
    old
  )
  write(path.join(source, 'robots.txt'), 'User-agent: *\n', old)
  write(path.join(source, 'models', 'Andaime.glb'), Buffer.alloc(4096, 7), old)
  write(
    path.join(source, 'fonts', 'sub', 'inter.woff2'),
    Buffer.from('fonte'),
    old
  )
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  write(path.join(outside, 'canario.txt'), 'não me apague')
  write(path.join(outside, 'obsoleto.txt'), 'fora do destino')
  return { base, root, outside, source, destination }
}

/** Mapa caminho relativo (posix) → sha256 de cada arquivo regular, sem seguir link. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (current: string, rel: string) => {
    for (const name of fs.readdirSync(current).sort()) {
      const full = path.join(current, name)
      const relPath = rel ? `${rel}/${name}` : name
      const stat = fs.lstatSync(full)
      if (stat.isSymbolicLink()) out[relPath] = 'link'
      else if (stat.isDirectory()) walk(full, relPath)
      else
        out[relPath] = createHash('sha256')
          .update(fs.readFileSync(full))
          .digest('hex')
    }
  }
  walk(dir, '')
  return out
}

function withoutSentinel(tree: Record<string, string>): Record<string, string> {
  const copy = { ...tree }
  delete copy[SENTINEL]
  return copy
}

function refusal(run: () => unknown): SyncRefusal {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(SyncRefusal)
    return error as SyncRefusal
  }
  throw new Error('a sincronização deveria ter recusado')
}

describe('sync-web-public: cópia real', () => {
  it('copia public/ inteiro para uma pasta REAL (não link), byte a byte, com o sentinela gerado', () => {
    const repo = makeRepo()
    const result = syncWebPublic({ root: repo.root })
    const stat = fs.lstatSync(repo.destination)
    expect(stat.isSymbolicLink()).toBe(false)
    expect(stat.isDirectory()).toBe(true)
    expect(withoutSentinel(snapshot(repo.destination))).toEqual(
      snapshot(repo.source)
    )
    expect(fs.lstatSync(path.join(repo.destination, SENTINEL)).isFile()).toBe(
      true
    )
    expect([...result.copied].sort()).toEqual([
      'favicon.ico',
      'fonts/sub/inter.woff2',
      'models/Andaime.glb',
      'robots.txt',
    ])
    expect(result.removed).toEqual([])
    // A data de modificação acompanha a fonte: é a base da comparação incremental.
    expect(
      Math.floor(fs.statSync(path.join(repo.destination, 'robots.txt')).mtimeMs)
    ).toBe(
      Math.floor(fs.statSync(path.join(repo.source, 'robots.txt')).mtimeMs)
    )
  })

  it('incremental: sem mudança nada é regravado; tamanho ou data diferente copia de novo', () => {
    const repo = makeRepo()
    syncWebPublic({ root: repo.root })
    const again = syncWebPublic({ root: repo.root })
    expect(again.copied).toEqual([])
    expect(again.removed).toEqual([])
    expect(again.unchanged).toBe(4)

    // Mesmo tamanho e mesma data no destino: a ferramenta não relê o conteúdo nem regrava o arquivo.
    const glb = path.join(repo.destination, 'models', 'Andaime.glb')
    const glbStat = fs.statSync(glb)
    fs.writeFileSync(glb, Buffer.alloc(4096, 9))
    fs.utimesSync(glb, glbStat.atime, glbStat.mtime)
    expect(syncWebPublic({ root: repo.root }).copied).toEqual([])
    expect(fs.readFileSync(glb)).toEqual(Buffer.alloc(4096, 9))

    // Fonte com o mesmo tamanho e data nova: copia de novo.
    write(
      path.join(repo.source, 'robots.txt'),
      'User-agent: X\n',
      new Date('2026-05-06T07:08:09.000Z')
    )
    // Destino com tamanho diferente (editado à mão): volta a ser a cópia da fonte.
    write(
      path.join(repo.destination, 'favicon.ico'),
      'editado à mão, tamanho diferente'
    )
    fs.utimesSync(
      path.join(repo.destination, 'favicon.ico'),
      fs.statSync(path.join(repo.source, 'favicon.ico')).atime,
      fs.statSync(path.join(repo.source, 'favicon.ico')).mtime
    )
    const changed = syncWebPublic({ root: repo.root })
    expect([...changed.copied].sort()).toEqual(['favicon.ico', 'robots.txt'])
    expect(
      fs.readFileSync(path.join(repo.destination, 'robots.txt'), 'utf8')
    ).toBe('User-agent: X\n')
    expect(fs.readFileSync(path.join(repo.destination, 'favicon.ico'))).toEqual(
      fs.readFileSync(path.join(repo.source, 'favicon.ico'))
    )
  })

  it('fonte reescrita com o mesmo tamanho e data poucos ms depois copia de novo (edição rápida não passa batida)', () => {
    const repo = makeRepo()
    syncWebPublic({ root: repo.root })
    const robots = path.join(repo.source, 'robots.txt')
    const before = fs.statSync(robots).mtimeMs
    fs.writeFileSync(robots, 'User-agent: Y\n')
    fs.utimesSync(robots, (before + 5) / 1000, (before + 5) / 1000)
    const result = syncWebPublic({ root: repo.root })
    expect(result.copied).toEqual(['robots.txt'])
    expect(
      fs.readFileSync(path.join(repo.destination, 'robots.txt'), 'utf8')
    ).toBe('User-agent: Y\n')
  })

  it('incremental com data de fonte fracionária (NTFS guarda 100 ns; Date do Node arredonda o ms)', () => {
    const repo = makeRepo()
    // Frações acima e abaixo de meio ms: o arredondamento de stat.mtime (Date) empurraria a primeira para o ms seguinte.
    fs.utimesSync(
      path.join(repo.source, 'robots.txt'),
      1767323045.1237,
      1767323045.1237
    )
    fs.utimesSync(
      path.join(repo.source, 'favicon.ico'),
      1767323045.9994,
      1767323045.9994
    )
    const copyFileSync = fs.copyFileSync
    vi.spyOn(fs, 'copyFileSync').mockImplementation((from, to, mode) => {
      copyFileSync(from, to, mode)
      const now = new Date()
      fs.utimesSync(to, now, now)
    })
    syncWebPublic({ root: repo.root })
    const again = syncWebPublic({ root: repo.root })
    expect(again.copied).toEqual([])
    expect(again.unchanged).toBe(4)
  })

  it('a cópia recebe a data da fonte mesmo onde o sistema não a preserva (Linux), senão toda execução recopiaria', () => {
    const repo = makeRepo()
    // No Windows o CopyFileW já preserva a data; aqui a cópia do sistema se comporta como no Linux (data de agora).
    const copyFileSync = fs.copyFileSync
    const spy = vi
      .spyOn(fs, 'copyFileSync')
      .mockImplementation((from, to, mode) => {
        copyFileSync(from, to, mode)
        const now = new Date()
        fs.utimesSync(to, now, now)
      })
    expect(syncWebPublic({ root: repo.root }).copied).toHaveLength(4)
    expect(spy).toHaveBeenCalledTimes(4)
    const again = syncWebPublic({ root: repo.root })
    expect(again.copied).toEqual([])
    expect(again.unchanged).toBe(4)
  })

  it('apaga do destino (com sentinela) o que saiu de public/, inclusive subpasta e troca arquivo↔pasta', () => {
    const repo = makeRepo()
    syncWebPublic({ root: repo.root })
    fs.unlinkSync(path.join(repo.source, 'fonts', 'sub', 'inter.woff2'))
    fs.rmdirSync(path.join(repo.source, 'fonts', 'sub'))
    fs.rmdirSync(path.join(repo.source, 'fonts'))
    fs.unlinkSync(path.join(repo.source, 'robots.txt'))
    // robots.txt vira pasta na fonte; models/ vira arquivo.
    write(path.join(repo.source, 'robots.txt', 'dentro.txt'), 'agora é pasta')
    fs.unlinkSync(path.join(repo.source, 'models', 'Andaime.glb'))
    fs.rmdirSync(path.join(repo.source, 'models'))
    write(path.join(repo.source, 'models'), 'agora é arquivo')

    // Nenhuma remoção recursiva (regra 7 do AGENTS.md): arquivo por arquivo e depois cada pasta já vazia.
    const rmSync = vi.spyOn(fs, 'rmSync')
    const rmdirSync = vi.spyOn(fs, 'rmdirSync')
    const result = syncWebPublic({ root: repo.root })
    expect(rmSync).not.toHaveBeenCalled()
    expect(
      rmdirSync.mock.calls.map(([dir, options]) => [
        path.relative(repo.destination, String(dir)).split(path.sep).join('/'),
        options,
      ])
    ).toEqual([
      ['fonts/sub', undefined],
      ['models', undefined],
      ['fonts', undefined],
    ])
    expect([...result.removed].sort()).toEqual([
      'fonts',
      'fonts/sub',
      'fonts/sub/inter.woff2',
      'models',
      'models/Andaime.glb',
      'robots.txt',
    ])
    expect(withoutSentinel(snapshot(repo.destination))).toEqual(
      snapshot(repo.source)
    )
  })
})

describe('sync-web-public: sentinela', () => {
  it('recusa pasta real sem sentinela que já tem arquivos e não mexe em nada', () => {
    const repo = makeRepo()
    write(path.join(repo.destination, 'meu-arquivo.txt'), 'de alguém')
    write(path.join(repo.destination, 'robots.txt'), 'versão local')
    const before = snapshot(repo.destination)
    const error = refusal(() => syncWebPublic({ root: repo.root }))
    expect(error.message).toContain(SENTINEL)
    expect(snapshot(repo.destination)).toEqual(before)
  })

  it('adota pasta real vazia (grava o sentinela e copia)', () => {
    const repo = makeRepo()
    fs.mkdirSync(repo.destination)
    syncWebPublic({ root: repo.root })
    expect(withoutSentinel(snapshot(repo.destination))).toEqual(
      snapshot(repo.source)
    )
    expect(fs.existsSync(path.join(repo.destination, SENTINEL))).toBe(true)
  })

  it('recusa public/ com um arquivo que tenha o nome do sentinela', () => {
    const repo = makeRepo()
    write(path.join(repo.source, SENTINEL), 'conflito')
    refusal(() => syncWebPublic({ root: repo.root }))
    expect(fs.existsSync(repo.destination)).toBe(false)
  })
})

describe('sync-web-public: links (nunca toca fora do destino)', () => {
  it('recusa destino que é junção/symlink, explica como remover SÓ o link e não apaga nada do alvo', () => {
    const repo = makeRepo()
    fs.symlinkSync(repo.outside, repo.destination, 'junction')
    const before = snapshot(repo.outside)
    const error = refusal(() => syncWebPublic({ root: repo.root }))
    expect(error.message).toMatch(/rmdir apps[\\/]clients[\\/]web[\\/]public/)
    expect(error.message).not.toMatch(/rmdir \/s|rm -r/)
    expect(snapshot(repo.outside)).toEqual(before)
    expect(fs.lstatSync(repo.destination).isSymbolicLink()).toBe(true)
  })

  it('recusa link dentro do destino antes de qualquer remoção (nem o obsoleto de dentro sai)', () => {
    const repo = makeRepo()
    syncWebPublic({ root: repo.root })
    write(
      path.join(repo.destination, 'obsoleto-dentro.txt'),
      'sairia numa sincronização normal'
    )
    fs.symlinkSync(
      repo.outside,
      path.join(repo.destination, 'pasta-ligada'),
      'junction'
    )
    const outsideBefore = snapshot(repo.outside)
    const destinationBefore = snapshot(repo.destination)
    const error = refusal(() => syncWebPublic({ root: repo.root }))
    expect(error.message).toContain('pasta-ligada é um link dentro do destino')
    expect(error.message).toMatch(/rmdir \S*pasta-ligada/)
    expect(snapshot(repo.outside)).toEqual(outsideBefore)
    expect(snapshot(repo.destination)).toEqual(destinationBefore)
  })

  it('recusa link no caminho até o destino (apps/clients/web ligado a outra pasta)', () => {
    const repo = makeRepo()
    const web = path.dirname(repo.destination)
    fs.rmdirSync(web)
    fs.symlinkSync(repo.outside, web, 'junction')
    const before = snapshot(repo.outside)
    const writes = [
      vi.spyOn(fs, 'writeFileSync'),
      vi.spyOn(fs, 'openSync'),
      vi.spyOn(fs, 'mkdirSync'),
      vi.spyOn(fs, 'copyFileSync'),
      vi.spyOn(fs, 'renameSync'),
    ]
    refusal(() => syncWebPublic({ root: repo.root }))
    // Nem o trinco é criado: ele mora em apps/clients/web, que aqui é o link. (Antes do snapshot, que lê arquivos.)
    for (const spy of writes) expect(spy).not.toHaveBeenCalled()
    expect(snapshot(repo.outside)).toEqual(before)
  })

  it('recusa link dentro de public/ (a fonte) em vez de copiar o que ele aponta', () => {
    const repo = makeRepo()
    fs.symlinkSync(repo.outside, path.join(repo.source, 'ligado'), 'junction')
    const error = refusal(() => syncWebPublic({ root: repo.root }))
    expect(error.message).toContain('public/ligado é um link')
    expect(fs.existsSync(repo.destination)).toBe(false)
  })
})

describe('sync-web-public: linha de comando', () => {
  function cli(root: string) {
    const run = spawnSync(process.execPath, [tool, '--root', root], {
      encoding: 'utf8',
    })
    return { status: run.status, out: run.stdout, err: run.stderr }
  }

  it('sincroniza e resume o que fez; na junção sai com 1 e a explicação', () => {
    const repo = makeRepo()
    const first = cli(repo.root)
    expect(first.err).toBe('')
    expect(first.status).toBe(0)
    expect(first.out).toMatch(/4 copiados, 0 removidos, 0 inalterados/)

    const linked = makeRepo()
    fs.symlinkSync(linked.outside, linked.destination, 'junction')
    const refused = cli(linked.root)
    expect(refused.status).toBe(1)
    expect(refused.err).toMatch(/rmdir apps[\\/]clients[\\/]web[\\/]public/)
    expect(fs.lstatSync(linked.destination).isSymbolicLink()).toBe(true)
  })
})

describe('sync-web-public: ligação no host web', () => {
  it('predev e prebuild do host web rodam a ferramenta a partir de apps/clients/web', () => {
    const webDir = path.join(repoRoot, 'apps', 'clients', 'web')
    const pkg = JSON.parse(
      fs.readFileSync(path.join(webDir, 'package.json'), 'utf8')
    ) as {
      scripts: Record<string, string>
    }
    for (const hook of ['predev', 'prebuild']) {
      const match = /^node (\S+)$/.exec(pkg.scripts[hook] ?? '')
      expect(match, hook).not.toBeNull()
      expect(path.resolve(webDir, match?.[1] ?? '')).toBe(tool)
    }
  })

  it('a captura visual roda a ferramenta antes do next dev do host web (o next direto pula o predev)', () => {
    const config = fs.readFileSync(
      path.join(repoRoot, 'tests', 'visual', 'playwright.visual.config.ts'),
      'utf8'
    )
    const commands = [...config.matchAll(/command: `([^`]*)`/g)].map(
      (match) => match[1] ?? ''
    )
    const nextDev = commands.filter((command) => command.includes('next dev'))
    expect(nextDev).toHaveLength(1)
    expect(nextDev[0]).toMatch(
      /^node \.\.\/\.\.\/\.\.\/tools\/sync-web-public\.mjs && node node_modules\/next\/dist\/bin\/next dev /
    )
  })
})

describe('sync-web-public: uma execução por vez (trinco)', () => {
  /** CLI assíncrona: devolve o processo, a saída acumulada e a promessa do término. */
  function startCli(root: string) {
    const child: ChildProcess = spawn(process.execPath, [tool, '--root', root])
    const output = { out: '', err: '' }
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
      output.out += chunk
    })
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
      output.err += chunk
    })
    const done = new Promise<number | null>((resolve) => {
      child.on('close', (status) => resolve(status))
    })
    return { child, output, done }
  }

  /** Muitas pastas e arquivos: cada execução leva centenas de ms, e as simultâneas se sobrepõem de verdade. */
  function makeBigRepo() {
    const repo = makeRepo()
    for (let dir = 0; dir < 12; dir++)
      for (let file = 0; file < 25; file++)
        write(
          path.join(repo.source, `lote-${dir}`, `arquivo-${file}.bin`),
          Buffer.alloc(2048, dir * 25 + file)
        )
    return { ...repo, files: 4 + 12 * 25 }
  }

  it('execuções simultâneas (predev/prebuild em paralelo) terminam bem: uma copia, as outras acham tudo pronto', async () => {
    const repo = makeBigRepo()
    const runs = Array.from({ length: 4 }, () => startCli(repo.root))
    const statuses = await Promise.all(runs.map((run) => run.done))
    for (const [index, run] of runs.entries()) {
      expect(run.output.err, `execução ${index}`).toBe('')
      expect(statuses[index], `execução ${index}`).toBe(0)
    }
    const copied = runs.map((run) =>
      Number(/(\d+) copiados/.exec(run.output.out)?.[1] ?? Number.NaN)
    )
    // Serializadas, a primeira copia tudo e as outras encontram cada arquivo já igual à fonte.
    expect([...copied].sort((a, b) => a - b)).toEqual([0, 0, 0, repo.files])
    expect(withoutSentinel(snapshot(repo.destination))).toEqual(
      snapshot(repo.source)
    )
    // O trinco sai no fim e nada além do destino fica em apps/clients/web.
    expect(fs.readdirSync(path.dirname(repo.destination))).toEqual(['public'])
  })

  /**
   * Execuções em processos separados que começam juntas: cada uma carrega a ferramenta, avisa que está pronta e
   * espera o arquivo `go`; o teste o cria quando todas avisaram, e elas disputam o trinco no mesmo milissegundo.
   */
  async function runTogether(
    repo: { base: string; root: string },
    count: number
  ) {
    const script = path.join(repo.base, 'execucao.mjs')
    const go = path.join(repo.base, 'go')
    fs.writeFileSync(
      script,
      [
        "import fs from 'node:fs'",
        "import { pathToFileURL } from 'node:url'",
        'const [tool, root, go] = process.argv.slice(2)',
        'const { syncWebPublic } = await import(pathToFileURL(tool).href)',
        "process.stdout.write('pronto\\n')",
        'while (!fs.existsSync(go)) {}',
        "process.stdout.write(JSON.stringify(syncWebPublic({ root })) + '\\n')",
      ].join('\n')
    )
    const runs = Array.from({ length: count }, () => {
      const child = spawn(process.execPath, [script, tool, repo.root, go])
      const output = { out: '', err: '' }
      child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
        output.out += chunk
      })
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
        output.err += chunk
      })
      const done = new Promise<number | null>((resolve) => {
        child.on('close', (status) => resolve(status))
      })
      return { child, output, done }
    })
    const deadline = Date.now() + 30_000
    while (
      runs.some(
        (run) =>
          !run.output.out.includes('pronto') && run.child.exitCode === null
      ) &&
      Date.now() < deadline
    )
      await new Promise((resolve) => setTimeout(resolve, 10))
    fs.writeFileSync(go, '')
    const statuses = await Promise.all(runs.map((run) => run.done))
    fs.unlinkSync(go)
    fs.unlinkSync(script)
    return runs.map((run, index) => ({
      status: statuses[index],
      err: run.output.err,
      result: (() => {
        const line = run.output.out
          .split('\n')
          .find((text) => text.startsWith('{'))
        return line ? (JSON.parse(line) as { copied: string[] }) : undefined
      })(),
    }))
  }

  it('trinco abandonado disputado por várias execuções no mesmo instante: todas terminam bem, a cópia sai inteira (achado 134, repetido)', async () => {
    // No Windows, dois renameSync do mesmo arquivo podem os dois reportar sucesso (68 de 200 na prova do verificador):
    // a retirada do trinco abandonado não pode depender de rename atômico.
    for (let round = 0; round < 12; round++) {
      const repo = makeRepo()
      fs.writeFileSync(lockPath(repo.destination), lockContent(deadPid()))
      const runs = await runTogether(repo, 6)
      for (const [index, run] of runs.entries()) {
        expect(run.err, `rodada ${round}, execução ${index}`).toBe('')
        expect(run.status, `rodada ${round}, execução ${index}`).toBe(0)
      }
      // Serializadas: uma copia os 4 arquivos, as outras acham tudo pronto.
      expect(runs.map((run) => run.result?.copied.length).sort()).toEqual([
        0, 0, 0, 0, 0, 4,
      ])
      expect(withoutSentinel(snapshot(repo.destination))).toEqual(
        snapshot(repo.source)
      )
      expect(fs.readdirSync(path.dirname(repo.destination))).toEqual(['public'])
      removeTree(repo.base)
      created.splice(created.indexOf(repo.base), 1)
    }
  }, 120_000)

  it('espera o trinco de outra execução viva e só depois sincroniza', async () => {
    const repo = makeRepo()
    // Dono vivo: o processo deste teste, que não é o da CLI.
    fs.writeFileSync(lockPath(repo.destination), lockContent(process.pid))
    const run = startCli(repo.root)
    const deadline = Date.now() + 15_000
    while (!run.output.out.includes('aguardando') && Date.now() < deadline) {
      if (run.child.exitCode !== null) break
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    expect(run.output.out).toContain('aguardando')
    expect(run.output.out).toContain(`pid ${process.pid}`)
    expect(run.child.exitCode).toBeNull()
    expect(fs.existsSync(repo.destination)).toBe(false)

    fs.unlinkSync(lockPath(repo.destination))
    expect(await run.done).toBe(0)
    expect(run.output.err).toBe('')
    expect(run.output.out).toMatch(/4 copiados, 0 removidos, 0 inalterados/)
    expect(fs.existsSync(lockPath(repo.destination))).toBe(false)
  })

  it('desiste depois do tempo de espera sem escrever nada e sem tocar no trinco alheio', () => {
    const repo = makeRepo()
    const content = lockContent(SYSTEM_PID)
    fs.writeFileSync(lockPath(repo.destination), content)
    const started = Date.now()
    const error = refusal(() =>
      syncWebPublic({ root: repo.root, lockWaitMs: 300 })
    )
    expect(Date.now() - started).toBeGreaterThanOrEqual(300)
    expect(error.message).toContain(LOCK_NAME)
    expect(error.message).toContain(`pid ${SYSTEM_PID}`)
    expect(fs.readFileSync(lockPath(repo.destination), 'utf8')).toBe(content)
    expect(fs.existsSync(repo.destination)).toBe(false)
  })

  it('trinco de processo que já morreu é abandonado: sai e a sincronização segue', () => {
    const repo = makeRepo()
    fs.writeFileSync(lockPath(repo.destination), lockContent(deadPid()))
    const result = syncWebPublic({ root: repo.root, lockWaitMs: 5_000 })
    expect(result.copied).toHaveLength(4)
    expect(fs.readdirSync(path.dirname(repo.destination))).toEqual(['public'])
  })

  it('trinco com o próprio pid é resto de execução antiga (pid reaproveitado), não um dono vivo', () => {
    const repo = makeRepo()
    fs.writeFileSync(lockPath(repo.destination), lockContent(process.pid))
    expect(
      syncWebPublic({ root: repo.root, lockWaitMs: 300 }).copied
    ).toHaveLength(4)
    expect(fs.existsSync(lockPath(repo.destination))).toBe(false)
  })

  it('dono em outra máquina não é julgado pelo pid; só a idade torna o trinco abandonado', () => {
    const repo = makeRepo()
    const lock = lockPath(repo.destination)
    fs.writeFileSync(lock, lockContent(deadPid(), { host: 'outra-maquina' }))
    refusal(() => syncWebPublic({ root: repo.root, lockWaitMs: 300 }))
    expect(fs.existsSync(repo.destination)).toBe(false)

    age(lock, 11 * 60_000)
    expect(
      syncWebPublic({ root: repo.root, lockWaitMs: 300 }).copied
    ).toHaveLength(4)
    expect(fs.existsSync(lock)).toBe(false)

    // Mesmo nome de máquina, outro sistema no mesmo disco (WSL e Windows): o pid de lá também não diz nada aqui.
    const other = makeRepo()
    fs.writeFileSync(
      lockPath(other.destination),
      lockContent(deadPid(), { platform: 'outro-sistema' })
    )
    refusal(() => syncWebPublic({ root: other.root, lockWaitMs: 300 }))
    expect(fs.existsSync(other.destination)).toBe(false)
  })

  it('processo vivo que o sistema não deixa sinalizar (EPERM) conta como vivo', () => {
    const repo = makeRepo()
    fs.writeFileSync(lockPath(repo.destination), lockContent(SYSTEM_PID))
    refusal(() => syncWebPublic({ root: repo.root, lockWaitMs: 300 }))
    expect(fs.existsSync(repo.destination)).toBe(false)
  })

  it('trinco sem dono legível: recente é respeitado (dono ainda escrevendo); velho é abandonado', () => {
    const repo = makeRepo()
    const lock = lockPath(repo.destination)
    fs.writeFileSync(lock, '')
    refusal(() => syncWebPublic({ root: repo.root, lockWaitMs: 300 }))
    age(lock, 10_000)
    expect(
      syncWebPublic({ root: repo.root, lockWaitMs: 300 }).copied
    ).toHaveLength(4)

    // pid 0 não é dono válido (no POSIX o kill(0) sinalizaria o grupo): conta como ilegível.
    const other = makeRepo()
    const otherLock = lockPath(other.destination)
    fs.writeFileSync(otherLock, lockContent(0))
    age(otherLock, 10_000)
    expect(
      syncWebPublic({ root: other.root, lockWaitMs: 300 }).copied
    ).toHaveLength(4)
  })

  it('trinco que é pasta ou link: recusa sem seguir nem apagar', () => {
    const repo = makeRepo()
    const lock = lockPath(repo.destination)
    write(path.join(lock, 'dentro.txt'), 'alguém criou uma pasta aqui')
    const error = refusal(() => syncWebPublic({ root: repo.root }))
    expect(error.message).toContain(LOCK_NAME)
    expect(fs.readFileSync(path.join(lock, 'dentro.txt'), 'utf8')).toBe(
      'alguém criou uma pasta aqui'
    )
    expect(fs.existsSync(repo.destination)).toBe(false)

    const linked = makeRepo()
    const linkedLock = lockPath(linked.destination)
    fs.symlinkSync(linked.outside, linkedLock, 'junction')
    const before = snapshot(linked.outside)
    refusal(() => syncWebPublic({ root: linked.root }))
    expect(fs.lstatSync(linkedLock).isSymbolicLink()).toBe(true)
    expect(snapshot(linked.outside)).toEqual(before)
  })

  it('solta o trinco quando recusa e quando falha no meio', () => {
    const repo = makeRepo()
    write(path.join(repo.source, SENTINEL), 'conflito')
    refusal(() => syncWebPublic({ root: repo.root }))
    expect(fs.existsSync(lockPath(repo.destination))).toBe(false)

    const failing = makeRepo()
    vi.spyOn(fs, 'copyFileSync').mockImplementation(() => {
      throw new Error('disco cheio (simulado)')
    })
    expect(() => syncWebPublic({ root: failing.root })).toThrow(
      'disco cheio (simulado)'
    )
    expect(fs.existsSync(lockPath(failing.destination))).toBe(false)
  })

  it('na saída não apaga o trinco que outra execução tomou (só o próprio)', () => {
    const repo = makeRepo()
    const lock = lockPath(repo.destination)
    const foreign = lockContent(SYSTEM_PID)
    const copyFileSync = fs.copyFileSync
    let taken = false
    vi.spyOn(fs, 'copyFileSync').mockImplementation((from, to, mode) => {
      if (!taken) {
        fs.writeFileSync(lock, foreign)
        taken = true
      }
      copyFileSync(from, to, mode)
    })
    syncWebPublic({ root: repo.root })
    expect(fs.readFileSync(lock, 'utf8')).toBe(foreign)
  })

  it('ao tirar um trinco abandonado, não apaga o trinco novo que outra execução criou depois da leitura desta', () => {
    const repo = makeRepo()
    const lock = lockPath(repo.destination)
    fs.writeFileSync(lock, lockContent(deadPid()))
    const fresh = lockContent(SYSTEM_PID)
    const readFileSync = fs.readFileSync
    let taken = false
    vi.spyOn(fs, 'readFileSync').mockImplementation(((
      file: fs.PathOrFileDescriptor,
      options?: Parameters<typeof fs.readFileSync>[1]
    ) => {
      const text = readFileSync(file, options)
      // Outra execução tirou o abandonado e criou o seu logo depois que esta o leu para julgá-lo.
      if (!taken && typeof file === 'string' && path.resolve(file) === lock) {
        taken = true
        fs.writeFileSync(lock, fresh)
      }
      return text
    }) as typeof fs.readFileSync)
    refusal(() => syncWebPublic({ root: repo.root, lockWaitMs: 300 }))
    expect(taken).toBe(true)
    expect(readFileSync(lock, 'utf8')).toBe(fresh)
    expect(fs.existsSync(repo.destination)).toBe(false)
    // Nada de sobra da retirada ao lado do trinco.
    expect(fs.readdirSync(path.dirname(repo.destination))).toEqual([LOCK_NAME])
  })

  it('execução que morre no meio da retirada do trinco abandonado não trava as seguintes nem deixa sobra (achado 134)', () => {
    const repo = makeRepo()
    const web = path.dirname(repo.destination)
    fs.writeFileSync(lockPath(repo.destination), lockContent(deadPid()))
    // Queda simulada: a execução para de apagar arquivos ao lado do trinco (morreria ali, no meio da retirada).
    const unlinkSync = fs.unlinkSync
    const crash = vi.spyOn(fs, 'unlinkSync').mockImplementation((target) => {
      if (path.dirname(path.resolve(String(target))) === web)
        throw new Error('queda simulada')
      unlinkSync(target)
    })
    expect(() => syncWebPublic({ root: repo.root, lockWaitMs: 300 })).toThrow(
      'queda simulada'
    )
    crash.mockRestore()
    // O que ela deixou ao lado do trinco passa a ter o dono de outro processo, já morto.
    const leftovers = fs.readdirSync(web).filter((name) => name !== LOCK_NAME)
    expect(leftovers.length).toBeGreaterThan(0)
    for (const name of leftovers)
      fs.writeFileSync(path.join(web, name), lockContent(deadPid()))
    expect(
      syncWebPublic({ root: repo.root, lockWaitMs: 5_000 }).copied
    ).toHaveLength(4)
    expect(fs.readdirSync(web)).toEqual(['public'])
  })
})
