/**
 * Hosts que o registrador da paridade reconhece (onda 135, B3): a API e a raiz da rodada, e os hosts que uma fixture
 * isolada sobe por conta própria (`markParityHost`). Uma requisição a qualquer outra origem não entra no registro.
 */
import { inject } from 'vitest'
import { appendRecord } from './parity-report.mjs'

export type ParityTarget = 'api' | 'legacy'

const hosts = new Map<string, ParityTarget>()

/** Registra a origem de um host da rodada (ou de uma fixture isolada) com o alvo que ele representa. */
export function markParityHost(origin: string, target: ParityTarget) {
  hosts.set(new URL(origin).origin, target)
}

/** Alvo e URL de uma requisição a um host registrado; `null` para qualquer outra origem. */
export function hostOfRequest(input: Parameters<typeof fetch>[0]) {
  let url: URL
  try {
    url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    )
  } catch {
    return null
  }
  const target = hosts.get(url.origin)
  return target ? { target, url } : null
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const LOOPBACK = /https?:\/\/(?:127\.0\.0\.1|localhost):\d+/g

/**
 * Nome de um caso comparável entre rodadas (B11): as portas dos hosts mudam a cada rodada e os IDs da fixture são
 * sorteados, então a origem vira `<api>`/`<legacy>` (outra origem de loopback vira `<loopback>`), o sufixo da rodada
 * vira `<run>` e cada UUID vira `<uuid>`.
 */
export function caseName(
  name: string,
  context: { api: string; legacy: string | null; alfa: { id: string } }
) {
  const run = context.alfa.id.replace(/^api-alfa-/, '')
  let value = name.replaceAll(context.api, '<api>')
  if (context.legacy) value = value.replaceAll(context.legacy, '<legacy>')
  return value
    .replace(LOOPBACK, '<loopback>')
    .replace(UUID, '<uuid>')
    .replace(new RegExp(run, 'gi'), '<run>')
}

/** Grava uma requisição feita por outro transporte (ex.: a ponte TLS do host web) a um host registrado. */
export function recordParityHit(
  origin: string,
  method: string,
  pathname: string,
  status: number,
  via: string
) {
  const target = hosts.get(new URL(origin).origin)
  if (!target) return
  appendRecord(inject('apiParityRecord').directory, 'hits.jsonl', {
    target,
    method: method.toUpperCase(),
    path: new URL(pathname, origin).pathname,
    status,
    via,
  })
}

export { appendRecord }
