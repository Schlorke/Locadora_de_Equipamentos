import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

const root = path.resolve(__dirname, '../..')
const EXPECTED_RESOLVING_ROUTES = 111
const EXPECTED_RESOLVER_CALLS = 144
const methods = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'])
function routeFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory()
      ? routeFiles(file)
      : entry.name === 'route.ts'
        ? [file]
        : []
  })
}
const sourceOf = (file: string) =>
  ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  )
function callsIn(node: ts.Node, names: Set<string>): ts.CallExpression[] {
  const result: ts.CallExpression[] = []
  function visit(child: ts.Node) {
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      names.has(child.expression.text)
    )
      result.push(child)
    ts.forEachChild(child, visit)
  }
  visit(node)
  return result
}

// A prova dos 20 adapters de papéis da antiga raiz (21 chamadas) foi encerrada
// antes da aposentadoria local no bloco F. A prova ativa abaixo continua selando
// 111 rotas e 144 chamadas da API, sem consultar a estrutura aposentada.

// Onda 135 (E6): o mesmo invariante sem depender da raiz legada. Toda rota da API compartilhada que resolve o principal
// ou a permissão da locadora no próprio handler entrega a esse resolvedor a requisição HTTP original (a seleção da
// locadora, a borda e a assinatura vêm dela), nunca uma cópia montada nem outro objeto. As contagens fixam a superfície:
// rota nova que resolve a locadora muda o número de propósito, e rota que deixa de resolver também.
it('every API route handler that resolves the tenant principal or permission forwards its original request', () => {
  const apiRoot = path.join(root, 'apps/services/api/src/app/api')
  const resolvers = new Set([
    'resolveTenantPrincipal',
    'requireTenantPermission',
  ])
  const files = new Set<string>()
  let checked = 0
  for (const file of routeFiles(apiRoot)) {
    const source = sourceOf(file)
    for (const handler of source.statements) {
      if (
        !ts.isFunctionDeclaration(handler) ||
        !handler.name ||
        !methods.has(handler.name.text)
      )
        continue
      const request = handler.parameters[0]?.name.getText()
      for (const call of callsIn(handler, resolvers)) {
        checked++
        files.add(path.relative(root, file).split(path.sep).join('/'))
        const message = `${path.relative(root, file)} ${handler.name.text}`
        expect(request, message).toBeTruthy()
        expect(call.arguments[0]?.getText(), message).toBe(request)
      }
    }
  }
  // A rota de categorias continua entre as 111 rotas da superfície compartilhada.
  expect(files).toContain(
    'apps/services/api/src/app/api/admin/categories/route.ts'
  )
  expect(files.size).toBe(EXPECTED_RESOLVING_ROUTES)
  expect(checked).toBe(EXPECTED_RESOLVER_CALLS)
})
