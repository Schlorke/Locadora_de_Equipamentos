import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { resolveFallbackSource } from '../helpers/fallback-source'

vi.mock('node:child_process', async (original) => ({
  ...(await original<typeof import('node:child_process')>()),
  spawnSync: vi.fn(),
}))

const REF = 'refs/tags/checkpoint/onda-135-pre-exclusao'
const roots: string[] = []
const snapshots: ReturnType<typeof resolveFallbackSource>[] = []
let realSpawnSync: typeof spawnSync
beforeAll(async () => {
  realSpawnSync = (
    await vi.importActual<typeof import('node:child_process')>(
      'node:child_process'
    )
  ).spawnSync
})
beforeEach(() => {
  vi.mocked(spawnSync).mockImplementation(realSpawnSync)
})

/** Test-owned scratch only. A replacement link is unlinked, never traversed. */
function removeOwnedFixture(root: string) {
  const relative = path.relative(fs.realpathSync(os.tmpdir()), root)
  if (
    !relative.startsWith('locadora-fallback-fixture-') ||
    relative.includes(path.sep)
  )
    throw new Error('Refusing to remove an unowned fixture')
  const remove = (target: string) => {
    const entry = fs.lstatSync(target)
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      for (const child of fs.readdirSync(target))
        remove(path.join(target, child))
      fs.rmdirSync(target)
    } else {
      if (!entry.isSymbolicLink()) fs.chmodSync(target, 0o600)
      fs.unlinkSync(target)
    }
  }
  remove(root)
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  for (const snapshot of snapshots.splice(0)) snapshot.cleanup()
  for (const root of roots.splice(0)) removeOwnedFixture(root)
})

// Repositório fixture descartável: reproduz os antigos app/, lib/, proxy.ts e next.config.mjs, retirados em F, para provar snapshot de pré-exclusão, ausência, links e restauração por bytes sem usar a árvore ativa.
function repository(complete = true) {
  const root = fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), 'locadora-fallback-fixture-')
  )
  roots.push(root)
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_CEILING_DIRECTORIES: path.dirname(root),
  }
  for (const key of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_COMMON_DIR',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_NO_REPLACE_OBJECTS',
  ])
    delete env[key]
  const git = (...args: string[]) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.test',
        '-c',
        'core.autocrlf=false',
        '-c',
        'commit.gpgsign=false',
        '-c',
        'core.ignorecase=false',
        '-c',
        'core.hooksPath=',
        ...args,
      ],
      { cwd: root, env, encoding: 'utf8' }
    ).trim()
  const write = (file: string, contents: string | Buffer) => {
    const target = path.resolve(root, file)
    if (!target.startsWith(root + path.sep))
      throw new Error('Fixture path escaped')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, contents)
  }
  const populate = (marker = 'tagged') => {
    write(
      'app/api/check/route.ts',
      `export const marker = ${JSON.stringify(marker)}\n`
    )
    write('lib/runtime.ts', `export const marker = ${JSON.stringify(marker)}\n`)
    write('proxy.ts', 'export default function proxy() {}\n')
    write('next.config.mjs', 'export default {}\n')
    write('package.json', JSON.stringify({ name: marker, type: 'module' }))
    write(
      'tsconfig.base.json',
      JSON.stringify({ compilerOptions: { strict: true } })
    )
    write(
      'tsconfig.json',
      JSON.stringify({
        extends: './tsconfig.base.json',
        compilerOptions: { paths: { '@/*': ['./*'] } },
      })
    )
  }
  const commit = () => {
    git('add', '-A')
    git('commit', '-q', '-m', 'fixture source')
    return git('rev-parse', 'HEAD')
  }
  const indexBlob = (file: string, contents: string, mode = '100644') => {
    const oid = execFileSync('git', ['hash-object', '-w', '--stdin'], {
      cwd: root,
      env,
      input: contents,
      encoding: 'utf8',
    }).trim()
    git('update-index', '--add', '--cacheinfo', `${mode},${oid},${file}`)
    return oid
  }
  git('init', '-q')
  if (complete) populate()
  return { root, git, write, populate, commit, indexBlob }
}

function resolve(root: string, ref?: string) {
  const source = resolveFallbackSource(root, ref)
  snapshots.push(source)
  return source
}

describe('resolveFallbackSource', () => {
  it('uses the complete pre-tag checkout explicitly and cleanup preserves it', () => {
    const repo = repository()
    repo.commit()
    const source = resolve(repo.root)
    expect(source).toMatchObject({
      root: repo.root,
      origin: 'pre-tag-checkout',
      revision: null,
    })
    source.cleanup()
    expect(
      fs.readFileSync(path.join(repo.root, 'lib/runtime.ts'), 'utf8')
    ).toContain('tagged')
  })

  it.each(['app', 'lib', 'proxy.ts', 'next.config.mjs', 'package.json'])(
    'refuses a missing ref with an incomplete checkout (%s absent)',
    (missing) => {
      const repo = repository()
      repo.commit()
      if (missing === 'app')
        fs.unlinkSync(path.join(repo.root, 'app/api/check/route.ts'))
      else if (missing === 'lib')
        fs.unlinkSync(path.join(repo.root, 'lib/runtime.ts'))
      else fs.unlinkSync(path.join(repo.root, missing))
      expect(() => resolve(repo.root)).toThrow(/incomplete/)
    }
  )

  it('refuses when both the checkpoint and the legacy root are absent', () => {
    const repo = repository(false)
    repo.write('package.json', '{}')
    repo.commit()
    expect(() => resolve(repo.root)).toThrow(/incomplete/)
  })

  it('reads tagged bytes and aliases despite a divergent checkout and removed legacy files', () => {
    const repo = repository()
    repo.write(
      'packages/shared/package.json',
      '{"name":"@fixture/shared","exports":{".":"./src/index.ts"}}'
    )
    repo.write(
      'packages/shared/src/index.ts',
      'export const shared = "tagged"\n'
    )
    repo.write(
      'apps/services/api/tsconfig.json',
      '{"extends":"../../../tsconfig.base.json"}'
    )
    const revision = repo.commit()
    repo.git('tag', 'checkpoint/onda-135-pre-exclusao')
    repo.populate('checkout-divergent')
    fs.unlinkSync(path.join(repo.root, 'proxy.ts'))
    fs.unlinkSync(path.join(repo.root, 'app/api/check/route.ts'))
    const before = repo.git('status', '--porcelain')
    const source = resolve(repo.root)
    expect(source.origin).toBe('immutable-tag')
    expect(source.revision).toBe(revision)
    expect(source.root).not.toBe(repo.root)
    expect(
      fs.readFileSync(path.join(source.root, 'lib/runtime.ts'), 'utf8')
    ).toBe('export const marker = "tagged"\n')
    expect(
      JSON.parse(
        fs.readFileSync(path.join(source.root, 'package.json'), 'utf8')
      ).name
    ).toBe('tagged')
    expect(
      JSON.parse(
        fs.readFileSync(path.join(source.root, 'tsconfig.json'), 'utf8')
      ).compilerOptions.paths
    ).toEqual({ '@/*': ['./*'] })
    for (const file of [
      'proxy.ts',
      'app/api/check/route.ts',
      'tsconfig.base.json',
      'packages/shared/package.json',
      'packages/shared/src/index.ts',
      'apps/services/api/tsconfig.json',
    ])
      expect(fs.statSync(path.join(source.root, file)).isFile(), file).toBe(
        true
      )
    expect(repo.git('status', '--porcelain')).toBe(before)
    source.cleanup()
    expect(fs.existsSync(source.root)).toBe(false)
    expect(repo.git('status', '--porcelain')).toBe(before)
  })

  it('peels an annotated tag to its commit', () => {
    const repo = repository()
    const revision = repo.commit()
    repo.git(
      'tag',
      '-a',
      'checkpoint/onda-135-pre-exclusao',
      '-m',
      'fixture checkpoint'
    )
    expect(resolve(repo.root).revision).toBe(revision)
  })

  it('does not fall back to the checkout when the existing ref points to a blob', () => {
    const repo = repository()
    repo.commit()
    const blob = repo.git('rev-parse', 'HEAD:lib/runtime.ts')
    repo.git('update-ref', REF, blob)
    expect(() => resolve(repo.root)).toThrow(/does not identify a commit/)
  })

  it('refuses a corrupt existing ref even with a complete current checkout', () => {
    const repo = repository()
    repo.commit()
    repo.write(
      '.git/refs/tags/checkpoint/onda-135-pre-exclusao',
      'not-an-object-id\n'
    )
    expect(() => resolve(repo.root)).toThrow(/fallback Git reference/)
  })

  it('does not supplement an incomplete tag with complete current sources', () => {
    const repo = repository(false)
    repo.write('package.json', '{}')
    repo.commit()
    repo.git('tag', 'checkpoint/onda-135-pre-exclusao')
    repo.populate('complete-current')
    const temporaryRoots: string[] = []
    const realMkdtemp = fs.mkdtempSync
    vi.spyOn(fs, 'mkdtempSync').mockImplementation((prefix) => {
      const created = realMkdtemp(prefix)
      temporaryRoots.push(created)
      return created
    })
    expect(() => resolve(repo.root)).toThrow(/incomplete/)
    expect(temporaryRoots).toHaveLength(1)
    expect(fs.existsSync(temporaryRoots[0]!)).toBe(false)
  })

  it('pins the commit before a ref moves and batches reads by immutable object IDs', () => {
    const repo = repository()
    const oldRevision = repo.commit()
    repo.git('tag', 'checkpoint/onda-135-pre-exclusao')
    repo.populate('new-tag-target')
    const newRevision = repo.commit()
    let moved = false
    vi.mocked(spawnSync).mockImplementation((command, args, options) => {
      if (args?.[0] === 'ls-tree') {
        repo.git('update-ref', REF, newRevision)
        moved = true
      }
      return realSpawnSync(command, args, options)
    })
    const source = resolve(repo.root)
    expect(moved).toBe(true)
    expect(repo.git('rev-parse', REF)).toBe(newRevision)
    expect(source.revision).toBe(oldRevision)
    expect(
      fs.readFileSync(path.join(source.root, 'lib/runtime.ts'), 'utf8')
    ).toContain('tagged')
    const batches = vi
      .mocked(spawnSync)
      .mock.calls.filter(([, args]) => args?.[0] === 'cat-file')
    expect(batches).toHaveLength(1)
    expect(batches[0]?.[1]).toEqual(['cat-file', '--batch'])
    expect(
      String(batches[0]?.[2]?.input)
        .trim()
        .split('\n')
        .every((oid) => /^[a-f0-9]{40}$/.test(oid))
    ).toBe(true)
  })

  it('ignores replacement commit refs and keeps the bytes of the pinned commit', () => {
    const repo = repository()
    const revision = repo.commit()
    repo.git('tag', 'checkpoint/onda-135-pre-exclusao')
    repo.populate('replacement-commit')
    const replacement = repo.commit()
    repo.git('replace', revision, replacement)
    expect(repo.git('show', `${revision}:lib/runtime.ts`)).toContain(
      'replacement-commit'
    )
    const source = resolve(repo.root)
    expect(source.revision).toBe(revision)
    expect(
      fs.readFileSync(path.join(source.root, 'lib/runtime.ts'), 'utf8')
    ).toContain('tagged')
  })

  it('ignores replacement blob refs when reading the pinned tree in a batch', () => {
    const repo = repository()
    const revision = repo.commit()
    repo.git('tag', 'checkpoint/onda-135-pre-exclusao')
    const original = repo.git('rev-parse', 'HEAD:lib/runtime.ts')
    const replacement = repo.indexBlob(
      'lib/replacement.ts',
      'export const marker = "replacement-blob"\n'
    )
    repo.git('replace', original, replacement)
    expect(repo.git('cat-file', 'blob', original)).toContain('replacement-blob')
    const source = resolve(repo.root)
    expect(source.revision).toBe(revision)
    expect(
      fs.readFileSync(path.join(source.root, 'lib/runtime.ts'), 'utf8')
    ).toContain('tagged')
    expect(fs.existsSync(path.join(source.root, 'lib/replacement.ts'))).toBe(
      false
    )
  })

  it('uses the requested repository despite inherited Git redirects and config injection', () => {
    const repo = repository()
    const revision = repo.commit()
    repo.git('tag', 'checkpoint/onda-135-pre-exclusao')
    const other = repository()
    other.populate('other-repository')
    other.commit()
    other.git('tag', 'checkpoint/onda-135-pre-exclusao')
    const redirects = {
      GIT_DIR: path.join(other.root, '.git'),
      GIT_WORK_TREE: other.root,
      GIT_COMMON_DIR: path.join(other.root, '.git'),
      GIT_INDEX_FILE: path.join(other.root, '.git/index'),
      GIT_OBJECT_DIRECTORY: path.join(other.root, '.git/objects'),
      GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(other.root, '.git/objects'),
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: '',
      GIT_CONFIG_VALUE_0: '',
      GIT_CONFIG_PARAMETERS: 'invalid inherited config',
      GIT_NO_REPLACE_OBJECTS: '',
    }
    for (const [key, value] of Object.entries(redirects)) vi.stubEnv(key, value)
    const source = resolve(repo.root)
    expect(source.revision).toBe(revision)
    expect(
      fs.readFileSync(path.join(source.root, 'lib/runtime.ts'), 'utf8')
    ).toContain('tagged')
    for (const [, , options] of vi.mocked(spawnSync).mock.calls) {
      for (const key of Object.keys(redirects).filter(
        (key) => key !== 'GIT_NO_REPLACE_OBJECTS'
      ))
        expect(options?.env?.[key], key).toBeUndefined()
      expect(options?.env?.GIT_NO_REPLACE_OBJECTS).toBe('1')
    }
  })

  it('copies source/config bytes while excluding credentials, assets, dependencies and Git links', () => {
    const repo = repository()
    const bytes = Buffer.from('export const unicode = "locação"\r\n')
    repo.write('lib/source with spaces.ts', bytes)
    const excluded = [
      '.env',
      'app/.env.json',
      'public/asset.ts',
      'packages/ui/assets/data.json',
      'packages/ui/node_modules/leak/index.ts',
      'docs/leak.ts',
      'lib/data.png',
    ]
    for (const file of excluded) repo.write(file, 'synthetic excluded marker')
    repo.git('add', '-f', '--', ...excluded)
    repo.commit()
    repo.indexBlob('lib/link.ts', '../outside.ts', '120000')
    repo.git('commit', '-q', '-m', 'fixture symlink object')
    repo.git('tag', 'checkpoint/onda-135-pre-exclusao')
    const tracked = repo.git('ls-tree', '-r', '--name-only', 'HEAD').split('\n')
    for (const file of [...excluded, 'lib/link.ts'])
      expect(tracked).toContain(file)
    const source = resolve(repo.root)
    expect(
      fs.readFileSync(path.join(source.root, 'lib/source with spaces.ts'))
    ).toEqual(bytes)
    for (const file of [...excluded, 'lib/link.ts', '.git'])
      expect(fs.existsSync(path.join(source.root, file)), file).toBe(false)
  })

  it('rejects case-colliding Git entries rather than overwriting sources on Windows', () => {
    const repo = repository()
    repo.commit()
    repo.indexBlob('lib/alias.ts', 'export const a = 1\n')
    repo.indexBlob('lib/ALIAS.ts', 'export const a = 2\n')
    repo.git('commit', '-q', '-m', 'fixture case collision')
    repo.git('tag', 'checkpoint/onda-135-pre-exclusao')
    expect(() => resolve(repo.root)).toThrow(/Case-colliding/)
  })

  it('rejects unsafe listed paths before writing a blob', () => {
    const repo = repository()
    repo.commit()
    repo.git('tag', 'checkpoint/onda-135-pre-exclusao')
    const oid = repo.git('rev-parse', 'HEAD:lib/runtime.ts')
    vi.mocked(spawnSync).mockImplementation((command, args, options) => {
      const result = realSpawnSync(command, args, options)
      return args?.[0] === 'ls-tree'
        ? {
            ...result,
            stdout: Buffer.from(`100644 blob ${oid}\tlib/../escaped.ts\0`),
          }
        : result
    })
    expect(() => resolve(repo.root)).toThrow(/Unsafe fallback source path/)
    expect(
      vi
        .mocked(spawnSync)
        .mock.calls.some(([, args]) => args?.[0] === 'cat-file')
    ).toBe(false)
  })

  it('cleans only its own snapshot and is safe to call twice', () => {
    const repo = repository()
    repo.commit()
    repo.git('tag', 'checkpoint/onda-135-pre-exclusao')
    const first = resolve(repo.root)
    const second = resolve(repo.root)
    expect(first.root).not.toBe(second.root)
    first.cleanup()
    first.cleanup()
    expect(fs.existsSync(first.root)).toBe(false)
    expect(
      fs.readFileSync(path.join(second.root, 'lib/runtime.ts'), 'utf8')
    ).toContain('tagged')
    expect(
      fs.readFileSync(path.join(repo.root, 'lib/runtime.ts'), 'utf8')
    ).toContain('tagged')
  })

  it('does not follow a replacement directory link while cleaning owned paths', () => {
    const repo = repository()
    repo.write('lib/nested/source.ts', 'export const original = true\n')
    repo.commit()
    repo.git('tag', 'checkpoint/onda-135-pre-exclusao')
    const source = resolve(repo.root)
    const outside = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'locadora-fallback-fixture-')
    )
    roots.push(outside)
    fs.writeFileSync(path.join(outside, 'source.ts'), 'external sentinel')
    const nested = path.join(source.root, 'lib/nested')
    fs.unlinkSync(path.join(nested, 'source.ts'))
    fs.rmdirSync(nested)
    fs.symlinkSync(outside, nested, 'junction')
    source.cleanup()
    expect(fs.existsSync(source.root)).toBe(false)
    expect(fs.readFileSync(path.join(outside, 'source.ts'), 'utf8')).toBe(
      'external sentinel'
    )
  })
})
