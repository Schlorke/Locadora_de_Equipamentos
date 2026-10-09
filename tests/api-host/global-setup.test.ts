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
import { describe, expect, it } from 'vitest'
import type { TestProject } from 'vitest/node'
import setup, {
  assertParityCoverage,
  assertSerialParityRun,
  legacyParityMode,
} from './global-setup'
import { appendRecord, startRecord } from './parity-report.mjs'
import {
  compareAcrossTargets,
  legacyRunning,
  namedParityTargets,
  otherTarget,
  parityTargets,
  rotatingTarget,
  sequentialTargets,
} from './targets'

const serialMessage =
  /API parity shares servers and fixtures across files and must run with one worker \(got maxWorkers=\d+\)/

describe('API parity global setup', () => {
  it('accepts the single worker declared by vitest.api.config.ts', () => {
    expect(() => assertSerialParityRun(1)).not.toThrow()
  })

  it.each([2, 4])('refuses %i workers sharing the same fixtures', (count) => {
    expect(() => assertSerialParityRun(count)).toThrow(serialMessage)
    expect(() => assertSerialParityRun(count)).toThrow(
      `got maxWorkers=${count}`
    )
  })

  it('refuses a parallel run before reading the database or starting servers', async () => {
    // Without the guard, setup would reach requireTestDatabase first; this env makes that path a different error, so
    // the assertion only passes when the worker check runs before any database work.
    const previous = process.env.TEST_DATABASE_DISPOSABLE
    process.env.TEST_DATABASE_DISPOSABLE = 'false'
    try {
      await expect(
        setup({ config: { maxWorkers: 2 } } as unknown as TestProject)
      ).rejects.toThrow(serialMessage)
    } finally {
      if (previous === undefined) delete process.env.TEST_DATABASE_DISPOSABLE
      else process.env.TEST_DATABASE_DISPOSABLE = previous
    }
  })
})

describe('legacy root mode of a parity run (wave 135, E1)', () => {
  it.each([
    [undefined, 'dev'],
    ['', 'dev'],
    ['dev', 'dev'],
    ['production', 'production'],
    ['absent', 'absent'],
    [' absent ', 'absent'],
  ] as const)('API_LEGACY_MODE=%j is %s', (value, mode) => {
    expect(legacyParityMode({ API_LEGACY_MODE: value })).toBe(mode)
  })

  it.each(['absnet', 'off', 'none', 'Production'])(
    'refuses API_LEGACY_MODE=%s instead of guessing',
    (value) => {
      expect(() => legacyParityMode({ API_LEGACY_MODE: value })).toThrow(
        'API_LEGACY_MODE must be production, absent or dev'
      )
    }
  )

  it('refuses an unknown legacy mode before reading the database or starting servers', async () => {
    const previous = {
      disposable: process.env.TEST_DATABASE_DISPOSABLE,
      mode: process.env.API_LEGACY_MODE,
    }
    process.env.TEST_DATABASE_DISPOSABLE = 'false'
    process.env.API_LEGACY_MODE = 'absnet'
    try {
      await expect(
        setup({ config: { maxWorkers: 1 } } as unknown as TestProject)
      ).rejects.toThrow('API_LEGACY_MODE must be production, absent or dev')
    } finally {
      for (const [name, value] of [
        ['TEST_DATABASE_DISPOSABLE', previous.disposable],
        ['API_LEGACY_MODE', previous.mode],
      ] as const)
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
    }
  })
})

describe('parity targets (wave 135, E1)', () => {
  const both = { legacy: 'http://127.0.0.1:1', api: 'http://127.0.0.1:2' }
  const apiOnly = { legacy: null, api: 'http://127.0.0.1:2' }

  it('lists every running host, the legacy root first, and only the API without it', () => {
    expect(legacyRunning(both)).toBe(true)
    expect(parityTargets(both)).toEqual([both.legacy, both.api])
    expect(legacyRunning(apiOnly)).toBe(false)
    expect(parityTargets(apiOnly)).toEqual([apiOnly.api])
    expect(parityTargets({ legacy: '', api: both.api })).toEqual([both.api])
  })

  it('names the running hosts for describe.each', () => {
    const labels = { legacy: 'legado', api: 'serviço' } as const
    expect(namedParityTargets(both, labels)).toEqual([
      ['legado', both.legacy],
      ['serviço', both.api],
    ])
    expect(namedParityTargets(apiOnly, labels)).toEqual([
      ['serviço', apiOnly.api],
    ])
  })

  it('always makes two real requests for single-use and idempotency proofs', () => {
    expect(sequentialTargets(both)).toEqual([both.legacy, both.api])
    expect(sequentialTargets(apiOnly)).toEqual([apiOnly.api, apiOnly.api])
    expect(otherTarget(both, both.legacy)).toBe(both.api)
    expect(otherTarget(both, both.api)).toBe(both.legacy)
    expect(otherTarget(apiOnly, apiOnly.api)).toBe(apiOnly.api)
  })
})

describe('cross-target comparison (wave 135, E25 guard)', () => {
  it('compares every running host with the first one', () => {
    expect(() => compareAcrossTargets([{ a: 1 }, { a: 1 }])).not.toThrow()
    expect(() => compareAcrossTargets([{ a: 1 }, { a: 2 }])).toThrow()
    expect(() => compareAcrossTargets([1, 1, 2])).toThrow()
  })

  it.each([[[]], [[{ a: 1 }]]])(
    'refuses a comparison with fewer than two hosts instead of passing empty (%j)',
    (values) => {
      expect(() => compareAcrossTargets(values, 'fixture label')).toThrow(
        /compareAcrossTargets needs at least two running hosts \(got [01]\): fixture label/
      )
    }
  )
})

describe('rotating target of a concurrent burst (wave 135, E1)', () => {
  it('alternates legacy and API while both run, and sends every request to the API without the root', () => {
    const both = { legacy: 'http://127.0.0.1:1', api: 'http://127.0.0.1:2' }
    const apiOnly = { legacy: null, api: 'http://127.0.0.1:2' }
    expect([0, 1, 2, 3].map((index) => rotatingTarget(both, index))).toEqual([
      both.legacy,
      both.api,
      both.legacy,
      both.api,
    ])
    expect([0, 1, 2].map((index) => rotatingTarget(apiOnly, index))).toEqual([
      apiOnly.api,
      apiOnly.api,
      apiOnly.api,
    ])
  })
})

describe('coverage of the whole parity run (wave 135, B3)', () => {
  /** A throwaway repository root with two parity files and a two-method API surface; removed file by file. */
  function workspace() {
    const root = mkdtempSync(path.join(tmpdir(), 'locadora-parity-coverage-'))
    const record = path.join(root, 'record')
    const files: string[] = []
    const directories = [
      'tests',
      'tests/api-host',
      'tests/security',
      'tests/security/fixtures',
      'record',
    ]
    for (const directory of directories)
      mkdirSync(path.join(root, directory))
    const write = (name: string, text: string) => {
      writeFileSync(path.join(root, name), text)
      files.push(name)
    }
    write('tests/api-host/a.http.test.ts', '')
    write('tests/api-host/b.http.test.ts', '')
    write(
      'tests/security/fixtures/api-surface.json',
      JSON.stringify({
        routes: 1,
        methods: 2,
        endpoints: ['GET /api/things', 'POST /api/things'],
      })
    )
    startRecord(record, { profile: 'absent-legacy', authMode: 'legacy' })
    files.push(
      ...['hits.jsonl', 'cases.jsonl', 'files.jsonl', 'meta.json'].map(
        (name) => `record/${name}`
      )
    )
    return {
      root,
      record,
      ran: (...names: string[]) => {
        for (const file of names) appendRecord(record, 'files.jsonl', { file })
      },
      hit: (method: string, status: number) =>
        appendRecord(record, 'hits.jsonl', {
          target: 'api',
          method,
          path: '/api/things',
          status,
        }),
      dispose() {
        for (const name of [...files, 'record/coverage.json'])
          rmSync(path.join(root, name), { force: true })
        for (const directory of [...directories].reverse())
          rmdirSync(path.join(root, directory))
        rmdirSync(root)
      },
    }
  }

  it('skips the 173/221 check when only part of the files ran', () => {
    const fixture = workspace()
    try {
      fixture.ran('a.http.test.ts')
      const lines: string[] = []
      expect(
        assertParityCoverage(fixture.record, fixture.root, (line) =>
          lines.push(line)
        )
      ).toBeNull()
      expect(lines.join('\n')).toContain('partial run (1/2 files)')
    } finally {
      fixture.dispose()
    }
  })

  it('fails the whole run when a method has no expected success', () => {
    const fixture = workspace()
    try {
      fixture.ran('a.http.test.ts', 'b.http.test.ts')
      fixture.hit('GET', 200)
      fixture.hit('POST', 403)
      expect(() =>
        assertParityCoverage(fixture.record, fixture.root, () => {})
      ).toThrow(
        'API parity coverage failed: 1 methods without an expected success'
      )
      expect(
        JSON.parse(
          readFileSync(path.join(fixture.record, 'coverage.json'), 'utf8')
        ).missing
      ).toEqual([{ endpoint: 'POST /api/things', statuses: [403] }])
    } finally {
      fixture.dispose()
    }
  })

  it('passes when every method of the surface has a success outcome', () => {
    const fixture = workspace()
    try {
      fixture.ran('a.http.test.ts', 'b.http.test.ts')
      fixture.hit('GET', 200)
      fixture.hit('POST', 201)
      const report = assertParityCoverage(fixture.record, fixture.root, () => {})
      expect(report?.methods).toEqual({ total: 2, covered: 2 })
      expect(report?.ok).toBe(true)
    } finally {
      fixture.dispose()
    }
  })
})
