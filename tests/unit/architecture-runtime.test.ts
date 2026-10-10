import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  check,
  formatReport,
  tightenBaseline,
  writeBaseline,
} from '../../tools/arch-check.mjs'
import {
  adoptCoverage,
  guardBaselines,
  readTransfers,
  renameEntry,
} from '../../tools/ratchet-guard.mjs'

type Violation = { rule: string; file: string; line: number; message: string }
const where = (violations: Violation[]) =>
  violations.map((item) => [item.rule, item.file, item.line])

const temporaryRoots: string[] = []
const temporaryBase = path.resolve(os.tmpdir())

// fixture() owns a disposable root: the former app/ and lib/ retired in F are recreated only there as adversarial inputs.
function fixture() {
  const root = fs.mkdtempSync(path.join(temporaryBase, 'locadora-arch-test-'))
  temporaryRoots.push(root)
  const write = (file: string, body: string | object) => {
    const target = path.resolve(root, file)
    if (!target.startsWith(root + path.sep))
      throw new Error('Fixture escaped temporary root')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(
      target,
      typeof body === 'string' ? body : JSON.stringify(body, null, 2)
    )
  }
  write('package.json', {
    name: 'fixture',
    dependencies: { react: '*', 'react-native': '*', 'lucide-react': '*' },
  })
  write('tsconfig.json', { compilerOptions: { paths: { '@/*': ['./*'] } } })
  write('packages/frontend/package.json', {
    name: '@fixture/frontend',
    exports: {
      './app': './src/app/index.ts',
      './pages/*': './src/pages/*/index.ts',
    },
  })
  write('packages/frontend/tsconfig.json', { compilerOptions: {} })
  write('packages/frontend/src/app/index.ts', 'export const app = 1;')
  write(
    'packages/frontend/src/pages/home/index.ts',
    'export const Home = () => null;'
  )
  write('packages/ui/package.json', {
    name: '@fixture/ui',
    exports: {
      '.': {
        'react-native': './src/index.native.ts',
        default: './src/index.web.ts',
      },
    },
  })
  write('packages/ui/src/index.native.ts', 'export const native = true;')
  write('packages/ui/src/index.web.ts', 'export const web = true;')
  write('packages/design-tokens/package.json', {
    name: '@fixture/design-tokens',
    exports: { '.': './src/index.ts' },
  })
  write('packages/design-tokens/src/index.ts', 'export const space = 8;')
  write('apps/clients/web/package.json', { name: '@fixture/web' })
  write('apps/clients/mobile/package.json', { name: '@fixture/mobile' })
  const server = () => {
    write('packages/backend/package.json', {
      name: '@fixture/backend',
      contextWindow: { runtime: 'server' },
      exports: { './store': './src/store.ts' },
    })
    write(
      'packages/backend/src/store.ts',
      'import fs from "node:fs"; export const store = fs; export interface RecordDTO { id: string }'
    )
  }
  return { root, write, server }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    const resolved = path.resolve(root)
    if (
      path.dirname(resolved) !== temporaryBase ||
      !path.basename(resolved).startsWith('locadora-arch-test-')
    )
      throw new Error('Unsafe fixture cleanup')
    fs.rmSync(resolved, { recursive: true, force: true })
  }
})

describe('architecture runtime boundaries', () => {
  it('keeps direct secret storage access within the vault, including SQL and destructuring', () => {
    const { root, write } = fixture()
    write('packages/backend/package.json', {
      name: '@fixture/backend',
      contextWindow: { runtime: 'server' },
      exports: { './runtime': './src/runtime/index.ts' },
    })
    write(
      'packages/backend/src/runtime/index.ts',
      'export const runtime = true;'
    )
    write(
      'packages/backend/src/modules/secrets/vault.ts',
      'export const get = tx => tx.integrationSecret.findMany();'
    )
    expect(check(root).violations).toEqual([])
    for (const [name, code] of Object.entries({
      dot: 'tx.integrationSecret.findMany()',
      bracket: 'tx["integrationSecret"].findMany()',
      destructure: 'const { integrationSecret: rows } = tx',
      sql: 'tx.$queryRaw`SELECT * FROM integration_secrets`',
      interpolated: 'tx.$queryRaw`SELECT ${name} FROM integration_secrets`',
    })) {
      write(`packages/backend/src/modules/billing/${name}.ts`, code)
    }
    const findings = check(root).violations.filter(
      (item: Violation) => item.rule === 'SECRET-VAULT-OWNERSHIP'
    )
    expect(new Set(findings.map((item: Violation) => item.file))).toEqual(
      new Set(
        ['dot', 'bracket', 'destructure', 'sql', 'interpolated'].map(
          (name) => `packages/backend/src/modules/billing/${name}.ts`
        )
      )
    )
  })
  it('limits the platform database to platform composition, including aliased imports', () => {
    const { root, write } = fixture()
    write('packages/backend/package.json', {
      name: '@fixture/backend',
      contextWindow: { runtime: 'server' },
      exports: { './runtime': './src/runtime/platform-jobs.ts' },
    })
    write('packages/backend/tsconfig.json', {
      compilerOptions: {
        paths: { '@platform-runtime/*': ['./src/runtime/*'] },
      },
    })
    write(
      'packages/backend/src/runtime/platform-database.ts',
      'export const database = 1;'
    )
    write(
      'packages/backend/src/runtime/platform-jobs.ts',
      'import { database } from "./platform-database"; export { database };'
    )
    expect(check(root).violations).toEqual([])
    write(
      'packages/backend/src/modules/billing/unsafe.ts',
      'import { database } from "../../runtime/platform-database"; export { database };'
    )
    write(
      'packages/backend/src/modules/billing/aliased.ts',
      'import { database } from "@platform-runtime/platform-database"; export { database };'
    )
    const findings = check(root).violations.filter(
      (item: Violation) => item.rule === 'PLATFORM-PRISMA'
    )
    expect(new Set(findings.map((item: Violation) => item.file))).toEqual(
      new Set([
        'packages/backend/src/modules/billing/unsafe.ts',
        'packages/backend/src/modules/billing/aliased.ts',
      ])
    )
  })
  it('accepts the baseline and chooses native conditional exports', () => {
    const { root, write } = fixture()
    write('packages/ui/src/index.web.ts', 'export { Web } from "./view.web";')
    write(
      'packages/ui/src/view.web.tsx',
      'export const Web = () => <div>web</div>;'
    )
    write(
      'apps/clients/mobile/src/app/index.ts',
      'import { native } from "@fixture/ui"; export { native };'
    )
    expect(check(root).violations).toEqual([])
  })
  it('rejects an unknown alias instead of treating it as an external package', () => {
    const { root, write } = fixture()
    write(
      'packages/frontend/src/pages/home/index.ts',
      'export { store } from "@/secret-store";'
    )
    expect(check(root).violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'ALIAS-UNRESOLVED' }),
      ])
    )
  })
  it('enforces FSD after resolving a configured alias', () => {
    const { root, write } = fixture()
    write('packages/frontend/tsconfig.json', {
      compilerOptions: { paths: { '@local/*': ['./src/*'] } },
    })
    write(
      'packages/frontend/src/features/auth/index.ts',
      'export { app } from "@local/app";'
    )
    expect(check(root).violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'FSD-LAYER' })])
    )
  })
  it('rejects DOM JSX in a native variant even when no host imports it yet', () => {
    const { root, write } = fixture()
    write(
      'packages/frontend/src/pages/home/ui/Home.native.tsx',
      'export const Home = () => <div>invalid</div>;'
    )
    expect(check(root).violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'NATIVE-DOM', line: 1 }),
      ])
    )
  })
  it('finds native DOM behind a barrel and reports the import trace', () => {
    const { root, write } = fixture()
    write(
      'packages/ui/src/index.native.ts',
      'export { value } from "./bridge";'
    )
    write('packages/ui/src/bridge.ts', 'export { value } from "./dom";')
    write(
      'packages/ui/src/dom.ts',
      'export const value = window.location.href;'
    )
    const violation = check(root).violations.find(
      (item: { rule: string }) => item.rule === 'NATIVE-DOM'
    )
    expect(violation?.trace).toEqual([
      'packages/ui/src/index.native.ts',
      'packages/ui/src/bridge.ts',
      'packages/ui/src/dom.ts',
    ])
  })
  it('rejects a client barrel that reaches a server-only workspace package', () => {
    const { root, write, server } = fixture()
    server()
    write(
      'apps/clients/web/src/app/page.tsx',
      '"use client"; import { store } from "../bridge"; export default () => store;'
    )
    write(
      'apps/clients/web/src/bridge.ts',
      'export { store } from "@fixture/backend/store";'
    )
    const violations = check(root).violations
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'CLIENT-SERVER-PACKAGE' }),
        expect.objectContaining({ rule: 'CLIENT-SERVER-TRANSITIVE' }),
      ])
    )
  })
  it('permits server host imports and excludes type-only edges from runtime traversal', () => {
    const { root, write, server } = fixture()
    server()
    write(
      'apps/clients/web/src/app/page.tsx',
      'import { store } from "@fixture/backend/store"; export default () => store;'
    )
    write(
      'packages/frontend/src/pages/home/index.ts',
      'import type { RecordDTO } from "@fixture/backend/store"; export type { RecordDTO };'
    )
    expect(check(root).violations).toEqual([])
  })
  it('inventories the legacy root and checks its client graph', () => {
    const { root, write } = fixture()
    write('arch.config.json', {
      legacyRoots: [
        { path: 'app', runtime: 'web-host' },
        { path: 'lib', runtime: 'server-and-shared' },
      ],
    })
    write(
      'app/page.tsx',
      '"use client"; import { db } from "@/lib/db"; export default () => db;'
    )
    write('lib/db.ts', 'import fs from "node:fs"; export const db = fs;')
    const result = check(root)
    expect(result.runtime.inventory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'app', productionFiles: 1 }),
      ])
    )
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: 'CLIENT-SERVER-TRANSITIVE',
          file: 'lib/db.ts',
        }),
      ])
    )
  })
  it('honors Next server-action RPC boundaries on web', () => {
    const { root, write } = fixture()
    write('arch.config.json', { legacyRoots: ['app'] })
    write(
      'app/page.tsx',
      '"use client"; import { action } from "./action"; export default () => action;'
    )
    write(
      'app/action.ts',
      '"use server"; import fs from "node:fs"; export async function action() { return fs.existsSync("fixture"); }'
    )
    expect(check(root).violations).toEqual([])
  })
  it('does not mistake comments, strings or type-only DOM names and local bindings for runtime DOM', () => {
    const { root, write } = fixture()
    write(
      'packages/ui/src/index.native.ts',
      '// window.alert("comment");\nexport const label = "document and <div>";\ntype Shape = HTMLElement;\nexport function format(document: string) { const window = document.length; return window; }'
    )
    expect(check(root).violations).toEqual([])
  })
  it('rejects an unexported workspace entry and a dynamic import without a provable target', () => {
    const { root, write } = fixture()
    write(
      'apps/clients/mobile/src/app/index.ts',
      'import { x } from "@fixture/ui/private"; export const load = (name: string) => import(name);'
    )
    expect(check(root).violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'IMPORT-UNRESOLVED' }),
        expect.objectContaining({ rule: 'DYNAMIC-IMPORT-UNRESOLVED' }),
      ])
    )
  })
  it('does not permit a package to escape to root implementations through an alias', () => {
    const { root, write } = fixture()
    write('packages/frontend/tsconfig.json', {
      compilerOptions: { paths: { '@legacy/*': ['../../lib/*'] } },
    })
    write(
      'packages/frontend/src/pages/home/index.ts',
      'export { value } from "@legacy/value";'
    )
    write('lib/value.ts', 'export const value = 1;')
    expect(check(root).violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'ROOT-ESCAPE' })])
    )
  })
  it('honors aliases overriding a workspace package instead of hiding a root escape', () => {
    const { root, write } = fixture()
    write('packages/frontend/tsconfig.json', {
      compilerOptions: { paths: { '@fixture/ui': ['../../lib/secret'] } },
    })
    write(
      'packages/frontend/src/pages/home/index.ts',
      'export { value } from "@fixture/ui";'
    )
    write('lib/secret.ts', 'export const value = 1;')
    expect(check(root).violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'ROOT-ESCAPE' })])
    )
  })

  it('rejects native browser dialogs but accepts locally bound identifiers', () => {
    const { root, write } = fixture()
    write(
      'packages/ui/src/index.native.ts',
      'export const useDialog = () => alert("not native"); export function local(confirm: () => boolean) { return confirm(); }'
    )
    const violations = check(root).violations.filter(
      (item) => item.rule === 'NATIVE-DOM'
    )
    expect(violations).toHaveLength(1)
    expect(violations[0].message).toContain('alert')
  })
})

describe('workspace escapes', () => {
  it('blocks static, dynamic and require imports from a host into the legacy root', () => {
    const { root, write } = fixture()
    write('arch.config.json', {
      legacyRoots: [{ path: 'lib', runtime: 'server-and-shared' }],
    })
    write('lib/prisma.ts', 'export const prisma = { ready: true };')
    const page = 'apps/clients/web/src/app/(public)/page.tsx'
    write(
      page,
      [
        'import { prisma } from "../../../../../../lib/prisma";',
        'export async function load() { return (await import("../../../../../../lib/prisma")).prisma; }',
        'export const legacy = require("../../../../../../lib/prisma");',
        'export default function Page() { return prisma.ready; }',
      ].join('\n')
    )
    const violations: Violation[] = check(root).violations
    expect(where(violations)).toEqual([
      ['WORKSPACE-ESCAPE', page, 1],
      ['WORKSPACE-ESCAPE', page, 2],
      ['WORKSPACE-ESCAPE', page, 3],
    ])
    expect(violations[0]?.message).toContain('the legacy root (lib/prisma.ts)')
  })

  it("blocks a package reaching another workspace's internals by relative path or alias", () => {
    const { root, write } = fixture()
    write('packages/contracts/package.json', {
      name: '@fixture/contracts',
      exports: { '.': './src/index.ts' },
    })
    write('packages/contracts/src/index.ts', 'export { id } from "./internal";')
    write('packages/contracts/src/internal.ts', 'export const id = 1;')
    write('packages/domain/package.json', {
      name: '@fixture/domain',
      exports: { '.': './src/index.ts' },
    })
    write('packages/domain/tsconfig.json', {
      compilerOptions: {
        paths: { '@contracts-src/*': ['../contracts/src/*'] },
      },
    })
    const index = 'packages/domain/src/index.ts'
    write(
      index,
      [
        'export { id } from "../../contracts/src/internal";',
        'export { id as aliased } from "@contracts-src/internal";',
        'export { id as entry } from "@fixture/contracts";',
      ].join('\n')
    )
    const violations: Violation[] = check(root).violations
    expect(where(violations)).toEqual([
      ['WORKSPACE-ESCAPE', index, 1],
      ['WORKSPACE-ESCAPE', index, 2],
    ])
    expect(violations[0]?.message).toContain('@fixture/contracts internals')
  })

  it('reports a frontend escape to the legacy root once, as the hard ROOT-ESCAPE', () => {
    const { root, write } = fixture()
    write('arch.config.json', {
      legacyRoots: [{ path: 'lib', runtime: 'server-and-shared' }],
    })
    write('lib/value.ts', 'export const value = 1;')
    write(
      'packages/frontend/src/pages/home/index.ts',
      'export { value } from "../../../../../lib/value";'
    )
    expect(where(check(root).violations)).toEqual([
      ['ROOT-ESCAPE', 'packages/frontend/src/pages/home/index.ts', 1],
    ])
  })

  it('allows hosts to consume declared package entry points, including an alias onto the exported file', () => {
    const { root, write } = fixture()
    write('apps/clients/web/tsconfig.json', {
      compilerOptions: {
        paths: { '@fixture/ui': ['../../../packages/ui/src/index.web.ts'] },
      },
    })
    write(
      'apps/clients/web/src/app/page.tsx',
      [
        'import { Home } from "@fixture/frontend/pages/home";',
        'import { web } from "@fixture/ui";',
        'import { space } from "@fixture/design-tokens";',
        'import { shell } from "../host/shell";',
        'export default function Page() { return [Home, web, space, shell]; }',
      ].join('\n')
    )
    write('apps/clients/web/src/host/shell.ts', 'export const shell = 1;')
    expect(check(root).violations).toEqual([])
  })
})

describe('universal files stay platform neutral', () => {
  const markup =
    'export const Home = () => (\n  <div className="card">\n    <span>hi</span>\n  </div>\n);'

  it('blocks intrinsic DOM JSX in an unsuffixed file', () => {
    const { root, write } = fixture()
    const file = 'packages/frontend/src/pages/home/ui/Home.tsx'
    write(file, markup)
    const violations: Violation[] = check(root).violations
    expect(where(violations)).toEqual([
      ['UNIVERSAL-DOM-JSX', file, 2],
      ['UNIVERSAL-DOM-JSX', file, 3],
    ])
    expect(violations[0]?.message).toContain('<div> with className')
  })

  it('allows the same markup in a .web variant and component-only JSX in a universal file', () => {
    const { root, write } = fixture()
    write('packages/frontend/src/pages/home/ui/Home.web.tsx', markup)
    write(
      'packages/frontend/src/pages/home/ui/Shell.tsx',
      'import type { ReactNode } from "react";\nexport const Shell = ({ Box, children }: { Box: (props: { children: ReactNode }) => ReactNode; children: ReactNode }) => <Box>{children}</Box>;'
    )
    expect(check(root).violations).toEqual([])
  })

  it('blocks runtime imports of web-only libraries in a universal file but not in its .web variant', () => {
    const { root, write } = fixture()
    write('package.json', {
      name: 'fixture',
      dependencies: {
        react: '*',
        'react-native': '*',
        'lucide-react': '*',
        'framer-motion': '*',
        'tailwind-merge': '*',
        '@radix-ui/react-dialog': '*',
      },
    })
    const source = [
      'import { motion } from "framer-motion";',
      'import { twMerge } from "tailwind-merge";',
      'import type { LucideIcon } from "lucide-react";',
      'import * as Dialog from "@radix-ui/react-dialog";',
      'export const parts = { motion, twMerge, Dialog };',
      'export type Icon = LucideIcon;',
    ].join('\n')
    const universal = 'packages/frontend/src/pages/home/lib/motion.ts'
    write(universal, source)
    write('packages/frontend/src/pages/home/lib/motion.web.ts', source)
    const violations: Violation[] = check(root).violations
    expect(where(violations)).toEqual([
      ['UNIVERSAL-WEB-LIB', universal, 1],
      ['UNIVERSAL-WEB-LIB', universal, 2],
      ['UNIVERSAL-WEB-LIB', universal, 4],
    ])
  })
})

describe('architecture ratchet', () => {
  const file = 'packages/frontend/src/pages/home/ui/Home.tsx'
  const markup = (items: number) =>
    `export const Home = () => (\n  <section>\n${'    <p>item</p>\n'.repeat(items)}  </section>\n);`
  const baseline = (count: number) => ({
    total: count,
    files: { [file]: { 'UNIVERSAL-DOM-JSX': count } },
  })

  it('tolerates baselined debt, fails an increase or a new file, and passes a reduction', () => {
    const { root, write } = fixture()
    write(file, markup(2))
    write('tools/arch-baseline.json', baseline(3))
    let result = check(root)
    expect(result.violations).toEqual([])
    expect(result.ratchet.tolerated).toHaveLength(3)
    expect(formatReport(result)).toContain('baseline total 3 in 1 file(s)')

    write(file, markup(3))
    result = check(root)
    expect(where(result.violations)).toEqual(
      [2, 3, 4, 5].map((line) => ['UNIVERSAL-DOM-JSX', file, line])
    )
    expect(
      result.violations.every((item: Violation) =>
        item.message.endsWith('[ratchet: 4 > baseline 3]')
      )
    ).toBe(true)

    write(file, markup(2))
    write(
      'packages/frontend/src/pages/home/ui/Novo.tsx',
      'export const Novo = () => <div />;'
    )
    result = check(root)
    expect(where(result.violations)).toEqual([
      ['UNIVERSAL-DOM-JSX', 'packages/frontend/src/pages/home/ui/Novo.tsx', 1],
    ])
    fs.rmSync(path.join(root, 'packages/frontend/src/pages/home/ui/Novo.tsx'))

    write(file, markup(0))
    result = check(root)
    expect(result.violations).toEqual([])
    expect(result.ratchet.reducible).toEqual([
      { file, rule: 'UNIVERSAL-DOM-JSX', baseline: 3, current: 1 },
    ])
    expect(formatReport(result)).toContain('below baseline (-2)')
  })

  it('only lets the baseline shrink', () => {
    const { root, write } = fixture()
    write(file, markup(0))
    write('tools/arch-baseline.json', baseline(3))
    writeBaseline(root, check(root), 'update')
    const tightened = JSON.parse(
      fs.readFileSync(path.join(root, 'tools/arch-baseline.json'), 'utf8')
    )
    expect(tightened).toEqual(
      expect.objectContaining({
        total: 1,
        files: { [file]: { 'UNIVERSAL-DOM-JSX': 1 } },
      })
    )
    write(file, markup(2))
    expect(check(root).violations).toHaveLength(3)
    expect(() => writeBaseline(root, check(root), 'init')).toThrow(
      /already exists/
    )
    expect(
      tightenBaseline(
        { [file]: { 'UNIVERSAL-DOM-JSX': 2 } },
        {
          [file]: { 'UNIVERSAL-DOM-JSX': 5 },
          'other.tsx': { 'WORKSPACE-ESCAPE': 1 },
        }
      )
    ).toEqual({ [file]: { 'UNIVERSAL-DOM-JSX': 2 } })
  })

  it('rejects a baseline whose totals do not add up or that lists a non-ratcheted rule', () => {
    const { root, write } = fixture()
    write(file, markup(0))
    write('tools/arch-baseline.json', {
      total: 5,
      files: { [file]: { 'UNIVERSAL-DOM-JSX': 1, 'ROOT-ESCAPE': 1 } },
    })
    const messages = check(root)
      .violations.filter((item: Violation) => item.rule === 'RATCHET-BASELINE')
      .map((item: Violation) => item.message)
    expect(messages).toEqual([
      expect.stringContaining('"ROOT-ESCAPE" is not a ratcheted rule'),
      expect.stringContaining('declared total 5 differs'),
    ])
  })
})

describe('legacy root is not a blind spot', () => {
  const legacyConfig = {
    legacyRoots: [
      { path: 'app', runtime: 'web-host' },
      { path: 'lib', runtime: 'server-and-shared' },
    ],
  }
  const internal = 'packages/frontend/src/pages/home/ui/Internal.web.tsx'

  it('counts legacy imports of package internals, but not entry points or the legacy root itself', () => {
    const { root, write } = fixture()
    write('arch.config.json', legacyConfig)
    write(internal, 'export const Internal = () => null;')
    write('lib/db.ts', 'export const db = 1;')
    const page = 'app/page.tsx'
    write(
      page,
      [
        'import { Internal } from "../packages/frontend/src/pages/home/ui/Internal.web";',
        'import { Internal as Aliased } from "@/packages/frontend/src/pages/home/ui/Internal.web";',
        'import { Home } from "@fixture/frontend/pages/home";',
        'import { db } from "../lib/db";',
        'const legacy = require("../packages/design-tokens/src/index");',
        'export default function Page() { return [Internal, Aliased, Home, db, legacy]; }',
      ].join('\n')
    )
    const violations: Violation[] = check(root).violations
    expect(where(violations)).toEqual([
      ['LEGACY-DEEP-IMPORT', page, 1],
      ['LEGACY-DEEP-IMPORT', page, 2],
      ['LEGACY-DEEP-IMPORT', page, 5],
    ])
    expect(violations[0]?.message).toContain(
      '@fixture/frontend internals (packages/frontend/src/pages/home/ui/Internal.web.tsx) from the legacy root app'
    )
  })

  it('allows the web platform in the legacy host but counts markup and product UI libraries', () => {
    const { root, write } = fixture()
    write('package.json', {
      name: 'fixture',
      dependencies: {
        react: '*',
        'react-dom': '*',
        next: '*',
        'lucide-react': '*',
        'isomorphic-dompurify': '*',
      },
    })
    write('arch.config.json', legacyConfig)
    write(
      'app/layout.tsx',
      [
        'import Link from "next/link";',
        'import { createPortal } from "react-dom";',
        'import DOMPurify from "isomorphic-dompurify";',
        'import type { LucideIcon } from "lucide-react";',
        'export type Icon = LucideIcon;',
        'export default function Layout() { return [Link, createPortal, DOMPurify]; }',
      ].join('\n')
    )
    write(
      'lib/icons.tsx',
      'import { Search } from "lucide-react";\nexport const Icon = () => <span><Search /></span>;'
    )
    expect(where(check(root).violations)).toEqual([
      ['LEGACY-DOM-JSX', 'lib/icons.tsx', 2],
      ['LEGACY-WEB-LIB', 'lib/icons.tsx', 1],
    ])
  })

  it('moving a file with debt from packages/frontend into app/ is not a reduction', () => {
    const { root, write } = fixture()
    write('arch.config.json', legacyConfig)
    write(internal, 'export const Internal = () => null;')
    const home = 'packages/frontend/src/pages/home/ui/Home.tsx'
    const source =
      'import { Search } from "lucide-react";\nexport const Home = () => (\n  <section>\n    <p>item</p>\n    <Search />\n  </section>\n);'
    write(home, source)
    write('tools/arch-baseline.json', {
      total: 3,
      files: { [home]: { 'UNIVERSAL-DOM-JSX': 2, 'UNIVERSAL-WEB-LIB': 1 } },
    })
    expect(check(root).violations).toEqual([])

    fs.rmSync(path.join(root, home))
    const moved = 'app/home/Home.tsx'
    write(
      moved,
      `${source}\nexport { Internal } from "../../packages/frontend/src/pages/home/ui/Internal.web";`
    )
    let result = check(root)
    expect(where(result.violations)).toEqual([
      ['LEGACY-DEEP-IMPORT', moved, 8],
      ['LEGACY-DOM-JSX', moved, 3],
      ['LEGACY-DOM-JSX', moved, 4],
      ['LEGACY-WEB-LIB', moved, 1],
    ])
    expect(result.ratchet.reducible).toEqual([
      { file: home, rule: 'UNIVERSAL-DOM-JSX', baseline: 2, current: 0 },
      { file: home, rule: 'UNIVERSAL-WEB-LIB', baseline: 1, current: 0 },
    ])

    // Locking in the "reduction" cannot admit the moved file: the gate keeps failing.
    writeBaseline(root, result, 'update')
    result = check(root)
    expect(result.ratchet.baseline.total).toBe(0)
    expect(where(result.violations)).toHaveLength(4)
  })
})

describe('web-only libraries the repository imports', () => {
  const libs = [
    'vaul',
    'input-otp',
    'embla-carousel-react',
    '@dnd-kit/core',
    '@dnd-kit/sortable',
    'next-themes',
    'three',
    '@react-three/fiber',
    '@react-three/drei',
    'cmdk',
    'gsap',
    'lenis',
    '@base-ui/react',
    'isomorphic-dompurify',
    'recharts',
    'react-resizable-panels',
    'react-day-picker',
    'motion/react',
    'sonner',
    '@radix-ui/react-dialog',
  ]

  it('are web-only in a universal file and DOM packages in the native graph', () => {
    const { root, write } = fixture()
    write('package.json', {
      name: 'fixture',
      dependencies: Object.fromEntries(
        [
          'react',
          'react-native',
          'lucide-react',
          'lucide-react-native',
          'tailwind-merge',
          ...libs,
        ].map((name) => [
          name.replace(/^(@[^/]+\/[^/]+|[^@/][^/]*).*$/, '$1'),
          '*',
        ])
      ),
    })
    const universal = 'packages/frontend/src/pages/home/lib/web.ts'
    write(
      universal,
      [
        ...libs.map((lib, index) => `import * as lib${index} from "${lib}";`),
        'import * as icons from "lucide-react-native";',
        `export const all = [${libs.map((_, index) => `lib${index}`).join(', ')}, icons];`,
      ].join('\n')
    )
    write(
      'packages/frontend/src/pages/home/index.ts',
      'export { all } from "./lib/web";'
    )
    write(
      'packages/frontend/src/app/index.ts',
      'export { all } from "../pages/home";'
    )
    write(
      'apps/clients/mobile/src/app/index.ts',
      'import { all } from "@fixture/frontend/app"; export default all;'
    )
    const violations: Violation[] = check(root).violations
    const lines = libs.map((_, index) => index + 1)
    expect(
      violations
        .filter((item) => item.rule === 'UNIVERSAL-WEB-LIB')
        .map((item) => [item.file, item.line])
    ).toEqual(lines.map((line) => [universal, line]))
    expect(
      violations
        .filter((item) => item.rule === 'NATIVE-DOM-PACKAGE')
        .map((item) => [item.file, item.line])
    ).toEqual(lines.map((line) => [universal, line]))
    expect(
      violations.filter(
        (item) =>
          !['UNIVERSAL-WEB-LIB', 'NATIVE-DOM-PACKAGE'].includes(item.rule)
      )
    ).toEqual([])
  })

  it('tailwind-merge is web-only for universal code without being a DOM package', () => {
    const { root, write } = fixture()
    write('package.json', {
      name: 'fixture',
      dependencies: { react: '*', 'react-native': '*', 'tailwind-merge': '*' },
    })
    write(
      'packages/frontend/src/pages/home/lib/cn.ts',
      'import { twMerge } from "tailwind-merge";\nexport const cn = twMerge;'
    )
    write(
      'packages/frontend/src/pages/home/index.ts',
      'export { cn } from "./lib/cn";'
    )
    write(
      'packages/frontend/src/app/index.ts',
      'export { cn } from "../pages/home";'
    )
    write(
      'apps/clients/mobile/src/app/index.ts',
      'import { cn } from "@fixture/frontend/app"; export default cn;'
    )
    expect(where(check(root).violations)).toEqual([
      ['UNIVERSAL-WEB-LIB', 'packages/frontend/src/pages/home/lib/cn.ts', 1],
    ])
  })
})

describe('ratchet guard (baselines anchored to the base)', () => {
  type Files = Record<string, Record<string, number>>
  type Transfer = {
    baseline: string
    from: string
    to: string
    reason: string
    counts?: Record<string, number>
  }
  const spec = (
    base: Files | null,
    tree: Files | null,
    {
      baseRules = ['R', 'S'],
      treeRules = ['R', 'S'],
      errors = [] as string[],
    } = {}
  ) => ({
    name: 'arch',
    file: 'tools/arch-baseline.json',
    baseText:
      base === null ? null : JSON.stringify({ rules: baseRules, files: base }),
    treeText:
      tree === null ? null : JSON.stringify({ rules: treeRules, files: tree }),
    treeErrors: errors,
  })
  const run = (
    base: Files | null,
    tree: Files | null,
    {
      coverage = {} as Files,
      transfers = [] as Transfer[],
      verify = (() => null) as (_transfer: Transfer) => string | null,
      ...options
    } = {}
  ) => {
    let measured = 0
    const result = guardBaselines({
      baselines: [spec(base, tree, options)],
      transfers,
      verifyTransfer: verify,
      measureBase: () => {
        measured += 1
        return { arch: coverage }
      },
    })
    return {
      ...result,
      measured,
      problems: result.results[0].problems as string[],
      covered: result.results[0].covered,
    }
  }

  it('fails a higher count or a new file/rule pair and passes at or below the base, measuring nothing then', () => {
    const base = { 'a.tsx': { R: 2 } }
    expect(run(base, { 'a.tsx': { R: 2 } })).toMatchObject({
      ok: true,
      measured: 0,
    })
    expect(run(base, { 'a.tsx': { R: 1 } })).toMatchObject({
      ok: true,
      measured: 0,
    })
    expect(run(base, { 'a.tsx': { R: 3 } }).problems).toEqual([
      'tools/arch-baseline.json: increase a.tsx R: base 2, tree 3; the base code measures 0 with the current rules',
    ])
    expect(
      run(base, { 'a.tsx': { R: 1, S: 1 }, 'b.tsx': { R: 1 } }).problems
    ).toEqual([
      'tools/arch-baseline.json: new entry a.tsx S: base 0, tree 1; the base code measures 0 with the current rules',
      'tools/arch-baseline.json: new entry b.tsx R: base 0, tree 1; the base code measures 0 with the current rules',
    ])
  })

  it('fails a removed baseline, a dropped rule or an invalid tree baseline; a baseline new in the change is an introduction', () => {
    expect(run({ 'a.tsx': { R: 1 } }, null).problems).toEqual([
      'tools/arch-baseline.json exists at the base but was removed',
    ])
    expect(
      run({ 'a.tsx': { R: 1 } }, { 'a.tsx': { R: 1 } }, { treeRules: ['R'] })
        .problems
    ).toEqual([
      'tools/arch-baseline.json: rule S is ratcheted at the base but missing from "rules" in the tree',
    ])
    expect(
      run({}, {}, { errors: ['declared total 5 differs'] }).problems
    ).toEqual(['tools/arch-baseline.json: declared total 5 differs'])
    const introduced = run(null, { 'a.tsx': { R: 9 } })
    expect(introduced).toMatchObject({ ok: true, measured: 0 })
    expect(introduced.results[0].status).toBe('introduced')
  })

  it('a recorded rename moves the base allowance to the new path without growing the total', () => {
    const transfers = [
      {
        baseline: 'arch',
        from: 'old.tsx',
        to: 'new.tsx',
        reason: 'movido para o slice correto',
        counts: { R: 2 },
      },
    ]
    expect(
      run({ 'old.tsx': { R: 2 } }, { 'new.tsx': { R: 2 } }, { transfers }).ok
    ).toBe(true)
    expect(
      run({ 'old.tsx': { R: 2 } }, { 'new.tsx': { R: 3 } }, { transfers }).ok
    ).toBe(false)
    expect(
      run(
        { 'old.tsx': { R: 2 } },
        { 'new.tsx': { R: 2 }, 'old.tsx': { R: 1 } },
        { transfers }
      ).ok
    ).toBe(false)
    // A stale transfer (its origin is not at the base) creates no allowance.
    expect(run({}, { 'new.tsx': { R: 1 } }, { transfers }).ok).toBe(false)
    expect(run({ 'old.tsx': { R: 2 } }, { 'new.tsx': { R: 2 } }).ok).toBe(false)
    // Without the evidence of a rename, or without the recorded counts, the transfer moves nothing.
    expect(
      run(
        { 'old.tsx': { R: 2 } },
        { 'new.tsx': { R: 2 } },
        { transfers, verify: () => 'not a rename' }
      ).problems
    ).toEqual([
      'tools/ratchet-transfers.json: transfer old.tsx -> new.tsx rejected: not a rename',
      'tools/arch-baseline.json: new entry new.tsx R: base 0, tree 2; the base code measures 0 with the current rules',
    ])
    expect(
      run(
        { 'old.tsx': { R: 2 } },
        { 'new.tsx': { R: 2 } },
        { transfers: [{ ...transfers[0]!, counts: undefined }] }
      ).problems[0]
    ).toBe(
      'tools/ratchet-transfers.json: transfer old.tsx -> new.tsx rejected: "counts" is required (record the transfer with --rename)'
    )
    const { transfers: valid, problems } = readTransfers(
      JSON.stringify({
        transfers: [
          ...transfers,
          {
            baseline: 'arch',
            from: 'x.tsx',
            to: 'x.tsx',
            reason: 'mesmo caminho',
          },
          { baseline: 'arch', from: 'y.tsx', to: 'z.tsx' },
          {
            baseline: 'other',
            from: 'y.tsx',
            to: 'z.tsx',
            reason: 'base errada',
          },
        ],
      }),
      ['arch', 'tokens']
    )
    expect(valid).toEqual(transfers)
    expect(problems).toHaveLength(3)
  })

  it('allows new coverage only up to what the current rules measure on the base code', () => {
    const base = { 'a.tsx': { R: 1 } }
    const tree = { 'a.tsx': { R: 3 }, 'app/b.tsx': { S: 2 } }
    const covered = run(base, tree, {
      coverage: { 'a.tsx': { R: 3 }, 'app/b.tsx': { S: 2 } },
    })
    expect(covered).toMatchObject({ ok: true, measured: 1 })
    expect(
      covered.covered.map((entry: { file: string }) => entry.file)
    ).toEqual(['a.tsx', 'app/b.tsx'])
    expect(
      run(base, tree, {
        coverage: { 'a.tsx': { R: 2 }, 'app/b.tsx': { S: 2 } },
      }).problems
    ).toEqual([
      'tools/arch-baseline.json: increase a.tsx R: base 1, tree 3; the base code measures 2 with the current rules',
    ])
  })

  it('adopts only new coverage, capped by the current count and never reopening a locked reduction', () => {
    const { files, adopted } = adoptCoverage(
      { 'a.tsx': { R: 2 }, 'c.tsx': { R: 4 } },
      { 'a.tsx': { R: 1 }, 'c.tsx': { R: 3 } },
      { 'a.tsx': { R: 4 }, 'b.tsx': { S: 3 }, 'c.tsx': { R: 4 } },
      { 'a.tsx': { R: 5 }, 'b.tsx': { S: 1 }, 'c.tsx': { R: 4 } }
    )
    expect(files).toEqual({
      'a.tsx': { R: 3 },
      'b.tsx': { S: 1 },
      'c.tsx': { R: 3 },
    })
    expect(adopted).toHaveLength(2)
  })

  it('--rename moves the tree entry of a renamed file and records the transfer; the source must be gone', () => {
    const { root, write } = fixture()
    const from = 'packages/frontend/src/pages/home/ui/Old.tsx'
    const to = 'packages/frontend/src/pages/home/ui/Novo.tsx'
    const markup =
      'export const Home = () => (\n  <section>\n    <p>item</p>\n  </section>\n);'
    write(to, markup)
    write('tools/arch-baseline.json', {
      total: 2,
      files: { [from]: { 'UNIVERSAL-DOM-JSX': 2 } },
    })
    expect(check(root).violations).toHaveLength(2)
    expect(() => renameEntry(root, from, to, 'curto')).toThrow(/--reason/)
    write(from, markup)
    expect(() => renameEntry(root, from, to, 'renomeado no slice')).toThrow(
      /still exists/
    )
    fs.rmSync(path.join(root, from))
    const moved = renameEntry(root, from, to, 'renomeado no slice')
    expect(moved).toEqual([
      {
        baseline: 'arch',
        from,
        to,
        reason: 'renomeado no slice',
        counts: { 'UNIVERSAL-DOM-JSX': 2 },
      },
    ])
    expect(check(root).violations).toEqual([])
    const transfers = JSON.parse(
      fs.readFileSync(path.join(root, 'tools/ratchet-transfers.json'), 'utf8')
    ).transfers
    expect(
      readTransfers(JSON.stringify({ transfers }), ['arch', 'tokens'])
    ).toEqual({
      transfers: [
        {
          baseline: 'arch',
          from,
          to,
          reason: 'renomeado no slice',
          counts: { 'UNIVERSAL-DOM-JSX': 2 },
        },
      ],
      problems: [],
    })
  })

  it("end to end: a new rule's debt in the base code is covered, debt moved into app/ by the change is not", () => {
    const base = fixture()
    const tree = fixture()
    const config = { legacyRoots: [{ path: 'app', runtime: 'web-host' }] }
    const home = 'packages/frontend/src/pages/home/ui/Home.tsx'
    const markup =
      'export const Home = () => (\n  <section>\n    <p>item</p>\n  </section>\n);'
    for (const { write } of [base, tree]) {
      write('arch.config.json', config)
      write(
        'app/layout.tsx',
        'export default function Layout() { return <main />; }'
      )
    }
    base.write(home, markup)
    tree.write('app/home/Home.tsx', markup)
    const counts = (root: string) => check(root).ratchet.counts as Files
    // The base baseline predates LEGACY-DOM-JSX; the tree records app/layout.tsx (already in the base code)
    // and the moved file (only in the change).
    const baseBaseline = { [home]: { 'UNIVERSAL-DOM-JSX': 2 } }
    const treeBaseline = {
      'app/layout.tsx': { 'LEGACY-DOM-JSX': 1 },
      'app/home/Home.tsx': { 'LEGACY-DOM-JSX': 2 },
    }
    expect(counts(tree.root)).toEqual(treeBaseline)
    const result = guardBaselines({
      baselines: [
        spec(baseBaseline, treeBaseline, {
          baseRules: ['UNIVERSAL-DOM-JSX'],
          treeRules: ['UNIVERSAL-DOM-JSX', 'LEGACY-DOM-JSX'],
        }),
      ],
      transfers: [],
      measureBase: () => ({ arch: counts(base.root) }),
    })
    expect(
      result.results[0].covered.map((entry: { file: string }) => entry.file)
    ).toEqual(['app/layout.tsx'])
    expect(result.results[0].problems).toEqual([
      'tools/arch-baseline.json: new entry app/home/Home.tsx LEGACY-DOM-JSX: base 0, tree 2; the base code measures 0 with the current rules',
    ])
  })
})

// Na caracterização A1/E9 da onda 135, `types/` deixou de ser raiz legada inteira e os dois `.d.ts` antigos
// eram declarados individualmente. Após F, o shim `types/next-auth.d.ts` permanece só de tipos
// (nonRuntimeRoots), ligado ao entrypoint do backend; o teste abaixo lê a configuração atual.
// The former types/global.d.ts and types/google-maps-ecl.d.ts were retired in F; this group reads the real shim contract.
describe('types/ é raiz declarada só de tipos', () => {
  const repoRoot = path.resolve(__dirname, '..', '..')
  const read = (file: string) =>
    fs.readFileSync(path.join(repoRoot, file), 'utf8')
  const config = () =>
    JSON.parse(read('arch.config.json')) as {
      legacyRoots: Array<{ path: string; runtime: string }>
      nonRuntimeRoots: Array<{ path: string; reason: string }>
    }
  const covers = (root: string, file: string) =>
    file === root || file.startsWith(root.replace(/\/+$/, '') + '/')

  it('o shim do NextAuth é raiz declarada só de tipos, fora das raízes legadas', () => {
    const { legacyRoots, nonRuntimeRoots } = config()
    expect(
      legacyRoots.filter((entry) => covers(entry.path, 'types/next-auth.d.ts'))
    ).toEqual([])
    expect(legacyRoots.map((entry) => entry.path)).not.toContain('types')
    // O antigo proxy.ts da raiz foi retirado em F; o literal abaixo proíbe declará-lo vivo novamente.
    const retiredCodeRoots = [
      'app',
      'lib',
      'middlewares',
      'schemas',
      'types/global.d.ts',
      'types/google-maps-ecl.d.ts',
      'proxy.ts',
    ]
    for (const retiredRoot of retiredCodeRoots) {
      expect(
        legacyRoots.filter(
          (entry) =>
            covers(entry.path, retiredRoot) || covers(retiredRoot, entry.path)
        ),
        retiredRoot
      ).toEqual([])
    }
    expect(legacyRoots).toEqual([{ path: 'public', runtime: 'browser-assets' }])
    const declared = nonRuntimeRoots.find(
      (entry) => entry.path === 'types/next-auth.d.ts'
    )
    expect(declared?.reason).toMatch(/só de tipos/)
  })

  it('o shim só importa o entrypoint declarado do backend, e só os tsconfig do web e do frontend o incluem', () => {
    const shim = read('types/next-auth.d.ts')
      .replace(/^\s*\/\/.*$/gm, '')
      .trim()
    expect(shim).toBe("import type {} from '@gb-locacoes/backend/identity'")
    const backend = JSON.parse(read('packages/backend/package.json')) as {
      exports: Record<string, string>
    }
    expect(backend.exports['./identity']).toBe(
      './src/modules/identity/index.ts'
    )
    expect(read('apps/clients/web/tsconfig.json')).toContain(
      '"../../../types/next-auth.d.ts"'
    )
    expect(read('packages/frontend/tsconfig.json')).toContain(
      '"../../types/next-auth.d.ts"'
    )
    // Os antigos types/global.d.ts e types/google-maps-ecl.d.ts saíram em F e não entram nos tsconfig atuais.
    for (const tsconfig of [
      'apps/clients/web/tsconfig.json',
      'apps/clients/mobile/tsconfig.json',
      'apps/services/api/tsconfig.json',
      'packages/frontend/tsconfig.json',
      'packages/ui/tsconfig.json',
      'packages/backend/tsconfig.json',
    ]) {
      if (!fs.existsSync(path.join(repoRoot, tsconfig))) continue
      expect(read(tsconfig), tsconfig).not.toMatch(
        /global\.d\.ts|google-maps-ecl\.d\.ts/
      )
    }
  })

  // The former types/global.d.ts is recreated only in fixture(); the compatibility counterexample is not a live source.
  it('um .ts novo em types/ reprova como raiz não classificada em vez de nascer legado', () => {
    const { root, write } = fixture()
    write(
      'types/next-auth.d.ts',
      "import type {} from '@fixture/backend/store'"
    )
    write('types/global.d.ts', 'declare const versao: string')
    write('types/novo.ts', 'export const novo = 1;')
    write('arch.config.json', {
      legacyRoots: [{ path: 'types/global.d.ts', runtime: 'types' }],
      nonRuntimeRoots: [
        { path: 'types/next-auth.d.ts', reason: 'Raiz declarada só de tipos.' },
      ],
    })
    expect(
      where(check(root).violations).filter(
        ([rule]) => rule === 'UNCLASSIFIED-ROOT'
      )
    ).toEqual([['UNCLASSIFIED-ROOT', 'types/novo.ts', 1]])
    // Com a pasta inteira legada (o desenho anterior), o mesmo arquivo nascia legado sem reprovar.
    write('arch.config.json', {
      legacyRoots: [{ path: 'types', runtime: 'types' }],
    })
    expect(
      where(check(root).violations).filter(
        ([rule]) => rule === 'UNCLASSIFIED-ROOT'
      )
    ).toEqual([])
  })
})
