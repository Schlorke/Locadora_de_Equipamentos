/**
 * Registro e relatório da bateria de paridade (onda 135, B3 e B11): `tests/api-host/parity-report.mjs` e o nome estável
 * dos casos (`tests/api-host/parity-record.ts`). Cobertura por método da API com desfecho de sucesso esperado e
 * comparação de `assertionCalls` entre a rodada com a raiz e a rodada sem ela.
 */
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  compareAssertions,
  appendRecord,
  assertionReport,
  createRouteMatcher,
  finishRecord,
  isSuccess,
  readRecord,
  recordDirectory,
  routeCoverage,
  startRecord,
} from '../api-host/parity-report.mjs'
import { caseName } from '../api-host/parity-record'

const endpoints = [
  'GET /api/[...rest]',
  'GET /api/admin/categories',
  'POST /api/admin/categories',
  'PUT /api/admin/categories/[id]',
  'GET /api/admin/categories/order',
  'POST /api/payments/boleto/webhook',
  'GET /api/cron/sync-google-merchant',
  'GET /api/drei-proxy/[...path]',
]
const sources: Record<string, string> = {
  '/api/payments/boleto/webhook':
    "return Response.json({ error: 'x' }, { status: 410 })",
  '/api/cron/sync-google-merchant':
    "return Response.json({ error: 'quarantined' }, { status: 503 })",
}
const hit = (
  method: string,
  pathname: string,
  status: number,
  target = 'api'
) => ({
  target,
  method,
  path: pathname,
  status,
})

describe('casamento de rota do App Router', () => {
  const match = createRouteMatcher(endpoints)
  it.each([
    ['/api/admin/categories', '/api/admin/categories'],
    ['/api/admin/categories/order', '/api/admin/categories/order'],
    ['/api/admin/categories/abc', '/api/admin/categories/[id]'],
    ['/api/admin/categories/a%20b', '/api/admin/categories/[id]'],
    ['/api/drei-proxy/a/b/c.glb', '/api/drei-proxy/[...path]'],
    ['/api/nao/existe', '/api/[...rest]'],
    ['/fora-da-api', null],
  ])(
    '%s -> %s (estático antes de [x], [x] antes de [...x])',
    (pathname, route) => {
      expect(match(pathname)).toBe(route)
    }
  )
})

describe('desfecho de sucesso esperado', () => {
  it.each([
    [200, '', true],
    [201, '', true],
    [204, '', true],
    [302, '', false],
    [401, '', false],
    [403, '', false],
    [404, '', false],
    [409, '', false],
    [410, sources['/api/payments/boleto/webhook']!, true],
    [410, 'status: 4100', false],
    [503, '', false],
    [503, sources['/api/cron/sync-google-merchant']!, true],
  ])(
    'status %i com a rota %j conta como sucesso: %s',
    (status, source, expected) => {
      expect(isSuccess(status, source)).toBe(expected)
    }
  )
})

describe('cobertura por método (B3)', () => {
  const coverage = (hits: ReturnType<typeof hit>[], exceptions = {}) =>
    routeCoverage({
      hits,
      endpoints,
      exceptions,
      routeSource: (route: string) => sources[route] ?? '',
    })
  const everything = [
    hit('GET', '/api/nao-existe', 200),
    hit('GET', '/api/admin/categories', 200),
    hit('POST', '/api/admin/categories', 201),
    hit('PUT', '/api/admin/categories/x', 200),
    hit('GET', '/api/admin/categories/order', 200),
    hit('POST', '/api/payments/boleto/webhook', 410),
    hit('GET', '/api/cron/sync-google-merchant', 503),
    hit('GET', '/api/drei-proxy/a.glb', 200),
  ]
  it('todo método com sucesso esperado cobre 8/8', () => {
    const report = coverage(everything)
    expect(report.ok).toBe(true)
    expect(report.methods).toEqual({ total: 8, covered: 8 })
    expect(report.routes).toEqual({ total: 7, covered: 7 })
    expect(report.missing).toEqual([])
  })
  it('negação, sucesso da raiz e método diferente não cobrem', () => {
    const report = coverage([
      ...everything.filter((row) => row.method !== 'PUT'),
      hit('PUT', '/api/admin/categories/x', 403),
      hit('PUT', '/api/admin/categories/x', 200, 'legacy'),
      hit('PATCH', '/api/admin/categories/x', 200),
    ])
    expect(report.ok).toBe(false)
    expect(report.missing).toEqual([
      { endpoint: 'PUT /api/admin/categories/[id]', statuses: [403] },
    ])
    expect(report.unmatched).toEqual([
      { request: 'PATCH /api/admin/categories/x', count: 1 },
    ])
  })
  it('exceção justificada fecha o método sem sucesso; a lista só encolhe', () => {
    const without = everything.filter((row) => row.method !== 'PUT')
    expect(
      coverage(without, {
        'PUT /api/admin/categories/[id]':
          'sucesso coberto pela suíte de unidade X',
      }).ok
    ).toBe(true)
    const problems = coverage(everything, {
      'PUT /api/admin/categories/[id]':
        'sucesso coberto pela suíte de unidade X',
      'GET /api/fora': 'rota que não existe mais na API',
      'GET /api/admin/categories': 'curto',
    }).problems
    expect(problems).toEqual([
      'PUT /api/admin/categories/[id]: já tem sucesso na rodada; tire a exceção',
      'GET /api/fora: exceção fora da superfície da API',
      'GET /api/admin/categories: exceção sem motivo',
    ])
  })
  it('exceção restrita a um motor só vale nesse motor', () => {
    const without = everything.filter((row) => row.method !== 'PUT')
    const only = {
      'PUT /api/admin/categories/[id]': {
        reason: 'o sucesso exige Better Auth (cadastro ligado)',
        authModes: ['legacy'],
      },
    }
    expect(
      routeCoverage({
        hits: without,
        endpoints,
        exceptions: only,
        routeSource: (route: string) => sources[route] ?? '',
        authMode: 'legacy',
      }).missing
    ).toEqual([])
    expect(
      routeCoverage({
        hits: without,
        endpoints,
        exceptions: only,
        routeSource: (route: string) => sources[route] ?? '',
        authMode: 'better-auth',
      }).missing.map((entry: { endpoint: string }) => entry.endpoint)
    ).toEqual(['PUT /api/admin/categories/[id]'])
  })
})

describe('asserções por caso, com e sem a raiz (B11)', () => {
  const row = (name: string, assertions: number, state = 'pass') => ({
    file: 'a.http.test.ts',
    name,
    state,
    assertions,
  })
  it('caso sem asserção, abaixo da metade ou sumido sem ser braço da raiz reprova', () => {
    const report = compareAssertions({
      present: [
        row('x', 10),
        row('y', 10),
        row('z', 4),
        row('<legacy> lê o catálogo', 3),
        row('legado — cartão', 3),
        row('some sem motivo', 2),
      ],
      absent: [row('x', 5), row('y', 4), row('z', 0), row('novo', 1)],
    })
    expect(report.open).toEqual([
      { key: 'a.http.test.ts > y', present: 10, absent: 4, rule: '>=half' },
      { key: 'a.http.test.ts > z', present: 4, absent: 0, rule: '>=1' },
      {
        key: 'a.http.test.ts > some sem motivo',
        present: 2,
        absent: null,
        rule: 'missing-without-root',
      },
    ])
    expect(report.presentOnly).toHaveLength(3)
    expect(report.absentOnly).toEqual(['a.http.test.ts > novo'])
    expect(report.ok).toBe(false)
  })
  it('exceção com motivo aceita a violação listada', () => {
    const report = compareAssertions({
      present: [row('y', 10)],
      absent: [row('y', 4)],
      exceptions: {
        'a.http.test.ts > y': 'o laço da raiz tinha seis asserções só dela',
      },
    })
    expect(report.ok).toBe(true)
    expect(report.accepted).toHaveLength(1)
  })
  it.each([
    { present: [], absent: [] },
    { present: [row('x', 2)], absent: [] },
    { present: [], absent: [row('x', 2)] },
    { present: [row('x', 2), row('falhou', 1, 'fail')], absent: [row('x', 1)] },
    { present: [row('x', 2)], absent: [row('x', 1), row('falhou', 1, 'fail')] },
    { present: [row('x', 2)], absent: [row('x', 1), row('incerto', 1, 'run')] },
    { present: [row('x', 2)], absent: [row('x', Number.NaN)] },
    { present: [row('x', 2)], absent: [row('x', -1)] },
    { present: [row('x', 2)], absent: [row('x', 1), row('x', 1)] },
  ])('recusa evidência vazia, inválida, duplicada ou falha: %j', (records) => {
    expect(compareAssertions(records).ok).toBe(false)
  })
  it('preserva casos skip/todo intencionais sem ocultar falhas da rodada', () => {
    const cases = [
      row('x', 2),
      row('não aplicável', 0, 'skip'),
      row('planejado', 0, 'todo'),
    ]
    expect(compareAssertions({ present: cases, absent: cases }).ok).toBe(true)
  })
  it('CLI não aprova duas pastas inexistentes como zero casos válidos', () => {
    const directory = mkdtempSync(
      path.join(tmpdir(), 'locadora-parity-missing-')
    )
    try {
      const result = spawnSync(
        process.execPath,
        [
          'tests/api-host/parity-report.mjs',
          'assertions',
          path.join(directory, 'present'),
          path.join(directory, 'absent'),
        ],
        { encoding: 'utf8' }
      )
      expect(result.status, result.stdout + result.stderr).toBe(1)
    } finally {
      rmdirSync(directory)
    }
  })
})

describe('nome estável do caso e pasta do registro', () => {
  const context = {
    api: 'http://127.0.0.1:51234',
    legacy: 'http://127.0.0.1:51233',
    alfa: { id: 'api-alfa-0a1b2c3d4e5f' },
  }
  it('troca origens, sufixo da rodada e UUIDs por marcadores', () => {
    expect(
      caseName(
        'http://127.0.0.1:51234 grava em {"id":"api-alfa-0a1b2c3d4e5f","categoryId":"3f1c2a7e-1111-4a2b-8c3d-1234567890ab"} via http://127.0.0.1:60000 e http://127.0.0.1:51233 APIDIR0A1B2C3D4E5F',
        context
      )
    ).toBe(
      '<api> grava em {"id":"api-alfa-<run>","categoryId":"<uuid>"} via <loopback> e <legacy> APIDIR<run>'
    )
  })
  it('a pasta padrão fica no %TEMP% por perfil e a explícita vence', () => {
    expect(recordDirectory({}, 'absent-legacy')).toBe(
      path.join(tmpdir(), 'locadora-api-parity', 'absent-legacy')
    )
    expect(recordDirectory({ API_PARITY_RECORD_DIR: 'x/y' }, 'p')).toBe(
      path.resolve('x/y')
    )
  })
  it('um registro novo zera só os arquivos conhecidos', () => {
    const directory = mkdtempSync(
      path.join(tmpdir(), 'locadora-parity-record-')
    )
    try {
      writeFileSync(path.join(directory, 'hits.jsonl'), '{"old":true}\n')
      writeFileSync(path.join(directory, 'outro.txt'), 'fica')
      startRecord(directory, { profile: 'absent-legacy' })
      expect(readRecord(directory, 'hits.jsonl')).toEqual([])
      expect(readFileSync(path.join(directory, 'outro.txt'), 'utf8')).toBe(
        'fica'
      )
      expect(
        JSON.parse(readFileSync(path.join(directory, 'meta.json'), 'utf8'))
      ).toMatchObject({
        profile: 'absent-legacy',
        surface: {
          hash: expect.stringMatching(/^[a-f0-9]{64}$/),
          files: expect.arrayContaining(['public-catalog.http.test.ts']),
        },
      })
    } finally {
      for (const name of [
        'hits.jsonl',
        'cases.jsonl',
        'files.jsonl',
        'meta.json',
        'outro.txt',
      ])
        rmSync(path.join(directory, name), { force: true })
      rmdirSync(directory)
    }
  })
})

describe('evidência final das rodadas (B11)', () => {
  function workspace() {
    const root = mkdtempSync(path.join(tmpdir(), 'locadora-parity-evidence-'))
    const directories = [
      'tests',
      'tests/api-host',
      'tests/helpers',
      'prisma',
      'prisma/migrations',
      'prisma/migrations/fixture',
      'tests/security',
      'tests/security/fixtures',
      'present',
      'absent',
    ]
    for (const directory of directories) mkdirSync(path.join(root, directory))
    const files: string[] = []
    const write = (name: string, value: unknown) => {
      writeFileSync(
        path.join(root, name),
        typeof value === 'string' ? value : JSON.stringify(value)
      )
      if (!files.includes(name)) files.push(name)
    }
    for (const file of ['a.http.test.ts', 'b.http.test.ts'])
      write(`tests/api-host/${file}`, '// stable fixture')
    for (const file of [
      'tests/api-host/global-setup.ts',
      'tests/api-host/receiving-account.ts',
      'tests/helpers/owned-process.ts',
      'prisma/migrations/fixture/migration.sql',
      'vitest.api.config.ts',
    ])
      write(file, '// stable fixture configuration')
    write('tests/security/fixtures/api-surface.json', {
      endpoints: ['GET /api/things'],
    })
    for (const [label, legacyMode] of [
      ['present', 'production'],
      ['absent', 'absent'],
    ]) {
      const directory = path.join(root, label!)
      startRecord(
        directory,
        {
          profile: `${legacyMode}-legacy`,
          legacyMode,
          authMode: 'legacy',
          hostMode: 'production',
          startedAt: new Date().toISOString(),
        },
        root
      )
      for (const name of [
        'meta.json',
        'hits.jsonl',
        'cases.jsonl',
        'files.jsonl',
        'completion.json',
      ])
        files.push(`${label}/${name}`)
      for (const file of ['a.http.test.ts', 'b.http.test.ts']) {
        appendRecord(directory, 'files.jsonl', { file })
        appendRecord(directory, 'cases.jsonl', {
          file,
          name: 'shared case',
          state: 'pass',
          assertions: 2,
        })
      }
    }
    const directory = (label: string) => path.join(root, label)
    const json = (name: string) =>
      JSON.parse(readFileSync(path.join(root, name), 'utf8'))
    const finalFiles = (label: string) =>
      ['a.http.test.ts', 'b.http.test.ts'].map((file) => ({
        type: 'suite',
        filepath: path.join(root, 'tests/api-host', file),
        result: { state: 'pass' },
        tasks: readRecord(directory(label), 'cases.jsonl')
          .filter((row: { file: string }) => row.file === file)
          .map((row: { state: string }) => ({
            type: 'test',
            result: { state: row.state },
          })),
      }))
    const finish = (label: string) =>
      finishRecord(directory(label), { files: finalFiles(label) }, root)
    finish('present')
    finish('absent')
    return {
      root,
      directory,
      write,
      json,
      finish,
      finalFiles,
      report: () =>
        assertionReport(root, directory('present'), directory('absent')),
      dispose() {
        for (const file of files) rmSync(path.join(root, file), { force: true })
        for (const directory of [...directories].reverse())
          rmdirSync(path.join(root, directory))
        rmdirSync(root)
      },
    }
  }

  it('compara rodadas completas e permite braços legacy e skip/todo intencionais', () => {
    const fixture = workspace()
    try {
      for (const label of ['present', 'absent']) {
        appendRecord(fixture.directory(label), 'cases.jsonl', {
          file: 'a.http.test.ts',
          name: 'not applicable',
          state: 'skip',
          assertions: 0,
        })
        appendRecord(fixture.directory(label), 'cases.jsonl', {
          file: 'a.http.test.ts',
          name: 'planned',
          state: 'todo',
          assertions: 0,
        })
      }
      appendRecord(fixture.directory('present'), 'cases.jsonl', {
        file: 'a.http.test.ts',
        name: '<legacy> root arm',
        state: 'pass',
        assertions: 4,
      })
      fixture.finish('present')
      fixture.finish('absent')
      const report = fixture.report()
      expect(report.ok).toBe(true)
      expect(report.compared).toBe(2)
      expect(report.presentOnly).toEqual(['a.http.test.ts > <legacy> root arm'])
    } finally {
      fixture.dispose()
    }
  })

  it.each(['meta.json', 'cases.jsonl', 'files.jsonl', 'completion.json'])(
    'recusa evidência ausente: %s',
    (name) => {
      const fixture = workspace()
      try {
        rmSync(path.join(fixture.directory('absent'), name))
        expect(fixture.report).toThrow(/missing evidence/)
      } finally {
        fixture.dispose()
      }
    }
  )

  it.each([
    ['hostMode', 'dev'],
    ['legacyMode', 'production'],
    ['profile', 'production-legacy'],
    ['authMode', 'unknown'],
    ['startedAt', 'invalid'],
  ])('recusa metadado incompatível %s=%s', (field, value) => {
    const fixture = workspace()
    try {
      fixture.write('absent/meta.json', {
        ...fixture.json('absent/meta.json'),
        [field]: value,
      })
      expect(fixture.report).toThrow()
    } finally {
      fixture.dispose()
    }
  })

  it('recusa comparar dois motores diferentes mesmo com perfis válidos', () => {
    const fixture = workspace()
    try {
      fixture.write('absent/meta.json', {
        ...fixture.json('absent/meta.json'),
        authMode: 'better-auth',
        profile: 'absent-better-auth',
      })
      expect(fixture.report).toThrow(/identity engines differ/)
    } finally {
      fixture.dispose()
    }
  })

  it.each([
    'tests/api-host/a.http.test.ts',
    'tests/security/fixtures/api-surface.json',
    'tests/api-host/global-setup.ts',
    'tests/api-host/receiving-account.ts',
    'tests/helpers/owned-process.ts',
    'prisma/migrations/fixture/migration.sql',
    'vitest.api.config.ts',
  ])('recusa superfície de outra versão: %s', (name) => {
    const fixture = workspace()
    try {
      fixture.write(name, '// changed since the records began')
      expect(fixture.report).toThrow(/surface differs/)
    } finally {
      fixture.dispose()
    }
  })

  it.each([
    ['files.jsonl', ''],
    ['files.jsonl', '{"file":"a.http.test.ts"}\n'],
    ['cases.jsonl', ''],
    [
      'cases.jsonl',
      '{"file":"a.http.test.ts","name":"shared case","state":"pass","assertions":2}\n',
    ],
    [
      'cases.jsonl',
      '{"file":"outside.http.test.ts","name":"x","state":"pass","assertions":2}\n',
    ],
    ['cases.jsonl', '{not json'],
  ])('recusa registro vazio, truncado ou inválido em %s: %s', (name, value) => {
    const fixture = workspace()
    try {
      fixture.write(`absent/${name}`, value)
      expect(fixture.report).toThrow()
    } finally {
      fixture.dispose()
    }
  })

  it.each(['failed-case', 'cleanup', 'unhandled', 'unknown'])(
    'estado final %s reprova mesmo com registros pass',
    (failure) => {
      const fixture = workspace()
      try {
        const files = fixture.finalFiles('absent')
        if (failure === 'cleanup') files[0]!.result.state = 'fail'
        if (failure === 'failed-case') files[0]!.tasks[0]!.result.state = 'fail'
        if (failure === 'unknown') files[0]!.tasks[0]!.result.state = 'run'
        expect(() =>
          finishRecord(
            fixture.directory('absent'),
            {
              files,
              unhandledErrors:
                failure === 'unhandled' ? [new Error('fixture error')] : [],
            },
            fixture.root
          )
        ).toThrow(/did not finish successfully/)
        expect(fixture.report).toThrow(/incomplete or failed run/)
      } finally {
        fixture.dispose()
      }
    }
  )

  it('falha registrada não desaparece ao filtrar somente casos pass', () => {
    const fixture = workspace()
    try {
      appendRecord(fixture.directory('absent'), 'cases.jsonl', {
        file: 'a.http.test.ts',
        name: 'failed',
        state: 'fail',
        assertions: 1,
      })
      expect(fixture.report).toThrow(/incomplete or failed case evidence/)
    } finally {
      fixture.dispose()
    }
  })

  it('começar outra rodada invalida sua conclusão anterior', () => {
    const fixture = workspace()
    try {
      const meta = fixture.json('absent/meta.json')
      startRecord(
        fixture.directory('absent'),
        { ...meta, startedAt: new Date().toISOString() },
        fixture.root
      )
      expect(fixture.report).toThrow(/missing evidence.*completion.json/)
    } finally {
      fixture.dispose()
    }
  })

  it('não aceita conclusão antiga ou contagens adulteradas como rodada inteira', () => {
    const fixture = workspace()
    try {
      const completion = fixture.json('absent/completion.json')
      fixture.write('absent/completion.json', {
        ...completion,
        startedAt: '2000-01-01T00:00:00.000Z',
      })
      expect(fixture.report).toThrow(/incomplete or failed run/)
      completion.files[0].states.pass++
      fixture.write('absent/completion.json', completion)
      expect(fixture.report).toThrow(/incomplete or failed case evidence/)
    } finally {
      fixture.dispose()
    }
  })

  it.each([
    ['pass', '', true],
    [
      'afterAll',
      "afterAll(() => { throw new Error('cleanup failed') })",
      false,
    ],
    [
      'beforeAll cleanup',
      "beforeAll(() => () => { throw new Error('cleanup failed') })",
      false,
    ],
    [
      'onTestFinished',
      "beforeEach(() => onTestFinished(() => { throw new Error('cleanup failed') }))",
      false,
    ],
  ])(
    'Vitest real: conclusão observa o estado final após %s',
    (_name, hook, succeeded) => {
      const fixture = workspace()
      try {
        const repoRoot = process.cwd()
        const runner = path.join(repoRoot, 'node_modules/vitest/vitest.mjs')
        const vitest = pathToFileURL(
          path.join(repoRoot, 'node_modules/vitest/dist/index.js')
        ).href
        const reporter = pathToFileURL(
          path.join(repoRoot, 'tests/api-host/parity-report.mjs')
        ).href
        fixture.write(
          'tests/api-host/a.http.test.ts',
          `import { it, expect, afterAll, beforeAll, beforeEach, onTestFinished } from ${JSON.stringify(vitest)};
        it('passes', () => expect(1).toBe(1)); it.skip('intentional skip', () => {}); it.todo('intentional todo'); ${hook}`
        )
        fixture.write(
          'tests/api-host/b.http.test.ts',
          `import { it, expect } from ${JSON.stringify(vitest)}; it('passes', () => expect(1).toBe(1))`
        )
        fixture.write(
          'fixture-global.mjs',
          `import { startRecord, finishRecord } from ${JSON.stringify(reporter)};
        export default function setup(project) {
          const directory = ${JSON.stringify(fixture.directory('absent'))};
          const root = ${JSON.stringify(fixture.root)};
          startRecord(directory, { startedAt: new Date().toISOString() }, root);
          return () => finishRecord(directory, { files: project.vitest.state.getFiles(), unhandledErrors: project.vitest.state.getUnhandledErrors() }, root);
        }`
        )
        fixture.write(
          'vitest.config.mjs',
          `export default { root: ${JSON.stringify(fixture.root)}, test: { include: ['tests/api-host/*.test.ts'], globalSetup: ['./fixture-global.mjs'], maxWorkers: 1, fileParallelism: false, cache: false } }`
        )
        const result = spawnSync(
          process.execPath,
          [
            runner,
            'run',
            '--config',
            path.join(fixture.root, 'vitest.config.mjs'),
          ],
          { cwd: fixture.root, encoding: 'utf8', timeout: 15_000 }
        )
        expect(result.status, result.stdout + result.stderr).toBe(
          succeeded ? 0 : 1
        )
        const completion = fixture.json('absent/completion.json')
        expect(completion.ok).toBe(succeeded)
        const file = completion.files.find(
          (entry: { file: string }) => entry.file === 'a.http.test.ts'
        )
        expect(file.state).toBe(succeeded ? 'pass' : 'fail')
        expect(file.total).toBe(3)
        expect(file.states.skip).toBe(1)
        expect(file.states.todo).toBe(1)
        expect(file.states.fail).toBe(_name === 'onTestFinished' ? 1 : 0)
      } finally {
        fixture.dispose()
      }
    },
    20_000
  )
})
