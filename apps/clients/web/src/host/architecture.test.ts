// T15 da ADR docs/architecture/adr-tenant-hosts.md: fronteiras do host web por construção (varredura do código).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { LOCAL_API_ROUTES, matchesAny } from './routing/route-table'

const repoRoot = path.resolve(__dirname, '../../../../..')
const webSrc = path.join(repoRoot, 'apps', 'clients', 'web', 'src')
const appDir = path.join(webSrc, 'app')
const tenantTree = path.join(appDir, '(public)', '[locadora]')

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.(tsx?|jsx?|mjs)$/.test(name) && !/\.test\.[jt]sx?$/.test(name)
      ? [full]
      : []
  })
}

const rel = (file: string) =>
  path.relative(repoRoot, file).split(path.sep).join('/')
const code = (file: string) =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

const IMPORT_RE =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g
const importsOf = (file: string) =>
  [...code(file).matchAll(IMPORT_RE)].map((match) => match[1]!)

/** Arquivos de apps/clients/web/src alcançados por import relativo a partir de `entries`. */
function localClosure(entries: string[]): string[] {
  const seen = new Set<string>()
  const queue = [...entries]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    for (const specifier of importsOf(file)) {
      if (!specifier.startsWith('.')) continue
      const base = path.resolve(path.dirname(file), specifier)
      const target = [
        base,
        base + '.tsx',
        base + '.ts',
        path.join(base, 'index.ts'),
      ].find(
        (candidate) => existsSync(candidate) && statSync(candidate).isFile()
      )
      if (target && target.startsWith(webSrc)) queue.push(target)
    }
  }
  return [...seen]
}

describe('T15: fronteiras do host web', () => {
  const webFiles = sourceFiles(webSrc)
  const tenantFiles = localClosure(sourceFiles(tenantTree))

  it('nenhum Prisma, banco ou módulo da raiz legada em apps/clients/web/src', () => {
    const offenders = webFiles.flatMap((file) =>
      importsOf(file)
        .filter(
          (specifier) =>
            /(^|\/)lib\/prisma$|^@prisma\/client|^\.prisma|prisma/.test(
              specifier
            ) ||
            // Nada sobe além de apps/clients/web (WORKSPACE-ESCAPE).
            path
              .resolve(path.dirname(file), specifier)
              .startsWith(path.join(repoRoot, 'lib')) ||
            (specifier.startsWith('.') &&
              !path
                .resolve(path.dirname(file), specifier)
                .startsWith(path.join(repoRoot, 'apps', 'clients', 'web')))
        )
        .map((specifier) => `${rel(file)} → ${specifier}`)
    )
    expect(offenders).toEqual([])
  })

  it('a árvore [locadora] não lê headers() nem cookies() (locadora só do segmento, D4)', () => {
    expect(tenantFiles.length).toBeGreaterThan(20)
    const offenders = tenantFiles.filter(
      (file) =>
        importsOf(file).some(
          (specifier) =>
            specifier === 'next/headers' || specifier === 'next/server'
        ) || /\b(headers|cookies|draftMode)\s*\(\s*\)/.test(code(file))
    )
    expect(offenders.map(rel)).toEqual([])
  })

  it('nenhum href, redirect ou Link monta o segmento interno da locadora', () => {
    const offenders = webFiles.filter((file) =>
      /\/\$\{\s*(?:params\.|await\s+params\s*\)\.)?locadora\b|['"`]\/['"`]\s*\+\s*(?:params\.)?locadora\b|\/\$\{\s*(?:tenantSlug|site\.slug)\b/.test(
        code(file)
      )
    )
    expect(offenders.map(rel)).toEqual([])
  })

  it('o gateway é server-only e os providers são componentes de cliente', () => {
    expect(
      code(path.join(webSrc, 'host', 'server', 'public-api.ts'))
        .trimStart()
        .startsWith("import 'server-only'")
    ).toBe(true)
    for (const name of [
      'TenantSiteProviders.tsx',
      'AppHostProviders.tsx',
      'PlatformProviders.tsx',
    ]) {
      expect(
        readFileSync(path.join(webSrc, 'host', 'providers', name), 'utf8')
          .trimStart()
          .startsWith("'use client'")
      ).toBe(true)
    }
    // Só a árvore de servidor importa o gateway.
    const importers = webFiles.filter((file) =>
      importsOf(file).some((specifier) =>
        specifier.endsWith('host/server/public-api')
      )
    )
    for (const file of importers) {
      expect(code(file)).not.toMatch(/^['"]use client['"]/m)
    }
  })

  it('o layout raiz não monta providers nem lê dados', () => {
    const root = importsOf(path.join(appDir, 'layout.tsx'))
    expect(root.filter((specifier) => specifier.includes('host/'))).toEqual([])
    expect(code(path.join(appDir, 'layout.tsx'))).not.toMatch(
      /Suspense|fetch\(|await /
    )
  })

  it('handlers de API no host web só os locais declarados (LOCAL_API_ROUTES)', () => {
    const routes = webFiles
      .filter((file) => /[/\\]route\.[jt]sx?$/.test(file))
      .map(
        (file) =>
          '/' +
          rel(file)
            .replace('apps/clients/web/src/app/', '')
            .replace(/\/route\.[jt]sx?$/, '')
      )
      .map((route) =>
        route
          .split('/')
          .filter((segment) => !/^\(.+\)$/.test(segment))
          .join('/')
      )
    expect(
      routes.filter(
        (route) =>
          route.startsWith('/api') && !matchesAny(route, LOCAL_API_ROUTES)
      )
    ).toEqual([])
  })

  /**
   * Na API compartilhada nenhuma `route.ts` chama a função: a lógica mora na composição (`host/**`) e nas fábricas HTTP
   * de `packages/backend/src/http/**`. A varredura cobre os dois lugares onde a chamada poderia entrar. A única exceção
   * é o invólucro que define a função (`host/runtime.ts`); `host/private-identity.ts` só a injeta, sem chamá-la.
   */
  const SERVICE_PUBLIC_TENANT_DEFINITION =
    'apps/services/api/src/host/runtime.ts'
  it('na API compartilhada, composição e fábricas HTTP não chamam resolvePublicTenant direto (só o invólucro que a define)', () => {
    const scanned = [
      ...sourceFiles(
        path.join(repoRoot, 'apps', 'services', 'api', 'src', 'host')
      ),
      ...sourceFiles(path.join(repoRoot, 'packages', 'backend', 'src', 'http')),
    ]
    expect(scanned.map(rel)).toContain(SERVICE_PUBLIC_TENANT_DEFINITION)
    expect(
      scanned.filter((file) =>
        rel(file).startsWith('apps/services/api/src/host/')
      ).length
    ).toBeGreaterThan(30)
    expect(
      scanned.filter((file) =>
        rel(file).startsWith('packages/backend/src/http/')
      ).length
    ).toBeGreaterThan(50)
    const callers = scanned
      .filter((file) => /\bresolvePublicTenant\s*\(/.test(code(file)))
      .map(rel)
    // A exceção é nominal e continua verdadeira: o invólucro ainda define e chama a função do resolvedor.
    expect(callers).toEqual([SERVICE_PUBLIC_TENANT_DEFINITION])
    expect(code(path.join(repoRoot, SERVICE_PUBLIC_TENANT_DEFINITION))).toMatch(
      /export function resolvePublicTenant\s*\(/
    )
    // As rotas do serviço também não chamam.
    const routes = sourceFiles(
      path.join(repoRoot, 'apps', 'services', 'api', 'src', 'app', 'api')
    ).filter((file) => /[/\\]route\.ts$/.test(file))
    expect(routes.length).toBeGreaterThan(150)
    expect(
      routes
        .filter((file) => /\bresolvePublicTenant\s*\(/.test(code(file)))
        .map(rel)
    ).toEqual([])
  })
})
