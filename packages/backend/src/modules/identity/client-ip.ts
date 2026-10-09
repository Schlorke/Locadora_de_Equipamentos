import { isIP } from 'node:net'
import { readPlatformEdgeContext } from './platform-edge'

type HeaderSource = Headers | Record<string, unknown> | null | undefined
/** NODE_ENV, TRUSTED_PROXY_HOPS, VERCEL and the PLATFORM_* edge settings. */
type ClientIpEnvironment = Readonly<Record<string, string | undefined>>

function headerValues(source: HeaderSource, name: string): string[] {
  if (!source) return []
  const raw = source instanceof Headers ? source.get(name) : source[name]
  const values = Array.isArray(raw) ? raw : [raw]
  return values.filter((value): value is string => typeof value === 'string')
}

function forwardedChain(source: HeaderSource): string[] {
  return headerValues(source, 'x-forwarded-for')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
}

/** First four groups of an IPv6 address: one /64 is one client. */
function ipv6Network(address: string): string {
  const halves = address.split('::')
  const groups = (part: string | undefined) => (part ? part.split(':') : [])
  const head = groups(halves[0])
  const tail = halves.length > 1 ? groups(halves[1]) : []
  const width = (list: string[]) =>
    list.reduce((total, group) => total + (group.includes('.') ? 2 : 1), 0)
  const expanded = [
    ...head,
    ...Array<string>(Math.max(0, 8 - width(head) - width(tail))).fill('0'),
    ...tail,
  ]
  return `${expanded
    .slice(0, 4)
    .map((group) => Number.parseInt(group, 16).toString(16))
    .join(':')}::/64`
}

/** Canonical address for rate limiting, or null when it is not an IP. */
function canonicalAddress(raw: string): string | null {
  let value = raw.trim()
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(value)
  if (bracketed) value = bracketed[1]!
  else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value))
    value = value.slice(0, value.lastIndexOf(':'))
  value = value.replace(/%.*$/, '')
  const version = isIP(value)
  if (version === 4) return value
  if (version !== 6) return null
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value)
  if (mapped && isIP(mapped[1]!) === 4) return mapped[1]!
  return ipv6Network(value.toLowerCase())
}

let warnedUntrustedClientIp = false

/**
 * Validated platform edge context of the request (`readPlatformEdgeContext`:
 * edge secret compared in constant time, host re-classified). Only the web
 * host proxy knows the secret, so a request carrying one came through it.
 */
function platformEdge(source: HeaderSource, env: ClientIpEnvironment) {
  if (!source) return null
  return readPlatformEdgeContext(
    { headers: { get: (name) => headerValues(source, name)[0] ?? null } },
    env
  )
}

/**
 * Client address for rate limiting, from sources written by trusted
 * infrastructure only:
 * - a validated platform edge context (the request came through the web host
 *   proxy): its client IP (`x-platform-client-ip`), or null when it has none.
 *   Every other header then describes the proxy itself (x-real-ip is its
 *   egress address on Vercel, the same for every user), so none is read;
 * - TRUSTED_PROXY_HOPS=N: the Nth X-Forwarded-For entry from the right, the
 *   one appended by the outermost of N proxies that append to the header.
 * - VERCEL=1: x-real-ip, which the Vercel edge sets to the connecting
 *   address, replacing any value sent by the client.
 * - Outside production, for local runs and tests: the leftmost
 *   X-Forwarded-For entry, then x-real-ip.
 * Otherwise null: `next start` keeps a client-sent X-Forwarded-For, so no
 * header is trusted. IPv6 is grouped by /64. Accepts Fetch Headers or the
 * plain header record NextAuth passes to credential providers.
 */
export function clientIpFromHeaders(
  source: HeaderSource,
  env: ClientIpEnvironment = process.env
): string | null {
  const edge = platformEdge(source, env)
  if (edge) return edge.clientIp ? canonicalAddress(edge.clientIp) : null
  const hops = Number(env.TRUSTED_PROXY_HOPS)
  if (Number.isInteger(hops) && hops >= 1) {
    const chain = forwardedChain(source)
    const entry = chain[chain.length - hops]
    return entry ? canonicalAddress(entry) : null
  }
  if (env.VERCEL === '1') {
    const [realIp] = headerValues(source, 'x-real-ip')
    return realIp ? canonicalAddress(realIp) : null
  }
  if (env.NODE_ENV !== 'production') {
    for (const candidate of [
      forwardedChain(source)[0],
      headerValues(source, 'x-real-ip')[0],
    ]) {
      const address = candidate ? canonicalAddress(candidate) : null
      if (address) return address
    }
    return null
  }
  if (!warnedUntrustedClientIp) {
    warnedUntrustedClientIp = true
    console.warn(
      '[rate-limit] Sem origem confiável de IP do cliente: defina TRUSTED_PROXY_HOPS ou implante na Vercel. Janelas por IP desativadas.'
    )
  }
  return null
}
