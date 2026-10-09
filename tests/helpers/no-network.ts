/**
 * Setup das suítes unit, security, identity, platform e contract: nenhum teste
 * fala com a rede fora da máquina. Um teste já bateu no sandbox real do Asaas com
 * uma chave fictícia; quem precisa de um provedor usa o dublê
 * (tests/helpers/fake-asaas) ou um servidor local.
 *
 * Só localhost, 127.0.0.1 e ::1 passam. O resto falha na hora, com
 * {@link NetworkBlockedError}, em três camadas:
 * - `fetch` global (o undici embutido no Node): a promessa é rejeitada antes de sair;
 * - `http`/`https` `request` e `get`: lançam antes de abrir a conexão;
 * - `net.Socket#connect`, por onde passam `net.connect`, `tls.connect`, o undici
 *   instalado como pacote, os agentes HTTP e qualquer outro cliente TCP.
 * Um `vi.stubGlobal('fetch', dublê)` continua valendo: o dublê substitui o
 * `fetch` protegido e, ao restaurar, volta o protegido.
 */
import http from 'node:http'
import https from 'node:https'
import { syncBuiltinESMExports } from 'node:module'
import net from 'node:net'

/** Os únicos destinos permitidos nos testes. */
export const LOCAL_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
])

export class NetworkBlockedError extends Error {
  readonly code = 'ERR_TEST_NETWORK_BLOCKED'
  constructor(api: string, target: string) {
    super(
      `Rede de saída bloqueada nos testes: ${api} para ${target}. Só ${[...LOCAL_HOSTS].join(', ')} são permitidos; use o dublê (tests/helpers/fake-asaas para o Asaas) ou um servidor local.`
    )
    this.name = 'NetworkBlockedError'
  }
}

/** `[::1]` (URL) e `::1` (opções de socket) são o mesmo host; nome em minúsculas, sem ponto final. */
export function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return true
  const bare = host
    .toLowerCase()
    .replace(/^\[(.*)\]$/, '$1')
    .replace(/\.$/, '')
  return LOCAL_HOSTS.has(bare)
}

const STATE = Symbol.for('gb-locacoes.tests.no-network')
type Installed = { fetch: typeof fetch }
type WithState = { [STATE]?: Installed }

/** URL de uma chamada a `fetch` (string, URL ou Request); `null` quando não dá para ler. */
function fetchTarget(input: unknown): URL | null {
  try {
    if (typeof input === 'string') return new URL(input)
    if (input instanceof URL) return input
    if (input && typeof input === 'object' && 'url' in input)
      return new URL(String((input as { url: unknown }).url))
  } catch {
    // URL relativa ou inválida: o fetch original responde com o próprio erro.
  }
  return null
}

const NETWORK_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:'])

/** Host de `http.request(url?, options?, callback?)`; `null` para socket local (socketPath). */
function httpTarget(args: readonly unknown[]): string | null {
  let host: string | null = 'localhost'
  for (const argument of args) {
    if (typeof argument === 'string') {
      try {
        host = new URL(argument).hostname
      } catch {
        // Não é URL: o próprio http rejeita.
      }
    } else if (argument instanceof URL) host = argument.hostname
    else if (argument && typeof argument === 'object') {
      const options = argument as {
        socketPath?: unknown
        hostname?: unknown
        host?: unknown
      }
      if (options.socketPath) return null
      const named = options.hostname ?? options.host
      if (typeof named === 'string' && named) host = named
    }
  }
  return host
}

/** Destino de `Socket#connect`: `null` para IPC (pipe/unix socket), que não sai da máquina. */
function socketTarget(
  args: readonly unknown[]
): { host: string; port: unknown } | null {
  // net.connect(...) repassa os argumentos já normalizados como um array.
  const first = Array.isArray(args[0]) ? args[0][0] : args[0]
  if (first && typeof first === 'object') {
    const options = first as { path?: unknown; host?: unknown; port?: unknown }
    if (options.path) return null
    return {
      host: typeof options.host === 'string' ? options.host : 'localhost',
      port: options.port,
    }
  }
  if (
    typeof first === 'number' ||
    (typeof first === 'string' && /^\d+$/.test(first))
  )
    return {
      host: typeof args[1] === 'string' ? args[1] : 'localhost',
      port: first,
    }
  return null
}

type RequestFunction = (..._args: unknown[]) => http.ClientRequest

function guardHttp(module: typeof http | typeof https, scheme: string) {
  for (const name of ['request', 'get'] as const) {
    const original = module[name] as unknown as RequestFunction
    const guarded: RequestFunction = function (this: unknown, ...args) {
      const host = httpTarget(args)
      if (host !== null && !isLocalHost(host))
        throw new NetworkBlockedError(`${scheme}.${name}`, host)
      return original.apply(this, args)
    }
    ;(module as unknown as Record<string, RequestFunction>)[name] = guarded
  }
}

/** Instala as três camadas uma vez por processo (os arquivos de teste reaproveitam o worker). */
export function installNoNetwork(): void {
  const scope = globalThis as typeof globalThis & WithState
  if (scope[STATE]) return
  const originalFetch = globalThis.fetch
  const guardedFetch: typeof fetch = function (input, init) {
    const target = fetchTarget(input)
    if (
      target &&
      NETWORK_PROTOCOLS.has(target.protocol) &&
      !isLocalHost(target.hostname)
    )
      return Promise.reject(new NetworkBlockedError('fetch', target.origin))
    return originalFetch(input, init)
  }
  globalThis.fetch = guardedFetch
  scope[STATE] = { fetch: guardedFetch }

  guardHttp(http, 'http')
  guardHttp(https, 'https')

  const originalConnect = net.Socket.prototype.connect as unknown as (
    ..._args: unknown[]
  ) => net.Socket
  const guardedConnect = function (this: net.Socket, ...args: unknown[]) {
    const target = socketTarget(args)
    if (target && !isLocalHost(target.host))
      throw new NetworkBlockedError(
        'net.Socket#connect',
        `${target.host}:${String(target.port ?? '')}`
      )
    return originalConnect.apply(this, args)
  }
  net.Socket.prototype.connect =
    guardedConnect as unknown as typeof net.Socket.prototype.connect
  // `import { request } from 'node:http'` enxerga a troca.
  syncBuiltinESMExports()
}

installNoNetwork()
