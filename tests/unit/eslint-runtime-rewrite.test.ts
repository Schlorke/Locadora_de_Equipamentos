import tsParser from '@typescript-eslint/parser'
import { ESLint, Linter } from 'eslint'
import fs from 'node:fs'
import path from 'node:path'
import globals from 'globals'
import { describe, expect, it } from 'vitest'
import plugin, {
  EXCEPTIONS,
  PLUGIN_NAME,
  RULE_ID,
  SERVER_FILES,
  SERVER_IGNORES,
} from '../../tools/eslint-runtime-rewrite.mjs'

/**
 * Trava "o código de servidor não reescreve o runtime" (achado 123): a regra de tools/eslint-runtime-rewrite.mjs,
 * ligada em eslint.config.js para o código de servidor. Cada forma da gramática fechada precisa reprovar (os casos
 * do verificador vrf3-ft-111-112 entre elas) e os usos legítimos medidos no repositório precisam passar.
 */
const ROOT = path.resolve(import.meta.dirname, '../..')
const linter = new Linter({ cwd: ROOT })
const config: Linter.Config[] = [
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tsParser as Linter.Parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        React: 'readonly',
        JSX: 'readonly',
        NodeJS: 'readonly',
      },
    },
    plugins: { [PLUGIN_NAME]: plugin },
    rules: { [RULE_ID]: 'error' },
  },
]

/** A antiga lib/ foi retirada em F; forms analisa somente code com filename virtual, sem ler/importar esse arquivo. */
function forms(code: string, file = 'lib/probe.ts'): string[] {
  return linter
    .verify(code, config, { filename: path.join(ROOT, file) })
    .map((message) => {
      if (message.ruleId !== RULE_ID)
        throw new Error(`${message.ruleId ?? 'parser'}: ${message.message}`)
      return message.message.replace(
        /: o código de servidor não reescreve o runtime.*$/,
        ''
      )
    })
}

// Só o caso "está ligada em eslint.config.js" lê a configuração real (parser e plugins de TypeScript, React,
// Storybook...): isolado, até 1,2 s com cache quente (medido em 2026-10-07); sob a carga do pnpm test:unit completo,
// passava dos 20 s do padrão (22,9 e 25,9 s). Os outros casos usam o Linter com a configuração mínima acima.
const REAL_ESLINT = { timeout: 60_000 }

const hasInstance =
  '{ value: () => { void prisma.user.deleteMany(); return false } }'
// A antiga lib/ saiu em F; estes import specifiers são texto adversarial para tracking do prisma/Error, sem executar módulos.
const head = `import { prisma } from '@/lib/prisma'\nimport { CatalogError } from '@/lib/catalog'\n`

describe('regra runtime/no-runtime-rewrite', () => {
  it('reprova os caminhos por valor do verificador vrf3-ft-111-112 (achado 123, cenário A)', () => {
    // Error alcançado como protótipo de outra classe nativa, pela instância, por Reflect e pelo erro capturado.
    expect(
      forms(
        `${head}Object.defineProperty(Object.getPrototypeOf(RangeError), Symbol.hasInstance, ${hasInstance})`
      )
    ).toEqual([
      'Object.defineProperty',
      'Object.getPrototypeOf',
      'entrega o global RangeError como valor',
      'Symbol.hasInstance',
    ])
    expect(
      forms(
        `${head}Object.defineProperty(new CatalogError('x').constructor, Symbol.hasInstance, ${hasInstance})`
      )
    ).toEqual(['Object.defineProperty', '.constructor', 'Symbol.hasInstance'])
    expect(
      forms(
        `${head}Reflect.defineProperty(Reflect.getPrototypeOf(URIError) as object, Symbol.hasInstance, ${hasInstance})`
      )
    ).toEqual([
      'Reflect.defineProperty',
      'Reflect.getPrototypeOf',
      'entrega o global URIError como valor',
      'Symbol.hasInstance',
    ])
    expect(
      forms(
        `${head}try { JSON.parse('{') } catch (e) { Object.defineProperty(Object.getPrototypeOf((e as any).constructor), Symbol.hasInstance, ${hasInstance}) }`
      )
    ).toEqual([
      'Object.defineProperty',
      'Object.getPrototypeOf',
      '.constructor',
      'Symbol.hasInstance',
    ])
    // O mesmo remendo num arquivo comum de servidor, na carga do módulo (lib/telemetry.ts do verificador).
    expect(
      forms(
        `import { prisma } from '@/lib/prisma'\nObject.defineProperty(Object.getPrototypeOf(RangeError), Symbol.hasInstance, ${hasInstance})\nexport const TELEMETRY = 'on'\n`,
        'lib/telemetry.ts'
      )
    ).toEqual([
      'Object.defineProperty',
      'Object.getPrototypeOf',
      'entrega o global RangeError como valor',
      'Symbol.hasInstance',
    ])
  })

  it('reprova a reflexão: Reflect, os membros de Object que mudam ou revelam protótipos, os acessores legados e .constructor', () => {
    const cases: Record<string, string> = {
      'Object.defineProperties(URL, {})': 'Object.defineProperties',
      'Object.setPrototypeOf(CatalogError, null)': 'Object.setPrototypeOf',
      "Object.getOwnPropertyDescriptor(Array, 'prototype')":
        'Object.getOwnPropertyDescriptor',
      'Object.getOwnPropertyDescriptors(Headers)':
        'Object.getOwnPropertyDescriptors',
      'Object.getOwnPropertySymbols(Error)': 'Object.getOwnPropertySymbols',
      "Object['defineProperty'](URL, 'x', {})": 'Object.defineProperty',
      'Object[`setPrototypeOf`](URL, null)': 'Object.setPrototypeOf',
      "Reflect.set(URL, 'canParse', () => true)": 'Reflect.set',
      'const own = Reflect.ownKeys(URL)': 'Reflect.ownKeys',
      'const R = Reflect': 'Reflect',
      "globalThis.Object.defineProperty(URL, 'x', {})": 'Object.defineProperty',
      "window.Object.defineProperty(URL, 'x', {})": 'Object.defineProperty',
      "globalThis.Reflect.set(URL, 'x', 1)": 'Reflect.set',
      'const k = new URL("x").constructor': '.constructor',
      "const d = ({})['constructor']": '.constructor',
      'const p = ({}).__proto__': '__proto__',
      'const o = { __proto__: Array.prototype }': '__proto__',
      "URL.__defineGetter__('x', () => 1)": '__defineGetter__',
      "Array.__lookupSetter__('x')": '__lookupSetter__',
    }
    for (const [code, form] of Object.entries(cases))
      expect(forms(code), code).toContain(form)
  })

  it('reprova o protótipo como valor: só X.prototype.m.call|apply|bind(…) passa', () => {
    expect(forms('const p = Array.prototype')).toEqual([
      'lê Array.prototype como valor',
    ])
    expect(forms('patch(Headers.prototype)')).toEqual([
      'lê Headers.prototype como valor',
    ])
    expect(forms('const get = Headers.prototype.get')).toEqual([
      'lê Headers.prototype como valor',
    ])
    expect(forms('Array.prototype.map(() => 1)')).toEqual([
      'lê Array.prototype como valor',
    ])
    expect(
      forms('const has = Object.prototype.hasOwnProperty.call(o, k)')
    ).toEqual([])
    expect(forms('const s = Array.prototype.slice.apply(a, [1])')).toEqual([])
    expect(forms('const f = Function.prototype.bind')).toContain(
      'Function.prototype'
    )
    expect(forms('const s = Function.prototype.toString.call(f)')).toEqual([
      'Function.prototype',
    ])
  })

  it('reprova a escrita em global, import, módulo carregado e cadeia por prototype/constructor/__proto__', () => {
    const cases: Record<string, string> = {
      'URL = class {}': 'reescreve o global URL',
      'globalThis.fetch = async () => new Response()':
        'escreve globalThis.fetch',
      'globalThis.x = 1': 'escreve globalThis.x',
      "globalThis['x'] = 1": "escreve globalThis['x']",
      'Response.json = () => new Response()': 'escreve Response.json',
      'Array.prototype.map = function () { return [] }':
        'escreve Array.prototype.map',
      'Headers.prototype.get = () => null': 'escreve Headers.prototype.get',
      'delete Array.prototype.map': 'escreve Array.prototype.map',
      'Date.prototype.toISOString ??= () => ""':
        'escreve Date.prototype.toISOString',
      'Number.MAX_SAFE_INTEGER++': 'escreve Number.MAX_SAFE_INTEGER',
      'console.warn = () => undefined': 'escreve console.warn',
      'process.env.NODE_ENV = "x"': 'escreve process.env.NODE_ENV',
      "import { NextResponse } from 'next/server'\nNextResponse.json = () => new Response()":
        'escreve NextResponse.json',
      "import * as z from 'zod'\n;(z as any).string = () => null":
        'escreve (zasany).string',
      "import fs from 'node:fs'\nfs.readFileSync = () => ''":
        'escreve fs.readFileSync',
      "require('node:fs').readFileSync = () => ''":
        "escreve require('node:fs').readFileSync",
      "async function f() { (await import('node:fs')).x = 1 }":
        "escreve (awaitimport('node:fs')).x",
      'function f(c: boolean) { (c ? Array : Map).x = 1 }':
        'escreve (c?Array:Map).x',
      'function f(e: Error) { e.constructor.x = 1 }': 'escreve e.constructor.x',
      'function f(o: object) { (o as any).__proto__.x = 1 }':
        'escreve (oasany).__proto__.x',
      'function f(o: any) { o.prototype.x = 1 }': 'escreve o.prototype.x',
      '[globalThis.fetch] = [async () => new Response()]':
        'escreve globalThis.fetch',
      '({ a: URL } = { a: class {} })': 'reescreve o global URL',
      'for (globalThis.x of [1]) {}': 'escreve globalThis.x',
      'Object.assign(Array.prototype, { map() {} })':
        'Object.assign sobre Array.prototype',
      'Object.assign(globalThis, { fetch: null })':
        'Object.assign sobre globalThis',
      'Object.assign(Response, { json: null })': 'Object.assign sobre Response',
      "import { prisma } from '@/lib/prisma'\nObject.assign(prisma, { user: null })":
        'Object.assign sobre prisma',
      'Object.assign(...parts)': 'Object.assign sobre ...parts',
      'const assign = Object.assign': 'Object.assign como valor',
    }
    for (const [code, form] of Object.entries(cases))
      expect(forms(code), code).toContain(form)
  })

  it('reprova os símbolos que mudam instanceof, coerção e métodos nativos, em classe, objeto ou valor', () => {
    expect(
      forms('class Evil { static [Symbol.hasInstance]() { return true } }')
    ).toEqual(['Symbol.hasInstance'])
    expect(forms('const o = { [Symbol.toPrimitive]() { return 1 } }')).toEqual([
      'Symbol.toPrimitive',
    ])
    expect(
      forms(
        'class L extends Array { static get [Symbol.species]() { return L } }'
      )
    ).toEqual(['Symbol.species'])
    expect(forms('const k = Symbol.hasInstance')).toEqual([
      'Symbol.hasInstance',
    ])
    expect(forms('const k = globalThis.Symbol.split')).toEqual(['Symbol.split'])
    for (const name of [
      'isConcatSpreadable',
      'match',
      'matchAll',
      'replace',
      'search',
      'toStringTag',
      'unscopables',
    ])
      expect(forms(`const k = Symbol.${name}`)).toEqual([`Symbol.${name}`])
    expect(
      forms('class C { *[Symbol.iterator]() {} }\nconst t = Symbol.for("x")')
    ).toEqual([])
  })

  it('reprova o código dinâmico: eval, Function, import()/require() não literais, require como valor, vm e createRequire', () => {
    const cases: Record<string, string> = {
      "eval('1')": 'eval',
      "globalThis.eval('1')": 'eval',
      "new Function('return 1')": 'Function',
      "Function('return 1')()": 'Function',
      'async function f(m: string) { return import(m) }':
        'import() com argumento não literal',
      'async function f(m: string) { return import(`./${m}`) }':
        'import() com argumento não literal',
      "async function f() { return import('node:vm') }": "import('node:vm')",
      'function f(m: string) { return require(m) }':
        'require() com argumento não literal',
      "const r = require('node:module')": "require('node:module')",
      'const load = require': 'require como valor',
      "import vm from 'node:vm'": 'importa node:vm',
      "import { runInThisContext } from 'vm'": 'importa vm',
      "import { createRequire } from 'node:module'":
        'importa createRequire de node:module',
      "import * as mod from 'module'": 'importa createRequire de module',
      "setTimeout('alert(1)', 1)": 'setTimeout com texto',
      'setInterval(`tick()`, 1)': 'setInterval com texto',
      "const vm = process.getBuiltinModule('node:vm')":
        'process.getBuiltinModule',
      "const fsb = globalThis.process.binding('fs')": 'process.binding',
      "process.dlopen(target, 'addon.node')": 'process.dlopen',
      "const r = process.mainModule?.require('node:vm')": 'process.mainModule',
      "const vm = module.require('node:vm')": 'module.require',
      "const cached = require.cache['x']": 'require como valor',
    }
    for (const [code, form] of Object.entries(cases))
      expect(forms(code), code).toContain(form)
  })

  it('reprova um global do servidor entregue como valor ou lido por chave calculada', () => {
    const cases: Record<string, string> = {
      'const O = Object': 'entrega o global Object como valor',
      'const { defineProperty } = Object': 'entrega o global Object como valor',
      'patch(Array)': 'entrega o global Array como valor',
      'const deps = { URL }': 'entrega o global URL como valor',
      'const g = globalThis': 'entrega o global globalThis como valor',
      'const R = globalThis.Response': 'entrega o global Response como valor',
      'export default JSON': 'entrega o global JSON como valor',
      'const make = (c = Promise) => c': 'entrega o global Promise como valor',
      'items.map(Array)': 'entrega o global Array como valor',
      'register(Boolean)': 'entrega o global Boolean como valor',
      'function f(k: string) { return globalThis[k] }':
        'lê membro calculado de globalThis',
      'function f(k: string) { return Array[k as never] }':
        'lê membro calculado de Array',
      'function f(k: string) { return Symbol[k as never] }':
        'lê membro calculado de Symbol',
    }
    for (const [code, form] of Object.entries(cases))
      expect(forms(code), code).toContain(form)
  })

  it('aceita os usos legítimos medidos no repositório', () => {
    const legit = [
      "const ids = ids0.split(',').filter(Boolean).map(Number).some(String)",
      'timers.forEach(clearTimeout)',
      'const has = Object.prototype.hasOwnProperty.call(features, key)',
      'class Box { #value = 1; set(v: number) { this.#value = v; this.count = 1 } count = 0 }',
      'function f(data: Record<string, number>) { data.total = 1; data["x"] += 1; delete data.y }',
      'const cleanUpdateData = {}\nObject.assign(cleanUpdateData, { a: 1 })\nconst merged = Object.assign({}, a, b)',
      'const notify = Object.assign(function publish() {}, { success: () => undefined })',
      'function f(sheet: any) { sheet.getRow(1).height = 20; sheet.getRow(1).getCell(2).fill = {} }',
      "window.location.href = '/login'\ndocument.body.style.overflow = 'hidden'",
      ';(window as Window & { renderOptIn?: () => void }).renderOptIn = () => undefined',
      'const win = window as Window & typeof globalThis\nwin.addEventListener("resize", () => undefined)',
      'const u = new URL(req.url); const ok = e instanceof Error && typeof window === "undefined" && "fetch" in globalThis',
      'class AppError extends Error {}',
      "const fs = require('node:fs')\nconst p = require.resolve('zod')",
      "async function f() { return import('./x') }",
      'async function f(url: string) { return globalThis.fetch(url) }',
      'const key = process.env[name]',
      'const now = Date.now() + Math.max(1, 2) + JSON.stringify({}).length + Number.parseInt("1")',
      'let x: typeof URL | undefined\ntype T = ReturnType<typeof setTimeout>',
      'const s = String(v); const n = Number(v); const b = Boolean(v)',
      'if (x === undefined || Number.isNaN(NaN) || y === Infinity) void 0',
      'export const cache = new Map()\ncache.set("k", 1)\nconst registry: Record<string, unknown> = {}\nregistry.k = 1',
    ]
    for (const code of legit) expect(forms(code), code).toEqual([])
    // CommonJS: module.exports e exports são do arquivo.
    expect(
      forms('module.exports = { a: 1 }\nexports.b = 2', 'lib/probe.cjs')
    ).toEqual([])
  })

  it('mantém a lista de exceções fechada: cada uma com motivo, usada no seu arquivo e só na sua forma', () => {
    const files = [...new Set(EXCEPTIONS.map((entry) => entry.file))]
    for (const entry of EXCEPTIONS) {
      expect(entry.reason.length, entry.form).toBeGreaterThan(40)
      expect(fs.existsSync(path.join(ROOT, entry.file)), entry.file).toBe(true)
    }
    for (const file of files) {
      const code = fs.readFileSync(path.join(ROOT, file), 'utf8')
      const extension = path.extname(file)
      // No próprio arquivo, as exceções cobrem tudo o que a regra relata e nenhuma sobra.
      expect(forms(code, file), file).toEqual([])
      // O mesmo código em outro arquivo relata exatamente as formas da lista para ele.
      const found = new Set(forms(code, `lib/exception-probe${extension}`))
      expect([...found].sort(), file).toEqual(
        EXCEPTIONS.filter((entry) => entry.file === file)
          .map((entry) => entry.form)
          .sort()
      )
    }
    // Exceção que deixou de ser usada reprova (a lista só encolhe).
    const stale = linter.verify('export const nothing = 1', config, {
      filename: path.join(ROOT, 'packages/backend/src/runtime/database.ts'),
    })
    expect(stale.map((message) => message.messageId)).toEqual([
      'staleException',
      'staleException',
    ])
    expect(
      forms('global.__pool = pool\nglobal.__prisma = prisma', 'lib/prisma.ts')
    ).toEqual(['escreve global.__pool', 'escreve global.__prisma'])
    // A regra não aceita opções: a configuração não alarga a lista.
    expect(plugin.rules['no-runtime-rewrite'].meta?.schema).toEqual([])
  })

  it(
    'está ligada em eslint.config.js para o código de servidor, e só nele (a configuração real do repositório)',
    REAL_ESLINT,
    async () => {
      const eslint = new ESLint({ cwd: ROOT })
      const problems = async (file: string) =>
        (
          await eslint.lintText(
            'export const n = 1\nObject.defineProperty(Error, Symbol.hasInstance, { value: () => true })\n',
            { filePath: path.join(ROOT, file) }
          )
        )
          .flatMap((result) => result.messages)
          .filter((message) => message.ruleId === RULE_ID)
          .map((message) => message.message.replace(/: o código.*$/, ''))
      for (const file of [
        'apps/clients/web/src/app/api/probe/route.ts',
        'apps/clients/web/src/host/probe.ts',
        'apps/services/api/src/app/api/probe/route.ts',
        'apps/services/api/src/host/probe.ts',
        'packages/backend/src/probe.ts',
        'packages/contracts/src/probe.ts',
        'packages/domain/src/probe.ts',
        'packages/frontend/src/shared/probe.web.tsx',
        'packages/ui/src/probe.tsx',
        'packages/design-tokens/src/probe.ts',
        'types/probe.ts',
      ])
        expect(await problems(file), file).toEqual([
          'Object.defineProperty',
          'entrega o global Error como valor',
          'Symbol.hasInstance',
        ])
      // As antigas app/, lib/, middlewares e proxy.ts foram retiradas em F; estes filenames virtuais são controles negativos do escopo.
      for (const file of [
        'app/api/admin/probe/route.ts',
        'lib/probe.ts',
        'middlewares/probe.ts',
        'proxy.ts',
        'lib/probe.mjs',
        'tests/unit/probe.ts',
        'lib/probe.test.ts',
        'packages/backend/src/probe.test.ts',
        'packages/ui/src/probe.stories.tsx',
        'packages/frontend/src/probe.native.tsx',
      ])
        expect(await problems(file), file).toEqual([])
      expect(SERVER_FILES.length).toBeGreaterThan(0)
      expect(SERVER_IGNORES).toContain('**/*.native.{ts,tsx,js,jsx,mjs,cjs}')
    }
  )
})
