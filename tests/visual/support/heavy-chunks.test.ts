import { describe, expect, it } from 'vitest'
import {
  createHeavyChunkMatcher,
  deriveHeavyChunkFiles,
  parseClientReferenceManifest,
} from './heavy-chunks.mjs'

const hero = 'static/chunks/hero-hash.js'
const heavy = 'static/chunks/3d-hash.js'
const entry = 'static/chunks/carousel-entry.js'
const loading =
  'loadableGenerated:{modules:[382785]},ssr:!1,loading:()=>({children:"Carregando modelos 3D..."})'
const markers =
  '__THREE_DEVTOOLS__;forest_slope_1k;draco/versioned/decoders/1.5.5'
const input = () => ({
  loadableManifest: { '382785': { id: 382785, files: [entry, heavy] } },
  homeBundles: { [hero]: loading },
  chunkContents: {
    [entry]: 'carousel entry without 3D runtime',
    [heavy]: markers,
  },
  protectedChunks: [hero, 'static/chunks/react-ui.js'],
})

describe('production visual heavy chunks', () => {
  it('binds the exact client-only Hero loading label to its manifest dependency', () => {
    const value = input()
    const before = JSON.stringify(value)
    expect(deriveHeavyChunkFiles(value)).toEqual({
      moduleId: '382785',
      heroBundle: hero,
      files: [heavy, entry].sort(),
      blockedFiles: [heavy],
      markers: [
        '__THREE_DEVTOOLS__',
        'forest_slope_1k',
        'draco/versioned/decoders/1.5.5',
      ],
    })
    expect(JSON.stringify(value)).toBe(before)
  })

  it('ignores unrelated three/drei text in the eager UI bundle', () => {
    const value = input()
    value.homeBundles[hero] += ';const text="three drei forest_slope_1k"'
    expect(deriveHeavyChunkFiles(value).blockedFiles).toEqual([heavy])
  })

  it('rejects a dependency also needed by eager UI', () => {
    const value = input()
    value.protectedChunks.push(heavy)
    expect(() => deriveHeavyChunkFiles(value)).toThrow('eager UI dependency')
  })

  it('requires explicit eager protection instead of assuming it', () => {
    const value = input()
    value.protectedChunks = []
    expect(() => deriveHeavyChunkFiles(value)).toThrow('protected eager')
  })

  it.each([
    '__THREE_DEVTOOLS__',
    'forest_slope_1k',
    'draco/versioned/decoders/1.5.5',
  ])('rejects a candidate missing the exact marker %s', (marker) => {
    const value = input()
    value.chunkContents[heavy] = markers.replace(marker, '')
    expect(() => deriveHeavyChunkFiles(value)).toThrow('all exact markers')
  })

  it('rejects an absent dynamic chunk', () => {
    const value = input()
    Reflect.deleteProperty(value.chunkContents, heavy)
    expect(() => deriveHeavyChunkFiles(value)).toThrow('Dynamic chunk absent')
  })

  it.each([
    '../outside.js',
    'static/chunks/../../outside.js',
    '/static/chunks/hash.js',
    'static\\chunks\\hash.js',
    'static/chunks/hash.js?query=1',
    'static/chunks/nested/hash.js',
  ])('rejects the unexpected manifest path %s', (file) => {
    const value = input()
    value.loadableManifest['382785'].files = [file]
    expect(() => deriveHeavyChunkFiles(value)).toThrow('dynamic chunk path')
  })

  it('rejects a missing or mismatched loadable entry', () => {
    const missing = input()
    Reflect.deleteProperty(missing.loadableManifest, '382785')
    expect(() => deriveHeavyChunkFiles(missing)).toThrow(
      'react-loadable manifest'
    )
    const mismatched = input()
    mismatched.loadableManifest['382785'].id = 1
    expect(() => deriveHeavyChunkFiles(mismatched)).toThrow(
      'react-loadable manifest'
    )
  })

  it('rejects ambiguous placeholder-bound imports', () => {
    const value = input()
    value.homeBundles[hero] += loading.replaceAll('382785', '123456')
    expect(() => deriveHeavyChunkFiles(value)).toThrow('one exact')
  })

  it('rejects an SSR import or a different loading component', () => {
    const ssr = input()
    ssr.homeBundles[hero] = loading.replace('ssr:!1', 'ssr:!0')
    expect(() => deriveHeavyChunkFiles(ssr)).toThrow('one exact')
    const another = input()
    another.homeBundles[hero] = loading.replace(
      'Carregando modelos 3D...',
      'Carregando outra interface...'
    )
    expect(() => deriveHeavyChunkFiles(another)).toThrow('one exact')
  })

  it('parses client-reference JSON without evaluating the assignment', () => {
    const text =
      'globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\nglobalThis.__RSC_MANIFEST["/(public)/[locadora]/(vitrine)/page"] = {"entryJSFiles":{"page":["static/chunks/hero-hash.js","static/chunks/hero-hash.js"]}};'
    expect(parseClientReferenceManifest(text)).toEqual({
      route: '/(public)/[locadora]/(vitrine)/page',
      chunks: [hero],
    })
    expect(() =>
      parseClientReferenceManifest(text + '\nthrow new Error("execute");')
    ).toThrow('manifest format')
  })

  it('rejects unknown eager paths and unknown manifest layout', () => {
    const text =
      'globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\nglobalThis.__RSC_MANIFEST["/page"] = {"entryJSFiles":{"page":["../outside.js"]}};'
    expect(() => parseClientReferenceManifest(text)).toThrow('eager chunk path')
    expect(() => parseClientReferenceManifest('{}')).toThrow('manifest format')
  })

  it('preserves the development route/tracker predicate exactly', () => {
    const matches = createHeavyChunkMatcher({
      production: false,
      reportFile: '',
      expectedBuildId: '',
    })
    expect(matches('/_next/static/chunks/node_modules_three_core.js')).toBe(
      true
    )
    expect(matches('/_next/static/chunks/react-three_drei.js')).toBe(true)
    expect(matches('/_next/static/chunks/3d-hash.js')).toBe(false)
    expect(matches('/models/three.glb')).toBe(false)
  })

  it('requires an external hash report and BUILD_ID in production', () => {
    expect(() =>
      createHeavyChunkMatcher({
        production: true,
        reportFile: '',
        expectedBuildId: '',
      })
    ).toThrow('external hash report')
  })
})
