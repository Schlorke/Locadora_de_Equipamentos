/**
 * Banco que o próprio setup gravou em DATABASE_URL/DIRECT_URL, por objeto de ambiente. Fica num símbolo do processo,
 * nunca numa variável de ambiente: nada de fora do processo (shell, .env, CI) consegue marcar um valor como gravado.
 */
type AppliedTestDatabase = {
  /** URLs descartáveis que applyTestDatabase validou e gravou neste ambiente. */
  readonly written: Set<string>
  /** Valores originais de DATABASE_URL/DIRECT_URL (URL → variável) substituídos pelo setup: seguem proibidos como alvo. */
  readonly replaced: Map<string, string>
}

/** Variáveis lidas pela guarda: process.env ou um ambiente montado pelo teste. */
export type TestDatabaseEnvironment = Record<string, string | undefined>

const APPLIED_TEST_DATABASES = Symbol.for(
  'gb-locacoes.tests.applied-test-database'
)

function appliedTestDatabases(): WeakMap<object, AppliedTestDatabase> {
  const scope = globalThis as typeof globalThis & {
    [APPLIED_TEST_DATABASES]?: WeakMap<object, AppliedTestDatabase>
  }
  scope[APPLIED_TEST_DATABASES] ??= new WeakMap()
  return scope[APPLIED_TEST_DATABASES]
}

/** Grafias aceitas para o host do banco descartável, escrito na própria URL (a query não pode trocá-lo). */
const LOCAL_TEST_HOSTS = ['localhost', '127.0.0.1', '[::1]']

/**
 * Endereços que levam ao próprio computador: o servidor PostgreSQL local responde por qualquer um deles (localhost e
 * seus subdomínios, 127.0.0.0/8, ::1 e o 127/8 mapeado em IPv6, e o endereço não especificado, que o cliente conecta
 * na própria máquina). Um diretório de socket Unix (host começando por "/") também é o servidor local.
 */
function isLoopback(host: string): boolean {
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    /^127(?:\.\d{1,3}){3}$/.test(host) ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    host === '[::]' ||
    /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/.test(host) ||
    host.startsWith('/')
  )
}

/** Host, porta e banco aonde o driver se conecta, como o `pg` os expõe (`client.host`, `.port`, `.database`). */
export type DatabaseTarget = {
  host: string
  port: number
  database: string | undefined
}

/**
 * Valor de uma chave repetida na query: o pg-connection-string fica com o último; outro cliente (libpq, o motor do
 * Prisma) pode ficar com o primeiro. A guarda considera as duas leituras.
 */
type RepeatedKey = 'last' | 'first'

/** Texto que o pg-connection-string entrega ao parser de URL: espaço e `%` solto são codificados antes. */
function driverText(value: string): string {
  return / |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i.test(value)
    ? encodeURI(value).replace(/%25(\d\d)/g, '%$1')
    : value
}

/**
 * Destino da conexão como o pg 8 o resolve (pg-connection-string 2 + ConnectionParameters): `host`/`port`/`user` da
 * query vencem os da URL quando não vazios; o que falta vem de PGHOST, PGPORT, PGDATABASE e PGUSER do ambiente, depois
 * de localhost, 5432 e o usuário do sistema; sem banco, o driver usa o nome do usuário. `env` faz o papel do
 * process.env do processo que conecta. tests/unit/test-database.test.ts compara com o `pg` instalado.
 */
export function databaseTarget(
  value: string,
  env: TestDatabaseEnvironment,
  repeated: RepeatedKey = 'last'
): DatabaseTarget {
  const url = new URL(driverText(value), 'postgres://base')
  const query = (key: string): string | undefined => {
    const values = url.searchParams.getAll(key)
    return repeated === 'last' ? values.at(-1) : values[0]
  }
  const user = query('user') || decodeURIComponent(url.username)
  let host: string | undefined
  let database: string | null
  if (url.protocol === 'socket:') {
    host = decodeURI(url.pathname)
    database = url.searchParams.get('db')
  } else {
    host = query('host')
    if (!host) host = decodeURIComponent(url.hostname)
    // Um socket codificado no host da URL vira prefixo do caminho quando a query já escolheu o host (pelo setter da
    // URL, que acrescenta a barra inicial).
    else if (/^%2f/i.test(url.hostname))
      url.pathname = url.hostname + url.pathname
    database = url.pathname.slice(1) ? decodeURI(url.pathname.slice(1)) : null
  }
  const systemUser = process.platform === 'win32' ? env.USERNAME : env.USER
  const resolvedUser = user || env.PGUSER || systemUser
  return {
    host: host || env.PGHOST || 'localhost',
    port: Number.parseInt(
      query('port') || url.port || env.PGPORT || '5432',
      10
    ),
    database: database || env.PGDATABASE || resolvedUser,
  }
}

/**
 * Host comparável: caixa, ponto final e as formas de IPv4/IPv6 canonizadas, e toda grafia de loopback como uma só,
 * porque o mesmo servidor local atende localhost, 127.0.0.1 e [::1].
 */
function comparableHost(raw: string): string {
  let host = raw.toLowerCase().replace(/\.$/, '')
  if (!host.startsWith('/')) {
    try {
      // O parser de URL especial canoniza 127.1, 2130706433 e IPv6 por extenso, como o resolvedor do sistema faz.
      const bracketed = host.includes(':') && !host.startsWith('[')
      host = new URL(`http://${bracketed ? `[${host}]` : host}`).hostname
    } catch {
      // Host que nem o parser aceita fica como escrito: nunca é confundido com loopback.
    }
  }
  return isLoopback(host) ? 'loopback' : host
}

/**
 * Ambientes cujas variáveis PG* completam a URL: o recebido e, quando é outro objeto, o do próprio processo, que é o
 * que o driver deste processo lê. A guarda recusa se qualquer um deles levar ao banco de teste.
 */
function connectingEnvironments(
  env: TestDatabaseEnvironment
): TestDatabaseEnvironment[] {
  return env === process.env ? [env] : [env, process.env]
}

/**
 * Destinos comparáveis de uma URL nas duas leituras de chave repetida e em cada ambiente que a completa. Só URL
 * absoluta: uma forma que o parser de URL recusa sem base (relativa, host vazio com usuário, socket como texto) é
 * recusada como inválida.
 */
function comparableTargets(
  value: string,
  key: string,
  env: TestDatabaseEnvironment
): string[] {
  try {
    new URL(driverText(value))
    return [
      ...new Set(
        connectingEnvironments(env).flatMap((environment) =>
          (['last', 'first'] as const).map((repeated) => {
            const target = databaseTarget(value, environment, repeated)
            return JSON.stringify([
              comparableHost(target.host),
              String(target.port),
              target.database,
            ])
          })
        )
      ),
    ]
  } catch {
    throw new Error(`Invalid ${key}`)
  }
}

function assertDistinctDatabase(
  tested: string[],
  key: string,
  value: string,
  env: TestDatabaseEnvironment
) {
  const real = comparableTargets(value, key, env)
  if (tested.some((target) => real.includes(target))) {
    throw new Error(
      `TEST_DATABASE_URL must not target the same database as ${key}`
    )
  }
}

/** Integration tests only accept an explicitly disposable local PostgreSQL database. */
export function requireTestDatabase(env: TestDatabaseEnvironment): string {
  if (env.TEST_DATABASE_DISPOSABLE !== 'true')
    throw new Error(
      'TEST_DATABASE_DISPOSABLE=true is required for database tests'
    )
  const value = env.TEST_DATABASE_URL
  if (!value)
    throw new Error('TEST_DATABASE_URL is required for integration tests')
  let target: URL
  try {
    target = new URL(value)
  } catch {
    throw new Error('Invalid TEST_DATABASE_URL')
  }
  if (
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    !LOCAL_TEST_HOSTS.includes(target.hostname) ||
    // O destino precisa ser um só para todo cliente (pg, motor do Prisma, psql): host e porta na query são lidos por
    // uns e ignorados ou lidos noutra ordem por outros, e sem porta escrita o pg segue PGPORT e o Prisma, 5432.
    ['host', 'hostaddr', 'port'].some((key) => target.searchParams.has(key)) ||
    (!target.port &&
      connectingEnvironments(env).some((environment) =>
        Boolean(environment.PGPORT)
      )) ||
    !/^\/(test(?:[_-].*)?|.*[_-]test)$/.test(target.pathname)
  ) {
    throw new Error(
      'Integration tests require a disposable local PostgreSQL database named test, test_* or *_test, with host and port written in the URL itself (no host or port in the query; the port is required when PGPORT is set)'
    )
  }
  const tested = comparableTargets(value, 'TEST_DATABASE_URL', env)
  const applied = appliedTestDatabases().get(env)
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    const current = env[key]
    if (!current) continue
    // Reentrada: o valor que applyTestDatabase gravou neste mesmo ambiente já foi validado como descartável.
    if (applied?.written.has(current)) continue
    assertDistinctDatabase(tested, key, current, env)
  }
  // O banco real que o setup substituiu continua recusado, mesmo depois de DATABASE_URL apontar para o de teste.
  for (const [original, key] of applied?.replaced ?? [])
    assertDistinctDatabase(tested, key, original, env)
  return value
}

/**
 * Valida o banco descartável e aponta DATABASE_URL/DIRECT_URL deste ambiente para ele (setup da suíte de integração).
 * Os valores originais ficam registrados no processo: chamadas seguintes de requireTestDatabase no mesmo ambiente
 * (fixtures, reentrada do setup) aceitam o valor gravado e seguem recusando o banco real que ele substituiu.
 */
export function applyTestDatabase(env: TestDatabaseEnvironment): string {
  const url = requireTestDatabase(env)
  const registry = appliedTestDatabases()
  const applied = registry.get(env) ?? {
    written: new Set<string>(),
    replaced: new Map<string, string>(),
  }
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    const current = env[key]
    if (
      current &&
      !applied.written.has(current) &&
      !applied.replaced.has(current)
    )
      applied.replaced.set(current, key)
  }
  applied.written.add(url)
  registry.set(env, applied)
  env.DATABASE_URL = url
  env.DIRECT_URL = url
  return url
}
