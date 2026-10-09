import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * prisma/schema.prisma (achado 131): o `prisma generate` gera só o Prisma Client, fora do código versionado. O antigo
 * `generator zod` (prisma-zod-generator) gravava cerca de 2.800 arquivos em lib/validations que nada importava, sem os
 * modelos multiempresa, e um `prisma generate` sem `--generator client` regravava a pasta em que index.ts e
 * contact-types.ts são escritos à mão (entrada 227 de docs/issues/known-issues.md).
 */
const ROOT = path.resolve(import.meta.dirname, '../..')
const schema = fs.readFileSync(path.join(ROOT, 'prisma/schema.prisma'), 'utf8').replace(/\r\n/g, '\n')
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))

/** Os blocos `generator <nome> { chave = valor }` do schema, sem comentários. */
function generators(text: string): Array<{ name: string; settings: Record<string, string> }> {
  const code = text.replace(/\/\/.*$/gm, '')
  return [...code.matchAll(/^\s*generator\s+(\w+)\s*\{([^}]*)\}/gm)].map(([, name, body]) => ({
    name: name!,
    settings: Object.fromEntries([...body!.matchAll(/^\s*(\w+)\s*=\s*(.+?)\s*$/gm)].map(([, key, value]) => [key!, value!.replace(/^"|"$/g, '')])),
  }))
}

describe('prisma/schema.prisma', () => {
  it('declara só o gerador do Prisma Client, que grava no node_modules', () => {
    expect(generators(schema)).toEqual([{ name: 'client', settings: { provider: 'prisma-client-js' } }])
  })

  it('lê os blocos generator como o Prisma (controle do leitor)', () => {
    expect(generators('generator zod {\n  provider = "prisma-zod-generator"\n  output   = "../lib/validations"\n}\n')).toEqual([
      { name: 'zod', settings: { provider: 'prisma-zod-generator', output: '../lib/validations' } },
    ])
    expect(generators('// generator zod {\n// }\n')).toEqual([])
  })

  it('package.json não declara gerador de código do Prisma nem override dele', () => {
    const declared = [
      ...Object.keys({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies }),
      ...Object.keys(manifest.pnpm?.overrides ?? {}),
    ]
    expect(declared.filter((name) => /^prisma-[\w-]*generator\b/.test(name))).toEqual([])
  })
})
