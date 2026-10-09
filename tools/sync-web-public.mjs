#!/usr/bin/env node
/**
 * Copia public/ da raiz para apps/clients/web/public como pasta REAL, gerada (achado 130 da revisão; substitui a
 * junção NTFS de tools/link-web-public.mjs, proibida pela regra 7 do AGENTS.md: uma limpeza recursiva de
 * apps/clients/web atravessava a junção e apagava o public/ da raiz, como no incidente da entrada 171 dos
 * known-issues). Roda no predev e no prebuild de apps/clients/web/package.json e antes do `next dev` da captura
 * visual (tests/visual/playwright.visual.config.ts), que chama o next direto e pula o predev.
 *
 * Regras:
 * - Incremental: arquivo com o mesmo tamanho e a mesma data de modificação (diferença abaixo de 1 ms) no destino não
 *   é regravado; a cópia recebe a data da fonte depois de escrita, então uma cópia interrompida é refeita.
 * - O destino é marcado pelo sentinela `.sync-web-public`, gravado por esta ferramenta. Só uma pasta com o
 *   sentinela perde o que saiu de public/; pasta real sem ele e com arquivos é recusada sem tocar em nada (vazia é
 *   adotada).
 * - Nunca segue nem apaga link: destino que é junção/symlink, link dentro do destino, link no caminho da raiz até
 *   ele ou dentro de public/ recusam a execução inteira antes de qualquer escrita no destino. Nenhuma remoção é
 *   recursiva: arquivo por arquivo (unlink) e depois cada pasta já vazia (rmdir).
 * - Uma execução por vez: predev/prebuild em paralelo (dois terminais, agentes no mesmo checkout) quebravam com
 *   EEXIST no mkdir ou EBUSY no copyfile, porque cada um aplicava o seu plano sobre a mesma árvore. O trinco
 *   `apps/clients/web/.sync-web-public.lock` (criado com exclusividade e apagado no fim; com o direito de retirada
 *   abaixo, os únicos arquivos fora do destino, todos cobertos pelo .gitignore) serializa as execuções: a segunda
 *   espera e depois acha tudo igual à fonte. Trinco de processo morto, com o próprio pid (pid reaproveitado) ou
 *   velho demais é abandonado e sai; com dono vivo, a espera tem limite e a recusa diz o que fazer.
 * - Tirar o trinco abandonado não depende de rename atômico (achado 134: no Windows, dois renameSync do mesmo arquivo
 *   podem os dois reportar sucesso). Cada geração do trinco tem um direito de retirada criado com exclusividade ao
 *   lado dele; só quem o ganha relê o trinco e o apaga, e só se ainda for a mesma geração (removeStaleLock).
 *
 * Uso: node tools/sync-web-public.mjs [--root <repositório>]
 * Saída: 0 sincronizado; 1 recusado (mensagem explica o que fazer); outro erro sai com a pilha.
 */
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Arquivo que marca o destino como gerado por esta ferramenta (fica só no destino). */
export const SENTINEL = '.sync-web-public'
const SENTINEL_TEXT =
  'Pasta gerada por tools/sync-web-public.mjs a partir de public/ da raiz (predev/prebuild do host web).\n' +
  'Não edite nada aqui: a próxima sincronização sobrescreve e apaga o que não estiver em public/.\n'

const TAG = '[sync-web-public]'
/** Datas gravadas pelo utimes voltam com erro abaixo de 1 µs (double em segundos); 1 ms separa versões reais. */
const MTIME_TOLERANCE_MS = 1

/** Trinco das execuções: fica ao lado do destino, em apps/clients/web (nunca dentro do destino). */
const LOCK_NAME = '.sync-web-public.lock'
/** Espera máxima por um dono vivo; uma sincronização normal leva poucos segundos. */
const LOCK_WAIT_MS = 60_000
/** Trinco mais velho que isto é abandonado mesmo com dono aparentemente vivo (pid reaproveitado, outra máquina). */
const LOCK_STALE_MS = 10 * 60_000
/** Trinco sem dono legível: o dono cria o arquivo e escreve em seguida; depois disto, morreu no meio. */
const UNREADABLE_LOCK_STALE_MS = 5_000
const LOCK_POLL_MS = 50
/** Sufixo do direito de retirada de uma geração abandonada do trinco (`<LOCK_NAME>.<chave>.reap`, ao lado dele). */
const REAP_SUFFIX = '.reap'
/**
 * Um direito de retirada só fica para trás se a execução que o ganhou morrer no meio da retirada (milissegundos); ele
 * é retirado do mesmo jeito, um nível acima. Dois níveis cobrem duas mortes seguidas nessa janela.
 */
const MAX_REAP_DEPTH = 2
/** Espera curta enquanto outra execução retira o trinco abandonado. */
const REAP_POLL_MS = 5

/** Recusa esperada: nada foi escrito nem apagado; a mensagem diz o que fazer. */
export class SyncRefusal extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message)
    this.name = 'SyncRefusal'
  }
}

/** @param {string} root */
export function webPublicPaths(root) {
  const web = path.join(root, 'apps', 'clients', 'web')
  return {
    source: path.join(root, 'public'),
    destination: path.join(web, 'public'),
    lock: path.join(web, LOCK_NAME),
  }
}

/** @param {unknown} error */
function errorCode(error) {
  return error && typeof error === 'object' && 'code' in error
    ? error.code
    : undefined
}

/**
 * No Windows, abrir o trinco (ou o direito de retirada) no instante em que outro processo o apaga falha com EPERM, e
 * um antivírus que o segura dá EBUSY (achado 134: seis execuções juntas: EPERM ao criar e ao ler). É passageiro: quem
 * tenta de novo logo acha o nome livre ou o arquivo novo.
 * @param {unknown} error
 */
function transientWindowsError(error) {
  return (
    process.platform === 'win32' &&
    ['EPERM', 'EBUSY'].includes(String(errorCode(error)))
  )
}

/** @param {string} target */
function lstatOrNull(target) {
  try {
    return fs.lstatSync(target)
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return null
    throw error
  }
}

/** @param {number} ms */
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Processo existe? EPERM (existe, mas o sistema não deixa sinalizar) conta como vivo.
 * @param {number} pid
 */
function processAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return errorCode(error) === 'EPERM'
  }
}

/**
 * @typedef {{ pid: number, host: string, platform: string }} LockOwner
 * @typedef {{ raw: string, owner: LockOwner | null, mtimeMs: number, ageMs: number }} HeldLock
 */

/** Conteúdo de um trinco ou de um direito de retirada deste processo: o dono e um token único por criação. */
function ownerContent() {
  return (
    JSON.stringify({
      tool: 'sync-web-public',
      pid: process.pid,
      host: os.hostname(),
      platform: process.platform,
      token: randomUUID(),
      since: new Date().toISOString(),
    }) + '\n'
  )
}

/**
 * Lê o trinco sem seguir link. `null`: sumiu entre as chamadas (o dono soltou) ou está sendo apagado neste instante.
 * @param {string} lockPath
 * @returns {HeldLock | null}
 */
function readLock(lockPath) {
  let stat
  try {
    stat = lstatOrNull(lockPath)
  } catch (error) {
    if (transientWindowsError(error)) return null
    throw error
  }
  if (!stat) return null
  if (!stat.isFile())
    throw new SyncRefusal(
      `${TAG} ${lockPath} existe e não é arquivo comum (pasta ou link); não sigo nem apago.\n` +
        'Remova-o sem recursão (arquivo: del/rm; link: cmd /c rmdir ou unlink; pasta: esvazie à mão) e rode de novo.'
    )
  let raw
  try {
    raw = fs.readFileSync(lockPath, 'utf8')
  } catch (error) {
    if (errorCode(error) === 'ENOENT' || transientWindowsError(error))
      return null
    throw error
  }
  /** @type {LockOwner | null} */
  let owner = null
  try {
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      Number.isInteger(parsed.pid) &&
      parsed.pid > 0 &&
      typeof parsed.host === 'string' &&
      typeof parsed.platform === 'string'
    )
      owner = { pid: parsed.pid, host: parsed.host, platform: parsed.platform }
  } catch {
    // Vazio ou pela metade: o dono ainda está escrevendo ou morreu no meio (decide a idade).
  }
  return { raw, owner, mtimeMs: stat.mtimeMs, ageMs: Date.now() - stat.mtimeMs }
}

/**
 * @param {HeldLock} held
 * @param {number} staleMs
 */
function lockIsStale(held, staleMs) {
  if (held.ageMs > staleMs) return true
  const { owner } = held
  if (!owner) return held.ageMs > UNREADABLE_LOCK_STALE_MS
  // Em outra máquina (ou outro sistema no mesmo disco, como o WSL) o pid não diz nada: só a idade decide.
  if (owner.host !== os.hostname() || owner.platform !== process.platform)
    return false
  // Este processo ainda não segura o trinco: o próprio pid lá é resto de uma execução morta cujo pid voltou.
  if (owner.pid === process.pid) return true
  return !processAlive(owner.pid)
}

/**
 * A geração `held` ainda é a que está em `lockPath`? Geração = data de modificação e conteúdo (que traz o token
 * único de quem criou o arquivo): uma geração apagada nunca volta.
 * @param {string} lockPath
 * @param {HeldLock} held
 */
function sameGeneration(lockPath, held) {
  try {
    const stat = lstatOrNull(lockPath)
    if (!stat?.isFile() || stat.mtimeMs !== held.mtimeMs) return false
    return fs.readFileSync(lockPath, 'utf8') === held.raw
  } catch (error) {
    // Sumiu ou está sendo apagado: não é mais a geração lida.
    if (errorCode(error) === 'ENOENT' || transientWindowsError(error))
      return false
    throw error
  }
}

/**
 * Tira uma geração abandonada do trinco sem apagar a de outra execução e sem depender de rename atômico (achado 134:
 * no Windows, dois renameSync do mesmo arquivo podem os dois reportar sucesso, e o perdedor quebrava com ENOENT).
 * Retirar a geração exige o direito dela, `<LOCK_NAME>.<chave>.reap` ao lado do trinco, criado com exclusividade (wx):
 * só uma execução o ganha. Ela relê o trinco e só o apaga se ainda for a mesma geração; ninguém mais pode tirar
 * aquela geração enquanto ela segura o direito, então o que ela apaga é sempre o abandonado, nunca o trinco novo de
 * outra execução. Quem perde o direito volta a tentar o trinco. Um direito cujo dono morreu no meio da retirada é
 * tirado do mesmo jeito, um nível acima (até MAX_REAP_DEPTH).
 * @param {string} lockPath
 * @param {HeldLock} held
 * @param {number} staleMs
 * @param {number} [depth]
 * @returns {boolean} true quando esta execução apagou a geração abandonada
 */
function removeStaleLock(lockPath, held, staleMs, depth = 0) {
  const key = createHash('sha256')
    .update(`${held.mtimeMs}\n${held.raw}`)
    .digest('hex')
    .slice(0, 32)
  const claimPath = path.join(
    path.dirname(lockPath),
    `${LOCK_NAME}.${key}${REAP_SUFFIX}`
  )
  const claim = ownerContent()
  try {
    fs.writeFileSync(claimPath, claim, { flag: 'wx' })
  } catch (error) {
    // O direito está sendo apagado por quem acabou a retirada: tenta o trinco de novo.
    if (transientWindowsError(error)) return false
    if (errorCode(error) !== 'EEXIST') throw error
    const other = readLock(claimPath)
    if (other && depth < MAX_REAP_DEPTH && lockIsStale(other, staleMs))
      removeStaleLock(claimPath, other, staleMs, depth + 1)
    return false
  }
  try {
    if (!sameGeneration(lockPath, held)) return false
    try {
      fs.unlinkSync(lockPath)
    } catch (error) {
      if (errorCode(error) === 'ENOENT') return false
      throw error
    }
    return true
  } finally {
    releaseLock(claimPath, claim)
  }
}

/** @param {HeldLock} held */
function describeOwner(held) {
  if (!held.owner) return 'dono ainda não registrado'
  const since = Math.round(held.ageMs / 1000)
  return `pid ${held.owner.pid} em ${held.owner.host}, há ${since} s`
}

/**
 * Pega o trinco (criação exclusiva) e devolve a função que o solta. Espera enquanto outro dono vivo o segura.
 * @param {string} lockPath
 * @param {{ waitMs: number, staleMs: number, onWait?: (owner: string) => void }} options
 * @returns {() => void}
 */
function acquireLock(lockPath, { waitMs, staleMs, onWait }) {
  const content = ownerContent()
  const started = Date.now()
  let warned = false
  for (;;) {
    /** @type {unknown} */
    let busy
    try {
      fs.writeFileSync(lockPath, content, { flag: 'wx' })
      return () => releaseLock(lockPath, content)
    } catch (error) {
      if (transientWindowsError(error)) busy = error
      else if (errorCode(error) !== 'EEXIST') throw error
    }
    const held = busy ? null : readLock(lockPath)
    const stale = held !== null && lockIsStale(held, staleMs)
    if (held && stale && removeStaleLock(lockPath, held, staleMs)) continue
    if (Date.now() - started >= waitMs) {
      // Nome ocupado o tempo todo sem trinco legível (EPERM/EBUSY sem fim no Windows): não é espera, é erro.
      if (busy) throw busy
      throw new SyncRefusal(
        `${TAG} outra sincronização segura ${lockPath} (${held ? describeOwner(held) : 'trinco sendo trocado'}); ` +
          `esperei ${Math.round(waitMs / 1000)} s e não mexi em nada.\n` +
          'Se nenhuma sincronização estiver rodando (predev/prebuild do host web), apague só esse arquivo e rode de novo.'
      )
    }
    if (!held || stale) {
      // O trinco acabou de sair, está sendo apagado ou outra execução retira o abandonado (milissegundos): de novo logo.
      sleep(REAP_POLL_MS)
      continue
    }
    if (!warned) {
      onWait?.(describeOwner(held))
      warned = true
    }
    sleep(LOCK_POLL_MS)
  }
}

/**
 * Solta só o próprio trinco: se outra execução o tomou (abandonado por idade), o dela fica.
 * @param {string} lockPath
 * @param {string} content
 */
function releaseLock(lockPath, content) {
  const stat = lstatOrNull(lockPath)
  if (!stat?.isFile()) return
  try {
    if (fs.readFileSync(lockPath, 'utf8') === content) fs.unlinkSync(lockPath)
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error
  }
}

/** @param {string} rel */
const posix = (rel) => rel.split(path.sep).join('/')

/**
 * Lista a árvore sem seguir link. `onLink` decide o que fazer quando encontra um (aqui: sempre recusar).
 * @param {string} dir
 * @param {(rel: string) => never} onLink
 * @returns {Map<string, { type: 'file' | 'dir', size: number, mtimeMs: number }>}
 */
function scanTree(dir, onLink) {
  /** @type {Map<string, { type: 'file' | 'dir', size: number, mtimeMs: number }>} */
  const entries = new Map()
  /** @param {string} current @param {string} rel */
  const walk = (current, rel) => {
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name)
      const relPath = rel ? `${rel}/${name}` : name
      const stat = fs.lstatSync(full)
      if (stat.isSymbolicLink()) onLink(relPath)
      if (stat.isDirectory()) {
        entries.set(relPath, { type: 'dir', size: 0, mtimeMs: 0 })
        walk(full, relPath)
      } else if (stat.isFile()) {
        entries.set(relPath, {
          type: 'file',
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        })
      } else {
        throw new SyncRefusal(
          `${TAG} ${posix(path.join(dir, relPath))} não é arquivo nem pasta; não sincronizo.`
        )
      }
    }
  }
  walk(dir, '')
  return entries
}

/** @param {string} root @param {string} destination */
function linkRemovalHelp(root, destination) {
  const rel = path.relative(root, destination) || destination
  const windows = rel.split('/').join('\\')
  const unix = rel.split('\\').join('/')
  return [
    'Remova SÓ o link, sem recursão, e rode de novo (o conteúdo do alvo fica intacto):',
    `  Windows (cmd ou PowerShell): cmd /c rmdir ${windows}`,
    `  Linux/macOS: unlink ${unix}`,
    'Confira antes que é mesmo um link (PowerShell: Get-Item <caminho> -Force mostra LinkType; Linux: ls -ld).',
    'Nunca use a forma recursiva do rmdir, do rm ou do Remove-Item nesse caminho: ela atravessa o link e apaga o alvo.',
  ].join('\n')
}

/**
 * Sincroniza public/ → apps/clients/web/public dentro de `root`, uma execução por vez.
 * @param {{ root: string, lockWaitMs?: number, lockStaleMs?: number, onLockWait?: (owner: string) => void }} options
 * @returns {{ copied: string[], removed: string[], unchanged: number }}
 */
export function syncWebPublic({
  root,
  lockWaitMs = LOCK_WAIT_MS,
  lockStaleMs = LOCK_STALE_MS,
  onLockWait,
}) {
  const resolvedRoot = path.resolve(root)
  const { source, destination, lock } = webPublicPaths(resolvedRoot)

  // 1. Caminho da raiz até a pasta do destino: só pastas reais (nenhuma escrita, nem a do trinco, sai por um link).
  const chain = path
    .relative(resolvedRoot, path.dirname(destination))
    .split(path.sep)
  let current = resolvedRoot
  for (const segment of chain) {
    current = path.join(current, segment)
    const stat = lstatOrNull(current)
    if (!stat || stat.isSymbolicLink() || !stat.isDirectory())
      throw new SyncRefusal(
        `${TAG} ${current} ${stat?.isSymbolicLink() ? 'é um link (junção/symlink)' : 'não é pasta real'}; não escrevo por ele.`
      )
  }

  // 2. Uma execução por vez: o plano abaixo (ler as duas árvores e aplicar a diferença) só vale sem outro escritor.
  const release = acquireLock(lock, {
    waitMs: lockWaitMs,
    staleMs: lockStaleMs,
    onWait: onLockWait,
  })
  try {
    return syncUnderLock(resolvedRoot, source, destination)
  } finally {
    release()
  }
}

/**
 * @param {string} resolvedRoot
 * @param {string} source
 * @param {string} destination
 * @returns {{ copied: string[], removed: string[], unchanged: number }}
 */
function syncUnderLock(resolvedRoot, source, destination) {
  // 3. Fonte: pasta real, sem link dentro e sem o nome do sentinela.
  const sourceStat = lstatOrNull(source)
  if (!sourceStat || sourceStat.isSymbolicLink() || !sourceStat.isDirectory())
    throw new SyncRefusal(
      `${TAG} public/ da raiz ausente ou não é pasta real: ${source}`
    )
  const sourceTree = scanTree(source, (rel) => {
    throw new SyncRefusal(
      `${TAG} public/${rel} é um link (junção/symlink); não copio o que ele aponta.`
    )
  })
  if (sourceTree.has(SENTINEL))
    throw new SyncRefusal(
      `${TAG} public/${SENTINEL} tem o nome reservado do sentinela do destino; renomeie o arquivo.`
    )

  // 4. Destino: ausente, pasta vazia ou pasta com sentinela. Link ou pasta alheia recusam.
  const destinationStat = lstatOrNull(destination)
  /** @type {Map<string, { type: 'file' | 'dir', size: number, mtimeMs: number }>} */
  let destinationTree = new Map()
  let owned = false
  if (destinationStat) {
    if (destinationStat.isSymbolicLink())
      throw new SyncRefusal(
        `${TAG} ${destination} é um link (junção NTFS ou symlink), resto do antigo tools/link-web-public.mjs.\n` +
          'O host web agora usa uma cópia real de public/; não sigo nem apago links (known-issues, entrada 171).\n' +
          linkRemovalHelp(resolvedRoot, destination)
      )
    if (!destinationStat.isDirectory())
      throw new SyncRefusal(
        `${TAG} ${destination} existe e não é pasta; mova-o e rode de novo.`
      )
    destinationTree = scanTree(destination, (rel) => {
      throw new SyncRefusal(
        `${TAG} ${posix(path.join(destination, rel))} é um link dentro do destino; nada foi alterado.\n` +
          linkRemovalHelp(resolvedRoot, path.join(destination, rel))
      )
    })
    const sentinel = destinationTree.get(SENTINEL)
    owned = sentinel?.type === 'file'
    if (!owned && destinationTree.size > 0)
      throw new SyncRefusal(
        `${TAG} ${destination} é uma pasta real sem o sentinela ${SENTINEL} e com ${destinationTree.size} entradas; ` +
          'não sobrescrevo nem apago o que não gerei. Mova o conteúdo para fora (ou para public/ da raiz) e rode de novo.'
      )
    destinationTree.delete(SENTINEL)
  } else {
    fs.mkdirSync(destination)
  }
  if (!owned) fs.writeFileSync(path.join(destination, SENTINEL), SENTINEL_TEXT)

  // 5. Remove o que saiu de public/ (ou trocou de tipo): arquivos primeiro, depois pastas já vazias, das mais fundas.
  /** @type {string[]} */
  const removed = []
  const stale = [...destinationTree].filter(
    ([rel, entry]) => sourceTree.get(rel)?.type !== entry.type
  )
  for (const [rel, entry] of stale) {
    if (entry.type !== 'file') continue
    fs.unlinkSync(path.join(destination, rel))
    removed.push(rel)
  }
  const staleDirs = stale
    .filter(([, entry]) => entry.type === 'dir')
    .map(([rel]) => rel)
  staleDirs.sort(
    (a, b) => b.split('/').length - a.split('/').length || b.localeCompare(a)
  )
  for (const rel of staleDirs) {
    fs.rmdirSync(path.join(destination, rel))
    removed.push(rel)
  }

  // 6. Cria as pastas (das mais rasas) e copia o que mudou.
  /** @type {string[]} */
  const copied = []
  let unchanged = 0
  const ordered = [...sourceTree].sort(
    ([a], [b]) =>
      a.split('/').length - b.split('/').length || a.localeCompare(b)
  )
  for (const [rel, entry] of ordered) {
    const target = path.join(destination, rel)
    const previous = destinationTree.get(rel)
    const kept = previous !== undefined && previous.type === entry.type
    if (entry.type === 'dir') {
      if (!kept) fs.mkdirSync(target)
      continue
    }
    if (
      kept &&
      previous.size === entry.size &&
      Math.abs(previous.mtimeMs - entry.mtimeMs) < MTIME_TOLERANCE_MS
    ) {
      unchanged++
      continue
    }
    const from = path.join(source, rel)
    fs.copyFileSync(from, target)
    // A cópia recebe a data da fonte (no Linux o copyfile grava a de agora), base da comparação incremental. Em
    // segundos com a fração do ms: fica a menos de 1 µs da fonte; um Date perderia a fração, o que a tolerância de
    // 1 ms também absorveria.
    fs.utimesSync(target, entry.mtimeMs / 1000, entry.mtimeMs / 1000)
    copied.push(rel)
  }
  return { copied, removed, unchanged }
}

function main() {
  const args = process.argv.slice(2)
  const rootIndex = args.indexOf('--root')
  const root =
    rootIndex === -1
      ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
      : path.resolve(args[rootIndex + 1] ?? '')
  try {
    const { copied, removed, unchanged } = syncWebPublic({
      root,
      onLockWait: (owner) =>
        console.log(
          `${TAG} aguardando outra sincronização terminar (${owner})...`
        ),
    })
    console.log(
      `${TAG} public/ → apps/clients/web/public: ${copied.length} copiados, ${removed.length} removidos, ` +
        `${unchanged} inalterados.`
    )
  } catch (error) {
    if (!(error instanceof SyncRefusal)) throw error
    console.error(error.message)
    process.exitCode = 1
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main()
