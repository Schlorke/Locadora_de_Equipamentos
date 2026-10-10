import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Gate da onda 134: alteração de ACL de objeto compartilhado do banco de teste só por `tests/helpers/shared-acl.ts`.
 * Sem o lock do helper, dois arquivos em paralelo que regravam a mesma linha de catálogo (schema public, organizations,
 * settings...) fazem um deles falhar com XX000 "tuple concurrently updated" (validação consolidada da onda 133).
 */
const HELPER = 'tests/helpers/shared-acl.ts'
const HELPER_CALLS = new Set(['alterSharedAcl', 'alterSharedAclInTransaction'])
/** Este verificador: as fontes sintéticas abaixo são dado de teste e nunca chegam ao banco. */
const SCANNER = 'tests/unit/shared-acl.gate.test.ts'

/**
 * Onde uma instrução começa: no início do texto, depois de `;`, dentro de um bloco PL/pgSQL (`$$`, BEGIN, THEN, ELSE,
 * LOOP) ou na string de um EXECUTE dinâmico (`EXECUTE '...'`, `format('...')`).
 */
const STATEMENT_START = String.raw`(?:^|;|\$\$|\bBEGIN\b|\bTHEN\b|\bELSE\b|\bLOOP\b|\bEXECUTE\s+['"]|\bformat\s*\(\s*['"])\s*`

/**
 * GRANT, REVOKE, DROP OWNED, DROP ROLE, ALTER ... OWNER TO, ALTER DEFAULT PRIVILEGES e os scripts de papel do DBA.
 * Em maiúsculas em qualquer literal (a convenção do SQL do repositório); em qualquer caixa quando o literal vai para
 * o banco (`query`, `$executeRaw*`, `$queryRaw*` ou o próprio helper, direto ou pela variável que ele inicializa),
 * para que título de teste não conte.
 */
const ACL_KEYWORDS = [
  new RegExp(STATEMENT_START + String.raw`(?:GRANT|REVOKE)\b`),
  new RegExp(STATEMENT_START + String.raw`DROP\s+(?:OWNED|ROLE)\b`),
  /\bOWNER\s+TO\b/,
  /\bALTER\s+DEFAULT\s+PRIVILEGES\b/,
]
const ROLE_SCRIPT = /prisma\/sql\/roles\//
const SQL_CALLS = new Set([
  'query',
  '$executeRaw',
  '$executeRawUnsafe',
  '$queryRaw',
  '$queryRawUnsafe',
])

/**
 * Exceções: o arquivo altera ACL num banco ou schema que ele mesmo cria e apaga, com papéis de nome próprio, onde
 * nenhum outro arquivo de teste escreve. O helper nada serializaria ali: o PostgreSQL põe o banco na chave do lock
 * consultivo, e outro banco toma a mesma chave sem esperar. Uma entrada vai além disso, pelo motivo dela:
 * migration-preflight-rls também concede CREATE no próprio banco compartilhado ao papel dele, e o DROP OWNED desse
 * papel no fim revoga a concessão; as duas regravam a linha do banco em pg_database, que nenhum outro teste altera.
 * Se outro arquivo passar a alterá-la, os dois usam o helper e a entrada sai. Fora isso, só entra aqui arquivo de
 * banco ou schema próprio, com o motivo (o último caso confere que ele ainda precisa da entrada e cria o banco ou
 * schema); quem passar a usar o banco compartilhado sai daqui e vai para o helper.
 */
const OWN_DATABASE_OR_SCHEMA: Readonly<Record<string, string>> = {
  'tests/api-host/receiving-account.ts':
    'cria o banco receiving_<execução>_test, aplica nele os scripts de papel e o apaga com os papéis',
  'tests/identity/account-health-database.test.ts':
    'banco account_health_<sufixo>_test próprio: scripts de papel e grants só nele',
  'tests/identity/asaas-ingress-database.test.ts':
    'banco asaas_ingress_<sufixo>_test próprio: scripts de papel só nele',
  'tests/identity/equipment-quota-database.test.ts':
    'banco quota_<sufixo>_test próprio: scripts de papel e o REVOKE/GRANT de subscriptions só nele',
  'tests/identity/onboarding-database.test.ts':
    'banco onboarding_<sufixo>_test próprio: scripts de papel só nele',
  'tests/identity/owner-subscription-cancellation.test.ts':
    'banco owner_cancel_<sufixo>_test próprio: script de papel só nele',
  'tests/identity/platform-runtime-database.test.ts':
    'banco platform_runtime_<sufixo>_test próprio: scripts de papel e o grant de users.email só nele',
  'tests/identity/platform-scope-database.test.ts':
    'banco platform_<sufixo>_test próprio: scripts de papel só nele',
  'tests/identity/secrets-database.test.ts':
    'banco secrets_<sufixo>_test próprio: scripts de papel só nele',
  'tests/identity/secrets-import-database.test.ts':
    'banco secret_import_<sufixo>_test próprio: scripts de papel, grants e dono da função só nele',
  'tests/identity/subaccount-provisioning-database.test.ts':
    'banco subaccounts_<sufixo>_test próprio: scripts de papel renomeados para os papéis subaccount_*_<sufixo>, que ele mesmo apaga',
  'tests/identity/subscription-command-database.test.ts':
    'banco command_<sufixo>_test próprio: scripts de papel e o REVOKE/GRANT de subscriptions só nele',
  'tests/identity/subscription-invoices-database.test.ts':
    'banco subscription_invoice_<sufixo>_test próprio: scripts de papel só nele',
  'tests/identity/subscription-jobs-database.test.ts':
    'banco subscription_jobs_<sufixo>_test próprio: script de papel só nele',
  'tests/security/secret-leak.test.ts':
    'banco secret_leak_<sufixo>_test próprio: script do papel de plataforma renomeado para leak_platform_<sufixo>, que ele mesmo apaga',
  'tests/unit/tenant-slug-policy.test.ts':
    'grants só nos schemas slug_policy_<sufixo>_* próprios, apagados antes do DROP OWNED/DROP ROLE do leitor',
  'tests/unit/migration-preflight-rls.test.ts':
    'grants nos schemas mig_rls_<sufixo>_* próprios; o GRANT CREATE ON DATABASE é a única ACL do banco em si e nenhum outro teste a altera',
}

/** Raízes de teste lidas inteiras; nas outras, só pastas de teste e arquivos *.test.* / *.spec.*. */
const TEST_ROOTS = ['tests']
const COLOCATED_ROOTS = ['apps', 'packages', 'lib', 'app', 'tools', 'scripts']
// A .next antiga da raiz foi retirada em F; este basename ainda exclui gerados dos hosts na busca de mudanças de ACL.
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  '.next',
  '.expo',
  '.turbo',
  'android',
  'ios',
  'build',
  'dist',
  'coverage',
  'storybook-static',
  'test-results',
  'playwright-report',
])
const SOURCE = /\.[cm]?[jt]sx?$/
const COLOCATED_TEST =
  /\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)(?:tests?|__tests__)\//

interface AclChange {
  line: number
  text: string
  viaHelper: boolean
}

function sourceFiles(): string[] {
  const files: string[] = []
  const walk = (directory: string, colocated: boolean) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = path.posix.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) walk(relative, colocated)
      } else if (
        entry.isFile() &&
        SOURCE.test(entry.name) &&
        (!colocated || COLOCATED_TEST.test(relative))
      )
        files.push(relative)
    }
  }
  for (const root of TEST_ROOTS) walk(root, false)
  for (const root of COLOCATED_ROOTS) if (fs.existsSync(root)) walk(root, true)
  return files.sort()
}

function isHelperModule(file: string, specifier: string): boolean {
  const target = specifier.startsWith('@/')
    ? specifier.slice(2)
    : specifier.startsWith('.')
      ? path.posix.join(path.posix.dirname(file), specifier)
      : undefined
  return target?.replace(/\.[cm]?[jt]s$/, '') === HELPER.replace(/\.ts$/, '')
}

/** Nomes locais das duas funções do helper importadas por este arquivo (com alias, se houver). */
function helperNames(file: string, source: ts.SourceFile): Set<string> {
  const names = new Set<string>()
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !isHelperModule(file, statement.moduleSpecifier.text) ||
      statement.importClause?.isTypeOnly
    )
      continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements)
      if (
        !element.isTypeOnly &&
        HELPER_CALLS.has((element.propertyName ?? element.name).text)
      )
        names.add(element.name.text)
  }
  return names
}

function literalText(node: ts.Node): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text
  if (ts.isTemplateExpression(node))
    return (
      node.head.text +
      node.templateSpans.map((span) => '${}' + span.literal.text).join('')
    )
  return undefined
}

/** O literal está entre os argumentos de uma chamada às funções importadas do helper. */
function insideHelperCall(node: ts.Node, names: Set<string>): boolean {
  for (
    let child: ts.Node = node, parent = node.parent;
    parent;
    child = parent, parent = parent.parent
  )
    if (
      ts.isCallExpression(parent) &&
      ts.isIdentifier(parent.expression) &&
      names.has(parent.expression.text) &&
      parent.arguments.some((argument) => argument === child)
    )
      return true
  return false
}

const calleeName = (callee: ts.Expression) =>
  ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : undefined

/** A chamada manda os argumentos para o banco: `query`/`$executeRaw*`/`$queryRaw*` ou uma função do helper. */
const sendsSql = (call: ts.CallExpression, names: Set<string>) => {
  const name = calleeName(call.expression)
  return (
    !!name &&
    (SQL_CALLS.has(name) ||
      (ts.isIdentifier(call.expression) && names.has(name)))
  )
}

/** Variáveis passadas direto, como argumento, a uma chamada que vai para o banco. */
function sqlVariables(source: ts.SourceFile, names: Set<string>): Set<string> {
  const variables = new Set<string>()
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && sendsSql(node, names))
      for (const argument of node.arguments)
        if (ts.isIdentifier(argument)) variables.add(argument.text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return variables
}

/**
 * O literal vai para o banco: argumento de `query`/`$executeRaw*`/`$queryRaw*`, template marcado, o helper, ou o valor
 * inicial de uma variável que o arquivo passa a uma dessas chamadas.
 */
function executedAsSql(
  node: ts.Node,
  names: Set<string>,
  variables: Set<string>
): boolean {
  for (
    let child: ts.Node = node, parent = node.parent;
    parent;
    child = parent, parent = parent.parent
  ) {
    if (
      ts.isCallExpression(parent) &&
      parent.arguments.some((argument) => argument === child) &&
      sendsSql(parent, names)
    )
      return true
    if (
      ts.isVariableDeclaration(parent) &&
      parent.initializer === child &&
      ts.isIdentifier(parent.name) &&
      variables.has(parent.name.text)
    )
      return true
    if (
      ts.isTaggedTemplateExpression(parent) &&
      parent.template === child &&
      SQL_CALLS.has(calleeName(parent.tag) ?? '')
    )
      return true
  }
  return false
}

function aclChanges(file: string, text: string): AclChange[] {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const names = helperNames(file, source)
  const variables = sqlVariables(source, names)
  const changes: AclChange[] = []
  const visit = (node: ts.Node) => {
    const literal = literalText(node)
    if (
      literal !== undefined &&
      (ROLE_SCRIPT.test(literal) ||
        ACL_KEYWORDS.some((rule) => rule.test(literal)) ||
        (executedAsSql(node, names, variables) &&
          ACL_KEYWORDS.some((rule) =>
            new RegExp(rule.source, 'i').test(literal)
          )))
    )
      changes.push({
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        text: literal.slice(0, 80),
        viaHelper: insideHelperCall(node, names),
      })
    ts.forEachChild(node, visit)
  }
  visit(source)
  return changes
}

const outside = (changes: AclChange[]) =>
  changes.filter((change) => !change.viaHelper).map((change) => change.text)

// O caso que varre o repositório lê e analisa com o TypeScript cada arquivo de teste: isolado, de 1,6 a 1,8 s com cache
// quente e 10,1 s na primeira execução fria (medido em 2026-10-07); sob a carga do pnpm test:unit completo, passava dos
// 20 s do padrão (25,5 s).
const REPO_SCAN = { timeout: 60_000 }

describe('Shared ACL gate: test ACL changes only through tests/helpers/shared-acl.ts', () => {
  it('flags every form of ACL change outside the helper and accepts the helper calls', () => {
    const file = 'tests/unit/example.test.ts'
    const flagged = [
      `await pool.query('GRANT USAGE ON SCHEMA public TO r')`,
      'await pool.query(`REVOKE ${privilege} ON addresses FROM ${role}`)',
      `await pool.query('REVOKE UPDATE ON settings FROM ' + role)`,
      `await admin.query('drop owned by "x"')`,
      'await admin.query(`DROP ROLE IF EXISTS "${role}"`)',
      `await pool.query('ALTER FUNCTION public.f() OWNER TO "' + owner + '"')`,
      `await pool.query('ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO r')`,
      `await db.query(readFileSync('prisma/sql/roles/app_runtime.sql', 'utf8'))`,
      'await tx.$executeRaw`GRANT SELECT ON organizations TO ${role}`',
      `await admin.query('CREATE ROLE r; GRANT r TO s')`,
      // Dentro de bloco PL/pgSQL e de EXECUTE dinâmico.
      `await pool.query('DO $$ BEGIN IF NOT EXISTS (SELECT 1) THEN GRANT USAGE ON SCHEMA public TO r; END IF; END $$')`,
      `await pool.query("DO $$ BEGIN EXECUTE format('REVOKE ALL ON %I FROM r', 'settings'); END $$")`,
      `await pool.query("DO $$ BEGIN EXECUTE 'DROP ROLE ' || quote_ident('r'); END $$")`,
      `await pool.query('do $$ begin grant usage on schema public to r; end $$')`,
      // Minúsculas guardadas numa variável que depois vai para o banco.
      `const sql = 'grant usage on schema public to r'\nawait pool.query(sql)`,
      `const statement = \`revoke update on settings from \${role}\`\nawait tx.$executeRawUnsafe(statement)`,
      // Nome igual, mas não importado do helper.
      `async function alterSharedAcl(db, sql) { await db.query(sql) }\nawait alterSharedAcl(pool, 'GRANT USAGE ON SCHEMA public TO r')`,
      `import { alterSharedAcl } from '../helpers/shared-acl-copy'\nawait alterSharedAcl(pool, 'REVOKE ALL ON settings FROM r')`,
      `import type { alterSharedAcl } from '../helpers/shared-acl'\nawait alterSharedAcl(pool, 'REVOKE ALL ON settings FROM r')`,
      // Literal fora da chamada, passado depois por variável.
      `import { alterSharedAcl } from '../helpers/shared-acl'\nconst sql = 'GRANT USAGE ON SCHEMA public TO r'\nawait alterSharedAcl(pool, sql)`,
    ]
    for (const source of flagged)
      expect([source, outside(aclChanges(file, source)).length]).toEqual([
        source,
        1,
      ])

    const accepted = `
      import { alterSharedAcl, alterSharedAclInTransaction as inTx } from '../helpers/shared-acl'
      import { alterSharedAcl as acl } from '@/tests/helpers/shared-acl'
      // GRANT USAGE ON SCHEMA public: comentário não é instrução
      it.each(['ADMIN'])('grant %s does not authorize creation', () => undefined)
      const label = 'revoke access, then drop role membership'
      const title = 'then grant the owner, else revoke it'
      it(title, async () => {
        const sql = 'SELECT has_schema_privilege(r, $1, $2)'
        await pool.query(sql, [label, 'USAGE'])
        await alterSharedAcl(pool, ['GRANT USAGE ON SCHEMA public TO r', \`DROP ROLE "\${role}"\`])
        await alterSharedAcl(pool, 'REVOKE UPDATE ON settings FROM ' + role).catch(() => undefined)
        await inTx(tx, roles.map((role) => \`DROP OWNED BY "\${role}"\`))
        await inTx(tx, "DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO r', 'public'); END $$")
        await acl(pool, readFileSync('prisma/sql/roles/platform_runtime.sql', 'utf8'))
      })`
    const changes = aclChanges(file, accepted)
    expect(changes).toHaveLength(6)
    expect(outside(changes)).toEqual([])
  })

  it(
    'finds no ACL change on a shared object outside the helper in the test directories',
    REPO_SCAN,
    () => {
      const files = sourceFiles()
      expect(files).toContain(HELPER)
      expect(files).toContain('tests/api-host/global-setup.ts')
      const offenders: string[] = []
      for (const file of files) {
        if (file === SCANNER || OWN_DATABASE_OR_SCHEMA[file]) continue
        for (const change of aclChanges(file, fs.readFileSync(file, 'utf8')))
          if (!change.viaHelper)
            offenders.push(`${file}:${change.line} ${change.text}`)
      }
      expect(
        offenders,
        `use alterSharedAcl/alterSharedAclInTransaction de ${HELPER}; arquivo que altera ACL só num banco ou schema próprio entra em OWN_DATABASE_OR_SCHEMA com o motivo`
      ).toEqual([])
    }
  )

  it('routes the shared fixtures through the helper', () => {
    for (const file of [
      'tests/helpers/platform-fixture.ts',
      'tests/helpers/public-site.ts',
      'tests/api-host/global-setup.ts',
    ]) {
      const changes = aclChanges(file, fs.readFileSync(file, 'utf8'))
      expect([file, changes.length > 0, outside(changes)]).toEqual([
        file,
        true,
        [],
      ])
    }
  })

  it('keeps every exception explicit, motivated, current and on its own database or schema', () => {
    for (const [file, reason] of Object.entries(OWN_DATABASE_OR_SCHEMA)) {
      expect([file, fs.existsSync(file)]).toEqual([file, true])
      expect([file, reason.trim().length >= 20]).toEqual([file, true])
      const text = fs.readFileSync(file, 'utf8')
      // Exceção sem alteração fora do helper já não precisa estar aqui.
      expect([file, outside(aclChanges(file, text)).length > 0]).toEqual([
        file,
        true,
      ])
      expect([file, /\bCREATE\s+(?:DATABASE|SCHEMA)\b/.test(text)]).toEqual([
        file,
        true,
      ])
    }
  })
})
