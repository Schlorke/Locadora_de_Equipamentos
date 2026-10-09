import { Client } from 'pg'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyTestDatabase,
  databaseTarget,
  requireTestDatabase,
  type TestDatabaseEnvironment,
} from '../helpers/test-database'

/**
 * PGHOST, PGPORT, PGDATABASE e PGUSER do shell completam as URLs para o driver deste processo, e a guarda também os lê:
 * cada caso parte deles ausentes e define só os que descreve.
 */
const DRIVER_DEFAULTS = ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER']

beforeEach(() => {
  for (const key of DRIVER_DEFAULTS) vi.stubEnv(key, undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('integration database isolation', () => {
  it.each([undefined, 'false'])(
    'requires disposable database opt-in: %s',
    (flag) => {
      expect(() =>
        requireTestDatabase({
          TEST_DATABASE_DISPOSABLE: flag,
          TEST_DATABASE_URL: 'postgresql://test:test@127.0.0.1/test_gb',
        })
      ).toThrow('TEST_DATABASE_DISPOSABLE')
    }
  )

  it('accepts an explicitly named local disposable database', () => {
    const url = 'postgresql://test:test@127.0.0.1:5432/test_gb'
    expect(
      requireTestDatabase({
        TEST_DATABASE_DISPOSABLE: 'true',
        TEST_DATABASE_URL: url,
      })
    ).toBe(url)
  })
  it.each([
    undefined,
    'invalid',
    'postgresql://u:p@db.example.com/test_gb',
    'postgresql://u:p@localhost/gb',
    'https://localhost/test_gb',
  ])('rejects implicit, remote or non-test targets: %s', (url) => {
    expect(() =>
      requireTestDatabase({
        TEST_DATABASE_DISPOSABLE: 'true',
        TEST_DATABASE_URL: url,
      })
    ).toThrow()
  })
  it.each(['DATABASE_URL', 'DIRECT_URL'])(
    'rejects the same database through %s, including a different credential',
    (key) => {
      expect(() =>
        requireTestDatabase({
          TEST_DATABASE_DISPOSABLE: 'true',
          TEST_DATABASE_URL: 'postgresql://test:test@localhost/test_gb',
          [key]: 'postgresql://other:secret@localhost:5432/test_gb',
        })
      ).toThrow('same database')
    }
  )
})

/**
 * O mesmo servidor PostgreSQL local atende por localhost, 127.0.0.1 e [::1], e o driver (pg-connection-string) ainda
 * aceita o host e a porta na query e decodifica host e nome do banco. A guarda compara o destino efetivo, não a grafia
 * (onda 132, achado 145): um banco real local escrito de outro jeito continua sendo o banco de teste.
 */
describe('integration database comparison by effective target', () => {
  const loopback = ['localhost', '127.0.0.1', '[::1]']
  const pairs = loopback.flatMap((test) =>
    loopback.filter((real) => real !== test).map((real) => [test, real])
  )

  it.each(pairs)(
    'refuses TEST_DATABASE_URL on %s when the real DATABASE_URL reaches the same database through %s',
    (testHost, realHost) => {
      expect(() =>
        requireTestDatabase({
          TEST_DATABASE_DISPOSABLE: 'true',
          TEST_DATABASE_URL: `postgresql://runner:pw@${testHost}:55441/w_guard_test`,
          DATABASE_URL: `postgresql://dev:other@${realHost}:55441/w_guard_test`,
        })
      ).toThrow('same database as DATABASE_URL')
    }
  )

  it.each(pairs)(
    'keeps refusing the real database on %s replaced by the setup when TEST_DATABASE_URL moves to %s',
    (realHost, testHost) => {
      const env: TestDatabaseEnvironment = {
        TEST_DATABASE_DISPOSABLE: 'true',
        TEST_DATABASE_URL:
          'postgresql://runner:pw@127.0.0.1:55441/w_other_test',
        DIRECT_URL: `postgresql://dev:other@${realHost}:55441/w_guard_test`,
      }
      applyTestDatabase(env)
      env.TEST_DATABASE_URL = `postgresql://runner:pw@${testHost}:55441/w_guard_test`
      expect(() => requireTestDatabase(env)).toThrow(
        'same database as DIRECT_URL'
      )
    }
  )

  it.each([
    ['upper case', 'postgresql://dev:x@LOCALHOST:55441/w_guard_test'],
    ['trailing dot', 'postgresql://dev:x@localhost.:55441/w_guard_test'],
    [
      'localhost subdomain',
      'postgresql://dev:x@db.localhost:55441/w_guard_test',
    ],
    ['short IPv4', 'postgresql://dev:x@127.1:55441/w_guard_test'],
    ['decimal IPv4', 'postgresql://dev:x@2130706433:55441/w_guard_test'],
    [
      'another 127/8 address',
      'postgresql://dev:x@127.0.0.2:55441/w_guard_test',
    ],
    [
      'IPv4-mapped IPv6',
      'postgresql://dev:x@[::ffff:127.0.0.1]:55441/w_guard_test',
    ],
    [
      'expanded IPv6',
      'postgresql://dev:x@[0:0:0:0:0:0:0:1]:55441/w_guard_test',
    ],
    ['unspecified address', 'postgresql://dev:x@0.0.0.0:55441/w_guard_test'],
    [
      'percent-encoded host',
      'postgresql://dev:x@%6Cocalhost:55441/w_guard_test',
    ],
    [
      'host and port in the query',
      'postgresql://dev:x@db.example.com:5432/w_guard_test?host=localhost&port=55441',
    ],
    [
      'port with leading zero in the query',
      'postgresql://dev:x@localhost/w_guard_test?port=055441',
    ],
    [
      'percent-encoded database name',
      'postgresql://dev:x@localhost:55441/w%5Fguard%5Ftest',
    ],
  ])('refuses a real DATABASE_URL written with %s', (_, real) => {
    expect(() =>
      requireTestDatabase({
        TEST_DATABASE_DISPOSABLE: 'true',
        TEST_DATABASE_URL:
          'postgresql://runner:pw@127.0.0.1:55441/w_guard_test',
        DATABASE_URL: real,
      })
    ).toThrow('same database as DATABASE_URL')
  })

  it.each([
    ['another host', 'postgresql://dev:x@db.example.com:55441/w_guard_test'],
    ['another port', 'postgresql://dev:x@localhost:55442/w_guard_test'],
    ['the default port', 'postgresql://dev:x@[::1]/w_guard_test'],
    ['another database', 'postgresql://dev:x@[::1]:55441/w_guard_other'],
    [
      'a query host elsewhere',
      'postgresql://dev:x@localhost:55441/w_guard_test?host=db.example.com',
    ],
  ])('still accepts a real DATABASE_URL on %s', (_, real) => {
    const url = 'postgresql://runner:pw@127.0.0.1:55441/w_guard_test'
    expect(
      requireTestDatabase({
        TEST_DATABASE_DISPOSABLE: 'true',
        TEST_DATABASE_URL: url,
        DATABASE_URL: real,
      })
    ).toBe(url)
  })

  it('refuses a TEST_DATABASE_URL whose query sends the driver to another host', () => {
    expect(() =>
      requireTestDatabase({
        TEST_DATABASE_DISPOSABLE: 'true',
        TEST_DATABASE_URL:
          'postgresql://runner:pw@localhost:55441/w_guard_test?host=db.example.com',
      })
    ).toThrow('disposable local PostgreSQL database')
  })
})

/**
 * Setup da suíte de integração (tests/setup.ts): aponta DATABASE_URL para o banco descartável e as fixtures voltam a
 * chamar a guarda no mesmo processo. A guarda aceita o valor que o próprio setup gravou e segue recusando o banco real.
 */
describe('integration setup database switch', () => {
  const disposable =
    'postgresql://runner:secret@127.0.0.1:55441/w_integration_test'
  const remote = 'postgresql://app:secret@db.example.com:5432/gb'
  // Banco real local com nome de teste: só a comparação com DATABASE_URL/DIRECT_URL o protege.
  const localReal = 'postgresql://dev:secret@localhost:5432/gb_dev_test'
  const environment = (
    values: TestDatabaseEnvironment = {}
  ): TestDatabaseEnvironment => ({
    TEST_DATABASE_DISPOSABLE: 'true',
    TEST_DATABASE_URL: disposable,
    DATABASE_URL: remote,
    DIRECT_URL: remote,
    ...values,
  })

  it('points DATABASE_URL at the disposable database and accepts fixtures and setup reentry', () => {
    const env = environment()
    expect(applyTestDatabase(env)).toBe(disposable)
    expect(env.DATABASE_URL).toBe(disposable)
    expect(env.DIRECT_URL).toBe(disposable)
    expect(requireTestDatabase(env)).toBe(disposable)
    expect(applyTestDatabase(env)).toBe(disposable)
    expect(requireTestDatabase(env)).toBe(disposable)
  })

  it.each(['DATABASE_URL', 'DIRECT_URL'])(
    'refuses a real %s equal to the test database and leaves the environment untouched',
    (key) => {
      const real = 'postgresql://dev:other@127.0.0.1:55441/w_integration_test'
      const env = environment({ [key]: real })
      expect(() => applyTestDatabase(env)).toThrow(`same database as ${key}`)
      expect(env[key]).toBe(real)
      expect(() => requireTestDatabase(env)).toThrow(`same database as ${key}`)
    }
  )

  it.each(['DATABASE_URL', 'DIRECT_URL'])(
    'keeps refusing the real %s that the setup replaced',
    (key) => {
      const env = environment({ [key]: localReal })
      applyTestDatabase(env)
      env.TEST_DATABASE_URL = 'postgresql://other:pw@localhost/gb_dev_test'
      expect(() => requireTestDatabase(env)).toThrow(`same database as ${key}`)
      expect(() => applyTestDatabase(env)).toThrow(`same database as ${key}`)
      expect(env.DATABASE_URL).toBe(disposable)
    }
  )

  it('only exempts the exact value written into that same environment', () => {
    const env = environment()
    applyTestDatabase(env)
    expect(() => requireTestDatabase({ ...env })).toThrow(
      'same database as DATABASE_URL'
    )
    expect(() =>
      requireTestDatabase(
        environment({ DATABASE_URL: disposable, DIRECT_URL: undefined })
      )
    ).toThrow('same database as DATABASE_URL')
    env.DATABASE_URL =
      'postgresql://other:pw@127.0.0.1:55441/w_integration_test'
    expect(() => requireTestDatabase(env)).toThrow(
      'same database as DATABASE_URL'
    )
  })
})

/**
 * O driver (pg 8, pg-connection-string 2) completa o que a URL omite com PGHOST, PGPORT, PGDATABASE e PGUSER (e o usuário
 * do sistema), lê o último valor de uma chave repetida na query e ignora `?host=`/`?port=` vazios. A guarda supunha 5432,
 * lia o primeiro valor e tratava host vazio como local: duas URLs que o driver leva ao mesmo banco passavam por
 * diferentes (onda 132, achado 145, segunda rodada).
 */
describe('integration database comparison with the driver defaults and repeated query keys', () => {
  const test = 'postgresql://runner:pw@127.0.0.1:55441/w_guard_test'
  // O ambiente dado é o do processo, como no setup: as mesmas variáveis PG* valem para a guarda e para o driver.
  const guard = (values: TestDatabaseEnvironment) => {
    for (const key of DRIVER_DEFAULTS)
      if (key in values) vi.stubEnv(key, values[key])
    return requireTestDatabase({
      TEST_DATABASE_DISPOSABLE: 'true',
      TEST_DATABASE_URL: test,
      ...values,
    })
  }

  it.each([
    [
      'the port from PGPORT',
      { PGPORT: '55441' },
      'postgresql://dev:x@localhost/w_guard_test',
    ],
    [
      'the port from PGPORT behind an empty ?port=',
      { PGPORT: '55441' },
      'postgresql://dev:x@localhost/w_guard_test?port=',
    ],
    [
      'the database from PGDATABASE',
      { PGDATABASE: 'w_guard_test' },
      'postgresql://dev:x@localhost:55441',
    ],
    [
      'the database named after the URL user',
      {},
      'postgresql://w_guard_test:x@localhost:55441',
    ],
    [
      'the database named after PGUSER',
      { PGUSER: 'w_guard_test' },
      'postgresql://localhost:55441/',
    ],
    [
      'the last of two ?host= values',
      {},
      'postgresql://dev:x@db.example.com:55441/w_guard_test?host=db.example.com&host=localhost',
    ],
    [
      'the last of two ?port= values',
      {},
      'postgresql://dev:x@localhost:5432/w_guard_test?port=5432&port=55441',
    ],
    [
      'the first of two ?host= values, which a first-value client reads',
      {},
      'postgresql://dev:x@localhost:55441/w_guard_test?host=localhost&host=db.example.com',
    ],
  ])(
    'refuses a real DATABASE_URL that reaches the test database through %s',
    (_, env, real) => {
      expect(() => guard({ ...env, DATABASE_URL: real })).toThrow(
        'same database as DATABASE_URL'
      )
    }
  )

  it('refuses when only the process environment completes the port, which the driver of this process reads', () => {
    vi.stubEnv('PGPORT', '55441')
    expect(() =>
      requireTestDatabase({
        TEST_DATABASE_DISPOSABLE: 'true',
        TEST_DATABASE_URL: test,
        DATABASE_URL: 'postgresql://dev:x@localhost/w_guard_test',
      })
    ).toThrow('same database as DATABASE_URL')
    expect(() =>
      requireTestDatabase({
        TEST_DATABASE_DISPOSABLE: 'true',
        TEST_DATABASE_URL: 'postgresql://runner:pw@localhost/w_guard_test',
      })
    ).toThrow('disposable local PostgreSQL database')
  })

  it('keeps refusing the real database the setup replaced when PGPORT completes its port', () => {
    const env: TestDatabaseEnvironment = {
      TEST_DATABASE_DISPOSABLE: 'true',
      TEST_DATABASE_URL: 'postgresql://runner:pw@127.0.0.1:55441/w_other_test',
      PGPORT: '55441',
      DIRECT_URL: 'postgresql://dev:x@localhost/w_guard_test',
    }
    applyTestDatabase(env)
    env.TEST_DATABASE_URL = test
    expect(() => requireTestDatabase(env)).toThrow(
      'same database as DIRECT_URL'
    )
  })

  it.each([
    [
      'an empty ?host= (the URL host stays)',
      {},
      'postgresql://dev:x@db.example.com:55441/w_guard_test?host=',
    ],
    [
      'an empty host completed by a remote PGHOST',
      { PGHOST: 'db.example.com' },
      'postgresql:///w_guard_test?port=55441',
    ],
    [
      'no port and no PGPORT (the default 5432)',
      {},
      'postgresql://dev:x@localhost/w_guard_test',
    ],
  ])('still accepts a real DATABASE_URL with %s', (_, env, real) => {
    expect(guard({ ...env, DATABASE_URL: real })).toBe(test)
  })

  it.each([
    [
      'a remote last ?host=',
      {},
      'postgresql://runner:pw@localhost:55441/w_guard_test?host=localhost&host=db.example.com',
    ],
    [
      'a remote first ?host=',
      {},
      'postgresql://runner:pw@localhost:55441/w_guard_test?host=db.example.com&host=localhost',
    ],
    [
      'a ?port= that only some clients read',
      {},
      'postgresql://runner:pw@localhost:55441/w_guard_test?port=5432',
    ],
    [
      'a loopback ?host= that only some clients read',
      {},
      'postgresql://runner:pw@localhost:55441/w_guard_test?host=127.0.0.1',
    ],
    [
      'no port while PGPORT sends the driver elsewhere',
      { PGPORT: '55442' },
      'postgresql://runner:pw@localhost/w_guard_test',
    ],
  ])('refuses a TEST_DATABASE_URL with %s', (_, env, url) => {
    expect(() =>
      requireTestDatabase({
        TEST_DATABASE_DISPOSABLE: 'true',
        TEST_DATABASE_URL: url,
        ...env,
      })
    ).toThrow('disposable local PostgreSQL database')
  })

  it('accepts a TEST_DATABASE_URL without port when PGPORT is not set, and one with its port when it is', () => {
    const portless = 'postgresql://runner:pw@localhost/w_guard_test'
    expect(
      requireTestDatabase({
        TEST_DATABASE_DISPOSABLE: 'true',
        TEST_DATABASE_URL: portless,
      })
    ).toBe(portless)
    expect(
      requireTestDatabase({
        TEST_DATABASE_DISPOSABLE: 'true',
        TEST_DATABASE_URL: test,
        PGPORT: '55442',
      })
    ).toBe(test)
  })
})

/**
 * O destino que a guarda calcula é o do driver real: o `pg` instalado resolve as mesmas URLs com as mesmas variáveis
 * de ambiente e precisa chegar ao mesmo host, porta e banco. Uma atualização do driver que mude a leitura reprova aqui.
 */
describe('databaseTarget matches the installed pg driver', () => {
  const user = process.platform === 'win32' ? 'USERNAME' : 'USER'
  const environments: Record<string, string>[] = [
    {},
    { PGPORT: '55441' },
    {
      PGHOST: 'db.example.com',
      PGPORT: '6543',
      PGDATABASE: 'w_env_db',
      PGUSER: 'w_env_user',
    },
    { PGUSER: 'w_env_user', PGPORT: '' },
  ]
  const urls = [
    'postgresql://dev:x@localhost:55441/w_guard_test',
    'postgresql://dev:x@localhost/w_guard_test',
    'postgres://dev:x@127.0.0.1/w_guard_test?port=',
    'postgresql:///w_guard_test',
    'postgresql:///w_guard_test?port=55441&host=',
    'postgresql://dev@localhost:55441',
    'postgresql://localhost:55441/',
    'postgresql://dev:x@db.example.com:5432/w_guard_test?host=db.example.com&host=localhost',
    'postgresql://dev:x@localhost:5432/w_guard_test?port=5432&port=55441',
    'postgresql://dev:x@localhost/w_guard_test?host=%2Fvar%2Frun%2Fpostgresql',
    'postgresql://dev:x@%2Fvar%2Frun%2Fpostgresql/w_guard_test?host=localhost',
    'postgresql://dev:x@%6Cocalhost:55441/w%5Fguard%5Ftest',
    'postgresql://dev:p w@localhost:55441/w guard test',
    'postgresql://dev:x@[::1]:55441/w_guard_test?user=other',
    'postgresql://dev:x@LOCALHOST:0055441/w_guard_test',
    'socket:/var/run/postgresql?db=w_guard_test&port=55441',
  ]
  const cases = environments.flatMap((env) =>
    urls.map((url) => [url, env] as const)
  )

  it.each(cases)('%s with %o', (url, env) => {
    for (const key of ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER'])
      vi.stubEnv(key, env[key])
    const driver = new Client({ connectionString: url })
    expect(databaseTarget(url, { ...env, [user]: process.env[user] })).toEqual({
      host: driver.host,
      port: driver.port,
      database: driver.database,
    })
  })
})
