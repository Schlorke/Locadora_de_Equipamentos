// Test harness only: preserve the development placeholder and recognize the
// same lazy 3D dependency by exact build-derived paths in production captures.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const DEV_HEAVY_CHUNK = /\/_next\/static\/chunks\/[^?]*(?:three|drei)/i
const CHUNK = /^static\/chunks\/[A-Za-z0-9_-]+\.js$/
const MARKERS = [
  '__THREE_DEVTOOLS__',
  'forest_slope_1k',
  'draco/versioned/decoders/1.5.5',
]
const HOME = '/(public)/[locadora]/(vitrine)/page'
const EXCLUDED = new Set(['/(public)/[locadora]/(vitrine)/sobre/page'])
const NEXT = 'apps/clients/web/.next'
const PRODUCT_SOURCES = [
  'packages/frontend/src/widgets/hero/ui/Hero.web.tsx',
  'packages/frontend/src/widgets/hero/ui/Equipment3DCarousel.web.tsx',
  'packages/frontend/src/widgets/hero/ui/ModelViewer.web.tsx',
  'tests/visual/visual-baseline.spec.ts',
]

export function parseClientReferenceManifest(text) {
  // Parse the JSON assignment as data. Never evaluate a compiled JS manifest.
  const match =
    /^globalThis\.__RSC_MANIFEST = globalThis\.__RSC_MANIFEST \|\| \{\};\s*globalThis\.__RSC_MANIFEST\[("[^"\r\n]+")\]\s*=\s*(\{[\s\S]*\})\s*;?\s*$/.exec(
      text.trim()
    )
  assert.ok(match, 'Unknown client-reference manifest format')
  const route = JSON.parse(match[1])
  const data = JSON.parse(match[2])
  assert.ok(
    data.entryJSFiles && typeof data.entryJSFiles === 'object',
    'Client-reference entryJSFiles missing'
  )
  const chunks = [...new Set(Object.values(data.entryJSFiles).flat())].sort()
  assert.ok(
    chunks.every((chunk) => typeof chunk === 'string' && CHUNK.test(chunk)),
    'Unexpected eager chunk path'
  )
  return { route, chunks }
}

function locateHeroDynamicImport(homeBundles) {
  const candidates = []
  for (const [bundle, text] of Object.entries(homeBundles)) {
    assert.ok(CHUNK.test(bundle), 'Unexpected home bundle path')
    for (const match of text.matchAll(
      /loadableGenerated:\{modules:\[(\d+)\]\},ssr:!1,loading:/g
    )) {
      // The compiled Hero's own loading label binds the numeric manifest entry
      // to this dynamic import; a generic three/drei substring does not.
      const loading = text.slice(
        match.index + match[0].length,
        match.index + match[0].length + 600
      )
      if (loading.includes('Carregando modelos 3D...'))
        candidates.push({ moduleId: match[1], heroBundle: bundle })
    }
  }
  assert.equal(
    candidates.length,
    1,
    'Expected one exact client-only Hero carousel dynamic import'
  )
  return candidates[0]
}

export function deriveHeavyChunkFiles({
  loadableManifest,
  homeBundles,
  chunkContents,
  protectedChunks,
}) {
  assert.ok(
    Array.isArray(protectedChunks) &&
      protectedChunks.length > 0 &&
      protectedChunks.every(
        (file) => typeof file === 'string' && CHUNK.test(file)
      ),
    'Explicit protected eager chunk paths required'
  )
  const candidate = locateHeroDynamicImport(homeBundles)
  const entry = loadableManifest[candidate.moduleId]
  assert.ok(
    entry &&
      String(entry.id) === candidate.moduleId &&
      Array.isArray(entry.files) &&
      entry.files.length > 0,
    'Dynamic import missing from react-loadable manifest'
  )
  const files = [...new Set(entry.files)].sort()
  assert.ok(
    files.every((file) => typeof file === 'string' && CHUNK.test(file)),
    'Unexpected dynamic chunk path'
  )
  for (const file of files)
    assert.equal(
      typeof chunkContents[file],
      'string',
      `Dynamic chunk absent: ${file}`
    )
  const blockedFiles = files.filter((file) =>
    MARKERS.every((marker) => chunkContents[file].includes(marker))
  )
  assert.ok(
    blockedFiles.length > 0,
    'No manifest-owned 3D dependency with all exact markers'
  )
  const protectedSet = new Set(protectedChunks)
  for (const file of blockedFiles)
    assert.ok(
      !protectedSet.has(file),
      `Refusing to block eager UI dependency: ${file}`
    )
  return { ...candidate, files, blockedFiles, markers: [...MARKERS] }
}

export function deriveProductionHeavyChunkPolicy({
  repository,
  expectedBuildId,
}) {
  assert.ok(
    typeof expectedBuildId === 'string' &&
      /^[A-Za-z0-9_-]{1,256}$/.test(expectedBuildId),
    'Explicit production BUILD_ID required'
  )
  const root = fs.realpathSync(path.resolve(repository))
  const records = new Map()
  const digest = (buffer) => createHash('sha256').update(buffer).digest('hex')
  const read = (relative) => {
    assert.ok(
      typeof relative === 'string' &&
        !relative.includes('\\') &&
        !relative.includes('\0') &&
        !path.isAbsolute(relative) &&
        relative
          .split('/')
          .every((part) => part && part !== '.' && part !== '..'),
      'Unexpected provenance path'
    )
    const file = path.resolve(root, ...relative.split('/'))
    const actual = fs.realpathSync(file)
    const inside = path.relative(root, actual)
    assert.ok(
      inside &&
        inside !== '..' &&
        !inside.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(inside) &&
        !fs.lstatSync(file).isSymbolicLink() &&
        fs.statSync(file).isFile(),
      'Provenance file must stay in repository and be a regular file'
    )
    const bytes = fs.readFileSync(file)
    records.set(relative, {
      path: relative,
      sha256: digest(bytes),
      bytes: bytes.length,
    })
    return bytes.toString('utf8')
  }
  assert.equal(
    read(`${NEXT}/BUILD_ID`).trim(),
    expectedBuildId,
    'Production BUILD_ID changed'
  )
  const sources = Object.fromEntries(
    PRODUCT_SOURCES.map((file) => [file, read(file)])
  )
  const hero = sources[PRODUCT_SOURCES[0]]
  assert.ok(
    hero.includes("import('./Equipment3DCarousel.web')") &&
      hero.includes('ssr: false') &&
      hero.includes('Carregando modelos 3D...'),
    'Hero source no longer matches the characterized lazy import'
  )
  const clientManifests = []
  const walk = (directory) => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name)
      assert.ok(
        !entry.isSymbolicLink(),
        'Symlink in compiled app manifest tree'
      )
      if (entry.isDirectory()) walk(file)
      else if (
        entry.isFile() &&
        entry.name.endsWith('_client-reference-manifest.js')
      ) {
        const relative = path.relative(root, file).split(path.sep).join('/')
        clientManifests.push({
          path: relative,
          ...parseClientReferenceManifest(read(relative)),
        })
      }
    }
  }
  walk(path.join(root, ...`${NEXT}/server/app`.split('/')))
  const homes = clientManifests.filter((manifest) => manifest.route === HOME)
  assert.equal(
    homes.length,
    1,
    'Expected one production home client-reference manifest'
  )
  const home = homes[0]
  const loadablePath = `${NEXT}/server/app/(public)/[locadora]/(vitrine)/page/react-loadable-manifest.json`
  const loadableManifest = JSON.parse(read(loadablePath))
  const buildManifest = JSON.parse(read(`${NEXT}/build-manifest.json`))
  const rootChunks = [
    ...(buildManifest.rootMainFiles ?? []),
    ...(buildManifest.polyfillFiles ?? []),
    ...Object.values(buildManifest.pages ?? {}).flat(),
  ]
  assert.ok(
    rootChunks.every((file) => typeof file === 'string' && CHUNK.test(file)),
    'Unexpected root eager chunk path'
  )
  const protectedManifests = clientManifests.filter(
    (manifest) => !EXCLUDED.has(manifest.route)
  )
  const protectedChunks = [
    ...new Set([
      ...rootChunks,
      ...protectedManifests.flatMap((manifest) => manifest.chunks),
    ]),
  ].sort()
  const homeBundles = Object.fromEntries(
    home.chunks.map((file) => [file, read(`${NEXT}/${file}`)])
  )
  // Read only the one placeholder-bound import's manifest-owned dependencies.
  // No candidate filename comes from a user-supplied block list.
  const candidate = locateHeroDynamicImport(homeBundles)
  const entry = loadableManifest[candidate.moduleId]
  assert.ok(
    entry && Array.isArray(entry.files) && entry.files.length > 0,
    'Hero dynamic import manifest entry missing'
  )
  const entryFiles = [...new Set(entry.files)]
  assert.ok(
    entryFiles.every((file) => typeof file === 'string' && CHUNK.test(file)),
    'Unexpected loadable entry path'
  )
  const chunkContents = Object.fromEntries(
    entryFiles.map((file) => [file, read(`${NEXT}/${file}`)])
  )
  const dynamicImport = deriveHeavyChunkFiles({
    loadableManifest,
    homeBundles,
    chunkContents,
    protectedChunks,
  })
  return {
    version: 1,
    buildId: expectedBuildId,
    scannerSha256: digest(fs.readFileSync(fileURLToPath(import.meta.url))),
    home: HOME,
    documentedExcludedRoutes: [...EXCLUDED],
    protectedManifests: protectedManifests.map(({ path: file, route }) => ({
      path: file,
      route,
    })),
    dynamicImport,
    blockedPathnames: dynamicImport.blockedFiles.map(
      (file) => `/_next/${file}`
    ),
    provenance: [...records.values()].sort((a, b) =>
      a.path.localeCompare(b.path)
    ),
  }
}

export function createHeavyChunkMatcher({
  repository = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..'
  ),
  reportFile = process.env.VISUAL_HEAVY_CHUNKS_REPORT,
  expectedBuildId = process.env.VISUAL_PRODUCTION_BUILD_ID,
  production = process.env.VISUAL_CAPTURE_MODE === 'production',
} = {}) {
  if (!production && !reportFile && !expectedBuildId)
    return (pathname) => DEV_HEAVY_CHUNK.test(pathname)
  assert.ok(
    reportFile && expectedBuildId,
    'Production visual capture requires an external hash report and explicit BUILD_ID'
  )
  const destination = path.resolve(reportFile)
  const outside = (root, file) => {
    const relative = path.relative(path.resolve(root), file)
    return (
      relative === '..' ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    )
  }
  assert.ok(
    outside(repository, destination),
    'Production chunk hash report must be outside the repository'
  )
  if (process.env.VISUAL_OUT)
    assert.ok(
      outside(process.env.VISUAL_OUT, destination),
      'Write chunk hash report outside the capture directory'
    )
  const policy = deriveProductionHeavyChunkPolicy({
    repository,
    expectedBuildId,
  })
  if (fs.existsSync(destination))
    assert.deepEqual(
      JSON.parse(fs.readFileSync(destination, 'utf8').replace(/^\uFEFF/, '')),
      policy,
      'Chunk hash report belongs to different source/build inputs; use a new run destination'
    )
  else {
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, JSON.stringify(policy, null, 2) + '\n', {
      flag: 'wx',
    })
  }
  const exact = new Set(policy.blockedPathnames)
  return (pathname) => exact.has(pathname)
}
