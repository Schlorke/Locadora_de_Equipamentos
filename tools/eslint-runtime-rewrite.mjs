// Regra de projeto "o código de servidor não reescreve o runtime" (achado 123, lote travas-final).
//
// Por quê: o inventário de rotas (tests/security/route-auth-inventory.test.ts) aceita antes do guard só código
// INERT, que usa classes e métodos nativos (URL, Headers.prototype.get, Array.prototype.map, `instanceof
// CatalogError`…). Ele prova o que cada rota faz, mas não enxerga código que, em outro arquivo carregado pelo
// mesmo processo, dê a uma dessas classes um Symbol.hasInstance ou troque um método nativo por um VALOR
// (`Object.getPrototypeOf(RangeError)`, `new CatalogError().constructor`), sem nomear a classe. Em vez de
// perseguir cada caminho de valor no inventário, esta regra proíbe no código de servidor as primitivas com que se
// reescreve o runtime. Gramática fechada: cada forma abaixo reprova onde quer que apareça.
//
//   reflexão        Reflect (qualquer uso); Object.defineProperty/defineProperties/setPrototypeOf/getPrototypeOf/
//                   getOwnPropertyDescriptor(s)/getOwnPropertySymbols; __proto__, __defineGetter__,
//                   __defineSetter__, __lookupGetter__, __lookupSetter__; `.constructor`; `X.prototype` fora de
//                   `X.prototype.m.call|apply|bind(…)`.
//   escrita         atribuição, `++`/`--`, `delete`, desestruturação e for-in/of cujo alvo é um global do servidor
//                   (`URL = …`, `globalThis.x = …`, `Response.json = …`, `console.warn = …`), um membro de import
//                   (`Imported.x = …`), um módulo carregado (`require('fs').x = …`) ou uma cadeia que passa por
//                   prototype/constructor/__proto__; Object.assign com um alvo desses (variável do arquivo, `this`,
//                   literal novo e resultado de chamada passam).
//   símbolos        Symbol.hasInstance, toPrimitive, species, isConcatSpreadable, match, matchAll, replace, search,
//                   split, toStringTag e unscopables (mudam instanceof, coerção e os métodos nativos que os leem).
//   código dinâmico eval, Function, import()/require() com argumento não literal, require como valor, node:vm,
//                   createRequire, module.require, process.getBuiltinModule/binding/_linkedBinding/dlopen/
//                   mainModule e setTimeout/setInterval com texto.
//   globais         um global do servidor que é objeto ou função (Object, Array, URL, Response, globalThis…) só é
//                   chamado, construído, lido por membro estático, estendido ou usado em instanceof, in e typeof:
//                   nunca entregue como valor (`const O = Object`, `patch(Array)`, `{ URL }`) nem lido por chave
//                   calculada (`globalThis[k]`). Boolean, Number e String passam como callback de filter/map/….
//
// Os globais só do navegador (window, self, document, history, location) não existem no processo do servidor:
// escrever por eles não reescreve o runtime do servidor. Na leitura, `window.Object` continua sendo Object.
// Exceções: só as de EXCEPTIONS (arquivo, forma exata e motivo). A regra não aceita opções, então a configuração
// não alarga a lista; uma exceção que deixou de ser usada reprova (a lista só encolhe).
// O inventário confere que a regra está ligada em todo o código de servidor e que nenhum comentário a desliga.
// Modelo de ameaça: docs/architecture/security.md ("Inventário de rotas: modelo de ameaça em camadas").
// Testes: tests/unit/eslint-runtime-rewrite.test.ts.
import globals from 'globals'
import path from 'node:path'

export const PLUGIN_NAME = 'runtime'
export const RULE_NAME = 'no-runtime-rewrite'
export const RULE_ID = `${PLUGIN_NAME}/${RULE_NAME}`

// As extensões que eslint.config.js já lê (o .d.mts do host web é só declaração).
const SCRIPT = '{ts,tsx,js,jsx,mjs,cjs}'

/**
 * O código que o processo do servidor carrega: rotas da API, domínio, backend, contratos, o host web
 * inteiro e o front compartilhado que renderiza no servidor. A autoverificação do inventário compara esta
 * cobertura com serverSource(): o que ele considera servidor e fica fora daqui precisa de motivo lá.
 */
export const SERVER_FILES = Object.freeze([
  `packages/backend/**/*.${SCRIPT}`,
  `packages/contracts/**/*.${SCRIPT}`,
  `packages/domain/**/*.${SCRIPT}`,
  `packages/frontend/**/*.${SCRIPT}`,
  `packages/ui/**/*.${SCRIPT}`,
  `packages/design-tokens/**/*.${SCRIPT}`,
  `apps/clients/web/**/*.${SCRIPT}`,
  `apps/services/**/*.${SCRIPT}`,
  `types/**/*.${SCRIPT}`,
])

/** Testes, histórias e variantes nativas não rodam no processo do servidor (o mesmo recorte de serverSource()). */
export const SERVER_IGNORES = Object.freeze([
  `**/*.{test,spec,stories}.${SCRIPT}`,
  `**/*.native.${SCRIPT}`,
  '**/__tests__/**',
  '**/tests/**',
  '**/test/**',
  '**/e2e/**',
])

/**
 * Lista fechada de exceções: arquivo (relativo à raiz), a forma exata que a regra relata e o motivo. Nada mais
 * passa; uma entrada cuja forma sumiu do arquivo reprova.
 */
export const EXCEPTIONS = Object.freeze(
  [
    {
      file: 'packages/backend/src/runtime/database.ts',
      form: 'escreve global.__pool',
      reason:
        'Singleton do pool pg entre recargas do Next (padrão documentado do Prisma): nome próprio do projeto, que não sombreia membro do runtime.',
    },
    {
      file: 'packages/backend/src/runtime/database.ts',
      form: 'escreve global.__prisma',
      reason:
        'Singleton do PrismaClient entre recargas do Next (padrão documentado do Prisma): nome próprio do projeto, que não sombreia membro do runtime.',
    },
    {
      file: 'packages/backend/src/modules/billing/asaas-http.ts',
      form: 'Symbol.toPrimitive',
      reason:
        'AsaasSecretValue se redige na coerção (devolve só o marcador REDACTED): definido na própria classe, que não é nativa nem de INERT_CLASSES.',
    },
    ...[
      'escreve console.warn',
      'escreve console.error',
      'escreve console.log',
      'entrega o global console como valor',
    ].map((form) => ({
      file: 'packages/frontend/src/app/providers/ClientLayoutShell.web.tsx',
      form,
      reason:
        'Componente "use client" que, só no navegador (typeof window), filtra avisos do three.js e do zustand no console e o restaura na limpeza; não roda no processo do servidor.',
    })),
  ].map((entry) => Object.freeze(entry))
)

/** O objeto global, por qualquer nome: `globalThis.X` e `window.X` são o global X. */
const GLOBAL_OBJECTS = new Set(['globalThis', 'global', 'self', 'window'])
/** Os nomes do objeto global que só o navegador tem: escrever por eles não alcança o processo do servidor. */
const BROWSER_GLOBAL_OBJECTS = new Set(['self', 'window'])
/** Globais com valor primitivo: lê-los não entrega objeto nenhum. */
const PRIMITIVE_GLOBALS = new Set([
  'undefined',
  'NaN',
  'Infinity',
  '__dirname',
  '__filename',
])
/** Os globais do processo do servidor (ES, Node e os comuns a Node e navegador), objetos ou funções. */
export const SERVER_GLOBALS = new Set(
  [
    ...Object.keys(globals.builtin),
    ...Object.keys(globals.node),
    ...Object.keys(globals['shared-node-browser']),
    'globalThis',
    'global',
  ].filter((name) => !PRIMITIVE_GLOBALS.has(name))
)
/** Globais só do navegador: não existem no processo do servidor. */
const BROWSER_GLOBALS = new Set(
  [
    ...Object.keys(globals.browser),
    ...Object.keys(globals.serviceworker),
    'window',
    'self',
  ].filter((name) => !SERVER_GLOBALS.has(name))
)
/** Os wrappers do CommonJS são do próprio arquivo: `module.exports = …` não escreve no runtime. */
const COMMONJS_LOCALS = new Set(['module', 'exports'])
/** Funções globais que passam como callback de iteração (`.filter(Boolean)`, `.map(Number)`, `.forEach(clearTimeout)`). */
const CALLBACK_GLOBALS = new Set([
  'Boolean',
  'Number',
  'String',
  'clearTimeout',
  'clearInterval',
])
const CALLBACK_METHODS = new Set([
  'every',
  'filter',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'flatMap',
  'forEach',
  'map',
  'reduce',
  'some',
  'sort',
  'transform',
])

const FORBIDDEN_OBJECT_MEMBERS = new Set([
  'defineProperty',
  'defineProperties',
  'setPrototypeOf',
  'getPrototypeOf',
  'getOwnPropertyDescriptor',
  'getOwnPropertyDescriptors',
  'getOwnPropertySymbols',
])
const LEGACY_ACCESSORS = new Set([
  '__proto__',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
])
/** Chaves que, numa cadeia escrita, alcançam a classe ou o protótipo de outro objeto. */
const SHARED_KEYS = new Set(['prototype', 'constructor', '__proto__'])
export const FORBIDDEN_SYMBOLS = new Set([
  'hasInstance',
  'toPrimitive',
  'species',
  'isConcatSpreadable',
  'match',
  'matchAll',
  'replace',
  'search',
  'split',
  'toStringTag',
  'unscopables',
])
const DYNAMIC_CODE = new Set(['eval', 'Function', 'Reflect'])
const PROTOTYPE_CALLS = new Set(['call', 'apply', 'bind'])
const DYNAMIC_MODULES = new Set(['vm', 'node:vm'])
const REQUIRE_MODULES = new Set(['module', 'node:module'])
const STRING_TIMERS = new Set(['setTimeout', 'setInterval'])
/** Membros de process que carregam módulos nativos ou código fora de import/require literais. */
const PROCESS_LOADERS = new Set([
  'getBuiltinModule',
  'binding',
  '_linkedBinding',
  'dlopen',
  'mainModule',
])

const WRAPPERS = new Set([
  'TSAsExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
  'ChainExpression',
])
const unwrap = (node) => {
  while (node && WRAPPERS.has(node.type)) node = node.expression
  return node
}
/** O nó mais externo que só envolve `node` (casts, `!`, `?.`). */
const outer = (node) => {
  while (
    node.parent &&
    WRAPPERS.has(node.parent.type) &&
    node.parent.expression === node
  )
    node = node.parent
  return node
}
/** A chave estática de um membro (`a.b`, `a['b']`, `a[0]`, `` a[`b`] ``, `this.#b`), ou undefined quando é calculada. */
function memberKey(member) {
  if (member?.type !== 'MemberExpression') return undefined
  if (!member.computed)
    return member.property.type === 'PrivateIdentifier'
      ? `#${member.property.name}`
      : member.property.name
  const key = unwrap(member.property)
  if (
    key.type === 'Literal' &&
    (typeof key.value === 'string' || typeof key.value === 'number')
  )
    return String(key.value)
  if (key.type === 'TemplateLiteral' && key.expressions.length === 0)
    return key.quasis[0].value.cooked
  return undefined
}
const literalText = (node) => {
  const value = unwrap(node)
  if (value?.type === 'Literal' && typeof value.value === 'string')
    return value.value
  if (value?.type === 'TemplateLiteral' && value.expressions.length === 0)
    return value.quasis[0].value.cooked
  return undefined
}
const isText = (node) => {
  const value = unwrap(node)
  return (
    (value?.type === 'Literal' && typeof value.value === 'string') ||
    value?.type === 'TemplateLiteral'
  )
}
/** Posições de tipo (`typeof URL` num tipo, `declare`): não rodam. */
const TYPE_CONTEXTS = new Set([
  'TSTypeAnnotation',
  'TSTypeQuery',
  'TSTypeReference',
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSTypeParameterInstantiation',
  'TSTypeParameterDeclaration',
  'TSQualifiedName',
  'TSImportType',
  'TSDeclareFunction',
  'TSExternalModuleReference',
])
function inType(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (TYPE_CONTEXTS.has(current.type)) return true
    if (
      (current.type === 'TSModuleDeclaration' ||
        current.type === 'VariableDeclaration') &&
      current.declare
    )
      return true
    if (current.type === 'Program') return false
  }
  return false
}
/** `node` é o alvo de uma escrita (atribuição, `++`/`--`, `delete`). */
function assigned(node) {
  const place = outer(node)
  const parent = place.parent
  return (
    (parent.type === 'AssignmentExpression' && parent.left === place) ||
    (parent.type === 'UpdateExpression' && parent.argument === place) ||
    (parent.type === 'UnaryExpression' && parent.operator === 'delete')
  )
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'O código de servidor não reescreve o runtime: sem reflexão, escrita em global, import ou protótipo, símbolos que mudam a linguagem ou código dinâmico.',
    },
    schema: [],
    messages: {
      forbidden:
        '{{form}}: o código de servidor não reescreve o runtime (tools/eslint-runtime-rewrite.mjs).',
      staleException:
        'A exceção "{{form}}" de tools/eslint-runtime-rewrite.mjs não é mais usada neste arquivo: remova-a da lista.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode
    const file = path
      .relative(context.cwd, context.filename)
      .split(path.sep)
      .join('/')
    const exceptions = EXCEPTIONS.filter((entry) => entry.file === file)
    const used = new Set()
    const references = new Map()
    const reported = new Set()

    const report = (node, form) => {
      const key = `${node.range[0]}:${form}`
      if (reported.has(key)) return
      reported.add(key)
      const exception = exceptions.find((entry) => entry.form === form)
      if (exception) {
        used.add(exception)
        return
      }
      context.report({ node, messageId: 'forbidden', data: { form } })
    }
    const text = (node) => sourceCode.getText(node).replace(/\s+/g, '')

    /** A variável de um identificador de valor: `null` quando não resolve (global implícito), undefined quando não é referência. */
    const variableOf = (identifier) => {
      const reference = references.get(identifier)
      return reference ? (reference.resolved ?? null) : undefined
    }
    /** O nome do global que `node` denota (`URL`, `globalThis.URL`, `window.location`, `global.__prisma`), ou undefined. */
    const globalName = (node) => {
      node = unwrap(node)
      if (node?.type === 'Identifier') {
        if (COMMONJS_LOCALS.has(node.name) || PRIMITIVE_GLOBALS.has(node.name))
          return undefined
        const variable = variableOf(node)
        if (variable === undefined) return undefined
        return variable === null || variable.scope.type === 'global'
          ? node.name
          : undefined
      }
      if (node?.type === 'MemberExpression') {
        const base = globalName(node.object)
        const key = memberKey(node)
        if (base !== undefined && GLOBAL_OBJECTS.has(base) && key !== undefined)
          return key
      }
      return undefined
    }
    /** Um global que existe (ou pode existir) no processo do servidor: tudo menos os só do navegador. */
    const serverGlobal = (name) =>
      name !== undefined && !BROWSER_GLOBALS.has(name)
    const isImport = (node) => {
      const variable =
        node?.type === 'Identifier' ? variableOf(node) : undefined
      return (
        !!variable &&
        variable.defs.some((definition) => definition.type === 'ImportBinding')
      )
    }

    /**
     * Se escrever em `target` (ou, com `members`, nos seus membros) muda o que não é do arquivo: um global do
     * servidor, um import, um módulo carregado ou uma cadeia por prototype/constructor/__proto__. Variável ou
     * parâmetro do arquivo, `this`, literal novo e resultado de chamada são do arquivo (os globais e a reflexão que
     * poderiam produzi-los já reprovam onde aparecem).
     */
    const targetProblem = (target, members) => {
      const node = unwrap(target)
      if (!node) return true
      switch (node.type) {
        case 'MemberExpression': {
          const key = memberKey(node)
          if (key !== undefined && SHARED_KEYS.has(key)) return true
          // `window.x = …` e `self.x = …` só rodam no navegador: no servidor window e self não existem.
          if (BROWSER_GLOBAL_OBJECTS.has(globalName(node.object) ?? ''))
            return false
          const name = globalName(node)
          if (name !== undefined && serverGlobal(name)) return true
          return targetProblem(node.object, true)
        }
        case 'Identifier':
          if (COMMONJS_LOCALS.has(node.name)) return false
          return serverGlobal(globalName(node)) || isImport(node)
        case 'ThisExpression':
        case 'Super':
          return false
        case 'ObjectExpression':
        case 'ArrayExpression':
          return false
        case 'ConditionalExpression':
          return (
            targetProblem(node.consequent, members) ||
            targetProblem(node.alternate, members)
          )
        case 'LogicalExpression':
          return (
            targetProblem(node.left, members) ||
            targetProblem(node.right, members)
          )
        case 'SequenceExpression':
          return targetProblem(node.expressions.at(-1), members)
        case 'AssignmentExpression':
          return targetProblem(node.right, members)
        case 'AwaitExpression':
          return targetProblem(node.argument, members)
        case 'ImportExpression':
          return true
        case 'CallExpression':
          return (
            unwrap(node.callee)?.type === 'Identifier' &&
            globalName(node.callee) === 'require'
          )
        default:
          return false
      }
    }

    const checkWrite = (target) => {
      const node = unwrap(target)
      if (!node) return
      if (node.type === 'Identifier') {
        const name = globalName(node)
        if (serverGlobal(name)) report(node, `reescreve o global ${name}`)
        return
      }
      if (node.type === 'MemberExpression') {
        if (targetProblem(node, true)) report(node, `escreve ${text(node)}`)
        return
      }
      if (node.type === 'ObjectPattern')
        for (const property of node.properties)
          checkWrite(
            property.type === 'RestElement' ? property.argument : property.value
          )
      else if (node.type === 'ArrayPattern')
        for (const element of node.elements) element && checkWrite(element)
      else if (node.type === 'AssignmentPattern') checkWrite(node.left)
      else if (node.type === 'RestElement') checkWrite(node.argument)
    }

    /** O uso de um global do servidor: só chamado, construído, lido por membro, estendido, instanceof/in/typeof. */
    const checkGlobalUse = (node, name) => {
      const place = outer(node)
      const parent = place.parent
      // eval, Function e Reflect reprovam em qualquer uso (o membro lido, `Reflect.set`, é relatado no membro).
      if (DYNAMIC_CODE.has(name))
        return parent.type === 'MemberExpression' && parent.object === place
          ? undefined
          : report(node, name)
      if (name === 'require') {
        if (parent.type === 'CallExpression' && parent.callee === place) {
          const specifier =
            parent.arguments.length === 1
              ? literalText(parent.arguments[0])
              : undefined
          if (specifier === undefined)
            return report(parent, 'require() com argumento não literal')
          if (DYNAMIC_MODULES.has(specifier) || REQUIRE_MODULES.has(specifier))
            return report(parent, `require('${specifier}')`)
          return undefined
        }
        if (
          parent.type === 'MemberExpression' &&
          parent.object === place &&
          memberKey(parent) === 'resolve'
        )
          return undefined
        return report(node, 'require como valor')
      }
      if (
        (parent.type === 'CallExpression' || parent.type === 'NewExpression') &&
        parent.callee === place
      ) {
        if (
          STRING_TIMERS.has(name) &&
          parent.arguments.length > 0 &&
          isText(parent.arguments[0])
        )
          report(parent, `${name} com texto`)
        return undefined
      }
      if (parent.type === 'MemberExpression' && parent.object === place)
        return undefined
      if (
        parent.type === 'BinaryExpression' &&
        parent.right === place &&
        (parent.operator === 'instanceof' || parent.operator === 'in')
      )
        return undefined
      if (parent.type === 'UnaryExpression' && parent.operator === 'typeof')
        return undefined
      if (
        (parent.type === 'ClassDeclaration' ||
          parent.type === 'ClassExpression') &&
        parent.superClass === place
      )
        return undefined
      if (
        CALLBACK_GLOBALS.has(name) &&
        parent.type === 'CallExpression' &&
        parent.arguments.length === 1 &&
        parent.arguments[0] === place &&
        CALLBACK_METHODS.has(memberKey(unwrap(parent.callee)) ?? '')
      )
        return undefined
      if (!SERVER_GLOBALS.has(name)) return undefined
      return report(node, `entrega o global ${name} como valor`)
    }

    return {
      Program() {
        for (const scope of sourceCode.scopeManager.scopes)
          for (const reference of scope.references)
            if (reference.isValueReference !== false)
              references.set(reference.identifier, reference)
      },
      'Program:exit'(node) {
        for (const exception of exceptions)
          if (!used.has(exception))
            context.report({
              node,
              messageId: 'staleException',
              data: { form: exception.form },
            })
      },
      Identifier(node) {
        if (
          !references.has(node) ||
          inType(node) ||
          references.get(node).isWrite()
        )
          return
        const name = globalName(node)
        if (name !== undefined) checkGlobalUse(node, name)
      },
      MemberExpression(node) {
        const key = memberKey(node)
        const base = globalName(node.object)
        if (key === undefined) {
          if (serverGlobal(base)) report(node, `lê membro calculado de ${base}`)
          return
        }
        if (LEGACY_ACCESSORS.has(key)) return report(node, key)
        if (key === 'constructor') return report(node, '.constructor')
        if (base !== undefined && GLOBAL_OBJECTS.has(base)) {
          // globalThis.X é o global X: as mesmas regras de uso valem para ele (a leitura de um membro dele é
          // tratada no membro de fora).
          const place = outer(node)
          const read =
            place.parent.type === 'MemberExpression' &&
            place.parent.object === place
          if (!read && !assigned(node)) checkGlobalUse(node, key)
          return
        }
        if (DYNAMIC_CODE.has(base)) return report(node, `${base}.${key}`)
        if (base === 'process' && PROCESS_LOADERS.has(key))
          return report(node, `process.${key}`)
        if (
          key === 'require' &&
          unwrap(node.object)?.type === 'Identifier' &&
          unwrap(node.object).name === 'module'
        )
          return report(node, 'module.require')
        if (base === 'Object' && FORBIDDEN_OBJECT_MEMBERS.has(key))
          return report(node, `Object.${key}`)
        if (base === 'Symbol' && FORBIDDEN_SYMBOLS.has(key))
          return report(node, `Symbol.${key}`)
        if (base === 'Object' && key === 'assign') {
          const place = outer(node)
          const call = place.parent
          if (call.type !== 'CallExpression' || call.callee !== place)
            return report(node, 'Object.assign como valor')
          const [target] = call.arguments
          if (
            !target ||
            target.type === 'SpreadElement' ||
            targetProblem(target, false)
          )
            report(
              call,
              `Object.assign sobre ${target ? text(target) : 'nada'}`
            )
          return
        }
        if (key === 'prototype' && !assigned(node)) {
          // Só `X.prototype.m.call|apply|bind(…)`: o protótipo nunca vira valor.
          const place = outer(node)
          const method = place.parent
          const binder =
            method.type === 'MemberExpression' && method.object === place
              ? outer(method).parent
              : undefined
          const call =
            binder?.type === 'MemberExpression' &&
            binder.object === outer(method)
              ? outer(binder).parent
              : undefined
          const ok =
            memberKey(method) !== undefined &&
            PROTOTYPE_CALLS.has(memberKey(binder) ?? '') &&
            call?.type === 'CallExpression' &&
            call.callee === outer(binder) &&
            !assigned(method)
          if (!ok) report(node, `lê ${text(node)} como valor`)
        }
      },
      Property(node) {
        if (node.parent.type !== 'ObjectExpression') return
        const key = node.computed
          ? literalText(node.key)
          : node.key.type === 'Identifier'
            ? node.key.name
            : literalText(node.key)
        if (key === '__proto__') report(node, '__proto__')
      },
      AssignmentExpression(node) {
        checkWrite(node.left)
      },
      UpdateExpression(node) {
        checkWrite(node.argument)
      },
      UnaryExpression(node) {
        if (node.operator === 'delete') checkWrite(node.argument)
      },
      'ForInStatement, ForOfStatement'(node) {
        if (node.left.type !== 'VariableDeclaration') checkWrite(node.left)
      },
      ImportExpression(node) {
        const specifier = literalText(node.source)
        if (specifier === undefined)
          report(node, 'import() com argumento não literal')
        else if (
          DYNAMIC_MODULES.has(specifier) ||
          REQUIRE_MODULES.has(specifier)
        )
          report(node, `import('${specifier}')`)
      },
      ImportDeclaration(node) {
        const specifier = node.source.value
        if (node.importKind === 'type') return
        if (DYNAMIC_MODULES.has(specifier)) report(node, `importa ${specifier}`)
        else if (REQUIRE_MODULES.has(specifier))
          for (const item of node.specifiers)
            if (
              item.type !== 'ImportSpecifier' ||
              (item.imported.name ?? item.imported.value) === 'createRequire'
            )
              report(item, `importa createRequire de ${specifier}`)
      },
    }
  },
}

const plugin = Object.freeze({
  meta: { name: 'gb-locacoes-runtime' },
  rules: { [RULE_NAME]: rule },
})
export default plugin
