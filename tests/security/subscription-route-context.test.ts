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

it('every actual legacy role-helper adapter and its API counterpart forward the original HTTP request', () => {
  let files = 0
  let checked = 0
  for (const file of routeFiles(path.join(root, 'app/api'))) {
    const source = sourceOf(file)
    const roleHelpers = new Set<string>()
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        statement.moduleSpecifier.text !== '@/middlewares/require-admin'
      )
        continue
      const imports = statement.importClause?.namedBindings
      if (imports && ts.isNamedImports(imports))
        for (const entry of imports.elements) roleHelpers.add(entry.name.text)
    }
    if (!roleHelpers.size) continue
    files++
    const counterpart = sourceOf(
      path.join(root, 'apps/services/api/src', path.relative(root, file))
    )
    for (const handler of source.statements) {
      if (
        !ts.isFunctionDeclaration(handler) ||
        !handler.name ||
        !methods.has(handler.name.text)
      )
        continue
      const request = handler.parameters[0]?.name.getText()
      for (const call of callsIn(handler, roleHelpers)) {
        checked++
        const message = `${path.relative(root, file)} ${handler.name.text}`
        expect(request, message).toBeTruthy()
        expect(call.arguments.at(-1)?.getText(), message).toBe(request)
        const apiHandler = counterpart.statements.find(
          (statement) =>
            ts.isFunctionDeclaration(statement) &&
            statement.name?.text === handler.name?.text
        )
        expect(apiHandler, message).toBeDefined()
        if (!apiHandler || !ts.isFunctionDeclaration(apiHandler))
          throw new Error(message)
        const apiCalls = callsIn(
          apiHandler,
          new Set(['resolveTenantPrincipal'])
        )
        expect(apiCalls, message).toHaveLength(1)
        expect(apiCalls[0]?.arguments[0]?.getText(), message).toBe(
          apiHandler.parameters[0]?.name.getText()
        )
        expect(apiCalls[0]?.arguments, message).toHaveLength(1)
      }
    }
  }
  expect(files).toBe(20)
  expect(checked).toBe(21)
})

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
  // As rotas do adaptador de papéis da raiz (o primeiro teste) continuam entre elas.
  expect(files).toContain(
    'apps/services/api/src/app/api/admin/categories/route.ts'
  )
  expect(files.size).toBe(EXPECTED_RESOLVING_ROUTES)
  expect(checked).toBe(EXPECTED_RESOLVER_CALLS)
})
