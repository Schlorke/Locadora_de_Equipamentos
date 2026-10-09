/**
 * Varredura estática da bateria de paridade (onda 135, B2/E25): sem a raiz (`API_LEGACY_MODE=absent`) uma comparação
 * entre hosts vira tautologia (a API comparada com ela mesma) ou quebra. Em `tests/api-host` cada host é conferido
 * contra a expectativa explícita montada da fixture; esta varredura reprova o que volta a comparar um alvo com outro:
 * - a raiz como gabarito: `toEqual(legacy…)`/`toBe(old…)` e o par desestruturado `const [legacy, …]`;
 * - a lista de hosts escrita à mão (`[context.legacy, context.api]`), em vez de `parityTargets`;
 * - `compareAcrossTargets(` fora de `targets.ts` (ele só existe para recusar a comparação com um alvo só);
 * - elemento de lista comparado com outro elemento da mesma lista (`expect(xs[1]).toEqual(xs[0])`) e o laço
 *   `for (const x of xs) expect(x).toEqual(xs[0])`;
 * - `new Set(…).size`.
 * Os três últimos são aceitos com a anotação `// parity-scan: <motivo>` na mesma linha ou até três linhas acima,
 * quando comparam chamadas reais ao mesmo host (idempotência, concorrência, consumo único).
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..', '..')
const DIRECTORY = 'tests/api-host'
const MATCHER = '(?:toEqual|toStrictEqual|toBe|toMatchObject)'
const ANNOTATION = /\/\/\s*parity-scan:\s*(.{8,})/

type Finding = { file: string; line: number; rule: string; text: string }

const STRICT_RULES: Array<[string, RegExp]> = [
  ['legacy-oracle', new RegExp(`\\.${MATCHER}\\(\\s*(?:legacy|old)\\w*\\b`)],
  ['legacy-pair', /const\s*\[\s*(?:legacy|old)\w*\s*,/],
  ['host-list', /\[\s*context\.legacy\s*,\s*context\.api\s*\]/],
  ['cross-target-compare', /\bcompareAcrossTargets\(/],
]
const ANNOTATED_RULES: Array<[string, RegExp]> = [
  [
    'indexed-pair',
    new RegExp(
      `expect\\(\\s*(\\w+)\\[\\d+\\]!?[^)]*\\)\\.${MATCHER}\\(\\s*\\1\\[\\d+\\]`
    ),
  ],
  ['set-size', /new Set\(/],
]

function annotated(lines: string[], index: number) {
  for (let back = 0; back <= 3 && index - back >= 0; back++)
    if (ANNOTATION.test(lines[index - back]!)) return true
  return false
}

/** Follow response bodies into mutable file-level captures, independently of their variable names. */
function scanResponseCaptures(file: string, text: string): Finding[] {
  if (!/\.http\.test\.ts$/.test(file)) return []
  const sourcePath = path.resolve(file).replace(/\\/g, '/')
  const source = ts.createSourceFile(
    sourcePath,
    text,
    ts.ScriptTarget.Latest,
    true
  )
  // Bind this source alone, without reading imports or libraries. Symbols keep a
  // local variable that shadows a capture from being mistaken for that capture.
  const options: ts.CompilerOptions = { noLib: true, noResolve: true }
  const host = ts.createCompilerHost(options)
  host.getSourceFile = (name) => (name === sourcePath ? source : undefined)
  host.fileExists = (name) => name === sourcePath
  host.readFile = (name) => (name === sourcePath ? text : undefined)
  const checker = ts.createProgram([sourcePath], options, host).getTypeChecker()
  const symbol = (node: ts.Identifier) => checker.getSymbolAtLocation(node)
  const nodes: ts.Node[] = []
  const visit = (node: ts.Node) => {
    nodes.push(node)
    ts.forEachChild(node, visit)
  }
  visit(source)
  const capturedBindings = new Set<ts.Symbol>()
  const responseValues = new Set<ts.Symbol>()
  const responseFunctions = new Set<ts.Symbol>()
  const oracles = new Set<ts.Symbol>()
  const bodyMethods = new Set(['json', 'text', 'arrayBuffer', 'blob'])
  for (const node of nodes) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Let) !== 0 &&
      ts.isVariableStatement(node.parent.parent) &&
      ts.isSourceFile(node.parent.parent.parent)
    ) {
      const binding = symbol(node.name)
      if (binding) capturedBindings.add(binding)
    }
  }
  const containsResponse = (node: ts.Node): boolean => {
    if (ts.isIdentifier(node)) {
      const binding = symbol(node)
      if (binding && responseValues.has(binding)) return true
    }
    if (ts.isCallExpression(node)) {
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        bodyMethods.has(node.expression.name.text) &&
        node.arguments.length === 0
      )
        return true
      if (
        ts.isIdentifier(node.expression) &&
        responseFunctions.has(symbol(node.expression)!)
      )
        return true
    }
    return ts.forEachChild(node, containsResponse) ?? false
  }
  const returnsResponse = (body: ts.ConciseBody): boolean => {
    if (!ts.isBlock(body)) return containsResponse(body)
    const returned = (node: ts.Node): boolean => {
      if (ts.isFunctionLike(node)) return false
      if (ts.isReturnStatement(node))
        return !!node.expression && containsResponse(node.expression)
      return ts.forEachChild(node, returned) ?? false
    }
    return returned(body)
  }
  const bindingNames = (name: ts.BindingName): ts.Identifier[] =>
    ts.isIdentifier(name)
      ? [name]
      : name.elements.flatMap((element) =>
          ts.isOmittedExpression(element) ? [] : bindingNames(element.name)
        )
  let changed = true
  while (changed) {
    changed = false
    const add = (set: Set<ts.Symbol>, binding: ts.Symbol | undefined) => {
      if (binding && !set.has(binding)) {
        set.add(binding)
        changed = true
      }
    }
    for (const node of nodes) {
      if (
        ts.isFunctionDeclaration(node) &&
        node.name &&
        node.body &&
        returnsResponse(node.body)
      )
        add(responseFunctions, symbol(node.name))
      if (ts.isVariableDeclaration(node) && node.initializer) {
        if (
          ts.isArrowFunction(node.initializer) ||
          ts.isFunctionExpression(node.initializer)
        ) {
          if (
            ts.isIdentifier(node.name) &&
            returnsResponse(node.initializer.body)
          )
            add(responseFunctions, symbol(node.name))
        } else if (containsResponse(node.initializer)) {
          for (const name of bindingNames(node.name)) {
            const binding = symbol(name)
            add(responseValues, binding)
            if (binding && capturedBindings.has(binding)) add(oracles, binding)
          }
        }
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left) &&
        containsResponse(node.right)
      ) {
        const binding = symbol(node.left)
        add(responseValues, binding)
        if (binding && capturedBindings.has(binding)) add(oracles, binding)
      }
    }
  }
  const findings: Finding[] = []
  const report = (node: ts.Node, rule: string) => {
    const line =
      source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
    findings.push({
      file,
      line,
      rule,
      text: text.split(/\r?\n/)[line - 1]!.trim(),
    })
  }
  const usesOracle = (node: ts.Node): boolean =>
    (ts.isIdentifier(node) && oracles.has(symbol(node)!)) ||
    (ts.forEachChild(node, usesOracle) ?? false)
  for (const node of nodes) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      /^(toEqual|toStrictEqual|toBe|toMatchObject)$/.test(
        node.expression.name.text
      ) &&
      node.arguments.some(usesOracle)
    )
      report(node, 'response-capture-oracle')
    if (
      ts.isThrowStatement(node) &&
      node.expression &&
      ts.isNewExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Error'
    ) {
      const message = node.expression.arguments?.[0]
      const prefix =
        message &&
        (ts.isStringLiteralLike(message)
          ? message.text
          : ts.isTemplateExpression(message)
            ? message.head.text
            : '')
      if (prefix?.startsWith('B2-CAPTURE:'))
        report(node, 'unfinished-http-expectation')
    }
  }
  return findings
}

/** Achados de um arquivo de `tests/api-host` (texto já lido). */
function scanParityFile(file: string, text: string): Finding[] {
  const findings: Finding[] = []
  const lines = text.split(/\r?\n/)
  const loops: Array<{ variable: string; list: string; until: number }> = []
  lines.forEach((line, index) => {
    const report = (rule: string) =>
      findings.push({ file, line: index + 1, rule, text: line.trim() })
    const loop = /for\s*\(\s*const\s+(\w+)\s+of\s+(\w+)\s*\)/.exec(line)
    if (loop)
      loops.push({ variable: loop[1]!, list: loop[2]!, until: index + 15 })
    for (const [rule, pattern] of STRICT_RULES) {
      // targets.ts é o único lugar que monta a lista de hosts e que define a recusa com um alvo só.
      if (
        (rule === 'cross-target-compare' || rule === 'host-list') &&
        file.endsWith('/targets.ts')
      )
        continue
      if (pattern.test(line)) report(rule)
    }
    for (const [rule, pattern] of ANNOTATED_RULES) {
      if (rule === 'set-size') {
        const window = lines.slice(index, index + 3).join(' ')
        if (!pattern.test(line) || !/\)\s*\.size\b|\.size\s*\)/.test(window))
          continue
      } else if (!pattern.test(line)) continue
      if (!annotated(lines, index)) report(rule)
    }
    for (const { variable, list, until } of loops) {
      if (index > until) continue
      const loopCompare = new RegExp(
        `expect\\(\\s*${variable}\\s*[,)][^;]*\\.${MATCHER}\\(\\s*${list}\\[\\d+\\]`
      )
      if (loopCompare.test(line) && !annotated(lines, index))
        report('loop-indexed')
    }
  })
  return [...findings, ...scanResponseCaptures(file, text)]
}

function scanDirectory() {
  const files = readdirSync(path.join(ROOT, DIRECTORY))
    .filter((name) => /\.(ts|mts|mjs)$/.test(name))
    .filter((name) => name !== 'global-setup.test.ts')
    .sort()
  return files.flatMap((name) =>
    scanParityFile(
      `${DIRECTORY}/${name}`,
      readFileSync(path.join(ROOT, DIRECTORY, name), 'utf8')
    )
  )
}

describe('varredura das comparações entre hosts em tests/api-host', () => {
  it('nenhum arquivo compara um host com outro (a expectativa é explícita)', () => {
    expect(scanDirectory()).toEqual([])
  })

  it.each([
    ['legacy-oracle', 'expect(service).toEqual(legacy)'],
    ['legacy-oracle', 'expect(current).toEqual(old)'],
    ['legacy-oracle', 'expect(serviceAdmin.text).toBe(legacyAdmin.text)'],
    ['legacy-oracle', 'expect(options).toEqual(legacyOptions)'],
    ['legacy-pair', 'const [legacy, service] = await Promise.all(['],
    ['host-list', 'for (const origin of [context.legacy, context.api]) {'],
    ['cross-target-compare', 'compareAcrossTargets(responses)'],
    ['indexed-pair', 'expect(results[1]).toEqual(results[0])'],
    ['indexed-pair', 'expect(replies[0]).toEqual(replies[1])'],
    ['set-size', 'expect(new Set(responses.map((r) => r.id)).size).toBe(1)'],
  ])('reprova %s: %s', (rule, line) => {
    expect(
      scanParityFile('tests/api-host/sample.http.test.ts', line).map(
        (finding) => finding.rule
      )
    ).toEqual([rule])
  })

  it('reprova o laço que compara cada resposta com a primeira', () => {
    const text = [
      'for (const response of responses)',
      '  expect(response).toEqual(responses[0])',
    ].join('\n')
    expect(
      scanParityFile('tests/api-host/sample.http.test.ts', text)
    ).toMatchObject([{ rule: 'loop-indexed', line: 2 }])
  })

  it('aceita comparação anotada entre chamadas reais ao mesmo host', () => {
    const text = [
      '// parity-scan: duas chamadas reais à API provam idempotência',
      'expect(new Set(responses.map((r) => r.id)).size).toBe(1)',
      'expect(results[1]).toEqual(results[0]) // parity-scan: mesma requisição repetida no mesmo host',
    ].join('\n')
    expect(scanParityFile('tests/api-host/sample.http.test.ts', text)).toEqual(
      []
    )
  })

  it('anotação sem motivo não vale e a raiz como gabarito não aceita anotação', () => {
    const text = [
      '// parity-scan: x',
      'expect(results[1]).toEqual(results[0])',
      '// parity-scan: a raiz ainda roda nesta rodada',
      'expect(service).toEqual(legacy)',
    ].join('\n')
    expect(
      scanParityFile('tests/api-host/sample.http.test.ts', text).map(
        (finding) => finding.rule
      )
    ).toEqual(['indexed-pair', 'legacy-oracle'])
  })

  it('expectativa explícita da fixture e ID da fixture indexado passam', () => {
    const text = [
      'for (const origin of parityTargets(context))',
      '  expect(await read(origin)).toEqual({ status: 200, body: expected })',
      'expect(detail.rental.id).toBe(rentals[0])',
      'expect(rows[0].id).toBe(context.alfa.categoryId)',
    ].join('\n')
    expect(scanParityFile('tests/api-host/sample.http.test.ts', text)).toEqual(
      []
    )
  })

  it.each(['pdfBaseline', 'recorded', 'arbitraryName'])(
    'reprova corpo de resposta capturado como oráculo com nome %s',
    (name) => {
      const text = `let ${name}: unknown
        const response = await fetch(origin)
        const bytes = Buffer.from(await response.arrayBuffer())
        if (origin === context.api) ${name} = normalize(bytes)
        else expect(normalize(bytes)).toBe(${name})`
      expect(
        scanParityFile('tests/api-host/sample.http.test.ts', text).map(
          (row) => row.rule
        )
      ).toEqual(['response-capture-oracle'])
    }
  )

  it('segue o helper HTTP e a resposta JSON até a captura', () => {
    const text = `let captured: unknown
      async function read() { return (await fetch(origin)).json() }
      captured = await read()
      expect(await read()).toEqual(captured)`
    expect(
      scanParityFile('tests/api-host/sample.http.test.ts', text)
    ).toMatchObject([{ rule: 'response-capture-oracle' }])
  })

  it('reprova também a captura mutável que começou com um valor vazio', () => {
    const text = `let captured = ''
      captured = await response.text()
      expect(await anotherResponse.text()).toBe(captured)`
    expect(
      scanParityFile('tests/api-host/sample.http.test.ts', text)
    ).toMatchObject([{ rule: 'response-capture-oracle' }])
  })

  it('distingue a fixture devolvida por um helper e uma variável local com o mesmo nome da captura', () => {
    const text = `let expected: unknown
      async function readAndCheck() {
        expect(await response.json()).toEqual({ total: 50 })
        return { total: 50 }
      }
      expected = await readAndCheck()
      expect(await response.json()).toEqual(expected)
      function sameTarget() {
        let expected: unknown
        expected = response.text()
        expect(response.text()).toEqual(expected)
      }`
    expect(scanParityFile('tests/api-host/sample.http.test.ts', text)).toEqual(
      []
    )
  })

  it('permite expectativas de fixture, snapshot de DB e comparação de transporte no mesmo alvo', () => {
    const text = `let before: unknown
      before = await prisma.payment.findMany()
      expect(await prisma.payment.findMany()).toEqual(before)
      const visualBaseline = readFileSync('approved.pdf')
      expect(bytes).toEqual(visualBaseline)
      const proxied = await (await fetch(proxy)).arrayBuffer()
      const direct = await (await fetch(target)).arrayBuffer()
      expect(normalize(proxied)).toEqual(normalize(direct))
      let expected: unknown
      expected = { total: 50 }
      expect(await response.json()).toEqual(expected)`
    expect(scanParityFile('tests/api-host/sample.http.test.ts', text)).toEqual(
      []
    )
  })

  it('bloqueia placeholders de captura somente em testes HTTP, sem confundir comentário ou mensagem literal', () => {
    const text =
      'function expected() { throw new Error(`B2-CAPTURE: pending ${name}`) }'
    expect(
      scanParityFile('tests/api-host/sample.http.test.ts', text)
    ).toMatchObject([{ rule: 'unfinished-http-expectation' }])
    expect(scanParityFile('tests/visual/sample.test.ts', text)).toEqual([])
    expect(
      scanParityFile(
        'tests/api-host/sample.http.test.ts',
        '// throw new Error("B2-CAPTURE: comment")\nconst label = "B2-CAPTURE: documentation"'
      )
    ).toEqual([])
  })

  it('preserva baselines de comparação visual fora da bateria HTTP', () => {
    const text = `let approved = ''
      approved = await page.content()
      expect(await page.content()).toBe(approved)`
    expect(scanParityFile('tests/visual/pdf.visual.test.ts', text)).toEqual([])
  })
})
