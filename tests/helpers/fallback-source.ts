import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const DEFAULT_REF = 'refs/tags/checkpoint/onda-135-pre-exclusao'
const RUNTIME_EXTENSION = /\.[cm]?[jt]sx?$/i
const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?|jsonc?)$/i
const SOURCE_PREFIXES = new Set([
  'app',
  'lib',
  'packages',
  'apps',
  'types',
  'tools',
  'middlewares',
  'schemas',
  'src',
  'components',
  'hooks',
  'utils',
  'contexts',
  'services',
  'config',
  'constants',
  'helpers',
  'providers',
  'store',
  'stores',
  'scripts',
])
// A .next antiga da raiz foi retirada em F; snapshots de retorno extraem somente fontes, omitindo também os gerados dos hosts.
const OMITTED_SEGMENTS = new Set([
  'node_modules',
  'public',
  'assets',
  '.git',
  '.next',
  '.expo',
  '.turbo',
  'coverage',
  'storybook-static',
  'test-results',
  'playwright-report',
])

type FallbackSource = {
  root: string
  origin: 'pre-tag-checkout' | 'immutable-tag'
  revision: string | null
  cleanup(): void
}

function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith('..' + path.sep) &&
    !path.isAbsolute(relative)
  )
}

function stat(file: string) {
  try {
    return fs.lstatSync(file)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

function realDirectory(directory: string): boolean {
  const entry = stat(directory)
  return !!entry && entry.isDirectory() && !entry.isSymbolicLink()
}

function containsSource(directory: string): boolean {
  if (!realDirectory(directory)) return false
  for (const name of fs.readdirSync(directory)) {
    const file = path.join(directory, name)
    const entry = stat(file)
    if (!entry || entry.isSymbolicLink()) continue
    if (entry.isFile() && RUNTIME_EXTENSION.test(name)) return true
    if (
      entry.isDirectory() &&
      !OMITTED_SEGMENTS.has(name) &&
      containsSource(file)
    )
      return true
  }
  return false
}

// O retorno exige uma fotografia completa dos antigos app/, lib/, proxy.ts e next.config.mjs, retirados em F; assertComplete verifica essa fonte externa de pré-exclusão, nunca recria fachadas na árvore ativa.
function assertComplete(root: string) {
  if (
    !realDirectory(root) ||
    !containsSource(path.join(root, 'app')) ||
    !containsSource(path.join(root, 'lib'))
  )
    throw new Error(
      'Fallback source is incomplete: app/ and lib/ sources are required'
    )
  for (const file of ['proxy.ts', 'next.config.mjs', 'package.json']) {
    const entry = stat(path.join(root, file))
    if (!entry || !entry.isFile() || entry.isSymbolicLink())
      throw new Error(`Fallback source is incomplete: ${file} is required`)
  }
}

function selected(file: string): boolean {
  const segments = file.split('/')
  if (
    !SOURCE_EXTENSION.test(file) ||
    segments.some(
      (segment) =>
        OMITTED_SEGMENTS.has(segment.toLowerCase()) ||
        /^\.env(?:\.|$)/i.test(segment)
    )
  )
    return false
  if (segments.length > 1) return SOURCE_PREFIXES.has(segments[0]!)
  return (
    file === 'package.json' ||
    /^tsconfig(?:\.[\w-]+)*\.jsonc?$/.test(file) ||
    /^(?:next-env\.d\.ts|proxy\.[cm]?[jt]s|middleware\.[cm]?[jt]s|instrumentation\.[cm]?[jt]s)$/.test(
      file
    ) ||
    /^[\w-]+\.config\.(?:[cm]?[jt]s|jsonc?)$/.test(file)
  )
}

function checkedPath(root: string, file: string): string {
  const segments = file.split('/')
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        /[\\:<>"|?*]/.test(segment) ||
        [...segment].some((character) => character.charCodeAt(0) < 32) ||
        /[. ]$/.test(segment) ||
        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment)
    )
  )
    throw new Error(`Unsafe fallback source path: ${JSON.stringify(file)}`)
  const target = path.resolve(root, ...segments)
  if (!inside(root, target))
    throw new Error('Fallback source path escaped its snapshot')
  return target
}

/** Only unlink recorded files and remove recorded directories; never traverse a replacement link. */
function snapshotOwner(root: string) {
  const files: string[] = []
  const directories = [root]
  const knownDirectories = new Set(directories)
  const safeParents = (target: string) => {
    if (target !== root && !inside(root, target))
      throw new Error('Cleanup escaped its snapshot')
    let current = path.dirname(target)
    if (target === root) return true
    while (true) {
      if (!realDirectory(current)) return false
      if (current === root) return true
      current = path.dirname(current)
    }
  }
  return {
    write(file: string, contents: Buffer) {
      const target = checkedPath(root, file)
      let directory = root
      for (const segment of file.split('/').slice(0, -1)) {
        directory = path.join(directory, segment)
        if (!knownDirectories.has(directory)) {
          fs.mkdirSync(directory)
          knownDirectories.add(directory)
          directories.push(directory)
        }
      }
      fs.writeFileSync(target, contents, { flag: 'wx' })
      files.push(target)
    },
    cleanup() {
      const failures: unknown[] = []
      for (const file of files) {
        try {
          if (!safeParents(file)) continue
          const entry = stat(file)
          if (!entry) continue
          if (!entry.isFile() && !entry.isSymbolicLink())
            throw new Error('Owned snapshot file was replaced by a directory')
          fs.unlinkSync(file)
        } catch (error) {
          failures.push(error)
        }
      }
      for (const directory of [...directories].reverse()) {
        try {
          if (!safeParents(directory)) continue
          const entry = stat(directory)
          if (!entry) continue
          if (entry.isSymbolicLink()) fs.unlinkSync(directory)
          else if (entry.isDirectory()) fs.rmdirSync(directory)
          else
            throw new Error('Owned snapshot directory was replaced by a file')
        } catch (error) {
          failures.push(error)
        }
      }
      if (failures.length)
        throw new AggregateError(failures, 'Fallback snapshot cleanup failed')
    },
  }
}

/** Read a pinned legacy source tree without checking it out or changing any repository refs. */
export function resolveFallbackSource(
  repositoryRoot: string,
  ref = DEFAULT_REF
): FallbackSource {
  const repository = path.resolve(repositoryRoot)
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_CEILING_DIRECTORIES: path.dirname(repository),
  }
  // Repository/object redirects and inherited per-command config must not change the requested source.
  for (const key of Object.keys(env)) {
    if (
      /^GIT_(?:DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|NO_REPLACE_OBJECTS)$/i.test(
        key
      ) ||
      /^GIT_CONFIG_(?:COUNT|PARAMETERS|KEY_\d+|VALUE_\d+)$/i.test(key)
    )
      delete env[key]
  }
  env.GIT_NO_REPLACE_OBJECTS = '1'
  const git = (args: string[], input?: string) => {
    const result = spawnSync('git', args, {
      cwd: repository,
      env,
      input,
      maxBuffer: 128 * 1024 * 1024,
      timeout: 60_000,
      windowsHide: true,
    })
    if (result.error || result.signal || result.status === null)
      throw new Error('Unable to read fallback Git source', {
        cause: result.error,
      })
    return result
  }
  // Resolve the name once. Even an annotated tag is peeled from this fixed OID, not looked up again.
  const object = git([
    'rev-parse',
    '--verify',
    '--quiet',
    '--end-of-options',
    ref,
  ])
  if (object.status === 1) {
    // A broken existing ref is an error too; only a genuinely absent name permits the pre-tag checkout.
    const existing = git(['show-ref', '--exists', ref])
    if (existing.status !== 2)
      throw new Error('Invalid existing fallback Git reference')
    assertComplete(repository)
    return {
      root: repository,
      origin: 'pre-tag-checkout',
      revision: null,
      cleanup() {
        /* The checkout belongs to the caller. */
      },
    }
  }
  if (object.status !== 0)
    throw new Error('Unable to resolve fallback Git reference')
  const oid = object.stdout.toString('ascii').trim()
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(oid))
    throw new Error('Invalid fallback Git object')
  const commit = git([
    'rev-parse',
    '--verify',
    '--quiet',
    '--end-of-options',
    `${oid}^{commit}`,
  ])
  const revision = commit.stdout.toString('ascii').trim()
  if (commit.status !== 0 || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(revision))
    throw new Error('Fallback reference does not identify a commit')
  const listing = git(['ls-tree', '-rz', '--full-tree', revision])
  if (listing.status !== 0) throw new Error('Unable to list fallback commit')
  const entries: { file: string; oid: string }[] = []
  const paths = new Set<string>()
  for (const record of new TextDecoder('utf-8', { fatal: true })
    .decode(listing.stdout)
    .split('\0')) {
    if (!record) continue
    const match = /^(\d{6}) (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(record)
    if (!match) throw new Error('Invalid fallback tree entry')
    const [, mode, type, blob, file] = match
    if (
      type !== 'blob' ||
      (mode !== '100644' && mode !== '100755') ||
      !selected(file!)
    )
      continue
    // Windows aliases are rejected on every platform so a snapshot cannot silently overwrite another source.
    const key = file!.toLowerCase()
    if (paths.has(key)) throw new Error('Case-colliding fallback source paths')
    paths.add(key)
    entries.push({ file: file!, oid: blob! })
  }
  const root = fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), 'locadora-fallback-source-')
  )
  const owner = snapshotOwner(root)
  try {
    for (const entry of entries) checkedPath(root, entry.file)
    const batch = git(
      ['cat-file', '--batch'],
      entries.map((entry) => entry.oid + '\n').join('')
    )
    if (batch.status !== 0)
      throw new Error('Unable to read fallback source blobs')
    let offset = 0
    for (const entry of entries) {
      const end = batch.stdout.indexOf(10, offset)
      if (end < 0) throw new Error('Truncated fallback blob header')
      const header = batch.stdout.subarray(offset, end).toString('ascii')
      const match = /^([a-f0-9]+) blob (\d+)$/.exec(header)
      if (!match || match[1] !== entry.oid)
        throw new Error('Unexpected fallback blob object')
      const size = Number(match[2])
      offset = end + 1
      if (
        !Number.isSafeInteger(size) ||
        offset + size >= batch.stdout.length ||
        batch.stdout[offset + size] !== 10
      )
        throw new Error('Truncated fallback source blob')
      owner.write(entry.file, batch.stdout.subarray(offset, offset + size))
      offset += size + 1
    }
    if (offset !== batch.stdout.length)
      throw new Error('Unexpected trailing fallback blob data')
    assertComplete(root)
    return { root, origin: 'immutable-tag', revision, cleanup: owner.cleanup }
  } catch (error) {
    try {
      owner.cleanup()
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Fallback snapshot failed to initialize and clean up',
        { cause: cleanupError }
      )
    }
    throw error
  }
}
