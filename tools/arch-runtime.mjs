import fs from 'node:fs'
import path from 'node:path'
import { builtinModules } from 'node:module'
import ts from 'typescript'

const EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]
// The former root .next was retired in F; host build directories with the same name remain outside source graphs.
const SKIP = new Set([
  'node_modules',
  '.git',
  '.next',
  '.expo',
  '.turbo',
  'dist',
  'dist-export',
  'build',
  'coverage',
  'out',
  'android',
  'ios',
])
const NODE = new Set(builtinModules.flatMap((name) => [name, 'node:' + name]))
// The web platform of apps/clients/web and explicitly configured historical web-host fixtures.
const WEB_PLATFORM_MODULES = [
  /^react-dom(?:\/|$)/,
  /^next(?:\/|$)/,
  /^next-auth\/react$/,
]
// Product UI libraries that need a browser (DOM, CSS, pointer events, WebGL canvas). The list is the set of
// web-only packages in the inventory made before the former root app/ and lib/ were retired in F; the current
// gate still rejects these browser dependencies from universal/native graphs. The native client has its own equivalents
// (lucide-react-native, react-native-svg); cmdk is listed because the design system catalogs it for the web.
export const WEB_UI_MODULES = [
  /^lucide-react(?:\/|$)/,
  /^framer-motion(?:\/|$)/,
  /^motion(?:\/|$)/,
  /^sonner(?:\/|$)/,
  /^@radix-ui\//,
  /^@base-ui\//,
  /^react-day-picker(?:\/|$)/,
  /^recharts(?:\/|$)/,
  /^react-resizable-panels(?:\/|$)/,
  /^vaul(?:\/|$)/,
  /^input-otp(?:\/|$)/,
  /^embla-carousel(?:-[a-z-]+)?(?:\/|$)/,
  /^@dnd-kit\//,
  /^next-themes(?:\/|$)/,
  /^three(?:\/|$)/,
  /^@react-three\//,
  /^cmdk(?:\/|$)/,
  /^gsap(?:\/|$)/,
  /^lenis(?:\/|$)/,
]
// DOM utilities that are not UI: DOMPurify needs a DOM (a browser or jsdom on a Node server), never React Native.
const DOM_UTILITY_MODULES = [/^(?:isomorphic-)?dompurify(?:\/|$)/]
// Packages that cannot run in React Native: reaching one from the native graph is a hard NATIVE-DOM-PACKAGE.
const DOM_MODULES = [
  ...WEB_PLATFORM_MODULES,
  ...WEB_UI_MODULES,
  ...DOM_UTILITY_MODULES,
]
// Libraries that only render or run on the web. An unsuffixed (universal) file that imports one at runtime
// cannot join the native graph, so it must become a .web variant behind the shared contract. tailwind-merge runs
// anywhere but only merges web class names, so it is web-only for universal code without being a DOM package.
export const UNIVERSAL_WEB_MODULES = [...DOM_MODULES, /^tailwind-merge(?:\/|$)/]
// Compatibility for an explicitly configured legacy web host (arch.config.json legacyRoots): the web platform and DOM
// utilities are allowed there; the product UI libraries are not, because product UI belongs to packages/frontend
// behind a pages entry point.
export const LEGACY_UI_MODULES = [...WEB_UI_MODULES, /^tailwind-merge(?:\/|$)/]
const SERVER_MODULES = [
  /^server-only$/,
  /^@prisma\/client(?:\/|$)/,
  /^prisma(?:\/|$)/,
  /^next\/(?:headers|server|cache)$/,
]
const BROWSER_GLOBALS = new Set([
  'window',
  'document',
  'alert',
  'confirm',
  'prompt',
  'localStorage',
  'sessionStorage',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLDivElement',
  'MutationObserver',
  'IntersectionObserver',
  'ResizeObserver',
])
const ASSET =
  /\.(?:css|scss|sass|less|svg|png|jpg|jpeg|gif|webp|avif|ico|json|glb|gltf|woff2?|ttf|mp3|mp4)$/i
const posix = (value) => value.split(path.sep).join('/')
const inside = (dir, file) => {
  const relative = path.relative(dir, file)
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  )
}
const testFile = (file) =>
  /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) ||
  file.split(path.sep).includes('__tests__')
const platformFile = (file) =>
  /\.web\.[cm]?[jt]sx?$/.test(file)
    ? 'web'
    : /\.(?:native|ios|android)\.[cm]?[jt]sx?$/.test(file)
      ? 'native'
      : 'universal'
const packageName = (spec) =>
  spec.startsWith('@')
    ? spec.split('/').slice(0, 2).join('/')
    : spec.split('/')[0]

export function sourceFacts(source, file = 'source.tsx') {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const imports = [],
    dom = [],
    env = [],
    dynamic = [],
    secretAccess = []
  const directives = new Set()
  for (const statement of ast.statements) {
    if (
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression)
    )
      directives.add(statement.expression.text)
    else break
  }

  const bindings = new Map()
  const isScope = (node) =>
    ts.isSourceFile(node) ||
    ts.isFunctionLike(node) ||
    ts.isBlock(node) ||
    ts.isModuleBlock(node) ||
    ts.isCatchClause(node) ||
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node)
  const nearestScope = (node, functionOnly = false) => {
    for (let current = node; current; current = current.parent) {
      if (
        functionOnly
          ? ts.isSourceFile(current) || ts.isFunctionLike(current)
          : isScope(current)
      )
        return current
    }
    return ast
  }
  const bind = (scope, name) => {
    if (!name) return
    if (ts.isIdentifier(name)) {
      if (!bindings.has(scope)) bindings.set(scope, new Set())
      bindings.get(scope).add(name.text)
    } else if (
      ts.isObjectBindingPattern(name) ||
      ts.isArrayBindingPattern(name)
    ) {
      for (const element of name.elements)
        if (ts.isBindingElement(element)) bind(scope, element.name)
    }
  }
  const collectBindings = (node) => {
    if (ts.isParameter(node)) bind(nearestScope(node.parent, true), node.name)
    else if (ts.isVariableDeclaration(node)) {
      const list = node.parent
      bind(
        nearestScope(
          node.parent,
          ts.isVariableDeclarationList(list) &&
            !(list.flags & ts.NodeFlags.BlockScoped)
        ),
        node.name
      )
    } else if (ts.isImportClause(node)) bind(ast, node.name)
    else if (ts.isImportSpecifier(node)) bind(ast, node.name)
    else if (ts.isNamespaceImport(node)) bind(ast, node.name)
    else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node))
      bind(nearestScope(node.parent), node.name)
    else if (ts.isFunctionExpression(node) || ts.isClassExpression(node))
      bind(node, node.name)
    ts.forEachChild(node, collectBindings)
  }
  collectBindings(ast)
  const isBound = (node, name) => {
    for (let current = node.parent; current; current = current.parent)
      if (bindings.get(current)?.has(name)) return true
    return false
  }
  const inType = (node) => {
    for (let current = node.parent; current; current = current.parent) {
      if (ts.isTypeNode(current)) return true
      if (ts.isExpressionStatement(current) || ts.isStatement(current))
        return false
    }
    return false
  }

  const line = (node) =>
    ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1
  const addImport = (literal, node, typeOnly = false) => {
    imports.push({ spec: literal.text, line: line(node), typeOnly })
  }
  const visit = (node) => {
    if (
      (ts.isPropertyAccessExpression(node) &&
        node.name.text === 'integrationSecret') ||
      (ts.isElementAccessExpression(node) &&
        ts.isStringLiteral(node.argumentExpression) &&
        node.argumentExpression.text === 'integrationSecret') ||
      (ts.isBindingElement(node) &&
        (node.propertyName || node.name).getText(ast).replace(/["']/g, '') ===
          'integrationSecret')
    )
      secretAccess.push({
        line: line(node),
        reason: 'integrationSecret access belongs to modules/secrets',
      })
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)) &&
      /\b(?:SELECT|INSERT|UPDATE|DELETE|TRUNCATE|WITH)\b[\s\S]*\bintegration_secrets\b/i.test(
        node.text
      )
    )
      secretAccess.push({
        line: line(node),
        reason: 'integration_secrets SQL belongs to modules/secrets',
      })
    if (
      ts.isTemplateExpression(node) &&
      /\b(?:SELECT|INSERT|UPDATE|DELETE|TRUNCATE|WITH)\b[\s\S]*\bintegration_secrets\b/i.test(
        [
          node.head.text,
          ...node.templateSpans.map((span) => span.literal.text),
        ].join(' ')
      )
    )
      secretAccess.push({
        line: line(node),
        reason: 'integration_secrets SQL belongs to modules/secrets',
      })
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const named = node.importClause?.namedBindings
      const allNamedTypes =
        named &&
        ts.isNamedImports(named) &&
        named.elements.length > 0 &&
        named.elements.every((element) => element.isTypeOnly)
      addImport(
        node.moduleSpecifier,
        node,
        Boolean(
          node.importClause?.isTypeOnly ||
          (!node.importClause?.name && allNamedTypes)
        )
      )
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const allNamedTypes =
        node.exportClause &&
        ts.isNamedExports(node.exportClause) &&
        node.exportClause.elements.length > 0 &&
        node.exportClause.elements.every((element) => element.isTypeOnly)
      addImport(
        node.moduleSpecifier,
        node,
        Boolean(node.isTypeOnly || allNamedTypes)
      )
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      addImport(node.moduleReference.expression, node, node.isTypeOnly)
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require'))
    ) {
      const argument = node.arguments[0]
      if (
        argument &&
        (ts.isStringLiteral(argument) ||
          ts.isNoSubstitutionTemplateLiteral(argument))
      )
        addImport(argument, node)
      else dynamic.push({ line: line(node), code: node.getText(ast) })
    }
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      /^[a-z]/.test(node.tagName.text)
    ) {
      const position = ast.getLineAndCharacterOfPosition(node.getStart(ast))
      const className = node.attributes.properties.some(
        (attribute) =>
          ts.isJsxAttribute(attribute) &&
          ts.isIdentifier(attribute.name) &&
          attribute.name.text === 'className'
      )
      dom.push({
        line: line(node),
        column: position.character + 1,
        reason: 'intrinsic JSX <' + node.tagName.text + '>',
        intrinsic: node.tagName.text,
        className,
      })
    }
    if (ts.isIdentifier(node) && BROWSER_GLOBALS.has(node.text)) {
      const parent = node.parent
      const nameOnly =
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isPropertyAssignment(parent) && parent.name === node) ||
        (ts.isVariableDeclaration(parent) && parent.name === node) ||
        (ts.isParameter(parent) && parent.name === node) ||
        ts.isImportSpecifier(parent) ||
        ts.isImportClause(parent) ||
        ts.isTypeReferenceNode(parent) ||
        ts.isQualifiedName(parent)
      if (!nameOnly && !isBound(node, node.text) && !inType(node))
        dom.push({ line: line(node), reason: 'browser global ' + node.text })
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'process' &&
      node.expression.name.text === 'env'
    ) {
      const name = node.name.text
      if (!/^(NEXT_PUBLIC_|EXPO_PUBLIC_)/.test(name) && name !== 'NODE_ENV')
        env.push({ line: line(node), name })
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return {
    imports,
    dom,
    env,
    dynamic,
    secretAccess,
    client: directives.has('use client'),
    serverAction: directives.has('use server'),
    syntax: ast.parseDiagnostics.map((diagnostic) => ({
      line: ast.getLineAndCharacterOfPosition(diagnostic.start || 0).line + 1,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
    })),
  }
}

function files(directory) {
  if (!fs.existsSync(directory)) return []
  if (fs.statSync(directory).isFile())
    return EXTENSIONS.includes(path.extname(directory)) &&
      !directory.endsWith('.d.ts')
      ? [directory]
      : []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory())
      return SKIP.has(entry.name) || entry.name.startsWith('.')
        ? []
        : files(file)
    return EXTENSIONS.includes(path.extname(file)) && !file.endsWith('.d.ts')
      ? [file]
      : []
  })
}

function readManifest(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

export function createImportResolver(root, packages) {
  root = path.resolve(root)
  const workspace = new Map(
    packages.map((pkg) => [
      pkg.name,
      { ...pkg, manifest: readManifest(path.join(pkg.dir, 'package.json')) },
    ])
  )
  const rootManifest = readManifest(path.join(root, 'package.json'))
  const configurations = new Map()
  const owner = (file) =>
    [...workspace.values()]
      .filter((pkg) => inside(pkg.dir, file))
      .sort((a, b) => b.dir.length - a.dir.length)[0]
  const configFor = (file) => {
    const directory = owner(file)?.dir || root
    if (configurations.has(directory)) return configurations.get(directory)
    const filename = path.join(directory, 'tsconfig.json')
    let options = {}
    if (fs.existsSync(filename)) {
      const parsed = ts.readConfigFile(filename, ts.sys.readFile)
      if (parsed.config)
        options = ts.parseJsonConfigFileContent(
          parsed.config,
          ts.sys,
          directory
        ).options
    }
    const config = {
      directory,
      paths: options.paths || {},
      base: options.baseUrl || options.pathsBasePath || directory,
    }
    configurations.set(directory, config)
    return config
  }
  const resolveFile = (absolute, mode) => {
    const platform = mode === 'native' ? 'native' : 'web'
    const ext = path.extname(absolute)
    const candidates =
      EXTENSIONS.includes(ext) || ext === '.json' || ext === '.css'
        ? [absolute]
        : [
            ...EXTENSIONS.map((suffix) => absolute + '.' + platform + suffix),
            ...EXTENSIONS.map((suffix) => absolute + suffix),
            ...EXTENSIONS.map((suffix) =>
              path.join(absolute, 'index.' + platform + suffix)
            ),
            ...EXTENSIONS.map((suffix) =>
              path.join(absolute, 'index' + suffix)
            ),
          ]
    return (
      candidates.find(
        (candidate) =>
          fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      ) || null
    )
  }
  const selectExport = (value, mode, star) => {
    if (typeof value === 'string') return value.replaceAll('*', star || '')
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = selectExport(entry, mode, star)
        if (found) return found
      }
      return null
    }
    if (!value || typeof value !== 'object') return null
    const conditions =
      mode === 'native'
        ? ['react-native', 'import', 'default']
        : ['browser', 'import', 'default']
    for (const condition of conditions)
      if (Object.hasOwn(value, condition)) {
        const found = selectExport(value[condition], mode, star)
        if (found) return found
      }
    return null
  }
  const exported = (pkg, spec, mode) => {
    const subpath = spec === pkg.name ? '.' : '.' + spec.slice(pkg.name.length)
    const exports = pkg.manifest.exports
    if (!exports) return { error: 'workspace package has no explicit exports' }
    let entry, star
    if (
      typeof exports === 'string' ||
      !Object.keys(exports).some((key) => key.startsWith('.'))
    )
      entry = subpath === '.' ? exports : null
    else if (Object.hasOwn(exports, subpath)) entry = exports[subpath]
    else {
      for (const key of Object.keys(exports)
        .filter((key) => key.includes('*'))
        .sort((a, b) => b.length - a.length)) {
        const [prefix, suffix] = key.split('*')
        if (subpath.startsWith(prefix) && subpath.endsWith(suffix)) {
          star = subpath.slice(prefix.length, subpath.length - suffix.length)
          entry = exports[key]
          break
        }
      }
    }
    const relative = selectExport(entry, mode, star)
    if (!relative || !relative.startsWith('./'))
      return { error: 'no exported entry for ' + subpath + ' (' + mode + ')' }
    const absolute = path.resolve(pkg.dir, relative)
    if (!inside(pkg.dir, absolute)) return { error: 'export escapes package' }
    const file = resolveFile(absolute, mode)
    return file
      ? { kind: 'local', file, workspace: pkg.name }
      : { error: 'export target is missing: ' + relative }
  }
  const resolve = (file, spec, mode = 'web') => {
    if (NODE.has(spec) || NODE.has(spec.split('/')[0]))
      return { kind: 'external', spec, node: true }
    if (spec.startsWith('.') || spec.startsWith('/')) {
      const absolute = path.resolve(path.dirname(file), spec)
      if (ASSET.test(absolute))
        return fs.existsSync(absolute)
          ? { kind: 'asset', file: absolute }
          : { kind: 'unresolved', reason: 'asset target is missing' }
      const target = resolveFile(absolute, mode)
      return target
        ? { kind: 'local', file: target }
        : { kind: 'unresolved', reason: 'relative target is missing' }
    }
    const config = configFor(file)
    for (const pattern of Object.keys(config.paths).sort(
      (a, b) => b.length - a.length
    )) {
      const [prefix, suffix = ''] = pattern.split('*')
      const wildcard = pattern.includes('*')
      if (
        wildcard
          ? !spec.startsWith(prefix) || !spec.endsWith(suffix)
          : spec !== pattern
      )
        continue
      const star = wildcard
        ? spec.slice(prefix.length, spec.length - suffix.length)
        : ''
      for (const target of config.paths[pattern]) {
        const absolute = path.resolve(config.base, target.replaceAll('*', star))
        if (ASSET.test(absolute) && fs.existsSync(absolute))
          return { kind: 'asset', file: absolute, alias: pattern }
        const resolved = resolveFile(absolute, mode)
        if (resolved) return { kind: 'local', file: resolved, alias: pattern }
      }
      // Platform runtime package declarations may point at .d.ts; they are external dependencies, not runtime source.
      if (pattern === 'react-native') return { kind: 'external', spec }
      return {
        kind: 'unresolved',
        alias: pattern,
        reason: 'configured alias has no target',
      }
    }
    const pkg = workspace.get(packageName(spec))
    if (pkg) {
      const result = exported(pkg, spec, mode)
      return result.error
        ? { kind: 'unresolved', reason: result.error }
        : result
    }
    const name = packageName(spec)
    const current = owner(file)?.manifest || rootManifest
    const declared = [
      current.dependencies,
      current.devDependencies,
      current.peerDependencies,
      current.optionalDependencies,
      rootManifest.dependencies,
      rootManifest.devDependencies,
      rootManifest.peerDependencies,
    ].some((group) => Object.hasOwn(group || {}, name))
    if (declared) return { kind: 'external', spec }
    if (spec.startsWith('@/') || spec.startsWith('~/') || spec.startsWith('#'))
      return { kind: 'unresolved', alias: true, reason: 'unknown alias' }
    return {
      kind: 'unresolved',
      reason: 'package is not declared in the package or workspace root',
    }
  }
  // Files a bare workspace specifier may legitimately reach: its declared export for each runtime condition.
  const entrypoints = (spec) => {
    const pkg =
      spec.startsWith('.') || spec.startsWith('/')
        ? null
        : workspace.get(packageName(spec))
    if (!pkg) return []
    return ['web', 'native']
      .map((mode) => exported(pkg, spec, mode).file)
      .filter(Boolean)
  }
  return { resolve, owner, configFor, entrypoints }
}

export function analyzeRuntime(root, config, packages) {
  root = path.resolve(root)
  const resolver = createImportResolver(root, packages)
  const facts = new Map(),
    violations = [],
    seen = new Set()
  const rel = (file) => posix(path.relative(root, file))
  const read = (file) => {
    if (!facts.has(file))
      facts.set(file, sourceFacts(fs.readFileSync(file, 'utf8'), file))
    return facts.get(file)
  }
  const add = (rule, file, line, message, trace) => {
    const key = [rule, file, line, message].join('|')
    if (seen.has(key)) return
    seen.add(key)
    violations.push({
      rule,
      file: rel(file),
      line,
      message,
      ...(trace ? { trace: trace.map(rel) } : {}),
    })
  }
  const legacyRoots = config.legacyRoots || []
  const scanRoots = [
    ...packages.map((pkg) => ({
      path: rel(pkg.dir),
      kind: 'workspace',
      runtime: pkg.runtime || 'mixed',
    })),
    ...legacyRoots.map((entry) =>
      typeof entry === 'string'
        ? { path: entry, kind: 'legacy', runtime: 'mixed' }
        : { ...entry, kind: 'legacy' }
    ),
  ]
  const inventory = scanRoots.map((entry) => {
    const found = files(path.join(root, entry.path))
    return {
      ...entry,
      files: found.map(rel),
      productionFiles: found.filter((file) => !testFile(file)).length,
      testFiles: found.filter(testFile).length,
    }
  })
  const all = [
    ...new Set(
      inventory.flatMap((entry) =>
        entry.files.map((file) => path.join(root, file))
      )
    ),
  ].filter((file) => !testFile(file))
  const tooling = (file) =>
    /(?:^|[/\\])(?:metro|next|babel|postcss|tailwind|vitest|jest|eslint)(?:\.[a-z0-9-]+)*\.config\.[cm]?[jt]s$/.test(
      file
    )

  const nonRuntimeRoots = config.nonRuntimeRoots || []
  for (const entry of nonRuntimeRoots)
    if (!entry.path || !entry.reason)
      add(
        'SCOPE-EXCLUSION',
        root,
        0,
        'nonRuntimeRoots entries need a path and an explicit reason'
      )
  const outsideScope = files(root).filter(
    (file) =>
      !testFile(file) &&
      !tooling(file) &&
      !scanRoots.some((entry) =>
        inside(path.resolve(root, entry.path), file)
      ) &&
      !nonRuntimeRoots.some(
        (entry) => entry.path && inside(path.resolve(root, entry.path), file)
      )
  )
  for (const file of outsideScope)
    add(
      'UNCLASSIFIED-ROOT',
      file,
      1,
      'source outside the declared workspace/legacy runtime roots; classify it explicitly'
    )

  const serverPackages = new Set([
    ...(config.serverOnlyPackages || []),
    ...packages
      .filter((pkg) => pkg.runtime === 'server')
      .map((pkg) => pkg.name),
  ])
  const nativeRoot = path.resolve(root, config.clients.mobile)
  const foundation = Object.values(config.foundations).map((directory) =>
    path.resolve(root, directory)
  )
  const frontend = path.resolve(root, config.frontend)
  const universalRoots = (
    config.universalSourceRoots || [path.posix.join(config.frontend, 'src')]
  ).map((entry) => path.resolve(root, entry))
  const escaped = new Set()
  // A host or package reaches code outside its own workspace only through another package's declared entry point.
  // Relative paths, aliases and requires that land in the legacy root or in another package's internals are escapes.
  // The legacy root is its own home: it may import itself freely, but a package's internals only through an entry point.
  const workspaceEscape = (file, home, imported, result) => {
    const relative =
      imported.spec.startsWith('.') || imported.spec.startsWith('/')
    const target =
      result.file ||
      (relative ? path.resolve(path.dirname(file), imported.spec) : null)
    if (!target || target.split(path.sep).includes('node_modules')) return
    const destination = resolver.owner(target)
    if (destination === home || (home.legacy && !destination)) return
    if (
      !relative &&
      resolver
        .entrypoints(imported.spec)
        .some((entry) => path.resolve(entry) === path.resolve(target))
    )
      return
    const key = [file, imported.line, imported.spec].join('|')
    if (escaped.has(key)) return
    escaped.add(key)
    if (home.legacy)
      add(
        'LEGACY-DEEP-IMPORT',
        file,
        imported.line,
        '"' +
          imported.spec +
          '" reaches ' +
          destination.name +
          ' internals (' +
          rel(target) +
          ') from the legacy root ' +
          home.name +
          '; import only a declared package entry point'
      )
    else
      add(
        'WORKSPACE-ESCAPE',
        file,
        imported.line,
        '"' +
          imported.spec +
          '" leaves ' +
          home.name +
          ' for ' +
          (destination ? destination.name + ' internals' : 'the legacy root') +
          ' (' +
          rel(target) +
          '); import only a declared package entry point'
      )
  }
  // Legacy roots (arch.config.json legacyRoots) are outside every workspace. They are not a place to park debt:
  // markup, product UI libraries and package internals there are counted like their packages/frontend counterparts.
  const legacyHomes = scanRoots
    .filter((entry) => entry.kind === 'legacy')
    .map((entry) => ({
      name: entry.path,
      dir: path.resolve(root, entry.path),
      legacy: true,
    }))
  const legacyHomeOf = (file) =>
    legacyHomes
      .filter((entry) => inside(entry.dir, file))
      .sort((a, b) => b.dir.length - a.dir.length)[0]
  const nativeEntries = [],
    clientEntries = []
  for (const file of all) {
    if (tooling(file)) continue
    const info = read(file)
    if (!inside(path.join(root, 'packages/backend/src/modules/secrets'), file))
      for (const access of info.secretAccess)
        add('SECRET-VAULT-OWNERSHIP', file, access.line, access.reason)
    for (const error of info.syntax)
      add('SOURCE-SYNTAX', file, error.line, error.message)
    for (const item of info.dynamic)
      add(
        'DYNAMIC-IMPORT-UNRESOLVED',
        file,
        item.line,
        'cannot prove the runtime target of ' + item.code
      )
    if (inside(nativeRoot, file) || platformFile(file) === 'native')
      nativeEntries.push(file)
    if (
      (info.client ||
        legacyRoots.some(
          (entry) =>
            typeof entry === 'object' &&
            entry.runtime === 'browser-assets' &&
            inside(path.resolve(root, entry.path), file)
        )) &&
      platformFile(file) !== 'native' &&
      !inside(nativeRoot, file)
    )
      clientEntries.push(file)
    const modes =
      inside(nativeRoot, file) || platformFile(file) === 'native'
        ? ['native']
        : platformFile(file) === 'web'
          ? ['web']
          : ['web', 'native']
    const home = resolver.owner(file) || legacyHomeOf(file)
    const packageScoped =
      inside(frontend, file) ||
      foundation.some((directory) => inside(directory, file))
    for (const mode of modes) {
      for (const imported of info.imports) {
        const result = resolver.resolve(file, imported.spec, mode)
        if (
          result.kind === 'local' &&
          rel(result.file) ===
            'packages/backend/src/runtime/platform-database.ts' &&
          rel(file) !== 'packages/backend/src/runtime/platform-jobs.ts'
        ) {
          add(
            'PLATFORM-PRISMA',
            file,
            imported.line,
            'platform database belongs to platform runtime composition; inject PlatformScope into modules'
          )
        }
        if (result.kind === 'unresolved')
          add(
            result.alias ? 'ALIAS-UNRESOLVED' : 'IMPORT-UNRESOLVED',
            file,
            imported.line,
            imported.spec + ': ' + result.reason + ' (' + mode + ')'
          )
        if (result.kind === 'local' && testFile(result.file))
          add(
            'TEST-IMPORT',
            file,
            imported.line,
            'product imports test source ' + rel(result.file)
          )
        if (
          result.kind === 'local' &&
          packageScoped &&
          !resolver.owner(result.file)
        ) {
          add(
            'ROOT-ESCAPE',
            file,
            imported.line,
            'package imports legacy root implementation ' + rel(result.file)
          )
          escaped.add([file, imported.line, imported.spec].join('|')) // already a hard ROOT-ESCAPE; not also ratcheted
        } else if (home) workspaceEscape(file, home, imported, result)
      }
    }
    // Universal (unsuffixed) product files must stay renderable by both hosts.
    if (
      platformFile(file) === 'universal' &&
      universalRoots.some((directory) => inside(directory, file))
    ) {
      for (const item of info.dom) {
        if (item.intrinsic)
          add(
            'UNIVERSAL-DOM-JSX',
            file,
            item.line,
            item.reason +
              (item.className ? ' with className' : '') +
              ' at column ' +
              item.column +
              ' in a universal file; move the DOM markup to a .web.tsx variant'
          )
      }
      for (const imported of info.imports) {
        if (
          !imported.typeOnly &&
          UNIVERSAL_WEB_MODULES.some((pattern) => pattern.test(imported.spec))
        )
          add(
            'UNIVERSAL-WEB-LIB',
            file,
            imported.line,
            'web-only library "' +
              imported.spec +
              '" in a universal file; move it to a .web variant'
          )
      }
    }
    // Moving a file from packages/frontend into the legacy root must not read as a reduction.
    if (home?.legacy) {
      for (const item of info.dom) {
        if (item.intrinsic)
          add(
            'LEGACY-DOM-JSX',
            file,
            item.line,
            item.reason +
              ' at column ' +
              item.column +
              ' in the legacy root ' +
              home.name +
              '; product markup belongs in packages/frontend behind a pages entry point'
          )
      }
      for (const imported of info.imports) {
        if (
          !imported.typeOnly &&
          LEGACY_UI_MODULES.some((pattern) => pattern.test(imported.spec))
        )
          add(
            'LEGACY-WEB-LIB',
            file,
            imported.line,
            'product UI library "' +
              imported.spec +
              '" in the legacy root ' +
              home.name +
              '; product UI belongs in packages/frontend or packages/ui'
          )
      }
    }
  }
  const checkGraph = (entries, mode) => {
    const queue = entries.map((file) => ({ file, trace: [file] }))
    const visited = new Set()
    let edgeCount = 0
    for (let index = 0; index < queue.length; index += 1) {
      const { file, trace } = queue[index]
      if (visited.has(file)) continue
      visited.add(file)
      const info = read(file)
      if (mode === 'native') {
        if (platformFile(file) === 'web')
          add(
            'NATIVE-WEB-TRANSITIVE',
            file,
            1,
            'native graph reaches a .web implementation',
            trace
          )
        for (const item of info.dom)
          add(
            'NATIVE-DOM',
            file,
            item.line,
            item.reason + ' is reachable by native',
            trace
          )
        if (info.serverAction)
          add(
            'NATIVE-SERVER-ACTION',
            file,
            1,
            'native graph imports a Next server action',
            trace
          )
      }
      for (const item of info.env)
        add(
          'CLIENT-SERVER-ENV',
          file,
          item.line,
          'client graph reads non-public environment variable ' + item.name,
          trace
        )
      const owner = resolver.owner(file)
      if (owner && serverPackages.has(owner.name))
        add(
          'CLIENT-SERVER-PACKAGE',
          file,
          1,
          mode + ' graph reaches server package ' + owner.name,
          trace
        )
      for (const imported of info.imports) {
        if (imported.typeOnly) continue
        const target = resolver.resolve(file, imported.spec, mode)
        edgeCount += 1
        if (target.kind === 'external') {
          if (
            target.node ||
            SERVER_MODULES.some((pattern) => pattern.test(imported.spec)) ||
            serverPackages.has(packageName(imported.spec))
          ) {
            add(
              'CLIENT-SERVER-TRANSITIVE',
              file,
              imported.line,
              mode + ' graph reaches server module ' + imported.spec,
              trace
            )
          }
          if (
            mode === 'native' &&
            DOM_MODULES.some((pattern) => pattern.test(imported.spec))
          )
            add(
              'NATIVE-DOM-PACKAGE',
              file,
              imported.line,
              'native graph reaches DOM package ' + imported.spec,
              trace
            )
        } else if (target.kind === 'local') {
          if (mode === 'web' && read(target.file).serverAction) continue
          queue.push({ file: target.file, trace: [...trace, target.file] })
        }
      }
    }
    return {
      entrypoints: entries.map(rel),
      files: visited.size,
      edges: edgeCount,
    }
  }
  const graph = {
    webClient: checkGraph(clientEntries, 'web'),
    native: checkGraph(nativeEntries, 'native'),
  }
  return {
    violations,
    inventory,
    graph,
    exclusions: {
      directories: [...SKIP],
      hiddenDirectories: fs
        .readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('.'))
        .map((entry) => entry.name),
      nonRuntimeRoots: nonRuntimeRoots.map((entry) => ({
        ...entry,
        files: files(path.resolve(root, entry.path)).length,
      })),
      tests:
        'Test sources are inventoried but not runtime roots; product imports of tests are rejected.',
      declarations: 'Type declarations have no runtime body.',
      tooling: all.filter(tooling).map(rel),
    },
  }
}
