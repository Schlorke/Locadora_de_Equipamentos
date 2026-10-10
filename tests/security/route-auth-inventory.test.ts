/**
 * Structural rule (RT-3, finding 108): every HTTP method a non-public Route Handler exports starts with its guard.
 * - Before it only PROLOGUE statements run (`const { id } = await params`, `await request.json()`, the MEMORY_LIMITERS
 *   rate limit and the same-origin guard with their refusals, and host context on /organizations/current only)
 *   and refusals `if (<INERT>) return <INERT>`; a try may
 *   wrap the guard when its catch is INERT and leaves. INERT is a closed grammar, not a hunt for data: INERT_SYNTAX
 *   only, no FORBIDDEN_MEMBERS, computed member or HOOK_KEYS, writes only to its own variables, calls only to
 *   INERT_CALLS, INERT_IMPORT_CALLS, named INERT_IMPORTS, INERT_METHODS of INERT values and INERT functions of the file,
 *   `instanceof` only of INERT_CLASSES.
 * - The guard: a GUARDS helper with INERT arguments whose result is returned or tested at once, leaving on failure, or a
 *   DELEGATES function under this rule; under /api/admin a role check follows resolveTenantPrincipal at once (STAFF_ROLES,
 *   or OWNER_CLIENT: a CLIENT whose `principal.userId` equals a route param that every later data access names once as a
 *   schema field of its argument, in an OWNER_SCOPED helper or one withTenantTransaction query, the rest being INERT).
 *
 * Each breach of the flow analysis this rule replaces is kept below as a synthetic case that must fail. The
 * module loads evaluating only LOAD_SYNTAX: zod schemas (ZOD_BUILDERS), LOAD_TIME_FACTORIES and literal data. Public methods are
 * listed in PUBLIC_ALLOWLIST with the modules they may reach (`reach`, flow-insensitive, with reflection and writes
 * as references no entry lists); retired ones are INERT. A second pass (CSRF) proves that
 * every mutation authenticated by the session cookie passes the same-origin guard before any effect: in its
 * PROLOGUE, through a central gate that carries it (resolveTenantPrincipal and the helpers built on it), or right
 * after reading the session; OWN_CSRF_DEFENCE lists the framework handlers with their own defence. Behaviour
 * (status codes, tenant isolation) stays covered by the HTTP tests.
 */
import fs from 'node:fs'
import { isBuiltin } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
/** Superfície versionada da API compartilhada (E26 da onda 135): método e caminho de cada endpoint. */
const API_SURFACE_FIXTURE = 'tests/security/fixtures/api-surface.json'
const ROUTE_ROOTS = ['apps/clients/web/src/app', 'apps/services/api/src/app']
// Build-directory basenames include .next under the live hosts; the former root .next was retired in F.
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'build'])
const ROUTE_FILE = /^route\.(?:[cm]?[jt]sx?)$/
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
/**
 * The script extensions a project specifier may resolve to (finding 123, scenario B): the union of what Next 16
 * accepts (webpack `.js .mjs .tsx .ts .jsx`, Turbopack `.tsx .ts .jsx .js .mjs`) and TypeScript (`.mts .cts .cjs`
 * by name). The bundlers try them in different orders, so the file a specifier names is only certain when one
 * candidate exists (a file or an `/index` file): resolveModule refuses the others. `.json` comes last in every
 * resolver, so it only counts when no script answers.
 */
const MODULE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
]
const SCRIPT_SUFFIXES = [
  '',
  ...MODULE_EXTENSIONS,
  ...MODULE_EXTENSIONS.map((extension) => `/index${extension}`),
]
const DATA_SUFFIXES = ['.json', '/index.json']
const RESOLVE_SUFFIXES = [...SCRIPT_SUFFIXES, ...DATA_SUFFIXES]

const ADMIN =
  /^(?:apps\/(?:clients\/web|services\/api)\/src\/)?app\/api\/admin\//
const CRON = /^(?:apps\/(?:clients\/web|services\/api)\/src\/)?app\/api\/cron\//
const AUTH = /^(?:apps\/(?:clients\/web|services\/api)\/src\/)?app\/api\/auth\//
// Signup has no existing tenant. Only these two new session-bound endpoints use the identity guard.
const ACCOUNT_SESSION_ROUTES =
  /^(?:apps\/(?:clients\/web|services\/api)\/src\/)?app\/api\/(?:auth\/|onboarding\/(?:organizations|slug-availability)\/route\.ts$)/
const CURRENT_ORGANIZATION =
  /^(?:apps\/services\/api\/src\/)?app\/api\/auth\/organizations\/current\/route\.ts$/
const WEBHOOK =
  /^(?:apps\/(?:clients\/web|services\/api)\/src\/)?app\/api\/(?:webhooks|payments|contracts)\//
const ROUTE_MODULE =
  /^(?:apps\/(?:clients\/web|services\/api)\/src\/)?app\/api\/.+\/route$/

type Kind =
  | 'tenant-permission'
  | 'tenant-principal'
  | 'role'
  | 'webhook'
  | 'webhook-handshake'
  | 'cron'
  | 'public-tenant'
  | 'identity'
/**
 * How a helper's result says the request may proceed. Only a test that can
 * actually tell failure from success gates the handler: a truthiness or
 * `== null` test on a result that is always an object proves nothing.
 */
type ResultShape =
  /** Always an object; success only through the boolean discriminant (`if (!r.ok) return r.response`). */
  | { type: 'discriminated'; property: 'ok' | 'success' }
  /** A denial Response, or `null` when the request may proceed. */
  | { type: 'denial' }
  /** The value, or `null` when it is missing. */
  | { type: 'nullable' }
  /** A Response (a delegated handler): success only through `.ok` or a 2xx `.status`. */
  | { type: 'response' }
  /** Unknown: only returning it as is counts. */
  | { type: 'opaque' }
const OK_RESULT: ResultShape = { type: 'discriminated', property: 'ok' }
const DENIAL_RESULT: ResultShape = { type: 'denial' }
const NULLABLE_RESULT: ResultShape = { type: 'nullable' }
const RESPONSE_RESULT: ResultShape = { type: 'response' }
const OPAQUE_RESULT: ResultShape = { type: 'opaque' }

type Guard = {
  module: string
  /** Explicit implementation of a package-exported guard, checked below rather than treating its barrel as a function. */
  source?: string
  name: string
  kind: Kind
  /** Only authorizes routes under this namespace. */
  scope?: RegExp
  /** Never authorizes routes under this namespace. */
  excluded?: RegExp
  /** The shape of the helper's result (kept in sync with the helper by a self-check). */
  result: ResultShape
  /** Arguments the helper only runs once it has authorized the request (a job): not INERT. */
  callbacks?: number[]
  /** This service guard must receive the handler's original request at this position. */
  requestArgument?: number
}

/** Approved helpers, keyed by canonical module id (repo path without extension). */
const GUARDS: Guard[] = [
  {
    module: 'apps/services/api/src/host/permissions',
    name: 'requireTenantPermission',
    kind: 'tenant-permission',
    scope:
      /^apps\/services\/api\/src\/app\/api\/(?:admin\/|payments\/boleto\/(?:\[id\]\/regenerate|verify)\/route\.ts$)/,
    result: OK_RESULT,
    requestArgument: 0,
  },
  {
    module: 'apps/services/api/src/host/private-identity',
    name: 'resolveTenantPrincipal',
    kind: 'tenant-principal',
    scope: /^apps\/services\/api\/src\/app\/api\//,
    result: OK_RESULT,
    requestArgument: 0,
  },
  {
    module: '@gb-locacoes/backend/identity',
    source: 'packages/backend/src/modules/identity/platform-webhook.ts',
    name: 'authenticatePlatformAsaasWebhook',
    kind: 'webhook',
    scope:
      /^(?:apps\/services\/api\/src\/)?app\/api\/webhooks\/asaas\/platform\/route\.ts$/,
    result: OK_RESULT,
  },
  {
    module: 'apps/services/api/src/host/webhook-authentication',
    name: 'authenticateTenantWebhook',
    kind: 'webhook',
    scope:
      /^apps\/services\/api\/src\/app\/api\/(?:payments\/(?:pix|boleto)\/webhook|contracts\/zapsign-webhook|webhooks\/(?:whatsapp|asaas))\/\[integrationId\]\/route\.ts$/,
    result: OK_RESULT,
  },
  {
    module: 'packages/backend/src/http/cron-authorization',
    name: 'requireCronAuthorization',
    kind: 'cron',
    scope: CRON,
    result: DENIAL_RESULT,
  },
  {
    module: 'apps/services/api/src/host/tenant-cron',
    name: 'requireCronAuthorization',
    kind: 'cron',
    scope: CRON,
    result: DENIAL_RESULT,
  },
  {
    module: 'apps/services/api/src/host/tenant-cron',
    name: 'runTenantCron',
    kind: 'cron',
    scope: CRON,
    result: RESPONSE_RESULT,
    callbacks: [1],
  },
  {
    module: 'apps/services/api/src/host/runtime',
    name: 'resolvePublicTenant',
    kind: 'public-tenant',
    excluded: ADMIN,
    result: NULLABLE_RESULT,
  },
  {
    module: 'apps/services/api/src/host/runtime',
    name: 'resolvePublicRequestTenant',
    kind: 'public-tenant',
    excluded: ADMIN,
    result: OK_RESULT,
    requestArgument: 0,
  },
  {
    module: 'apps/services/api/src/host/session',
    name: 'getServerSession',
    kind: 'identity',
    scope: ACCOUNT_SESSION_ROUTES,
    result: NULLABLE_RESULT,
  },
  {
    module: 'apps/services/api/src/host/session',
    name: 'handleIdentityRequest',
    kind: 'identity',
    scope: AUTH,
    result: RESPONSE_RESULT,
  },
  {
    module: 'next-auth',
    name: 'default',
    kind: 'identity',
    scope: AUTH,
    result: OPAQUE_RESULT,
  },
]

/** Host preparation for /current only; it never counts as an authorization gate. */
const CURRENT_HOST_RESOLVERS = [
  {
    module: 'apps/services/api/src/host/runtime',
    name: 'resolveCurrentOrganizationTenant',
  },
]

/** Gate kinds that authorize by the session cookie (a CSRF target). */
const COOKIE_KINDS: ReadonlySet<Kind> = new Set<Kind>([
  'tenant-permission',
  'tenant-principal',
  'role',
  'identity',
])
/** Cookie gates whose helper applies the same-origin guard itself (see the source self-check). */
const CENTRAL_KINDS: ReadonlySet<Kind> = new Set<Kind>([
  'tenant-permission',
  'tenant-principal',
  'role',
])
const IDENTITY_MODULE = '@gb-locacoes/backend/identity'

/**
 * CSRF pass: reading the session or the request headers changes nothing, so
 * the same-origin guard may follow these helpers at once.
 */
const CSRF_INERT: Array<{ module: string; names: string[] }> = [
  { module: 'apps/services/api/src/host/session', names: ['getServerSession'] },
  { module: 'next/headers', names: ['headers'] },
]
/**
 * Cookie mutations that rely on the framework's own CSRF defence instead of
 * the same-origin guard.
 */
const OWN_CSRF_DEFENCE: Record<string, { methods: string[]; reason: string }> =
  {
    'apps/services/api/src/app/api/auth/[...nextauth]/route.ts': {
      methods: ['POST'],
      reason:
        'The same NextAuth double-submit token or Better Auth exact-origin defence as the legacy engine; real host bindings and HTTP refusals are tested.',
    },
    'apps/services/api/src/app/api/auth/v2/[...all]/route.ts': {
      methods: ['POST'],
      reason:
        'The same Better Auth exact-origin defence and inactive-engine 410 as the legacy adapter; no sibling-tenant trust is added.',
    },
  }

/**
 * Known gaps of routes outside the security batch, kept exact: each entry
 * must still be a cookie mutation that fails the CSRF pass, so fixing the
 * route fails this list until the entry is removed.
 */
const CSRF_PENDING: Record<string, { methods: string[]; reason: string }> = {}

/**
 * Meta verification handshake (webhook namespace only): the integration
 * lookup may run first, and the constant-time verify token comparison must
 * leave the handler on mismatch.
 */
const HANDSHAKES = [
  {
    lookup: {
      module: 'apps/services/api/src/host/webhook-authentication',
      name: 'resolveWebhookIntegration',
    },
    verify: { module: '@gb-locacoes/backend/identity', name: 'secretsMatch' },
  },
]
/** Membership roles that may pass an /api/admin role check (Role minus CLIENT). */
const STAFF_ROLES = new Set(['ADMIN', 'FINANCIAL', 'OPERATOR'])

/**
 * Helpers that scope what they return by an owner argument and refuse any
 * other CLIENT themselves (`owner`: the position of that argument). Kept in
 * sync with their source by a self-check.
 */
const OWNER_SCOPED: Array<{
  module: string
  name: string
  owner: number
  source: string
}> = [
  {
    module: 'apps/services/api/src/host/client-documents',
    name: 'listClientDocuments',
    owner: 1,
    source: 'packages/backend/src/modules/customers/client-documents.ts',
  },
]
/** Calls that hand their callback the data client: the queries inside are the accesses, not the call. */
const DATA_SCOPES = [
  {
    module: 'apps/services/api/src/host/tenant-transaction',
    name: 'withTenantTransaction',
  },
]
/** Query operators that create records from `data` (every other one is scoped by its `where`). */
const CREATE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
])

/**
 * Composition roots a route module may run when it loads (`const profiles = createCustomerProfileService({...})`):
 * service factories that only close over the dependencies they receive and touch no data when called. Any other
 * call at load time but zod and INERT globals fails (loadProblem). Kept in sync with the source (factoryProblems).
 */
const LOAD_TIME_FACTORIES: Array<{
  module: string
  name: string
  source: string
}> = [
  {
    module: '@gb-locacoes/backend/identity',
    name: 'createCredentialAccounts',
    source: 'packages/backend/src/modules/identity/credential-accounts.ts',
  },
  {
    module: '@gb-locacoes/backend/http',
    name: 'createCredentialAccountHandlers',
    source: 'packages/backend/src/http/credential-accounts.ts',
  },
  {
    module: '@gb-locacoes/backend/identity',
    name: 'createTenantWebhookAuthentication',
    source: 'packages/backend/src/modules/identity/tenant-webhook.ts',
  },
  {
    module: '@gb-locacoes/backend/identity',
    name: 'createTenantPermissionResolver',
    source: 'packages/backend/src/modules/identity/tenant-permission.ts',
  },
  {
    module: '@gb-locacoes/backend/identity',
    name: 'createTenantPrincipalResolver',
    source: 'packages/backend/src/modules/identity/tenant-request-principal.ts',
  },
  {
    module: '@gb-locacoes/backend/identity',
    name: 'createPublicTenantResolver',
    source: 'packages/backend/src/modules/identity/public-tenant.ts',
  },
  {
    module: '@gb-locacoes/backend/rentals',
    name: 'createRentalAvailability',
    source: 'packages/backend/src/modules/rentals/availability.ts',
  },
  ...[
    ['createPublicCategoriesHandler', 'categories'],
    ['createPublicEquipmentsHandler', 'equipments'],
    ['createPublicEquipmentSearchHandler', 'equipment-search'],
    ['createPublicEquipmentAvailabilityHandler', 'equipment-availability'],
    ['createPublicEquipmentDetailHandler', 'equipment-detail'],
    ['createPublicTenantCardHandler', 'tenant-card'],
    ['createPublicDirectorySearchHandler', 'directory-search'],
    ['createPublicSettingsHandler', 'public-settings'],
    // Onda 134: texto legal da vitrine por locadora (superfície identity, só leitura).
    ['createPublicStorefrontLegalHandler', 'storefront-legal'],
    ['createHealthHandler', 'health'],
    ['createAsaasWebhookReceiver', 'asaas-webhook'],
    ['createOrganizationSelectionHandler', 'organization-selection-handler'],
    ['createDreiAssetProxy', 'drei-assets'],
  ].map(([name, source]) => ({
    module: '@gb-locacoes/backend/http',
    name: name!,
    source: `packages/backend/src/http/${source}.ts`,
  })),
  {
    module: '@gb-locacoes/backend/customers',
    name: 'createCustomerEnrollmentService',
    source: 'packages/backend/src/modules/customers/enroll.ts',
  },
  {
    module: '@gb-locacoes/backend/customers',
    name: 'createCustomerProfileService',
    source: 'packages/backend/src/modules/customers/profile.ts',
  },
]

/**
 * Project functions INERT code may call: they build a response or read the request and the environment, and
 * reach no data. Any other import is only a literal constant or a class of INERT_CLASSES after `instanceof` (an
 * error check); `NextResponse` is in INERT_IMPORT_CALLS.
 */
const INERT_IMPORTS: Array<{ module: string; names: string[] }> = [
  {
    module: '@gb-locacoes/backend/http',
    names: [
      'organizationCurrentResponse',
      'zohoOAuthAuthorizationFailure',
      'successResponse',
    ],
  },
  {
    module: 'packages/backend/src/http/organization-selection',
    names: ['organizationSelectionResponse'],
  },
  {
    module: IDENTITY_MODULE,
    names: ['selectedTenantPreferenceCookie'],
  },
  {
    module: IDENTITY_MODULE,
    names: [
      'rejectCrossOriginMutation',
      'isSameOriginMutation',
      'identityMode',
    ],
  },
  {
    module: 'apps/services/api/src/host/mutation-origin',
    names: ['isTrustedMutationOrigin'],
  },
]
/**
 * The classes INERT code may name after `instanceof` (the error checks of a catch around the guard), a closed list
 * (finding 111): `instanceof` runs the Symbol.hasInstance of its right side, or reads its `prototype`, so any other
 * value there (another import, a namespace or member chain, a class of the file, a variable) may run code before
 * the guard. The right side is a global of INERT_GLOBAL_CLASSES by its bare name, or an entry below named as it is
 * imported (`member` of the binding for `z.ZodError`) from the module listed, the package as installed for zod
 * (installedPackage). zod's ZodError owns a non-configurable Symbol.hasInstance that checks its argument's zod
 * traits. The project classes name their `source` and are kept in sync with it (inertClassProblems): the class the
 * module exports, `export class X extends Error` without static members, computed names or decorators. Neither
 * they nor the globals are changed or handed over anywhere in the server source (sealedClassProblems).
 */
const INERT_GLOBAL_CLASSES: ReadonlySet<string> = new Set([
  'Error',
  'TypeError',
  'SyntaxError',
  'Response',
])
const INERT_CLASSES: Array<{
  module: string
  name: string
  member?: string
  source?: string
}> = [
  { module: 'zod', name: 'ZodError' },
  { module: 'zod', name: 'z', member: 'ZodError' },
  {
    module: 'packages/backend/src/modules/catalog/errors',
    name: 'CatalogError',
    source: 'packages/backend/src/modules/catalog/errors.ts',
  },
  {
    module: '@gb-locacoes/backend/catalog',
    name: 'CatalogError',
    source: 'packages/backend/src/modules/catalog/errors.ts',
  },
  {
    module: 'packages/backend/src/modules/rentals/errors',
    name: 'RentalMutationError',
    source: 'packages/backend/src/modules/rentals/errors.ts',
  },
  {
    module: '@gb-locacoes/backend/rentals',
    name: 'RentalMutationError',
    source: 'packages/backend/src/modules/rentals/errors.ts',
  },
  {
    module: 'packages/backend/src/modules/operations/vehicles',
    name: 'VehicleError',
    source: 'packages/backend/src/modules/operations/vehicles.ts',
  },
  {
    module: '@gb-locacoes/backend/operations',
    name: 'VehicleError',
    source: 'packages/backend/src/modules/operations/vehicles.ts',
  },
  {
    module: 'packages/backend/src/modules/quotations/update',
    name: 'QuoteUpdateRejected',
    source: 'packages/backend/src/modules/quotations/update.ts',
  },
  {
    module: 'apps/services/api/src/host/quotations',
    name: 'QuoteUpdateRejected',
    source: 'packages/backend/src/modules/quotations/update.ts',
  },
  {
    module: 'packages/backend/src/modules/customers/errors',
    name: 'CustomerError',
    source: 'packages/backend/src/modules/customers/errors.ts',
  },
  {
    module: '@gb-locacoes/backend/customers',
    name: 'CustomerError',
    source: 'packages/backend/src/modules/customers/errors.ts',
  },
  {
    module: '@gb-locacoes/backend/customers',
    name: 'EnrollmentError',
    source: 'packages/backend/src/modules/customers/enroll.ts',
  },
  {
    module: 'packages/backend/src/modules/billing/payment-errors',
    name: 'PaymentRequestError',
    source: 'packages/backend/src/modules/billing/payment-errors.ts',
  },
  {
    module: '@gb-locacoes/backend/billing',
    name: 'PaymentRequestError',
    source: 'packages/backend/src/modules/billing/payment-errors.ts',
  },
  {
    module: 'packages/backend/src/modules/communications/tenant-branding',
    name: 'TenantBrandingError',
    source: 'packages/backend/src/modules/communications/tenant-branding.ts',
  },
  {
    module: '@gb-locacoes/backend/communications',
    name: 'TenantBrandingError',
    source: 'packages/backend/src/modules/communications/tenant-branding.ts',
  },
  {
    module: 'packages/backend/src/modules/documents/private-documents',
    name: 'InvalidDocumentError',
    source: 'packages/backend/src/modules/documents/private-documents.ts',
  },
  {
    module: '@gb-locacoes/backend/documents',
    name: 'InvalidDocumentError',
    source: 'packages/backend/src/modules/documents/private-documents.ts',
  },
  {
    module: 'packages/backend/src/modules/documents/rental-contracts',
    name: 'ContractAccessError',
    source: 'packages/backend/src/modules/documents/rental-contracts.ts',
  },
  {
    module: '@gb-locacoes/backend/documents',
    name: 'ContractAccessError',
    source: 'packages/backend/src/modules/documents/rental-contracts.ts',
  },
  {
    module: 'packages/backend/src/modules/catalog/image-upload',
    name: 'InvalidImageError',
    source: 'packages/backend/src/modules/catalog/image-upload.ts',
  },
  {
    module: '@gb-locacoes/backend/catalog',
    name: 'InvalidImageError',
    source: 'packages/backend/src/modules/catalog/image-upload.ts',
  },
]
/**
 * Whether `binding` imports the package these self-checks run as installed (zod: the runtime checks below import
 * it from this file): its bare specifier, resolved to the same name@version. A project file or an alias posing as
 * the package (`@/zod`, `paths`), or another install of it, is not (findings 111, 112).
 */
function installedPackage(
  binding: Binding | undefined
): binding is Binding & { package: string } {
  if (!binding?.package) return false
  const installed = packageOf(
    path.join(ROOT, 'tests/security/route-auth-inventory.test.ts'),
    binding.module
  )
  return !!installed && binding.package === installed
}
/** The global object of the server (`window`, `self` do not exist there: code naming them throws). */
const SERVER_GLOBAL_OBJECTS: ReadonlySet<string> = new Set([
  'globalThis',
  'global',
])
/** The members of a sealed class the server source may call (`Response.json(...)`): a closed list. */
const SEALED_CALLS: ReadonlySet<string> = new Set(['Response.json'])
/**
 * The rate limit PROLOGUE form: `checkRateLimit(request, <limiter>)` with one of these limiters of
 * the API host facade over packages/backend/src/http/memory-rate-limit.ts: per-instance counters in memory
 * (no database; kept in sync with the source). The former lib/rate-limit facade was retired in F.
 */
const MEMORY_LIMITERS = [
  'authRateLimit',
  'apiRateLimit',
  'adminApiRateLimit',
  'strictRateLimit',
]
const MEMORY_FACADES = ['apps/services/api/src/host/rate-limit']
const MEMORY_SOURCE = 'packages/backend/src/http/memory-rate-limit.ts'
/**
 * Project functions a guard may delegate to (`return downloadQuoteDocument(request, id, 'admin')`): each one
 * is checked with the same rule, its parameters bound to the literals of the call. `canManageContracts` is
 * a role predicate (`return ['ADMIN', 'OPERATOR'].includes(principal.role)`).
 */
const DELEGATES = [
  {
    module: 'apps/services/api/src/host/documents',
    name: 'downloadQuoteDocument',
  },
  {
    module: 'apps/services/api/src/host/organization-selection',
    name: 'organizationSelection',
  },
  {
    module: 'apps/services/api/src/host/contracts',
    name: 'canManageContracts',
  },
]
/**
 * The one refusal a HANDLER_WRAPPERS entry runs before the guard (wave 133, finding 149): the NextAuth reads with an
 * explicit foreign Origin get the central 403 before the engine and its storage. It reads only the request and the
 * environment; what it reaches is pinned (`reaches`, the sorted references of `reach`), so data access or another
 * import there fails the sync check.
 */
const NEXTAUTH_READ_REFUSAL = {
  module: 'packages/backend/src/modules/identity/engine-read-origin',
  name: 'refuseNextAuthRead',
  source: 'packages/backend/src/modules/identity/engine-read-origin.ts',
  // The central rule only (INERT_IMPORTS lists its mutation twin): request headers, URL and environment.
  reaches: [
    'packages/backend/src/modules/identity/same-origin-mutation#rejectExplicitCrossOrigin',
  ],
}
/**
 * Wrappers of a guard that return a handler calling the wrapped one before anything else
 * (`withSignInAvailability(NextAuth(authOptions))`), but for the approved `refusal` on the original request, whose
 * response is returned as is: `refusal(request) ?? post(await handler(request, context))`. Kept in sync with the
 * source.
 */
const HANDLER_WRAPPERS = [
  {
    module: '@gb-locacoes/backend/http',
    name: 'withSignInAvailability',
    source: 'packages/backend/src/http/legacy-auth-response.ts',
    refusal: NEXTAUTH_READ_REFUSAL,
  },
]
/** Prisma delegate operations: a call named like one of these is a query. */
const PRISMA_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
])
/** Filter operators and combinators: never a field that names the owner. */
const FILTER_OPERATORS = new Set([
  'equals',
  'not',
  'in',
  'notIn',
  'lt',
  'lte',
  'gt',
  'gte',
  'contains',
  'startsWith',
  'endsWith',
  'mode',
  'search',
  'has',
  'hasSome',
  'hasEvery',
  'isEmpty',
  'some',
  'every',
  'none',
  'is',
  'isNot',
  'AND',
  'OR',
  'NOT',
])

type Invariant = {
  /** Imported bindings the method may reference (module#name, `module#*` for any). */
  references: string[]
  /** Numeric status literal the method must contain. */
  status?: number
  /** The method (and what its module runs when it loads) is INERT code: it reaches nothing at all. */
  inert?: true
}
const RETIRED: Invariant = { references: [], status: 410, inert: true }
/**
 * Anonymous identity flows (sign-up, password reset, e-mail verification):
 * platform accounts and identity tokens only, never tenant data.
 */
const IDENTITY_FLOW: Invariant = {
  references: [
    'apps/services/api/src/host/credential-accounts#credentialAccountHandlers',
    `${IDENTITY_MODULE}#rejectCrossOriginMutation`,
    'tests/security/fixtures/authorization-scanner-data#prisma',
    '@prisma/client#Prisma',
    'bcryptjs#default',
    'node:crypto#*',
    'next/server#*',
    'zod#*',
  ],
}
/** Explicit public surface. Anything else must pass a gate from GUARDS. */
const API_PUBLIC_COMPOSITION: Invariant = {
  references: [
    'apps/services/api/src/host/runtime#resolvePublicRequestTenant',
    '@gb-locacoes/backend/identity#publicCacheHeaders',
    '@gb-locacoes/backend/identity#publicSiteHeaders',
    '@gb-locacoes/backend/identity#publicTenantNotFound',
    '@gb-locacoes/backend/rentals#RentalMutationError',
    '@gb-locacoes/contracts/storefront-legal#storefrontLegalKindFromSlug',
    '@gb-locacoes/backend/identity#createPublicTenantResolver',
    '@gb-locacoes/backend/identity#withTenantTransaction',
    '@gb-locacoes/backend/identity#clientIpFromHeaders',
    '@gb-locacoes/backend/catalog#createPublicCatalog',
    '@gb-locacoes/backend/rentals#createRentalAvailability',
    '@gb-locacoes/backend/runtime#getDatabaseRuntime',
    '@gb-locacoes/backend/directory#consumeDirectorySearchRateLimit',
    '@gb-locacoes/backend/directory#prismaRateLimitCounter',
    '@gb-locacoes/backend/directory#identityRateLimitSecret',
    '@gb-locacoes/backend/directory#readPublicTenantCard',
    '@gb-locacoes/backend/directory#searchDirectory',
    '@gb-locacoes/backend/http#createPublicCategoriesHandler',
    '@gb-locacoes/backend/http#createPublicEquipmentsHandler',
    '@gb-locacoes/backend/http#createPublicEquipmentSearchHandler',
    '@gb-locacoes/backend/http#createPublicEquipmentAvailabilityHandler',
    '@gb-locacoes/backend/http#createPublicEquipmentDetailHandler',
    '@gb-locacoes/backend/http#createPublicTenantCardHandler',
    '@gb-locacoes/backend/http#createPublicDirectorySearchHandler',
    '@gb-locacoes/backend/http#createPublicSettingsHandler',
    '@gb-locacoes/backend/http#createPublicStorefrontLegalHandler',
    '@gb-locacoes/backend/http#createHealthHandler',
  ],
}
const PUBLIC_ALLOWLIST: Record<
  string,
  { methods: string[]; reason: string; invariant: Invariant }
> = {
  'apps/services/api/src/app/api/auth/register/route.ts': {
    methods: ['POST'],
    reason:
      'The shared account policy preserves anonymous, limited, neutral platform registration; same-origin refusal precedes the composition.',
    invariant: IDENTITY_FLOW,
  },
  'apps/services/api/src/app/api/auth/forgot-password/route.ts': {
    methods: ['POST'],
    reason:
      'The shared recovery policy preserves the neutral response, deferred work, budget and hashed platform token; same-origin refusal precedes effects.',
    invariant: IDENTITY_FLOW,
  },
  'apps/services/api/src/app/api/auth/reset-password/route.ts': {
    methods: ['POST'],
    reason:
      'The existing single-use platform token authorizes the shared credential update; same-origin refusal precedes effects.',
    invariant: IDENTITY_FLOW,
  },
  'apps/services/api/src/app/api/auth/verify-email/route.ts': {
    methods: ['GET'],
    reason:
      'The existing single-use e-mail token authorizes platform verification in the shared service; legacy redirect semantics are preserved.',
    invariant: IDENTITY_FLOW,
  },
  'apps/services/api/src/app/api/contracts/zapsign-webhook/route.ts': {
    methods: ['POST'],
    reason: 'Retired (410) global webhook; integration-specific URL required.',
    invariant: RETIRED,
  },
  'apps/services/api/src/app/api/payments/pix/webhook/route.ts': {
    methods: ['POST'],
    reason: 'Retired (410) global webhook; integration-specific URL required.',
    invariant: RETIRED,
  },
  'apps/services/api/src/app/api/payments/boleto/webhook/route.ts': {
    methods: ['POST'],
    reason: 'Retired (410) global webhook; integration-specific URL required.',
    invariant: RETIRED,
  },
  'apps/services/api/src/app/api/categories/route.ts': {
    methods: ['GET'],
    reason:
      'Public categories for an explicitly resolved tenant; same shared catalog/RLS as the legacy host.',
    invariant: API_PUBLIC_COMPOSITION,
  },
  'apps/services/api/src/app/api/equipments/route.ts': {
    methods: ['GET'],
    reason:
      'Public equipment list for an explicitly resolved tenant, with the existing DTO and cache contract.',
    invariant: API_PUBLIC_COMPOSITION,
  },
  'apps/services/api/src/app/api/equipamentos/search/route.ts': {
    methods: ['GET'],
    reason:
      'Public equipment search, scoped to the explicitly resolved tenant with existing input limits.',
    invariant: API_PUBLIC_COMPOSITION,
  },
  'apps/services/api/src/app/api/equipments/[id]/availability/route.ts': {
    methods: ['GET'],
    reason:
      'Public availability computed within the resolved tenant transaction; no private rental DTO.',
    invariant: API_PUBLIC_COMPOSITION,
  },
  'apps/services/api/src/app/api/equipments/[id]/route.ts': {
    methods: ['GET'],
    reason:
      'Public detail filtered by id and the resolved tenant, using the canonical public projection.',
    invariant: API_PUBLIC_COMPOSITION,
  },
  'apps/services/api/src/app/api/settings/public/route.ts': {
    methods: ['GET'],
    reason:
      'Public settings projection for one resolved tenant; credentials and custom scripts are excluded.',
    invariant: API_PUBLIC_COMPOSITION,
  },
  'apps/services/api/src/app/api/settings/public/legal-documents/[kind]/route.ts':
    {
      methods: ['GET'],
      reason:
        'Published storefront legal text (wave 134) of one tenant resolved on the identity surface; validated text blocks only, read in the tenant transaction.',
      invariant: API_PUBLIC_COMPOSITION,
    },
  'apps/services/api/src/app/api/public/tenants/[slug]/route.ts': {
    methods: ['GET'],
    reason:
      'Anonymous public tenant card; slug/edge conflict rejected and logo read under tenant RLS.',
    invariant: API_PUBLIC_COMPOSITION,
  },
  'apps/services/api/src/app/api/public/tenants/route.ts': {
    methods: ['GET'],
    reason:
      'Opted-in active tenant directory; bounded public DTO and persistent shared per-IP rate limit.',
    invariant: API_PUBLIC_COMPOSITION,
  },
  'apps/services/api/src/app/api/onboarding/options/route.ts': {
    methods: ['GET'],
    reason:
      'Anonymous app-bound signup options; only hash-verified published texts and public site key, no database or mutation.',
    invariant: {
      references: [
        '@gb-locacoes/backend/runtime#handleConfiguredOnboardingOptions',
      ],
    },
  },
  'apps/services/api/src/app/api/auth/owner-register/route.ts': {
    methods: ['POST'],
    reason:
      'Anonymous minimum owner account in a genuine app context; signup/configuration, persistent budgets, captcha and compromised-password checks precede the existing neutral identity adapter.',
    invariant: {
      references: [
        'apps/services/api/src/host/credential-accounts#ownerAccountHandlers',
      ],
    },
  },
  'apps/services/api/src/app/api/public/plans/route.ts': {
    methods: ['GET'],
    reason:
      'Published sale offers only, strict public subscription DTO, isolated platform READ ONLY transaction.',
    invariant: {
      references: ['@gb-locacoes/backend/runtime#readConfiguredPublicPlans'],
    },
  },
  'apps/services/api/src/app/api/health/route.ts': {
    methods: ['GET'],
    reason:
      'Anonymous readiness probe SELECT 1 with neutral response and existing health status contract.',
    invariant: API_PUBLIC_COMPOSITION,
  },
  'apps/services/api/src/app/api/[...rest]/route.ts': {
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    reason:
      'Same neutral JSON 404 contract for unknown API paths in the partial service; no identity or data access.',
    invariant: { references: [], status: 404, inert: true },
  },
  'apps/services/api/src/app/api/drei-proxy/[...path]/route.ts': {
    methods: ['GET'],
    reason:
      'Same pinned public HDR proxy, shared path validation, opaque bytes and no CORS; no tenant data or credentials.',
    invariant: {
      references: [
        '@gb-locacoes/backend/http#createDreiAssetProxy',
        '<global>#fetch',
      ],
    },
  },
  'apps/services/api/src/app/api/admin/analytics/route.ts': {
    methods: ['GET'],
    reason:
      'Same retired (410) analytics contract in the partial service; no identity, telemetry or database lookup is permitted.',
    invariant: RETIRED,
  },
  'apps/services/api/src/app/api/admin/security/route.ts': {
    methods: ['GET'],
    reason:
      'Same retired (410) security contract in the partial service; no identity, telemetry or database lookup is permitted.',
    invariant: RETIRED,
  },
  'apps/services/api/src/app/api/admin/seed-admin/route.ts': {
    methods: ['GET', 'POST'],
    reason:
      'Same retired (410) operational contract; no provisioning or identity lookup.',
    invariant: RETIRED,
  },
  'apps/services/api/src/app/api/test-login/route.ts': {
    methods: ['POST'],
    reason:
      'Same retired (410) operational contract; no login or identity lookup.',
    invariant: RETIRED,
  },
  'apps/services/api/src/app/api/fix-storage/route.ts': {
    methods: ['POST'],
    reason:
      'Same retired (410) operational contract; no storage or data effects.',
    invariant: RETIRED,
  },
  'apps/services/api/src/app/api/supabase-setup/route.ts': {
    methods: ['GET', 'POST'],
    reason:
      'Same retired (410) operational contract; no setup, storage or data effects.',
    invariant: RETIRED,
  },
  'apps/services/api/src/app/api/webhooks/whatsapp/route.ts': {
    methods: ['GET', 'POST'],
    reason:
      'Same retired (410) global webhook contract in the partial service; no effect or integration lookup is permitted.',
    invariant: RETIRED,
  },
  'apps/clients/web/src/app/(public)/[locadora]/robots.txt/route.ts': {
    methods: ['GET'],
    reason:
      'Public robots.txt of the host tenant (ADR adr-tenant-hosts D12, S13): only the site mode of the public card through the server-only gateway; OFF is the neutral 404.',
    invariant: {
      references: [
        'apps/clients/web/src/host/server/public-api#fetchPublicSite',
        'apps/clients/web/src/host/server/site-state#SITE_PAUSED_PAGE',
        '@gb-locacoes/contracts/platform#isTenantSlug',
        '@gb-locacoes/contracts/platform#resolveWebPlatformEnv',
        '@gb-locacoes/contracts/platform#canonicalOrigin',
        'next/navigation#notFound',
      ],
    },
  },
  'apps/clients/web/src/app/(public)/[locadora]/sitemap.xml/route.ts': {
    methods: ['GET'],
    reason:
      'Public sitemap.xml of the host tenant (ADR adr-tenant-hosts D12, S13): public card, public catalog ids and the public settings (which legal pages are published, wave 134) through the server-only gateway; OFF is the neutral 404.',
    invariant: {
      references: [
        'apps/clients/web/src/host/server/public-api#fetchPublicSite',
        'apps/clients/web/src/host/server/public-api#fetchPublicSitemapCatalog',
        'apps/clients/web/src/host/server/public-api#fetchPublicSettings',
        '@gb-locacoes/contracts/platform#isTenantSlug',
        '@gb-locacoes/contracts/platform#resolveWebPlatformEnv',
        '@gb-locacoes/contracts/platform#canonicalOrigin',
        'next/navigation#notFound',
      ],
    },
  },
}
/**
 * Methods that public tenant resolution (resolvePublicTenant,
 * resolvePublicRequestTenant) may authorize: the anonymous catalog/storefront
 * of the tenant host. Anywhere else a public tenant is not an authorization:
 * a private route that swapped resolveTenantPrincipal for it fails.
 */
const PUBLIC_TENANT_SURFACE: Record<
  string,
  { methods: string[]; reason: string }
> = {
  'apps/services/api/src/app/api/settings/public/legal-documents/[kind]/route.ts':
    {
      methods: ['GET'],
      reason:
        'Published storefront legal text (wave 134) of one tenant resolved on the identity surface; validated text blocks only, read in the tenant transaction.',
    },
  'apps/services/api/src/app/api/categories/route.ts': {
    methods: ['GET'],
    reason: 'Public category catalog of the host tenant.',
  },
  'apps/services/api/src/app/api/equipments/route.ts': {
    methods: ['GET'],
    reason: 'Public equipment catalog of the host tenant.',
  },
  'apps/services/api/src/app/api/equipments/[id]/route.ts': {
    methods: ['GET'],
    reason: 'Public equipment detail of the host tenant.',
  },
  'apps/services/api/src/app/api/equipments/[id]/availability/route.ts': {
    methods: ['GET'],
    reason: 'Public availability calendar of one equipment of the host tenant.',
  },
  'apps/services/api/src/app/api/equipamentos/search/route.ts': {
    methods: ['GET'],
    reason: 'Public catalog search of the host tenant.',
  },
  'apps/services/api/src/app/api/settings/public/route.ts': {
    methods: ['GET'],
    reason:
      'Public storefront settings (branding, contacts) of the host tenant.',
  },
  'apps/services/api/src/app/api/public/tenants/[slug]/route.ts': {
    methods: ['GET'],
    reason: 'Public profile of one active tenant (ADR adr-tenant-hosts).',
  },
  'apps/services/api/src/app/api/contact/route.ts': {
    methods: ['POST'],
    reason:
      'Same anonymous contact request: validated tenant and origin precede the shared quote/outbox transaction.',
  },
  'apps/services/api/src/app/api/quotes/route.ts': {
    methods: ['POST'],
    reason:
      'Same anonymous quote request: the validated host tenant precedes the shared transaction; optional session does not bypass the same-origin guard.',
  },
  'apps/services/api/src/app/api/orcamentos/route.ts': {
    methods: ['POST'],
    reason:
      'Same localized alias of POST /api/quotes, preserving its tenant and same-origin guards and non-201 refusals.',
  },
  'apps/services/api/src/app/api/client/enroll/route.ts': {
    methods: ['POST'],
    reason:
      'Same host-only explicit-consent enrollment as the legacy adapter; validated tenant, session and same-origin guard precede the shared transaction.',
  },
}

/**
 * An imported binding. `module` names one module only (moduleBinding): a project file by its canonical id, an
 * installed package by its bare specifier (`package`: its name@version as resolved), or an id no list names.
 */
type Binding = { module: string; name: string; file?: string; package?: string }
type ExportEntry = {
  node?: ts.Node
  local?: string
  from?: Binding
  /** `export const { GET } = source`: the property read from `source`. */
  destructured?: { source: ts.Expression; property: string }
}
type ModuleInfo = {
  file: string
  id: string
  source: ts.SourceFile
  imports: Map<string, Binding>
  locals: Map<string, ts.Node>
  exports: Map<string, ExportEntry>
  /** `export * from '...'` targets. */
  stars: Binding[]
  /**
   * Every name the file binds somewhere (parameters, catch and loop variables, nested declarations), ambient
   * `declare` forms excluded: an identifier outside this set, the imports and the known globals is a global
   * the file did not declare.
   */
  bound: Set<string>
}
type Call = Binding & { node: ts.CallExpression }
type Facts = {
  calls: Call[]
  references: Set<string>
  statuses: Set<number>
  followed: string[]
}

const posix = (value: string) => value.split(path.sep).join('/')
const relative = (file: string) => posix(path.relative(ROOT, file))
const withoutExtension = (id: string) =>
  id.replace(/\.(?:[cm]?[jt]sx?)$/, '').replace(/\/index$/, '')

/**
 * In-memory declarations for authorization-scanner-data.ts below, plus temporary self-check shadows such as
 * zod.ts or backend catalog errors/index.ts, keyed by absolute path. They resolve and parse as if on disk;
 * each self-check removes its temporary entry in finally, preserving the declared fixture module.
 */
const FIXTURE_FILES = new Map<string, string>([
  [
    path.join(ROOT, 'tests/security/fixtures/authorization-scanner-data.ts'),
    'export declare const prisma: import("@prisma/client").PrismaClient\n' +
      'export declare function listPublicCategories(context: unknown): Promise<unknown>\n' +
      'export declare function getZohoAccessToken(): Promise<unknown>\n' +
      'export declare function makeZohoMailRequest(path: string): Promise<unknown>\n' +
      'export declare function cancelClientRentals(principal: unknown, owner: string): Promise<unknown>\n',
  ],
])
/** Whether each path is a file on disk: the tree does not change while the inventory runs. */
const onDisk = new Map<string, boolean>()
const isFile = (candidate: string) => {
  if (FIXTURE_FILES.has(path.resolve(candidate))) return true
  let found = onDisk.get(candidate)
  if (found === undefined) {
    found = fs.statSync(candidate, { throwIfNoEntry: false })?.isFile() ?? false
    onDisk.set(candidate, found)
  }
  return found
}

/** A specifier that names more than one file: see resolveModule. */
class AmbiguousModule extends Error {}
/**
 * The project file a specifier names, or undefined when none does. Throws AmbiguousModule when more than one
 * candidate of RESOLVE_SUFFIXES exists (errors.tsx or errors/index.ts beside packages/backend/src/modules/catalog/errors.ts):
 * Turbopack, webpack and TypeScript would load different files, and the analysis would read one the server may
 * not run. moduleBinding gives such a specifier an id no list names, analyzeRouteModule fails the routes that
 * import one, and a self-check fails any such pair in the server source.
 */
function resolveModule(fromFile: string, specifier: string): Binding['file'] {
  let base: string
  if (specifier.startsWith('@/')) base = path.join(ROOT, specifier.slice(2))
  else if (specifier.startsWith('.'))
    base = path.resolve(path.dirname(fromFile), specifier)
  else return undefined
  const candidates = (suffixes: string[]) =>
    suffixes.map((suffix) => base + suffix).filter(isFile)
  const scripts = candidates(SCRIPT_SUFFIXES)
  const found = scripts.length ? scripts : candidates(DATA_SUFFIXES)
  if (found.length > 1)
    throw new AmbiguousModule(
      `ambiguous module: '${specifier}' from ${relative(fromFile)} names ${found.map(relative).join(', ')} (Next and TypeScript may load different files: keep one)`
    )
  return found[0]
}

let projectOptions: ts.CompilerOptions | undefined
const packages = new Map<string, string | null | undefined>()
/**
 * What a bare specifier names, as TypeScript resolves it from `fromFile` with the project's options (its
 * `paths` included): `name@version` of an installed package, null when it resolves to a project file (an alias,
 * never a package) and undefined when it does not resolve (a Node built-in).
 */
function packageOf(
  fromFile: string,
  specifier: string
): string | null | undefined {
  const key = `${path.dirname(fromFile)}\n${specifier}`
  if (packages.has(key)) return packages.get(key)
  projectOptions ??=
    ts.getParsedCommandLineOfConfigFile(
      path.join(ROOT, 'tsconfig.json'),
      {},
      { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined }
    )?.options ?? {}
  const resolved = ts.resolveModuleName(
    specifier,
    fromFile,
    projectOptions,
    ts.sys
  ).resolvedModule
  const owner = !resolved
    ? undefined
    : resolved.isExternalLibraryImport && resolved.packageId
      ? `${resolved.packageId.name}@${resolved.packageId.version}`
      : null
  packages.set(key, owner)
  return owner
}

/**
 * The id of a project file (its path without extension) when that id names this file alone (findings 111, 112):
 * the id resolves back to the same file (not errors/index.ts or errors.mjs beside the backend catalog errors.ts),
 * and no installed package or Node built-in answers to it (not `zod.ts` or `next-auth.ts`
 * posing as the package). Otherwise undefined.
 */
function projectId(file: string): string | undefined {
  const id = withoutExtension(relative(file))
  const owner = id
    .split('/')
    .slice(0, id.startsWith('@') ? 2 : 1)
    .join('/')
  if (isBuiltin(owner) || fs.existsSync(path.join(ROOT, 'node_modules', owner)))
    return undefined
  let back: string | undefined
  try {
    back = moduleFile(id)
  } catch (error) {
    // Another file answers to the same id: this one is not its module alone.
    if (error instanceof AmbiguousModule) return undefined
    throw error
  }
  return back && path.resolve(back) === path.resolve(file) ? id : undefined
}

/**
 * The binding `import { name } from specifier` creates in `fromFile`. Every list names a module by this id, so it
 * never stands for another module: a project specifier (`@/`, `.`) is its canonical projectId, a bare one the
 * package it resolves to. Anything else gets an id no list names: `file:<path>` (a project file another id
 * owns, such as `@/zod`, `@/packages/backend/src/modules/catalog/errors/index`), `unresolved:<specifier>`, `ambiguous:<specifier>` (more than one
 * file answers to it) and `alias:<specifier>` (a bare specifier `paths` maps to project files).
 */
function moduleBinding(
  fromFile: string,
  specifier: string,
  name: string
): Binding {
  if (specifier.startsWith('@/') || specifier.startsWith('.')) {
    let file: string | undefined
    try {
      file = resolveModule(fromFile, specifier)
    } catch (error) {
      if (error instanceof AmbiguousModule)
        return { module: `ambiguous:${specifier}`, name }
      throw error
    }
    const id = file && projectId(file)
    if (id) return { module: id, name, file }
    return file
      ? { module: `file:${relative(file)}`, name, file }
      : { module: `unresolved:${specifier}`, name }
  }
  const owner = packageOf(fromFile, specifier)
  return owner === null
    ? { module: `alias:${specifier}`, name }
    : { module: specifier, name, ...(owner ? { package: owner } : {}) }
}

const unwrap = (node: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(node) ||
  ts.isAwaitExpression(node) ||
  ts.isAsExpression(node) ||
  ts.isNonNullExpression(node) ||
  ts.isSatisfiesExpression(node) ||
  ts.isTypeAssertionExpression(node)
    ? unwrap(node.expression)
    : node

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind)

const propertyText = (name: ts.Node | undefined): string | undefined =>
  name &&
  (ts.isIdentifier(name) ||
    ts.isStringLiteralLike(name) ||
    ts.isNumericLiteral(name))
    ? name.text
    : undefined

/** Every identifier bound by a (possibly nested) binding name. */
function boundNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text]
  return name.elements.flatMap((element) =>
    ts.isBindingElement(element) ? boundNames(element.name) : []
  )
}

/** Names bound anywhere in `source`, except ambient `declare` forms (they name globals of the runtime). */
function boundInFile(source: ts.SourceFile): Set<string> {
  const bound = new Set<string>()
  const visit = (node: ts.Node) => {
    if (
      ts.isModuleDeclaration(node) ||
      hasModifier(node, ts.SyntaxKind.DeclareKeyword)
    )
      return
    if (
      ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isBindingElement(node)
    ) {
      if (ts.isIdentifier(node.name)) bound.add(node.name.text)
    } else if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isClassDeclaration(node) ||
        ts.isClassExpression(node) ||
        ts.isEnumDeclaration(node)) &&
      node.name
    )
      bound.add(node.name.text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return bound
}

const cache = new Map<string, ModuleInfo>()
/** The module of each parsed source (in-memory fixtures included). */
const modules = new WeakMap<ts.SourceFile, ModuleInfo>()
function parseModule(file: string, text?: string): ModuleInfo {
  text ??= FIXTURE_FILES.get(path.resolve(file))
  const cached = text === undefined ? cache.get(file) : undefined
  if (cached) return cached
  const source = ts.createSourceFile(
    file,
    text ?? fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const info: ModuleInfo = {
    file,
    id: withoutExtension(relative(file)),
    source,
    imports: new Map(),
    locals: new Map(),
    exports: new Map(),
    stars: [],
    bound: boundInFile(source),
  }
  modules.set(source, info)
  for (const statement of source.statements) {
    if (ts.isClassDeclaration(statement) && statement.name)
      info.locals.set(statement.name.text, statement)
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.importClause &&
      !statement.importClause.isTypeOnly
    ) {
      const specifier = statement.moduleSpecifier.text
      const clause = statement.importClause
      if (clause.name)
        info.imports.set(
          clause.name.text,
          moduleBinding(file, specifier, 'default')
        )
      const named = clause.namedBindings
      if (named && ts.isNamespaceImport(named))
        info.imports.set(named.name.text, moduleBinding(file, specifier, '*'))
      if (named && ts.isNamedImports(named))
        for (const element of named.elements)
          if (!element.isTypeOnly)
            info.imports.set(
              element.name.text,
              moduleBinding(
                file,
                specifier,
                (element.propertyName ?? element.name).text
              )
            )
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      info.locals.set(statement.name.text, statement)
      if (hasModifier(statement, ts.SyntaxKind.ExportKeyword))
        info.exports.set(
          hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
            ? 'default'
            : statement.name.text,
          { node: statement }
        )
    } else if (ts.isVariableStatement(statement)) {
      const exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword)
      // `export let GET` may be reassigned: never resolved statically.
      const constant =
        (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer
        if (ts.isIdentifier(declaration.name)) {
          if (initializer) info.locals.set(declaration.name.text, initializer)
          if (exported)
            info.exports.set(
              declaration.name.text,
              constant && initializer ? { node: initializer } : {}
            )
        } else if (exported) {
          for (const element of declaration.name.elements) {
            if (!ts.isBindingElement(element)) continue
            const property =
              ts.isObjectBindingPattern(declaration.name) &&
              !element.dotDotDotToken &&
              ts.isIdentifier(element.name)
                ? propertyText(element.propertyName ?? element.name)
                : undefined
            for (const name of boundNames(element.name))
              info.exports.set(
                name,
                constant && initializer && property
                  ? { destructured: { source: initializer, property } }
                  : {}
              )
          }
        }
      }
    } else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      const specifier =
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : undefined
      const clause = statement.exportClause
      if (!clause) {
        if (specifier) info.stars.push(moduleBinding(file, specifier, '*'))
      } else if (ts.isNamespaceExport(clause)) {
        info.exports.set(
          clause.name.text,
          specifier ? { from: moduleBinding(file, specifier, '*') } : {}
        )
      } else {
        for (const element of clause.elements) {
          if (element.isTypeOnly) continue
          const original = (element.propertyName ?? element.name).text
          info.exports.set(
            element.name.text,
            specifier
              ? { from: moduleBinding(file, specifier, original) }
              : { local: original }
          )
        }
      }
    } else if (ts.isExportAssignment(statement)) {
      info.exports.set('default', { node: statement.expression })
    }
  }
  // `const { requireAdmin } = await import('@/middlewares/require-admin')`
  const dynamicImports = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer
    ) {
      const call = unwrap(node.initializer)
      if (
        ts.isCallExpression(call) &&
        call.expression.kind === ts.SyntaxKind.ImportKeyword &&
        call.arguments[0] &&
        ts.isStringLiteralLike(call.arguments[0])
      )
        for (const element of node.name.elements)
          if (ts.isIdentifier(element.name))
            info.imports.set(
              element.name.text,
              moduleBinding(
                file,
                call.arguments[0].text,
                element.propertyName && ts.isIdentifier(element.propertyName)
                  ? element.propertyName.text
                  : element.name.text
              )
            )
    }
    ts.forEachChild(node, dynamicImports)
  }
  dynamicImports(source)
  if (text === undefined) cache.set(file, info)
  return info
}

type Located = { info: ModuleInfo; node: ts.Node }

/** Object literal property `property` of `source` (inline or a same-module constant). */
function destructuredNode(
  info: ModuleInfo,
  source: ts.Expression,
  property: string
): Located | null {
  let value: ts.Node | undefined = unwrap(source)
  if (ts.isIdentifier(value)) {
    const local = info.locals.get(value.text)
    value = local && ts.isExpression(local) ? unwrap(local) : undefined
  }
  if (!value || !ts.isObjectLiteralExpression(value)) return null
  // A spread may override the property: not resolvable statically.
  if (value.properties.some((item) => ts.isSpreadAssignment(item))) return null
  for (const item of value.properties) {
    if (propertyText(item.name) !== property) continue
    if (ts.isPropertyAssignment(item)) return { info, node: item.initializer }
    if (ts.isShorthandPropertyAssignment(item)) return { info, node: item.name }
    if (ts.isMethodDeclaration(item)) return { info, node: item }
    return null
  }
  return null
}

function exportedNode(
  info: ModuleInfo,
  name: string,
  depth = 0
): Located | null {
  if (depth > 8) return null
  const entry = info.exports.get(name)
  if (!entry) {
    if (name === 'default') return null
    for (const star of info.stars) {
      const target = star.file
        ? exportedNode(parseModule(star.file), name, depth + 1)
        : null
      if (target) return target
    }
    return null
  }
  if (entry.node) {
    // `export const GET = handler` com `handler` importado é o mesmo valor de `export { handler as GET } from`:
    // segue para o módulo de origem, que responde pela rota (a especificação OpenAPI só lê `export const`).
    const imported =
      ts.isIdentifier(entry.node) && !info.locals.has(entry.node.text)
        ? info.imports.get(entry.node.text)
        : undefined
    return imported
      ? bindingNode(imported, depth + 1)
      : { info, node: entry.node }
  }
  if (entry.destructured)
    return destructuredNode(
      info,
      entry.destructured.source,
      entry.destructured.property
    )
  if (entry.local) {
    const local = info.locals.get(entry.local)
    if (local) return { info, node: local }
    const imported = info.imports.get(entry.local)
    return imported ? bindingNode(imported, depth + 1) : null
  }
  return entry.from ? bindingNode(entry.from, depth + 1) : null
}

const SELECTION_SOURCE =
  'packages/backend/src/http/organization-selection-handler.ts'
const SELECTION_FACADES = [
  {
    module: 'apps/services/api/src/host/organization-selection',
    session: 'apps/services/api/src/host/session',
    origin: 'apps/services/api/src/host/mutation-origin',
  },
] as const

/**
 * Instantiate this one verified closure for analysis, binding its real ports.
 * The policy text is copied from the canonical factory, never replaced by a
 * pre-approved guard: checkFunction still rejects missing/late session and
 * origin refusals. Unknown composition shapes fail closed.
 */
function selectionClosure(binding: Binding): Located | null {
  const facade = SELECTION_FACADES.find(
    (entry) => entry.module === binding.module
  )
  if (!facade || !binding.file || binding.name !== 'organizationSelection')
    return null
  const info = parseModule(binding.file)
  const call = info.locals.get(binding.name)
  if (
    !call ||
    !ts.isCallExpression(call) ||
    call.arguments.length !== 1 ||
    !sameBinding(importedCallee(call, info) ?? { module: '', name: '' }, {
      module: '@gb-locacoes/backend/http',
      name: 'createOrganizationSelectionHandler',
    })
  )
    return null
  const index = moduleFile('@gb-locacoes/backend/http')
  const exported =
    index &&
    exportedNode(parseModule(index), 'createOrganizationSelectionHandler')
  if (!exported || relative(exported.info.file) !== SELECTION_SOURCE)
    return null
  const entry = {
    module: '@gb-locacoes/backend/http',
    name: 'createOrganizationSelectionHandler',
    source: SELECTION_SOURCE,
  }
  if (factoryProblems(entry).length) return null
  const source = declaredFunction(SELECTION_SOURCE, entry.name)
  const body = source?.node.body
  const input = strip(call.arguments[0]!)
  if (
    !body ||
    body.statements.length !== 3 ||
    !ts.isObjectLiteralExpression(input) ||
    input.properties.length !== 4 ||
    input.properties.some(
      (property) =>
        !ts.isPropertyAssignment(property) &&
        !ts.isShorthandPropertyAssignment(property)
    )
  )
    return null
  const ports = new Map(
    input.properties.map((property) => [propertyText(property.name!), property])
  )
  if (
    ports.size !== 4 ||
    ![
      'getServerSession',
      'isTrustedMutationOrigin',
      'membership',
      'secure',
    ].every((name) => ports.has(name))
  )
    return null
  for (const [name, module] of [
    ['getServerSession', facade.session],
    ['isTrustedMutationOrigin', facade.origin],
  ]) {
    const port = ports.get(name!)
    if (
      !port ||
      !ts.isShorthandPropertyAssignment(port) ||
      !sameBinding(
        info.imports.get(port.name.text) ?? { module: '', name: '' },
        { module: module!, name: name! }
      )
    )
      return null
  }
  const membership = ports.get('membership')
  const secure = ports.get('secure')
  if (
    !membership ||
    !ts.isPropertyAssignment(membership) ||
    !ts.isArrowFunction(strip(membership.initializer)) ||
    !secure ||
    !ts.isPropertyAssignment(secure) ||
    !/^\(\)\s*=>\s*process\.env\.NODE_ENV === 'production'$/.test(
      secure.initializer.getText()
    )
  )
    return null
  const destructure = soleConst(body.statements[0])
  if (
    !destructure ||
    !ts.isObjectBindingPattern(destructure.name) ||
    destructure.initializer.getText() !== 'dependencies' ||
    destructure.name.elements.map((element) => element.getText()).join(',') !==
      'getServerSession,isTrustedMutationOrigin,membership'
  )
    return null
  const cookie = body.statements[1]!.getText()
  if (!/dependencies\.secure\(\)/.test(cookie)) return null
  const returned = body.statements[2]
  if (
    !returned ||
    !ts.isReturnStatement(returned) ||
    !returned.expression ||
    !ts.isFunctionExpression(returned.expression) ||
    returned.expression.name?.text !== 'organizationSelection'
  )
    return null
  // Retarget only relative imports; their file binding is unchanged.
  const imports = info.source.statements
    .filter(ts.isImportDeclaration)
    .map((statement) => {
      const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
      if (!specifier.startsWith('.')) return statement.getText()
      const target = resolveModule(info.file, specifier)
      return target
        ? statement
            .getText()
            .replace(specifier, `@/${relative(target).replace(/\.tsx?$/, '')}`)
        : ''
    })
  const sourceImports = source!.info.source.statements
    .filter(ts.isImportDeclaration)
    .map((statement) =>
      statement
        .getText()
        .replace('../modules/identity', '@gb-locacoes/backend/identity')
        .replace(
          './organization-selection',
          '@/packages/backend/src/http/organization-selection'
        )
    )
  const text = [
    ...sourceImports,
    ...imports,
    `const membership = ${membership.initializer.getText()}`,
    `const secure = ${secure.initializer.getText()}`,
    cookie.replace('dependencies.secure()', 'secure()'),
    `export ${returned.expression.getText()}`,
  ].join('\n')
  // Resolve the injected imports from their actual host, including the installed
  // workspace package identity (a package's self-import is a source alias).
  const closed = parseModule(binding.file, text)
  return exportedNode(closed, 'organizationSelection')
}

const PUBLIC_FACTORY_HOST = 'apps/services/api/src/host/runtime'
const PUBLIC_FACTORY_SOURCE = `${PUBLIC_FACTORY_HOST}.ts`
const PUBLIC_FACTORY_CLOSURES = [
  [
    'publicCategories',
    'createPublicCategoriesHandler',
    'categories',
    'categories',
    'listCategories',
    1,
    "{ tenantId: 'foreign' }",
  ],
  [
    'publicEquipments',
    'createPublicEquipmentsHandler',
    'equipments',
    'equipments',
    'listEquipments',
    1,
    "{ tenantId: 'foreign' }",
  ],
  [
    'equipmentSearch',
    'createPublicEquipmentSearchHandler',
    'equipment-search',
    'equipamentos/search',
    'searchEquipments',
    1,
    "{ tenantId: 'foreign' }, 'fixture'",
  ],
  [
    'equipmentAvailability',
    'createPublicEquipmentAvailabilityHandler',
    'equipment-availability',
    'equipments/[id]/availability',
    'calculateAvailability',
    1,
    "{ tenantId: 'foreign' }, 'fixture', new Date(0), new Date(86400000)",
  ],
  [
    'equipmentDetail',
    'createPublicEquipmentDetailHandler',
    'equipment-detail',
    'equipments/[id]',
    'getEquipment',
    1,
    "{ tenantId: 'foreign' }, 'fixture'",
  ],
  [
    'publicSettings',
    'createPublicSettingsHandler',
    'public-settings',
    'settings/public',
    'getSettings',
    2,
    "{ tenantId: 'foreign' }",
  ],
  [
    'tenantCard',
    'createPublicTenantCardHandler',
    'tenant-card',
    'public/tenants/[slug]',
    'readCard',
    2,
    "{ tenantId: 'foreign', slug: 'foreign' }",
  ],
  [
    'publicStorefrontLegal',
    'createPublicStorefrontLegalHandler',
    'storefront-legal',
    'settings/public/legal-documents/[kind]',
    'getDocument',
    2,
    "{ tenantId: 'foreign' }, 'terms'",
  ],
] as const
const PUBLIC_FACTORY_ANALYSIS_MODULES = new WeakSet<ModuleInfo>()
const PUBLIC_FACTORY_COMPOSITIONS = new WeakMap<ModuleInfo, Located>()

/** The sole pre-guard imported parser in these closures: pin its actual literal lookup AST. */
function publicFactoryLegalKindSourceIsInert(): boolean {
  const file = 'packages/contracts/src/storefront-legal.ts'
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'packages/contracts/package.json'), 'utf8')
  ) as { exports: Record<string, string> }
  if (manifest.exports['./storefront-legal'] !== './src/storefront-legal.ts')
    return false
  const actual = parseModule(path.join(ROOT, file))
  const expected = parseModule(
    path.join(ROOT, file),
    `
    export const STOREFRONT_LEGAL_KINDS = ['terms', 'privacy', 'returnPolicy'] as const
    export const STOREFRONT_LEGAL_SLUGS = Object.freeze({
      terms: 'terms', privacy: 'privacy', returnPolicy: 'return-policy',
    })
    export function storefrontLegalKindFromSlug(slug: string) {
      return (STOREFRONT_LEGAL_KINDS.find(
        (kind) => STOREFRONT_LEGAL_SLUGS[kind] === slug
      ) ?? null)
    }
  `
  )
  const shape = (node: ts.Node): unknown => {
    if (ts.isTypeNode(node)) return undefined
    const value = ts.isExpression(node) ? strip(node) : node
    const children: unknown[] = []
    ts.forEachChild(value, (child) => {
      if (!ts.isTypeNode(child)) children.push(shape(child))
    })
    return {
      kind: value.kind,
      ...(ts.isIdentifier(value) ||
      ts.isStringLiteralLike(value) ||
      ts.isNumericLiteral(value)
        ? { text: value.text }
        : {}),
      children,
    }
  }
  return [
    'STOREFRONT_LEGAL_KINDS',
    'STOREFRONT_LEGAL_SLUGS',
    'storefrontLegalKindFromSlug',
  ].every((name) => {
    const left = actual.locals.get(name)
    const right = expected.locals.get(name)
    return (
      !!left &&
      !!right &&
      JSON.stringify(shape(left)) === JSON.stringify(shape(right))
    )
  })
}

/** No global INERT grant: only the projected, source-checked public factory module. */
function publicFactoryLegalKindIsInert(
  binding: Binding,
  info: ModuleInfo
): boolean {
  return (
    PUBLIC_FACTORY_ANALYSIS_MODULES.has(info) &&
    sameBinding(binding, {
      module: '@gb-locacoes/contracts/storefront-legal',
      name: 'storefrontLegalKindFromSlug',
    }) &&
    publicFactoryLegalKindSourceIsInert()
  )
}

/** Project one bounded canonical GET with the host's real deferred ports. */
function publicFactoryClosure(binding: Binding): Located | null {
  const entry = PUBLIC_FACTORY_CLOSURES.find(([name]) => name === binding.name)
  if (
    !entry ||
    binding.module !== PUBLIC_FACTORY_HOST ||
    !binding.file ||
    path.resolve(binding.file) !== path.join(ROOT, PUBLIC_FACTORY_SOURCE)
  )
    return null
  const [name, factory, stem, , dataPort, resolveArguments] = entry
  const sourceFile = `packages/backend/src/http/${stem}.ts`
  const info = parseModule(binding.file)
  const call = info.locals.get(name)
  if (
    !call ||
    !ts.isCallExpression(call) ||
    call.arguments.length !== 1 ||
    !sameBinding(importedCallee(call, info) ?? { module: '', name: '' }, {
      module: '@gb-locacoes/backend/http',
      name: factory,
    })
  )
    return null
  const declaration = call.parent
  if (
    !ts.isVariableDeclaration(declaration) ||
    !ts.isIdentifier(declaration.name) ||
    declaration.name.text !== name ||
    declaration.initializer !== call ||
    !ts.isVariableDeclarationList(declaration.parent) ||
    !(declaration.parent.flags & ts.NodeFlags.Const) ||
    declaration.parent.declarations.length !== 1 ||
    !ts.isVariableStatement(declaration.parent.parent)
  )
    return null
  const hostStatement = declaration.parent.parent
  const input = strip(call.arguments[0]!)
  if (
    !ts.isObjectLiteralExpression(input) ||
    input.properties.length !== 2 ||
    input.properties.some((property) => !ts.isPropertyAssignment(property))
  )
    return null
  const ports = new Map(
    input.properties.map((property) => {
      const port = property as ts.PropertyAssignment
      return [propertyText(port.name), strip(port.initializer)] as const
    })
  )
  const resolve = ports.get('resolveTenant')
  const data = ports.get(dataPort)
  if (
    ports.size !== 2 ||
    !resolve ||
    !data ||
    !ts.isArrowFunction(resolve) ||
    !ts.isArrowFunction(data) ||
    resolve.parameters.length !== resolveArguments ||
    resolve.parameters.some(
      (parameter) =>
        !ts.isIdentifier(parameter.name) ||
        !!parameter.questionToken ||
        !!parameter.initializer ||
        !!parameter.dotDotDotToken
    ) ||
    ts.isBlock(resolve.body)
  )
    return null
  const tenant = info.locals.get('tenant')
  if (
    !tenant ||
    !ts.isCallExpression(tenant) ||
    tenant.arguments.length !== 1 ||
    !ts.isArrowFunction(strip(tenant.arguments[0]!)) ||
    !ts.isVariableDeclaration(tenant.parent) ||
    !ts.isVariableDeclarationList(tenant.parent.parent) ||
    !(tenant.parent.parent.flags & ts.NodeFlags.Const) ||
    !sameBinding(importedCallee(tenant, info) ?? { module: '', name: '' }, {
      module: '@gb-locacoes/backend/identity',
      name: 'createPublicTenantResolver',
    })
  )
    return null
  const forwards = (
    expression: ts.Expression,
    parameters: readonly ts.ParameterDeclaration[]
  ) => {
    const value = strip(expression)
    return (
      ts.isCallExpression(value) &&
      ts.isPropertyAccessExpression(value.expression) &&
      value.expression.name.text === 'resolvePublicRequestTenant' &&
      ts.isIdentifier(value.expression.expression) &&
      declarationOf(value.expression.expression) === tenant.parent &&
      value.arguments.length === parameters.length &&
      value.arguments.every((argument, index) => {
        const original = strip(argument)
        return (
          ts.isIdentifier(original) &&
          declarationOf(original) === parameters[index]
        )
      })
    )
  }
  if (!forwards(resolve.body, resolve.parameters)) return null
  const wrapper = info.locals.get('resolvePublicRequestTenant')
  if (
    !wrapper ||
    !ts.isFunctionDeclaration(wrapper) ||
    !wrapper.body ||
    wrapper.parameters.length !== 2 ||
    !ts.isIdentifier(wrapper.parameters[0]!.name) ||
    wrapper.parameters[0]!.questionToken ||
    wrapper.parameters[0]!.initializer ||
    wrapper.parameters[0]!.dotDotDotToken ||
    !ts.isIdentifier(wrapper.parameters[1]!.name) ||
    wrapper.parameters[1]!.questionToken ||
    wrapper.parameters[1]!.dotDotDotToken ||
    !wrapper.parameters[1]!.initializer ||
    !ts.isObjectLiteralExpression(strip(wrapper.parameters[1]!.initializer)) ||
    (strip(wrapper.parameters[1]!.initializer) as ts.ObjectLiteralExpression)
      .properties.length !== 0 ||
    !hasModifier(wrapper, ts.SyntaxKind.ExportKeyword)
  )
    return null
  const wrapperReturn = soleReturn(wrapper.body)
  if (
    !wrapperReturn?.expression ||
    !forwards(wrapperReturn.expression, wrapper.parameters)
  )
    return null
  const index = moduleFile('@gb-locacoes/backend/http')
  const exported = index && exportedNode(parseModule(index), factory)
  if (
    !exported ||
    relative(exported.info.file) !== sourceFile ||
    factoryProblems({
      module: '@gb-locacoes/backend/http',
      name: factory,
      source: sourceFile,
    }).length
  )
    return null
  const source = declaredFunction(sourceFile, factory)
  const deps = source?.node.parameters[0]
  const returned = source?.node.body && soleReturn(source.node.body)
  const handler = returned?.expression && strip(returned.expression)
  if (
    !source ||
    source.node.parameters.length !== 1 ||
    !deps ||
    !ts.isIdentifier(deps.name) ||
    !handler ||
    !ts.isFunctionExpression(handler) ||
    handler.name?.text !== 'GET' ||
    !hasModifier(handler, ts.SyntaxKind.AsyncKeyword) ||
    !handler.body ||
    !handler.parameters[0] ||
    !ts.isIdentifier(handler.parameters[0].name) ||
    handler.parameters[0].questionToken ||
    handler.parameters[0].initializer ||
    handler.parameters[0].dotDotDotToken
  )
    return null
  const guardName = '__publicFactoryResolveTenant'
  const dataName = `__publicFactory_${name}_${dataPort}`
  if (
    [guardName, dataName].some(
      (symbol) => info.bound.has(symbol) || source.info.bound.has(symbol)
    )
  )
    return null
  const edits: Array<{ start: number; end: number; value: string }> = []
  let invalid = false
  let guardCalls = 0
  const visit = (node: ts.Node) => {
    if (
      ts.isIdentifier(node) &&
      node.text === deps.name.getText() &&
      declarationOf(node) === deps
    ) {
      const member = node.parent
      if (
        !ts.isPropertyAccessExpression(member) ||
        member.expression !== node ||
        (member.name.text !== 'resolveTenant' && member.name.text !== dataPort)
      ) {
        invalid = true
      } else {
        if (member.name.text === 'resolveTenant') {
          const invocation = member.parent
          const argument =
            ts.isCallExpression(invocation) && invocation.arguments[0]
          if (
            !ts.isCallExpression(invocation) ||
            invocation.expression !== member ||
            invocation.arguments.length !== resolveArguments ||
            !argument ||
            !ts.isIdentifier(strip(argument)) ||
            declarationOf(strip(argument) as ts.Identifier) !==
              handler.parameters[0]
          )
            invalid = true
          guardCalls++
        }
        edits.push({
          start: member.getStart() - handler.getStart(),
          end: member.end - handler.getStart(),
          value: member.name.text === 'resolveTenant' ? guardName : dataName,
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(handler)
  if (
    invalid ||
    guardCalls !== 1 ||
    (stem === 'storefront-legal' && !publicFactoryLegalKindSourceIsInert())
  )
    return null
  let policy = handler.getText()
  for (const edit of edits.sort((left, right) => right.start - left.start))
    policy = policy.slice(0, edit.start) + edit.value + policy.slice(edit.end)
  const imports: string[] = []
  const importNames = new Map<string, string>()
  const printer = ts.createPrinter()
  const addImports = (module: ModuleInfo): boolean => {
    for (const statement of module.source.statements.filter(
      ts.isImportDeclaration
    )) {
      if (!ts.isStringLiteral(statement.moduleSpecifier)) return false
      const original = statement.moduleSpecifier.text
      let specifier = original
      if (original.startsWith('.')) {
        const target = resolveModule(module.file, original)
        if (!target) return false
        const id = relative(target)
        const publicModule =
          /^packages\/backend\/src\/modules\/(identity|rentals|catalog|directory)\/index\.ts$/.exec(
            id
          )
        specifier = publicModule
          ? `@gb-locacoes/backend/${publicModule[1]}`
          : `@/${id.replace(/\.tsx?$/, '')}`
      }
      let clause = statement.importClause
      if (clause?.name) {
        if (importNames.has(clause.name.text)) return false
        importNames.set(clause.name.text, specifier)
      }
      const named = clause?.namedBindings
      if (named && ts.isNamespaceImport(named)) {
        if (importNames.has(named.name.text)) return false
        importNames.set(named.name.text, specifier)
      } else if (named && ts.isNamedImports(named)) {
        const elements: ts.ImportSpecifier[] = []
        for (const element of named.elements) {
          const previous = importNames.get(element.name.text)
          if (previous && previous !== specifier) return false
          if (!previous) {
            importNames.set(element.name.text, specifier)
            elements.push(element)
          }
        }
        if (!elements.length && !clause?.name) continue
        clause = ts.factory.updateImportClause(
          clause!,
          clause!.isTypeOnly,
          clause!.name,
          ts.factory.updateNamedImports(named, elements)
        )
      }
      imports.push(
        printer.printNode(
          ts.EmitHint.Unspecified,
          ts.factory.updateImportDeclaration(
            statement,
            statement.modifiers,
            clause,
            ts.factory.createStringLiteral(specifier),
            statement.attributes
          ),
          module.source
        )
      )
    }
    return true
  }
  if (!addImports(info) || !addImports(source.info)) return null
  const sourceStatements = source.info.source.statements.filter(
    (statement) =>
      !ts.isImportDeclaration(statement) && statement !== source.node
  )
  if (sourceStatements.some((statement) => ts.isExportDeclaration(statement)))
    return null
  for (const symbol of source.info.locals.keys())
    if (symbol !== factory && info.locals.has(symbol)) return null
  const text = [
    ...imports,
    `import { resolvePublicRequestTenant as ${guardName} } from '@/${PUBLIC_FACTORY_HOST}'`,
    ...info.source.statements
      .filter(
        (statement) =>
          !ts.isImportDeclaration(statement) && statement !== hostStatement
      )
      .map((statement) => statement.getText()),
    ...sourceStatements.map((statement) => statement.getText()),
    `const ${dataName} = ${data.getText()}`,
    `export const ${name} = ${policy}`,
  ].join('\n')
  const closed = parseModule(binding.file, text)
  PUBLIC_FACTORY_ANALYSIS_MODULES.add(closed)
  PUBLIC_FACTORY_COMPOSITIONS.set(closed, { info, node: call })
  return exportedNode(closed, name)
}

function bindingNode(binding: Binding, depth = 0) {
  if (
    binding.module === PUBLIC_FACTORY_HOST &&
    PUBLIC_FACTORY_CLOSURES.some(([name]) => name === binding.name)
  )
    return publicFactoryClosure(binding)
  if (
    SELECTION_FACADES.some((entry) => entry.module === binding.module) &&
    binding.name === 'organizationSelection'
  )
    return selectionClosure(binding)
  // This moved role predicate is the sole approved package delegate here.
  // Follow its real package export and pin the result to its canonical source;
  // a reexport with the same name elsewhere cannot authorize a handler.
  if (
    !binding.file &&
    binding.module === '@gb-locacoes/backend/documents' &&
    binding.name === 'canManageContracts' &&
    binding.package === '@gb-locacoes/backend@0.1.0'
  ) {
    const file = moduleFile(binding.module)
    const located = file && exportedNode(parseModule(file), binding.name, depth)
    return located &&
      path.resolve(located.info.file) ===
        path.join(
          ROOT,
          'packages/backend/src/modules/documents/rental-contracts.ts'
        )
      ? located
      : null
  }
  return binding.file
    ? exportedNode(parseModule(binding.file), binding.name, depth)
    : null
}

/** Export names of a module, following `export * from` (never `default`). */
function exportSurface(
  info: ModuleInfo,
  seen = new Set<string>()
): { names: Set<string>; unresolved: string[] } {
  const names = new Set(info.exports.keys())
  const unresolved: string[] = []
  if (seen.has(info.file)) return { names, unresolved }
  seen.add(info.file)
  for (const star of info.stars) {
    if (!star.file) {
      unresolved.push(star.module)
      continue
    }
    const nested = exportSurface(parseModule(star.file), seen)
    for (const name of nested.names) if (name !== 'default') names.add(name)
    unresolved.push(...nested.unresolved)
  }
  return { names, unresolved }
}

const isDelegate = (binding: Binding) =>
  ROUTE_MODULE.test(binding.module) ||
  DELEGATES.some(
    (delegate) =>
      delegate.module === binding.module && delegate.name === binding.name
  )

function isTypePosition(node: ts.Node): boolean {
  for (let current = node.parent; current; current = current.parent) {
    // `class Repo extends Base`: the base class is a value (its members are inherited), not a type.
    if (
      ts.isExpressionWithTypeArguments(current) &&
      ts.isHeritageClause(current.parent) &&
      current.parent.token === ts.SyntaxKind.ExtendsKeyword &&
      ts.isClassLike(current.parent.parent)
    )
      return false
    if (ts.isTypeNode(current) || ts.isTypeAliasDeclaration(current))
      return true
    if (ts.isExpression(current) && !ts.isIdentifier(current)) return false
    if (ts.isStatement(current)) return false
  }
  return false
}

/**
 * Member names (`x.name`, `{ name: value }`), declaration names, labels, JSX attribute names and intrinsic
 * JSX tags (`<div>`) are not references.
 */
function isMemberName(node: ts.Identifier): boolean {
  const parent = node.parent
  if (
    ((ts.isLabeledStatement(parent) || ts.isBreakOrContinueStatement(parent)) &&
      parent.label === node) ||
    (ts.isJsxAttribute(parent) && parent.name === node) ||
    ((ts.isJsxOpeningElement(parent) ||
      ts.isJsxSelfClosingElement(parent) ||
      ts.isJsxClosingElement(parent)) &&
      parent.tagName === node &&
      /^[a-z]/.test(node.text))
  )
    return true
  return (
    ((ts.isPropertyAccessExpression(parent) ||
      ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isVariableDeclaration(parent)) &&
      parent.name === node) ||
    (ts.isBindingElement(parent) && parent.propertyName === node)
  )
}

// ---------------------------------------------------------------------------
// Name resolution and the values a binding receives
// ---------------------------------------------------------------------------

/** The node declaring `text` in a binding name (the declaration itself, or the element of a pattern). */
function bindingFor(
  name: ts.BindingName,
  text: string,
  declaration: ts.Node
): ts.Node | undefined {
  if (ts.isIdentifier(name)) return name.text === text ? declaration : undefined
  for (const element of name.elements) {
    if (!ts.isBindingElement(element)) continue
    const found = bindingFor(element.name, text, element)
    if (found) return found
  }
  return undefined
}

/** A `var` of a function body or file, outside nested functions and classes (hoisted). */
function hoistedVar(body: ts.Node, text: string): ts.Node | undefined {
  let found: ts.Node | undefined
  const visit = (node: ts.Node) => {
    if (found) return
    if (node !== body && (ts.isFunctionLike(node) || ts.isClassLike(node)))
      return
    // Ambient `declare var` names a global of the runtime.
    if (hasModifier(node, ts.SyntaxKind.DeclareKeyword)) return
    if (
      ts.isVariableDeclarationList(node) &&
      (node.flags & ts.NodeFlags.BlockScoped) === 0
    )
      for (const declaration of node.declarations)
        found ??= bindingFor(declaration.name, text, declaration)
    ts.forEachChild(node, visit)
  }
  visit(body)
  return found
}

/** Block-scoped declarations, functions, classes, enums and imports of a statement list. */
function declaredBy(
  statements: readonly ts.Statement[],
  text: string
): ts.Node | undefined {
  for (const statement of statements) {
    // Ambient `declare` forms name globals of the runtime, not bindings of the file.
    if (hasModifier(statement, ts.SyntaxKind.DeclareKeyword)) continue
    if (
      ts.isVariableStatement(statement) &&
      (statement.declarationList.flags & ts.NodeFlags.BlockScoped) !== 0
    )
      for (const declaration of statement.declarationList.declarations) {
        const found = bindingFor(declaration.name, text, declaration)
        if (found) return found
      }
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name?.text === text
    )
      return statement
    if (ts.isImportDeclaration(statement) && statement.importClause) {
      const clause = statement.importClause
      if (clause.name?.text === text) return clause
      const named = clause.namedBindings
      if (named && ts.isNamespaceImport(named) && named.name.text === text)
        return named
      if (named && ts.isNamedImports(named))
        for (const element of named.elements)
          if (element.name.text === text) return element
    }
  }
  return undefined
}

function declaredIn(container: ts.Node, text: string): ts.Node | undefined {
  if (ts.isSourceFile(container))
    return declaredBy(container.statements, text) ?? hoistedVar(container, text)
  if (ts.isBlock(container) || ts.isModuleBlock(container))
    return declaredBy(container.statements, text)
  if (ts.isCaseBlock(container)) {
    for (const clause of container.clauses) {
      const found = declaredBy(clause.statements, text)
      if (found) return found
    }
    return undefined
  }
  if (ts.isFunctionLike(container)) {
    for (const parameter of container.parameters) {
      const found = bindingFor(parameter.name, text, parameter)
      if (found) return found
    }
    if (
      (ts.isFunctionExpression(container) || ts.isClassExpression(container)) &&
      container.name?.text === text
    )
      return container
    const body = (container as ts.FunctionLikeDeclaration).body
    return body ? hoistedVar(body, text) : undefined
  }
  if (
    (ts.isForStatement(container) ||
      ts.isForInStatement(container) ||
      ts.isForOfStatement(container)) &&
    container.initializer &&
    ts.isVariableDeclarationList(container.initializer)
  ) {
    for (const declaration of container.initializer.declarations) {
      const found = bindingFor(declaration.name, text, declaration)
      if (found) return found
    }
    return undefined
  }
  if (ts.isCatchClause(container) && container.variableDeclaration)
    return bindingFor(
      container.variableDeclaration.name,
      text,
      container.variableDeclaration
    )
  if (ts.isClassExpression(container) && container.name?.text === text)
    return container
  return undefined
}

const declarations = new WeakMap<ts.Identifier, ts.Node | null>()
/**
 * The declaration an identifier refers to, following the scopes of its file (block, function, catch, loop,
 * file); undefined for a global the file does not declare.
 */
function declarationOf(identifier: ts.Identifier): ts.Node | undefined {
  const cached = declarations.get(identifier)
  if (cached !== undefined) return cached ?? undefined
  let found: ts.Node | undefined
  for (
    let node: ts.Node | undefined = identifier.parent;
    node && !found;
    node = node.parent
  )
    found = declaredIn(node, identifier.text)
  declarations.set(identifier, found ?? null)
  return found
}

const isImportName = (node: ts.Node) =>
  ts.isImportClause(node) ||
  ts.isNamespaceImport(node) ||
  ts.isImportSpecifier(node)

/** The identifier a member chain starts from: `holder` in `holder.db.user`. */
function chainRoot(node: ts.Expression): ts.Identifier | undefined {
  let value = unwrap(node)
  while (
    ts.isPropertyAccessExpression(value) ||
    ts.isElementAccessExpression(value)
  )
    value = unwrap(value.expression)
  return ts.isIdentifier(value) ? value : undefined
}

/** The call whose callee chain starts at `node`: `__prisma` in `__prisma.user.deleteMany()`. */
function callOfChain(
  node: ts.Node
): ts.CallExpression | ts.NewExpression | undefined {
  let current = node
  for (;;) {
    const parent = current.parent
    if (
      ((ts.isPropertyAccessExpression(parent) ||
        ts.isElementAccessExpression(parent)) &&
        parent.expression === current) ||
      ((ts.isParenthesizedExpression(parent) ||
        ts.isNonNullExpression(parent) ||
        ts.isAsExpression(parent) ||
        ts.isSatisfiesExpression(parent) ||
        ts.isTypeAssertionExpression(parent)) &&
        parent.expression === current)
    )
      current = parent
    else
      return (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
        parent.expression === current
        ? parent
        : undefined
  }
}

/**
 * What a global the file does not declare stands for in the allowlist invariants: `<global>#name` (a member of
 * the global object by its name, `*` when computed), `<computed module>#*` for `require` used as a value,
 * nothing for an inert global.
 */
function globalReference(node: ts.Identifier): string | undefined {
  const name = node.text
  if (name === 'require') {
    const call =
      ts.isCallExpression(node.parent) && node.parent.expression === node
    return call &&
      node.parent.arguments[0] &&
      ts.isStringLiteralLike(node.parent.arguments[0])
      ? undefined // a literal load, recorded as its module
      : '<computed module>#*'
  }
  if (GLOBAL_OBJECTS.has(name)) {
    let member: ts.Node = node
    while (
      (ts.isParenthesizedExpression(member.parent) ||
        ts.isAsExpression(member.parent) ||
        ts.isNonNullExpression(member.parent)) &&
      member.parent.expression === member
    )
      member = member.parent
    const parent = member.parent
    const property =
      ts.isPropertyAccessExpression(parent) && parent.expression === member
        ? parent.name.text
        : undefined
    if (
      property &&
      INERT_GLOBALS.has(property) &&
      !REFLECTIVE_GLOBALS.has(property)
    )
      return undefined
    return `<global>#${property ?? '*'}`
  }
  return inertGlobal(node) ? undefined : `<global>#${name}`
}

/** Globals that reflect or redefine other values: `Reflect`, `Proxy`, and `Object` beyond OBJECT_READS. */
const REFLECTIVE_GLOBALS = new Set(['Reflect', 'Proxy', 'Object'])
const OBJECT_READS = new Set([
  'keys',
  'values',
  'entries',
  'fromEntries',
  'freeze',
  'isFrozen',
  'hasOwn',
  'is',
])
/**
 * What code does to the language itself, as an invariant reference no allowlist lists: `<reflection>#name`
 * for a member of FORBIDDEN_MEMBERS (named, a string key, destructured or a `__proto__` key), a computed
 * member or destructured key (`[]`), or REFLECTIVE_GLOBALS; `<write>#root` for a write to anything but a
 * variable of its own function (a member, an import, a binding of the module, a global).
 */
function languageReference(node: ts.Node): string | undefined {
  if (
    ts.isPropertyAccessExpression(node) &&
    FORBIDDEN_MEMBERS.has(node.name.text)
  )
    return `<reflection>#${node.name.text}`
  if (ts.isElementAccessExpression(node)) {
    const key = strip(node.argumentExpression)
    if (!ts.isStringLiteralLike(key) && !ts.isNumericLiteral(key))
      return '<reflection>#[]'
    if (FORBIDDEN_MEMBERS.has(key.text)) return `<reflection>#${key.text}`
  }
  if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
    const property = node.propertyName ?? node.name
    if (ts.isComputedPropertyName(property)) return '<reflection>#[]'
    if (
      (ts.isIdentifier(property) || ts.isStringLiteralLike(property)) &&
      FORBIDDEN_MEMBERS.has(property.text)
    )
      return `<reflection>#${property.text}`
  }
  if (ts.isPropertyAssignment(node) && staticKey(node.name) === '__proto__')
    return '<reflection>#__proto__'
  if (
    ts.isIdentifier(node) &&
    REFLECTIVE_GLOBALS.has(node.text) &&
    !isTypePosition(node) &&
    !isMemberName(node) &&
    !declarationOf(node) &&
    !instanceOfRight(node)
  ) {
    const read = outer(node)
    return node.text === 'Object' &&
      ts.isPropertyAccessExpression(read.parent) &&
      read.parent.expression === read &&
      OBJECT_READS.has(read.parent.name.text)
      ? undefined
      : `<reflection>#${node.text}`
  }
  if (isAssignment(node)) return writeReference(node.left)
  if (
    (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
    (node.operator === ts.SyntaxKind.PlusPlusToken ||
      node.operator === ts.SyntaxKind.MinusMinusToken)
  )
    return writeReference(node.operand)
  if (ts.isDeleteExpression(node)) return writeReference(node.expression)
  if (
    (ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
    !ts.isVariableDeclarationList(node.initializer)
  )
    return writeReference(node.initializer)
  return undefined
}
/** The write reference of an assignment target (undefined for a variable of the function itself). */
function writeReference(target: ts.Expression): string | undefined {
  const value = strip(target)
  if (ts.isIdentifier(value)) {
    const declaration = declarationOf(value)
    return declaration &&
      !isImportName(declaration) &&
      !moduleLevel(declaration)
      ? undefined
      : `<write>#${value.text}`
  }
  // A destructuring assignment writes each of its targets (`[a = 1] = ...`: the target of a default).
  if (isAssignment(value)) return writeReference(value.left)
  if (ts.isArrayLiteralExpression(value))
    return value.elements
      .filter((element) => !ts.isOmittedExpression(element))
      .map((element) =>
        writeReference(
          ts.isSpreadElement(element) ? element.expression : element
        )
      )
      .find(Boolean)
  if (ts.isObjectLiteralExpression(value))
    return value.properties
      .map((property) =>
        ts.isShorthandPropertyAssignment(property)
          ? writeReference(property.name)
          : ts.isPropertyAssignment(property)
            ? writeReference(property.initializer)
            : ts.isSpreadAssignment(property)
              ? writeReference(property.expression)
              : `<write>#${describeNode(property)}`
      )
      .find(Boolean)
  // A member: the root it hangs from.
  return `<write>#${chainRoot(value)?.text ?? describeNode(value)}`
}

/**
 * Collects what one handler can reach, flow-insensitively: imported
 * calls/references, globals and status literals. Used for the public
 * allowlist invariants; authorization is decided by `checkFunction` (the structural rule).
 * `load`: the code the module runs when it loads, reached by every handler.
 */
function reach(info: ModuleInfo, start: ts.Node, load: ts.Node[] = []): Facts {
  const facts = emptyFacts()
  const seen = new Set<ts.Node>()
  const queue: Located[] = [
    { info, node: start },
    ...load.map((node) => ({ info, node })),
  ]
  while (queue.length) {
    const item = queue.pop()!
    if (seen.has(item.node)) continue
    seen.add(item.node)
    const current = item.info
    const visit = (node: ts.Node) => {
      if (ts.isNumericLiteral(node)) facts.statuses.add(Number(node.text))
      const language = languageReference(node)
      if (language) facts.references.add(language)
      if (
        ts.isIdentifier(node) &&
        !isTypePosition(node) &&
        !isMemberName(node)
      ) {
        const local = current.locals.get(node.text)
        if (local && local !== item.node && !seen.has(local))
          queue.push({ info: current, node: local })
        const imported = current.imports.get(node.text)
        if (imported) {
          const parent = node.parent
          const isImportName =
            ts.isImportSpecifier(parent) ||
            ts.isImportClause(parent) ||
            ts.isNamespaceImport(parent) ||
            ts.isBindingElement(parent)
          if (!isImportName)
            facts.references.add(`${imported.module}#${imported.name}`)
        } else if (!local && !declarationOf(node)) {
          // A global the file does not declare: `globalThis.__prisma`, `__prisma`, `fetch`, `require` as a value.
          // Reaching outside the module like a call does (a retired handler reaches nothing).
          const reference = globalReference(node)
          if (reference) {
            facts.references.add(reference)
            const [module, name] = reference.split('#')
            facts.calls.push({
              module: module!,
              name: name!,
              node: (callOfChain(node) ?? node) as ts.CallExpression,
            })
          }
        }
      }
      // A module loaded on the spot is a reference (and a call) like a static import of it.
      const loaded =
        ts.isCallExpression(node) &&
        loadSpecifier(
          node,
          (name) => current.locals.has(name) || current.imports.has(name)
        )
      if (
        ts.isCallExpression(node) &&
        loaded !== undefined &&
        loaded !== false
      ) {
        const module =
          loaded === null
            ? '<computed module>'
            : moduleBinding(current.file, loaded, '*').module
        const names = loadedNames(node, loaded === null)
        for (const name of names) facts.references.add(`${module}#${name}`)
        facts.calls.push({ module, name: names[0]!, node })
      }
      if (ts.isCallExpression(node)) {
        const callee = unwrap(node.expression)
        let binding: Binding | undefined
        if (ts.isIdentifier(callee)) binding = current.imports.get(callee.text)
        else if (
          ts.isPropertyAccessExpression(callee) &&
          ts.isIdentifier(callee.expression)
        ) {
          const namespace = current.imports.get(callee.expression.text)
          if (namespace?.name === '*')
            binding = { ...namespace, name: callee.name.text }
        }
        if (binding) {
          facts.calls.push({ ...binding, node })
          if (isDelegate(binding)) {
            const target = bindingNode(binding)
            if (target && !seen.has(target.node)) {
              facts.followed.push(`${binding.module}#${binding.name}`)
              queue.push(target)
            }
          }
        }
      }
      // A method of an imported value is a call into its module too: `prisma.user.deleteMany()`, `new Client()`.
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const callee = unwrap(node.expression)
        const root = chainRoot(callee)
        const imported =
          root && root !== callee && current.imports.get(root.text)
        const own =
          ts.isNewExpression(node) && ts.isIdentifier(callee)
            ? current.imports.get(callee.text)
            : undefined
        if (imported || own)
          facts.calls.push({
            ...(imported || own)!,
            node: node as ts.CallExpression,
          })
      }
      ts.forEachChild(node, visit)
    }
    visit(item.node)
  }
  return facts
}

type FunctionLike =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration
const isFunctionLike = (node: ts.Node): node is FunctionLike =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node)

const sameBinding = (
  binding: Binding,
  other: { module: string; name: string }
) => binding.module === other.module && binding.name === other.name
const accepts = (guard: Guard, route: string) =>
  (!guard.scope || guard.scope.test(route)) &&
  !(guard.excluded && guard.excluded.test(route))
const describeNode = (node: ts.Node) =>
  node.getText().replace(/\s+/g, ' ').slice(0, 80)

/** Follows identifiers to the function (or handler-producing call) they name. */
function resolveHandler(
  info: ModuleInfo,
  node: ts.Node,
  depth = 0
): Located | null {
  if (depth > 8) return null
  if (isFunctionLike(node)) return { info, node }
  if (!ts.isExpression(node)) return null
  const value = unwrap(node)
  if (isFunctionLike(value) || ts.isCallExpression(value))
    return { info, node: value }
  if (ts.isIdentifier(value)) {
    const local = info.locals.get(value.text)
    if (local) return resolveHandler(info, local, depth + 1)
    const imported = info.imports.get(value.text)
    const target = imported && bindingNode(imported)
    return target ? resolveHandler(target.info, target.node, depth + 1) : null
  }
  return null
}

/** `moduleLoad` with the file's own `require` given by `declared`. */
function loadSpecifier(
  node: ts.Node,
  declared: (_name: string) => boolean
): string | null | undefined {
  const value = ts.isExpression(node) ? unwrap(node) : node
  if (!ts.isCallExpression(value)) return undefined
  const callee = unwrap(value.expression)
  const loads =
    value.expression.kind === ts.SyntaxKind.ImportKeyword ||
    (ts.isIdentifier(callee) &&
      callee.text === 'require' &&
      !declared('require'))
  if (!loads) return undefined
  const specifier = value.arguments[0]
  return specifier && ts.isStringLiteralLike(specifier) ? specifier.text : null
}

/**
 * What a module load hands over: the names destructured from it, the member read right off it
 * (`(await import('m')).prisma`), or the whole module (`const m = await import('m')`, `*`).
 */
function loadedNames(call: ts.CallExpression, computed: boolean): string[] {
  if (computed) return ['*']
  let node: ts.Node = call
  while (
    ts.isAwaitExpression(node.parent) ||
    ts.isParenthesizedExpression(node.parent) ||
    ts.isAsExpression(node.parent) ||
    ts.isNonNullExpression(node.parent) ||
    ts.isSatisfiesExpression(node.parent)
  )
    node = node.parent
  const parent = node.parent
  if (
    ts.isVariableDeclaration(parent) &&
    parent.initializer === node &&
    ts.isObjectBindingPattern(parent.name) &&
    parent.name.elements.every(
      (element) => !element.dotDotDotToken && ts.isIdentifier(element.name)
    )
  )
    return parent.name.elements.map(
      (element) => propertyText(element.propertyName ?? element.name) ?? '*'
    )
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node)
    return [parent.name.text]
  return ['*']
}

const GLOBAL_OBJECTS = new Set(['globalThis', 'self', 'window', 'global'])
/** `process` is inert only through these members (`process.mainModule.require` loads any module). */
const PROCESS_INERT = new Set([
  'env',
  'cwd',
  'nextTick',
  'hrtime',
  'uptime',
  'memoryUsage',
  'emitWarning',
  'platform',
  'version',
  'versions',
  'arch',
  'pid',
])
/** A global whose use here touches no data by itself (`process` only through PROCESS_INERT). */
function inertGlobal(identifier: ts.Identifier): boolean {
  if (identifier.text !== 'process') return INERT_GLOBALS.has(identifier.text)
  const parent = identifier.parent
  return (
    ts.isPropertyAccessExpression(parent) &&
    parent.expression === identifier &&
    PROCESS_INERT.has(parent.name.text)
  )
}
/** Globals whose calls touch no data by themselves (`fetch` is I/O and is not listed). */
const INERT_GLOBALS = new Set(
  (
    'AbortController AbortSignal AggregateError Array ArrayBuffer BigInt BigInt64Array BigUint64Array Blob ' +
    'Boolean Buffer DOMException DataView Date Error EvalError Event EventTarget File Float32Array ' +
    'Float64Array FormData Headers Infinity Int16Array Int32Array Int8Array Intl JSON Map Math NaN Number ' +
    'Object Promise Proxy RangeError ReadableStream ReferenceError Reflect RegExp Request Response Set String ' +
    'Symbol SyntaxError TextDecoder TextEncoder TransformStream TypeError URIError URL URLSearchParams ' +
    'Uint16Array Uint32Array Uint8Array Uint8ClampedArray WeakMap WeakRef WeakSet WritableStream atob btoa ' +
    'clearInterval clearTimeout console crypto decodeURI decodeURIComponent encodeURI encodeURIComponent ' +
    'isFinite isNaN parseFloat parseInt performance queueMicrotask setInterval setTimeout ' +
    'structuredClone undefined arguments'
  ).split(' ')
)

function classEvaluation(node: ts.ClassLikeDeclaration): ts.Node[] {
  const parts: ts.Node[] = []
  for (const clause of node.heritageClauses ?? [])
    if (clause.token === ts.SyntaxKind.ExtendsKeyword)
      for (const type of clause.types) parts.push(type.expression)
  for (const decorator of ts.canHaveDecorators(node)
    ? (ts.getDecorators(node) ?? [])
    : [])
    parts.push(decorator.expression)
  for (const member of node.members) {
    if (member.name && ts.isComputedPropertyName(member.name))
      parts.push(member.name.expression)
    for (const decorator of ts.canHaveDecorators(member)
      ? (ts.getDecorators(member) ?? [])
      : [])
      parts.push(decorator.expression)
    if (
      ts.isPropertyDeclaration(member) &&
      hasModifier(member, ts.SyntaxKind.StaticKeyword) &&
      member.initializer
    )
      parts.push(member.initializer)
    if (ts.isClassStaticBlockDeclaration(member)) parts.push(member.body)
  }
  return parts
}

/** Relation fields per Prisma delegate (`tx.user`: the relations of model User), read from the schema. */
const RELATIONS: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const schema = fs.readFileSync(
    path.join(ROOT, 'prisma', 'schema.prisma'),
    'utf8'
  )
  const models = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)]
  const names = new Set(models.map((model) => model[1]!))
  const relations = new Map<string, ReadonlySet<string>>()
  for (const [, name, body] of models) {
    const fields = new Set<string>()
    for (const line of body!.split(/\r?\n/)) {
      const field = /^\s*(\w+)\s+(\w+)/.exec(line)
      if (field && names.has(field[2]!)) fields.add(field[1]!)
    }
    relations.set(name!.charAt(0).toLowerCase() + name!.slice(1), fields)
  }
  return relations
})()
/** Query arguments that neither read nor write another record. */
const OWNER_QUERY_KEYS = new Set([
  'where',
  'data',
  'select',
  'omit',
  'orderBy',
  'take',
  'skip',
  'cursor',
  'distinct',
  'create',
  'update',
  'skipDuplicates',
])
/** Operations of a nested write (a write to a related record through the owner record). */
const NESTED_WRITES = new Set([
  'create',
  'createMany',
  'connect',
  'connectOrCreate',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'set',
  'disconnect',
])

/**
 * A query on the owner record that stays there: only OWNER_QUERY_KEYS, a `select` of scalar fields (`true` or
 * `false`; no relation, no `_count`), and written values (`data`, upsert's `create` and `update`) given field by
 * field, none of them a relation of the model (on a model the schema does not name: no nested write operation).
 */
function ownerRecordOnly(
  query: ts.ObjectLiteralExpression,
  delegate: string
): boolean {
  const relations = RELATIONS.get(delegate)
  const scalarKey = (key: string | undefined) =>
    !!key && key !== '_count' && !relations?.has(key)
  const nestedWrite = (value: ts.Expression): boolean => {
    const object = unwrap(value)
    return (
      ts.isObjectLiteralExpression(object) &&
      object.properties.some(
        (property) =>
          !(
            ts.isPropertyAssignment(property) ||
            ts.isShorthandPropertyAssignment(property)
          ) || NESTED_WRITES.has(propertyText(property.name) ?? '')
      )
    )
  }
  const written = (node: ts.Expression): boolean => {
    const value = unwrap(node)
    if (ts.isArrayLiteralExpression(value))
      return value.elements.every(
        (element) => !ts.isSpreadElement(element) && written(element)
      )
    return (
      ts.isObjectLiteralExpression(value) &&
      value.properties.every((property) => {
        if (ts.isShorthandPropertyAssignment(property))
          return scalarKey(property.name.text)
        if (!ts.isPropertyAssignment(property)) return false
        return (
          scalarKey(propertyText(property.name)) &&
          (relations !== undefined || !nestedWrite(property.initializer))
        )
      })
    )
  }
  const selected = (node: ts.Expression): boolean => {
    const value = unwrap(node)
    return (
      ts.isObjectLiteralExpression(value) &&
      value.properties.every(
        (property) =>
          ts.isPropertyAssignment(property) &&
          scalarKey(propertyText(property.name)) &&
          (property.initializer.kind === ts.SyntaxKind.TrueKeyword ||
            property.initializer.kind === ts.SyntaxKind.FalseKeyword)
      )
    )
  }
  return query.properties.every((property) => {
    const key = propertyText(property.name)
    if (!key || !OWNER_QUERY_KEYS.has(key)) return false
    // A value named by shorthand (`{ where, data }`) is whatever the handler built there.
    if (!ts.isPropertyAssignment(property)) return key === 'where'
    if (key === 'select') return selected(property.initializer)
    if (key === 'data' || key === 'create' || key === 'update')
      return written(property.initializer)
    return true
  })
}

/**
 * A filter (or new record) that names the owner at its top level: `{ userId }`, `{ id: userId }`,
 * `{ tenantId_userId: { tenantId, userId } }`. Negated (NOT), alternative (OR), operator, conditional or spread
 * filters do not.
 */
function filterNamesOwner(
  node: ts.Expression | undefined,
  isOwner: (_node: ts.Node | undefined) => boolean,
  compound = false
): boolean {
  const filter = node && unwrap(node)
  if (!filter || !ts.isObjectLiteralExpression(filter)) return false
  if (filter.properties.some((property) => ts.isSpreadAssignment(property)))
    return false
  return filter.properties.some((property) => {
    if (ts.isShorthandPropertyAssignment(property))
      return isOwner(property.name)
    if (!ts.isPropertyAssignment(property)) return false
    const key = propertyText(property.name)
    // Operators and combinators (`not`, `in`, `OR`...) never name the owner.
    if (!key || FILTER_OPERATORS.has(key)) return false
    // The owner itself as the value of a field; AND/OR/NOT hold filters, never the owner itself.
    if (isOwner(property.initializer)) return true
    // A compound unique key: `tenantId_userId: { tenantId, userId }`.
    return (
      !compound &&
      key.includes('_') &&
      filterNamesOwner(property.initializer, isOwner, true)
    )
  })
}

const UNRESOLVED = 'handler could not be resolved statically'

const PUBLIC_TENANT_OUTSIDE_SURFACE =
  'public tenant resolution does not authorize this method (not in PUBLIC_TENANT_SURFACE)'

const UNSAFE_METHODS: ReadonlySet<string> = new Set([
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
])

const emptyFacts = (): Facts => ({
  calls: [],
  references: new Set(),
  statuses: new Set(),
  followed: [],
})

/**
 * The code a module runs when it loads (before any handler): initializers that are not functions, top-level
 * statements, what a class runs where it is defined, side-effect imports. Function bodies only run when called.
 */
function loadTimeCode(source: ts.SourceFile): ts.Node[] {
  const code: ts.Node[] = []
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) ||
      ts.isFunctionDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isModuleDeclaration(statement) ||
      ts.isExportDeclaration(statement) ||
      hasModifier(statement, ts.SyntaxKind.DeclareKeyword)
    )
      continue
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations)
        if (
          declaration.initializer &&
          !isFunctionLike(unwrap(declaration.initializer))
        )
          code.push(declaration.initializer)
    } else if (ts.isClassDeclaration(statement))
      code.push(...classEvaluation(statement))
    else if (ts.isExportAssignment(statement)) {
      if (!isFunctionLike(unwrap(statement.expression)))
        code.push(statement.expression)
    } else code.push(statement)
  }
  return code
}

// ---------------------------------------------------------------------------
// Structural rule
// ---------------------------------------------------------------------------

type Literal = string | number | boolean
type Env = {
  info: ModuleInfo
  route: string
  /** The request parameter. */
  request?: ts.Node
  /** The route params promise (`{ params }`) and the context parameter (`context.params`). */
  params: Set<ts.Node>
  contexts: Set<ts.Node>
  /** Declarations INERT code may read: parameters, PROLOGUE bindings, gate results, principal aliases. */
  allowed: Set<ts.Node>
  /** PROLOGUE route params (`const { id } = await params`): the only values that name an owner. */
  routeParams: Set<ts.Node>
  /** Parameters of a delegate bound to a literal argument of its call. */
  literals: Map<ts.Node, Literal>
  depth: number
}
type Outcome =
  | {
      ok: true
      kinds: Set<Kind>
      /** The same-origin guard runs before any effect on every path. */
      origin: boolean
      /** A CLIENT passes as the owner of the resource (OWNER_CLIENT). */
      owner: boolean
    }
  | { ok: false; reason: string; origin: boolean }

const NO_GUARD = 'no approved authentication/authorization helper'
const ADMIN_ROLE =
  'resolveTenantPrincipal under /api/admin without a role check'
const fail = (reason: string, origin = false): Outcome => ({
  ok: false,
  reason,
  origin,
})

/** Parentheses, type assertions and `!`, never `await` (it matters where a value comes from). */
const strip = (node: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(node) ||
  ts.isAsExpression(node) ||
  ts.isNonNullExpression(node) ||
  ts.isSatisfiesExpression(node) ||
  ts.isTypeAssertionExpression(node)
    ? strip(node.expression)
    : node
/** `x` without `await`, parentheses or type assertions. */
const awaited = (node: ts.Expression): ts.Expression => {
  const value = strip(node)
  return ts.isAwaitExpression(value) ? strip(value.expression) : value
}
/** The declaration an identifier expression refers to. */
function declOf(node: ts.Node | undefined): ts.Node | undefined {
  if (!node || !ts.isExpression(node)) return undefined
  const value = strip(node)
  return ts.isIdentifier(value) ? declarationOf(value) : undefined
}
const isRequest = (node: ts.Node | undefined, env: Env) =>
  !!env.request && declOf(node) === env.request

/** Only the real enrollment route may project its request to the same host, without query or body. */
function enrollmentHostOnlyRequest(
  node: ts.Expression | undefined,
  env: Env
): boolean {
  if (
    env.route !== 'apps/services/api/src/app/api/client/enroll/route.ts' ||
    !node
  )
    return false
  const call = strip(node)
  if (
    !ts.isCallExpression(call) ||
    call.questionDotToken ||
    call.arguments.length !== 1 ||
    !isRequest(call.arguments[0], env) ||
    !ts.isIdentifier(call.expression)
  )
    return false
  const declaration = declarationOf(call.expression)
  if (
    !declaration ||
    !ts.isVariableDeclaration(declaration) ||
    !declaration.initializer ||
    !ts.isIdentifier(declaration.name) ||
    declaration.name.text !== 'hostOnly' ||
    !ts.isVariableDeclarationList(declaration.parent) ||
    !ts.isVariableStatement(declaration.parent.parent) ||
    soleConst(declaration.parent.parent) !== declaration ||
    env.info.locals.get(declaration.name.text) !== declaration.initializer ||
    sealedProblem(declaration) !== undefined ||
    env.info.bound.has('URL') ||
    env.info.bound.has('Request')
  )
    return false
  const helper = strip(declaration.initializer)
  if (
    !ts.isArrowFunction(helper) ||
    hasModifier(helper, ts.SyntaxKind.AsyncKeyword) ||
    helper.parameters.length !== 1 ||
    !ts.isBlock(helper.body) ||
    helper.body.statements.length !== 2
  )
    return false
  const parameter = helper.parameters[0]!
  if (
    !ts.isIdentifier(parameter.name) ||
    parameter.initializer ||
    parameter.dotDotDotToken ||
    parameter.questionToken
  )
    return false
  const url = soleConst(helper.body.statements[0])
  const returned = helper.body.statements[1]
  if (
    !url ||
    !ts.isIdentifier(url.name) ||
    !returned ||
    !ts.isReturnStatement(returned) ||
    !returned.expression
  )
    return false
  const parsedUrl = strip(url.initializer)
  const projected = strip(returned.expression)
  if (
    !ts.isNewExpression(parsedUrl) ||
    !ts.isIdentifier(parsedUrl.expression) ||
    parsedUrl.expression.text !== 'URL' ||
    declarationOf(parsedUrl.expression) ||
    parsedUrl.arguments?.length !== 1 ||
    !ts.isNewExpression(projected) ||
    !ts.isIdentifier(projected.expression) ||
    projected.expression.text !== 'Request' ||
    declarationOf(projected.expression) ||
    projected.arguments?.length !== 2
  )
    return false
  const memberOf = (
    expression: ts.Expression,
    owner: ts.Node,
    member: string
  ) => {
    const value = strip(expression)
    return (
      ts.isPropertyAccessExpression(value) &&
      !value.questionDotToken &&
      value.name.text === member &&
      declOf(value.expression) === owner
    )
  }
  if (!memberOf(parsedUrl.arguments[0]!, parameter, 'url')) return false
  const address = strip(projected.arguments[0]!)
  const options = strip(projected.arguments[1]!)
  if (
    !ts.isBinaryExpression(address) ||
    address.operatorToken.kind !== ts.SyntaxKind.PlusToken ||
    !memberOf(address.left, url, 'origin') ||
    !memberOf(address.right, url, 'pathname') ||
    !ts.isObjectLiteralExpression(options) ||
    options.properties.length !== 1
  )
    return false
  const headers = options.properties[0]!
  return (
    ts.isPropertyAssignment(headers) &&
    propertyText(headers.name) === 'headers' &&
    memberOf(headers.initializer, parameter, 'headers')
  )
}

/** The module a node belongs to (fixtures parsed from text included). */
const moduleOf = (node: ts.Node) => modules.get(node.getSourceFile())

/** The single `const` declaration (with a value) of a statement. */
function soleConst(
  statement: ts.Statement | undefined
): (ts.VariableDeclaration & { initializer: ts.Expression }) | undefined {
  if (
    !statement ||
    !ts.isVariableStatement(statement) ||
    (statement.declarationList.flags & ts.NodeFlags.Const) === 0 ||
    statement.declarationList.declarations.length !== 1
  )
    return undefined
  const [declaration] = statement.declarationList.declarations
  return declaration?.initializer
    ? (declaration as ts.VariableDeclaration & { initializer: ts.Expression })
    : undefined
}
/** `return x` or `{ return x }`. */
function soleReturn(
  statement: ts.Statement | undefined
): ts.ReturnStatement | undefined {
  if (!statement) return undefined
  if (ts.isReturnStatement(statement)) return statement
  return ts.isBlock(statement) &&
    statement.statements.length === 1 &&
    ts.isReturnStatement(statement.statements[0]!)
    ? statement.statements[0]
    : undefined
}
/** `if (c) <then>` without else. */
const plainIf = (
  statement: ts.Statement | undefined
): statement is ts.IfStatement =>
  !!statement && ts.isIfStatement(statement) && !statement.elseStatement

/** Names a declaration binds, never a reference (`get x()`, `{ a } = ...`, `function f`, `enum E`). */
function isDeclarationName(node: ts.Identifier): boolean {
  const parent = node.parent as ts.Node & { name?: ts.Node }
  return (
    parent.name === node &&
    (ts.isBindingElement(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isClassExpression(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isEnumDeclaration(parent) ||
      ts.isEnumMember(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isTypeParameterDeclaration(parent))
  )
}
/** `Class` (or `ns.Class`) as the right side of `instanceof`: an error check. */
function instanceOfRight(identifier: ts.Identifier): boolean {
  let top: ts.Node = identifier
  while (
    ts.isPropertyAccessExpression(top.parent) &&
    top.parent.expression === top
  )
    top = top.parent
  return (
    ts.isBinaryExpression(top.parent) &&
    top.parent.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword &&
    top.parent.right === top
  )
}
/** An imported `const` whose value is a literal (`export const SELECTED_TENANT_COOKIE = 'x'`). */
function literalConstant(binding: Binding): boolean {
  // The cookie name moved to its canonical universal contract. Resolve its
  // public export to the actual declaration; the same literal/const check
  // below applies, rather than granting arbitrary contract imports INERT status.
  const file =
    binding.file ??
    (binding.module === '@gb-locacoes/contracts'
      ? moduleFile(binding.module)
      : undefined)
  const target = bindingNode({ ...binding, file })
  const value =
    target && ts.isExpression(target.node) ? strip(target.node) : undefined
  const declaration = value?.parent
  return (
    !!value &&
    (ts.isStringLiteralLike(value) ||
      ts.isNumericLiteral(value) ||
      value.kind === ts.SyntaxKind.TrueKeyword ||
      value.kind === ts.SyntaxKind.FalseKeyword) &&
    !!declaration &&
    ts.isVariableDeclaration(declaration) &&
    (declaration.parent.flags & ts.NodeFlags.Const) !== 0
  )
}
/** A declaration at the top level of its file: a function, a class or a `const` (the declaration that holds it). */
function moduleLevel(
  declaration: ts.Node
): ts.Node | 'reassignable' | undefined {
  let node: ts.Node = declaration
  while (
    ts.isBindingElement(node) ||
    ts.isObjectBindingPattern(node) ||
    ts.isArrayBindingPattern(node)
  )
    node = node.parent
  if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node))
    return ts.isSourceFile(node.parent) ? node : undefined
  if (
    ts.isVariableDeclaration(node) &&
    ts.isVariableDeclarationList(node.parent) &&
    ts.isVariableStatement(node.parent.parent) &&
    ts.isSourceFile(node.parent.parent.parent)
  )
    return (node.parent.flags & ts.NodeFlags.Const) !== 0
      ? node
      : 'reassignable'
  return undefined
}

/**
 * Member names that reach the machinery of the language (the Function constructor, prototypes, accessor
 * tables): INERT code never names them, as a member, a string key or a destructured property.
 */
const FORBIDDEN_MEMBERS = new Set([
  'constructor',
  'prototype',
  '__proto__',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
  'caller',
  'callee',
])
/** Keys the engine calls on its own (conversion, `await`, JSON): an INERT object literal never defines them. */
const HOOK_KEYS = new Set([
  ...FORBIDDEN_MEMBERS,
  'then',
  'toString',
  'valueOf',
  'toJSON',
  'toLocaleString',
])
const NO_KEYS: ReadonlySet<string> = new Set()
/** Global calls INERT code may make (`new X` constructs): each builds a value and runs nothing it receives. */
const INERT_CALLS = new Set([
  'Response.json',
  'new Response',
  'new Request',
  'new URL',
  'new Date',
  'new Error',
  'String',
  'encodeURIComponent',
  'console.error',
  'console.warn',
])
/** Imported values INERT code may call a member of, or construct: `NextResponse.json(...)`, `new NextResponse()`. */
const INERT_IMPORT_CALLS: Array<{
  module: string
  name: string
  members: string[]
  construct: boolean
}> = [
  {
    module: 'next/server',
    name: 'NextResponse',
    members: ['json', 'redirect'],
    construct: true,
  },
]
/**
 * Methods INERT code may call on an INERT value: natives of strings, arrays, Headers, URLSearchParams, dates
 * and regular expressions (`request.headers.get('x')`, `['ADMIN'].includes(role)`, `issues.map(...)`).
 */
const INERT_METHODS = new Set([
  'get',
  'has',
  'includes',
  'join',
  'map',
  'test',
  'toISOString',
])
/** The syntax INERT code is made of (plus punctuation and type annotations, which run nothing). */
const INERT_SYNTAX: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.Identifier,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.BigIntLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.RegularExpressionLiteral,
  ts.SyntaxKind.TemplateExpression,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.TemplateSpan,
  ts.SyntaxKind.TrueKeyword,
  ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.NullKeyword,
  ts.SyntaxKind.ObjectLiteralExpression,
  ts.SyntaxKind.PropertyAssignment,
  ts.SyntaxKind.ShorthandPropertyAssignment,
  ts.SyntaxKind.SpreadAssignment,
  ts.SyntaxKind.ArrayLiteralExpression,
  ts.SyntaxKind.SpreadElement,
  ts.SyntaxKind.OmittedExpression,
  ts.SyntaxKind.PropertyAccessExpression,
  ts.SyntaxKind.ElementAccessExpression,
  ts.SyntaxKind.CallExpression,
  ts.SyntaxKind.NewExpression,
  ts.SyntaxKind.ParenthesizedExpression,
  ts.SyntaxKind.AsExpression,
  ts.SyntaxKind.SatisfiesExpression,
  ts.SyntaxKind.NonNullExpression,
  ts.SyntaxKind.TypeAssertionExpression,
  ts.SyntaxKind.PrefixUnaryExpression,
  ts.SyntaxKind.PostfixUnaryExpression,
  ts.SyntaxKind.TypeOfExpression,
  ts.SyntaxKind.VoidExpression,
  ts.SyntaxKind.AwaitExpression,
  ts.SyntaxKind.BinaryExpression,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.Parameter,
  ts.SyntaxKind.Block,
  ts.SyntaxKind.ReturnStatement,
  ts.SyntaxKind.ThrowStatement,
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ExpressionStatement,
  ts.SyntaxKind.EmptyStatement,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.VariableDeclarationList,
  ts.SyntaxKind.VariableDeclaration,
  ts.SyntaxKind.ObjectBindingPattern,
  ts.SyntaxKind.ArrayBindingPattern,
  ts.SyntaxKind.BindingElement,
  ts.SyntaxKind.CatchClause,
  // Operators and modifiers that are keywords.
  ts.SyntaxKind.InKeyword,
  ts.SyntaxKind.InstanceOfKeyword,
  ts.SyntaxKind.AsyncKeyword,
  ts.SyntaxKind.ExportKeyword,
])
const isPunctuation = (kind: ts.SyntaxKind) =>
  kind >= ts.SyntaxKind.FirstPunctuation &&
  kind <= ts.SyntaxKind.LastPunctuation
const isAssignment = (node: ts.Node): node is ts.BinaryExpression =>
  ts.isBinaryExpression(node) &&
  node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
  node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
/** The static name of a property (`a`, `'a'`, `1`); undefined when it is computed or private. */
const staticKey = (name: ts.PropertyName | undefined) =>
  name &&
  (ts.isIdentifier(name) ||
    ts.isStringLiteralLike(name) ||
    ts.isNumericLiteral(name))
    ? name.text
    : undefined
/** Why an object literal is not a plain record: a computed, repeated or hook key, a method or an accessor. */
function recordProblem(
  object: ts.ObjectLiteralExpression,
  keys: ReadonlySet<string>
): string | undefined {
  const seen = new Set<string>()
  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) continue
    if (
      !ts.isPropertyAssignment(property) &&
      !ts.isShorthandPropertyAssignment(property)
    )
      return `${describeNode(property)} is not a plain property`
    if (
      ts.isShorthandPropertyAssignment(property) &&
      property.objectAssignmentInitializer
    )
      return describeNode(property)
    const key = staticKey(property.name)
    if (key === undefined) return `computed key ${describeNode(property.name)}`
    if (keys.has(key)) return `key ${key}`
    if (seen.has(key)) return `key ${key} repeated`
    seen.add(key)
  }
  return undefined
}
/** A local function: `function f() {}` or `const f = () => ...` (or a function expression). */
function localFunction(declaration: ts.Node): boolean {
  if (ts.isFunctionDeclaration(declaration)) return true
  return (
    ts.isVariableDeclaration(declaration) &&
    ts.isIdentifier(declaration.name) &&
    (declaration.parent.flags & ts.NodeFlags.Const) !== 0 &&
    !!declaration.initializer &&
    (ts.isArrowFunction(strip(declaration.initializer)) ||
      ts.isFunctionExpression(strip(declaration.initializer)))
  )
}
/** A global INERT code may use as a value: `undefined`, `NaN`, `Infinity`, `process.env` (classes: inertClass). */
function inertGlobalValue(identifier: ts.Identifier): boolean {
  if (['undefined', 'NaN', 'Infinity'].includes(identifier.text)) return true
  if (identifier.text === 'process') {
    const read = outer(identifier)
    return (
      ts.isPropertyAccessExpression(read.parent) &&
      read.parent.expression === read &&
      read.parent.name.text === 'env'
    )
  }
  return false
}
/**
 * Whether the right side of an `instanceof` is a class of INERT_CLASSES, named as listed: a global of
 * INERT_GLOBAL_CLASSES the file does not declare, an import of a listed binding, or `<import>.<member>` of a
 * listed member. Nothing else: another import, a namespace or member chain, a class of the file, a value.
 */
function inertClass(node: ts.Expression): boolean {
  const value = strip(node)
  const member =
    ts.isPropertyAccessExpression(value) && ts.isIdentifier(value.name)
      ? value.name.text
      : undefined
  const root = member
    ? strip((value as ts.PropertyAccessExpression).expression)
    : value
  if (!ts.isIdentifier(root)) return false
  const declaration = declarationOf(root)
  if (!declaration)
    return member === undefined && INERT_GLOBAL_CLASSES.has(root.text)
  const binding = isImportName(declaration)
    ? moduleOf(root)?.imports.get(root.text)
    : undefined
  return (
    !!binding &&
    INERT_CLASSES.some(
      (entry) =>
        sameBinding(binding, entry) &&
        entry.member === member &&
        // A package entry (zod) names the package as installed, never a file posing as it.
        (!!entry.source || installedPackage(binding))
    )
  )
}

/**
 * Why `node` is not INERT (undefined when it is). INERT is a closed grammar: only the syntax of INERT_SYNTAX;
 * no member, string key or destructured property of FORBIDDEN_MEMBERS and no computed member or key; object
 * literals are plain records without HOOK_KEYS; writes only to variables declared inside `node`; calls only to
 * INERT_CALLS, INERT_IMPORT_CALLS, the named INERT_IMPORTS, INERT_METHODS of an INERT value, and functions of
 * the code itself or of its file that are INERT too; `instanceof` only of INERT_CLASSES (inertClass). A name is
 * declared inside it, allowed by `env` (the request, PROLOGUE bindings, gate results), a literal constant of the
 * file or of an import, `undefined`, `NaN`, `Infinity` or `process.env`. So INERT code cannot build the Function
 * constructor, define a method the engine calls on its own, or change what any other code sees: whatever runs
 * it, it touches no data and no state.
 */
function inertProblem(
  node: ts.Node,
  env: Env,
  seen: Set<ts.Node> = new Set(),
  /** A node the caller decides on its own: `skip` (accepted, not visited) or why it fails. */
  decide?: (_node: ts.Node) => 'skip' | string | undefined
): string | undefined {
  const source = node.getSourceFile()
  const imports = moduleOf(node)?.imports
  const inside = (declaration: ts.Node) =>
    declaration.getSourceFile() === source &&
    declaration.pos >= node.pos &&
    declaration.end <= node.end
  let problem: string | undefined
  /** A variable of the code itself: the only target it may write. */
  const ownVariable = (target: ts.Expression) => {
    const value = strip(target)
    const declaration = ts.isIdentifier(value) && declarationOf(value)
    return (
      !!declaration &&
      inside(declaration) &&
      (ts.isVariableDeclaration(declaration) ||
        ts.isBindingElement(declaration))
    )
  }
  const syntax = (current: ts.Node): string | undefined => {
    if (!INERT_SYNTAX.has(current.kind) && !isPunctuation(current.kind))
      return describeNode(current)
    if (
      ts.isPropertyAccessExpression(current) &&
      (!ts.isIdentifier(current.name) ||
        FORBIDDEN_MEMBERS.has(current.name.text))
    )
      return `member ${current.name.getText()}`
    if (ts.isElementAccessExpression(current)) {
      const key = strip(current.argumentExpression)
      if (!ts.isStringLiteralLike(key) && !ts.isNumericLiteral(key))
        return `computed member ${describeNode(current)}`
      if (FORBIDDEN_MEMBERS.has(key.text)) return `member ${key.text}`
    }
    if (ts.isObjectLiteralExpression(current))
      return recordProblem(current, HOOK_KEYS)
    if (ts.isBindingElement(current)) {
      const property = current.propertyName ?? current.name
      if (ts.isComputedPropertyName(property))
        return `computed key ${describeNode(property)}`
      if (
        (ts.isIdentifier(property) || ts.isStringLiteralLike(property)) &&
        FORBIDDEN_MEMBERS.has(property.text)
      )
        return `member ${property.text}`
    }
    if (isAssignment(current) && !ownVariable(current.left))
      return `writes ${describeNode(current.left)}`
    if (
      (ts.isPrefixUnaryExpression(current) ||
        ts.isPostfixUnaryExpression(current)) &&
      (current.operator === ts.SyntaxKind.PlusPlusToken ||
        current.operator === ts.SyntaxKind.MinusMinusToken) &&
      !ownVariable(current.operand)
    )
      return `writes ${describeNode(current.operand)}`
    if (
      ts.isVariableDeclarationList(current) &&
      (current.flags & ts.NodeFlags.Using) !== 0
    )
      return describeNode(current.parent)
    if (
      (ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current)) &&
      current.asteriskToken
    )
      return `generator ${describeNode(current)}`
    return undefined
  }
  const reference = (identifier: ts.Identifier): string | undefined => {
    const declaration = declarationOf(identifier)
    if (!declaration)
      return inertGlobalValue(identifier)
        ? undefined
        : `global ${identifier.text}`
    if (inside(declaration) || env.allowed.has(declaration)) return undefined
    if (isImportName(declaration)) {
      const binding = imports?.get(identifier.text)
      if (binding && literalConstant(binding)) return undefined
      return binding ? `${binding.module}#${binding.name}` : identifier.text
    }
    const top = moduleLevel(declaration)
    if (top === 'reassignable') return `${identifier.text} (reassignable)`
    if (top) {
      // A class of the file is code (its constructor, its statics): never a value, not even after `instanceof`.
      if (ts.isClassDeclaration(top)) {
        const written = sealedProblem(top)
        return written
          ? `${identifier.text} ${written}`
          : `class ${identifier.text}`
      }
      if (seen.has(top)) return undefined
      seen.add(top)
      const value =
        ts.isVariableDeclaration(top) && top.initializer
          ? strip(top.initializer)
          : undefined
      // A literal never changes; anything else must be INERT code or flat literals nobody writes to.
      if (value && primitiveLiteral(value)) return undefined
      const written = sealedProblem(top)
      if (written) return `${identifier.text} ${written}`
      if (value && flatLiteral(value)) return undefined
      if (value && !isFunctionLike(value))
        return `${identifier.text} holds a value built when the module loads`
      // Module code sees only the module: no parameter or binding of the handler.
      const inner = inertProblem(top, { ...env, allowed: new Set() }, seen)
      return inner && `${identifier.text} reaches ${inner}`
    }
    return `${identifier.text} is not bound before the guard`
  }
  /** A call or `new`: its callee must be one INERT code may call; then its receiver and arguments are visited. */
  const call = (current: ts.CallExpression | ts.NewExpression) => {
    const construct = ts.isNewExpression(current)
    const callee = strip(current.expression)
    const label = `calls ${construct ? 'new ' : ''}${describeNode(callee)}`
    if (ts.isIdentifier(callee)) {
      const declaration = declarationOf(callee)
      if (!declaration) {
        if (!INERT_CALLS.has(`${construct ? 'new ' : ''}${callee.text}`))
          problem = label
      } else if (isImportName(declaration)) {
        const binding = imports?.get(callee.text)
        const allowed =
          !!binding &&
          (construct
            ? INERT_IMPORT_CALLS.some(
                (entry) => entry.construct && sameBinding(binding, entry)
              )
            : INERT_IMPORTS.some(
                (entry) =>
                  entry.module === binding.module &&
                  entry.names.includes(binding.name)
              ) || publicFactoryLegalKindIsInert(binding, env.info))
        if (!allowed) problem = label
      } else if (inside(declaration)) {
        if (construct || !localFunction(declaration)) problem = label
      } else {
        const top = moduleLevel(declaration)
        if (construct || !top || top === 'reassignable' || !localFunction(top))
          problem = label
        else problem = reference(callee)
      }
    } else if (
      ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.name)
    ) {
      const member = callee.name.text
      const receiver = strip(callee.expression)
      const root = ts.isIdentifier(receiver) ? receiver : undefined
      const declaration = root && declarationOf(root)
      if (root && !declaration) {
        if (
          !INERT_CALLS.has(`${construct ? 'new ' : ''}${root.text}.${member}`)
        )
          problem = label
      } else if (root && declaration && isImportName(declaration)) {
        const binding = imports?.get(root.text)
        const allowed =
          !!binding &&
          !construct &&
          (INERT_IMPORT_CALLS.some(
            (entry) =>
              sameBinding(binding, entry) && entry.members.includes(member)
          ) ||
            (binding.name === '*' &&
              INERT_IMPORTS.some(
                (entry) =>
                  entry.module === binding.module &&
                  entry.names.includes(member)
              )))
        if (!allowed) problem = label
      } else {
        // A method runs on its receiver: the receiver is INERT too (what it reaches is said first).
        visit(callee.expression)
        if (!problem && (construct || !INERT_METHODS.has(member)))
          problem = label
      }
    } else problem = label
    if (problem) return
    for (const argument of current.arguments ?? []) visit(argument)
  }
  const visit = (current: ts.Node) => {
    if (problem) return
    const decided = decide?.(current)
    if (decided === 'skip') return
    if (decided) {
      problem = decided
      return
    }
    // Types and type parameters run nothing; an instantiation expression (`f<T>`) is a value.
    if (ts.isExpressionWithTypeArguments(current)) {
      problem = describeNode(current)
      return
    }
    if (ts.isTypeNode(current) || ts.isTypeParameterDeclaration(current)) return
    problem = syntax(current)
    if (problem) return
    if (ts.isCallExpression(current) || ts.isNewExpression(current)) {
      call(current)
      return
    }
    // `instanceof` runs its right side's Symbol.hasInstance: only a class of INERT_CLASSES (finding 111).
    if (
      ts.isBinaryExpression(current) &&
      current.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword
    ) {
      if (!inertClass(current.right)) {
        problem = `instanceof ${describeNode(current.right)}`
        return
      }
      visit(current.left)
      return
    }
    if (
      ts.isIdentifier(current) &&
      !isTypePosition(current) &&
      !isMemberName(current) &&
      !isDeclarationName(current)
    ) {
      problem = reference(current)
      if (problem) return
    }
    ts.forEachChild(current, visit)
  }
  visit(node)
  return problem
}

/** Whether `statement` always leaves: a return or throw, or a block that ends with one. */
function leaves(statement: ts.Statement): boolean {
  const last = ts.isBlock(statement)
    ? statement.statements[statement.statements.length - 1]
    : statement
  return !!last && (ts.isReturnStatement(last) || ts.isThrowStatement(last))
}
/** A literal that holds no object: a string, number, boolean, null, a template without substitutions. */
function primitiveLiteral(node: ts.Expression): boolean {
  const value = strip(node)
  return (
    ts.isStringLiteralLike(value) ||
    ts.isNumericLiteral(value) ||
    value.kind === ts.SyntaxKind.TrueKeyword ||
    value.kind === ts.SyntaxKind.FalseKeyword ||
    value.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isPrefixUnaryExpression(value) && ts.isNumericLiteral(value.operand))
  )
}
/** An object or array literal of primitive literals only (`{ 'Cache-Control': 'no-store' }`). */
function flatLiteral(node: ts.Expression): boolean {
  const value = strip(node)
  if (ts.isArrayLiteralExpression(value))
    return value.elements.every((element) => primitiveLiteral(element))
  return (
    ts.isObjectLiteralExpression(value) &&
    value.properties.every(
      (property) =>
        ts.isPropertyAssignment(property) &&
        !ts.isComputedPropertyName(property.name) &&
        primitiveLiteral(property.initializer)
    )
  )
}
/** Calls that read what they receive and keep none of it: a value handed to them stays unchanged. */
const READING_SINKS = new Set([
  'Response.json',
  'NextResponse.json',
  'NextResponse.redirect',
  'new Response',
  'new NextResponse',
  'new Headers',
  'JSON.stringify',
])
const sinkName = (call: ts.CallExpression | ts.NewExpression) => {
  const callee = strip(call.expression)
  const name = ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression)
      ? `${callee.expression.text}.${callee.name.text}`
      : undefined
  return name && (ts.isNewExpression(call) ? `new ${name}` : name)
}
/** The outermost node that is `node` in parentheses or a type assertion. */
function outer(node: ts.Node): ts.Node {
  let current = node
  while (
    (ts.isParenthesizedExpression(current.parent) ||
      ts.isAsExpression(current.parent) ||
      ts.isNonNullExpression(current.parent) ||
      ts.isSatisfiesExpression(current.parent)) &&
    current.parent.expression === current
  )
    current = current.parent
  return current
}
/** An assignment target, an operand of `++`, `--` or `delete`, or a loop target. */
function isWritten(node: ts.Node): boolean {
  const parent = node.parent
  return (
    (ts.isBinaryExpression(parent) &&
      parent.left === node &&
      parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
    ((ts.isPrefixUnaryExpression(parent) ||
      ts.isPostfixUnaryExpression(parent)) &&
      (parent.operator === ts.SyntaxKind.PlusPlusToken ||
        parent.operator === ts.SyntaxKind.MinusMinusToken)) ||
    ts.isDeleteExpression(parent) ||
    ((ts.isForInStatement(parent) || ts.isForOfStatement(parent)) &&
      parent.initializer === node)
  )
}
/** Whether a value reaches only a READING_SINKS call (maybe through object literal properties). */
function sunk(node: ts.Node): boolean {
  let current = outer(node)
  for (;;) {
    const parent = current.parent
    if (
      (ts.isPropertyAssignment(parent) && parent.initializer === current) ||
      ts.isShorthandPropertyAssignment(parent)
    ) {
      current = outer(parent.parent)
      continue
    }
    return (
      (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
      parent.expression !== current &&
      READING_SINKS.has(sinkName(parent) ?? '')
    )
  }
}
/**
 * Why a module-level binding may come to hold something other than what it was declared with (undefined when
 * it cannot): somewhere in its file it is written (`x.a = ...`, `x.push(...)`, `delete x.a`) or handed to code
 * that could write it (aliased, destructured, passed to any call but one of READING_SINKS). Calls, member
 * reads, spreads (copies), `typeof`, `instanceof` and exports leave it as declared.
 */
function sealedProblem(declaration: ts.Node): string | undefined {
  const name = (declaration as ts.Node & { name?: ts.Node }).name
  if (!name || !ts.isIdentifier(name)) return 'is not a plain binding'
  let problem: string | undefined
  const visit = (node: ts.Node) => {
    if (problem) return
    if (
      ts.isIdentifier(node) &&
      node !== name &&
      node.text === name.text &&
      !isTypePosition(node) &&
      !isMemberName(node) &&
      !isDeclarationName(node) &&
      declarationOf(node) === declaration
    ) {
      let chain = outer(node)
      let member = false
      while (
        (ts.isPropertyAccessExpression(chain.parent) ||
          ts.isElementAccessExpression(chain.parent)) &&
        chain.parent.expression === chain
      ) {
        chain = outer(chain.parent)
        member = true
      }
      const parent = chain.parent
      const called =
        (ts.isCallExpression(parent) && parent.expression === chain) ||
        (ts.isTaggedTemplateExpression(parent) && parent.tag === chain)
      if (member) {
        if (isWritten(chain) || called)
          problem = `is written in ${describeNode(parent)}`
        return
      }
      if (
        called ||
        (ts.isNewExpression(parent) && parent.expression === chain) ||
        ts.isTypeOfExpression(parent) ||
        (ts.isBinaryExpression(parent) &&
          parent.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword &&
          parent.right === chain) ||
        ts.isExportSpecifier(parent) ||
        // A spread copies what the value holds.
        ts.isSpreadAssignment(parent) ||
        ts.isSpreadElement(parent) ||
        sunk(chain)
      )
        return
      problem = `is handed over in ${describeNode(parent)}`
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(declaration.getSourceFile())
  return problem
}
/** Why `statement` does not leave INERT (a return or throw that reaches nothing). */
function leaveProblem(statement: ts.Statement, env: Env): string | undefined {
  if (!leaves(statement))
    return `${describeNode(statement)} does not leave the handler`
  return inertProblem(statement, env)
}

/** `params` (from `{ params }`) or `context.params`: the route params promise. */
function isParamsRef(node: ts.Expression, env: Env): boolean {
  const value = strip(node)
  if (ts.isIdentifier(value)) {
    const declaration = declarationOf(value)
    return !!declaration && env.params.has(declaration)
  }
  return (
    ts.isPropertyAccessExpression(value) &&
    value.name.text === 'params' &&
    !!declOf(value.expression) &&
    env.contexts.has(declOf(value.expression)!)
  )
}
/** `id`, or `{ id }` / `{ id: userId }` without defaults, rest or nesting. */
function simplePattern(name: ts.BindingName): boolean {
  return (
    ts.isIdentifier(name) ||
    (ts.isObjectBindingPattern(name) &&
      name.elements.every(
        (element) =>
          !element.dotDotDotToken &&
          !element.initializer &&
          ts.isIdentifier(element.name) &&
          (!element.propertyName ||
            ts.isIdentifier(element.propertyName) ||
            ts.isStringLiteral(element.propertyName))
      ))
  )
}
/** The declarations a (simple) binding name introduces. */
const bindingDeclarations = (declaration: ts.VariableDeclaration): ts.Node[] =>
  ts.isIdentifier(declaration.name)
    ? [declaration]
    : ts.isObjectBindingPattern(declaration.name)
      ? [...declaration.name.elements]
      : []
/** The import a call's callee names: `fn(...)` or `namespace.fn(...)`. */
function importedCallee(
  call: ts.CallExpression | ts.NewExpression,
  info: ModuleInfo
): Binding | undefined {
  const callee = strip(call.expression)
  if (ts.isIdentifier(callee)) {
    const declaration = declarationOf(callee)
    return declaration && isImportName(declaration)
      ? info.imports.get(callee.text)
      : undefined
  }
  if (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression)
  ) {
    const declaration = declarationOf(callee.expression)
    const namespace =
      declaration && isImportName(declaration)
        ? info.imports.get(callee.expression.text)
        : undefined
    return namespace?.name === '*'
      ? { ...namespace, name: callee.name.text }
      : undefined
  }
  return undefined
}
const importNamed = (
  node: ts.Expression,
  info: ModuleInfo,
  module: string,
  names: string[]
) => {
  const value = strip(node)
  if (!ts.isIdentifier(value)) return false
  const declaration = declarationOf(value)
  const binding =
    declaration && isImportName(declaration)
      ? info.imports.get(value.text)
      : undefined
  return !!binding && binding.module === module && names.includes(binding.name)
}
/** `callee(request)` where the callee is one of `names` imported from `module`. */
function requestCall(
  node: ts.Expression,
  env: Env,
  module: string,
  names: string[]
): boolean {
  const call = strip(node)
  if (!ts.isCallExpression(call) || call.arguments.length !== 1) return false
  const binding = importedCallee(call, env.info)
  return (
    !!binding &&
    binding.module === module &&
    names.includes(binding.name) &&
    isRequest(call.arguments[0], env)
  )
}
/**
 * `!isTrustedMutationOrigin(request)` (or `!isSameOriginMutation(request)`).
 * The former lib/security/mutation-origin spelling was retired in F; its literal recognition below is preserved
 * as historical scanner grammar. Current routes bind the API host helper or the backend identity entrypoint.
 */
function refusesOrigin(condition: ts.Expression, env: Env): boolean {
  const value = strip(condition)
  return (
    ts.isPrefixUnaryExpression(value) &&
    value.operator === ts.SyntaxKind.ExclamationToken &&
    (requestCall(value.operand, env, 'lib/security/mutation-origin', [
      'isTrustedMutationOrigin',
    ]) ||
      requestCall(
        value.operand,
        env,
        'apps/services/api/src/host/mutation-origin',
        ['isTrustedMutationOrigin']
      ) ||
      requestCall(value.operand, env, IDENTITY_MODULE, [
        'isSameOriginMutation',
      ]))
  )
}
/** `if (denied) return denied` (or `denied !== null`, `denied != null`) for the variable `name` declares. */
function testsDenial(condition: ts.Expression, declaration: ts.Node): boolean {
  const value = strip(condition)
  if (declOf(value) === declaration) return true
  return (
    ts.isBinaryExpression(value) &&
    (value.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      value.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken) &&
    declOf(value.left) === declaration &&
    (value.right.kind === ts.SyntaxKind.NullKeyword ||
      (value.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken &&
        ts.isIdentifier(value.right) &&
        value.right.text === 'undefined'))
  )
}
/** `!x.<property>`, `x.<property> !== true`, `x.<property> === false`. */
function testsFailure(
  condition: ts.Expression,
  declaration: ts.Node,
  property: string
): boolean {
  const value = strip(condition)
  const member = (node: ts.Expression) => {
    const inner = strip(node)
    return (
      ts.isPropertyAccessExpression(inner) &&
      inner.name.text === property &&
      declOf(inner.expression) === declaration
    )
  }
  if (
    ts.isPrefixUnaryExpression(value) &&
    value.operator === ts.SyntaxKind.ExclamationToken
  )
    return member(value.operand)
  if (!ts.isBinaryExpression(value) || !member(value.left)) return false
  const operator = value.operatorToken.kind
  return (
    ((operator === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      operator === ts.SyntaxKind.ExclamationEqualsToken) &&
      value.right.kind === ts.SyntaxKind.TrueKeyword) ||
    ((operator === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      operator === ts.SyntaxKind.EqualsEqualsToken) &&
      value.right.kind === ts.SyntaxKind.FalseKeyword)
  )
}
/** `!x`, `!x?.a?.b`, `x === null`, `x == null`, `x == undefined`: the value is missing. */
function testsMissing(condition: ts.Expression, declaration: ts.Node): boolean {
  const value = strip(condition)
  if (
    ts.isPrefixUnaryExpression(value) &&
    value.operator === ts.SyntaxKind.ExclamationToken
  ) {
    // `!x`, `!session?.user?.id`: false only when the value (and what it holds) is there.
    let chain = strip(value.operand)
    while (ts.isPropertyAccessExpression(chain)) chain = strip(chain.expression)
    return declOf(chain) === declaration
  }
  if (!ts.isBinaryExpression(value) || declOf(value.left) !== declaration)
    return false
  const operator = value.operatorToken.kind
  const right = value.right
  return (
    (operator === ts.SyntaxKind.EqualsEqualsEqualsToken &&
      right.kind === ts.SyntaxKind.NullKeyword) ||
    (operator === ts.SyntaxKind.EqualsEqualsToken &&
      (right.kind === ts.SyntaxKind.NullKeyword ||
        (ts.isIdentifier(right) && right.text === 'undefined')))
  )
}
/** A delegated handler's Response: `!r.ok`, `r.status !== 2xx`, optionally after `!r ||`. */
function testsResponse(
  condition: ts.Expression,
  declaration: ts.Node
): boolean {
  const value = strip(condition)
  if (
    ts.isBinaryExpression(value) &&
    value.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
    testsMissing(value.left, declaration)
  )
    return testsResponse(value.right, declaration)
  if (testsFailure(value, declaration, 'ok')) return true
  return (
    ts.isBinaryExpression(value) &&
    value.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken &&
    ts.isPropertyAccessExpression(strip(value.left)) &&
    (strip(value.left) as ts.PropertyAccessExpression).name.text === 'status' &&
    declOf((strip(value.left) as ts.PropertyAccessExpression).expression) ===
      declaration &&
    ts.isNumericLiteral(value.right) &&
    Number(value.right.text) >= 200 &&
    Number(value.right.text) < 300
  )
}
/** Whether `condition` is true exactly when the gate result `declaration` (of `shape`) denies the request. */
function testsDenied(
  condition: ts.Expression,
  declaration: ts.Node,
  shape: ResultShape
): boolean {
  switch (shape.type) {
    case 'discriminated':
      return testsFailure(condition, declaration, shape.property)
    case 'denial':
      return testsDenial(condition, declaration)
    case 'nullable':
      return testsMissing(condition, declaration)
    case 'response':
      return testsResponse(condition, declaration)
    default:
      return false
  }
}

/**
 * One PROLOGUE statement (or statement and refusal) at `index`: the index after it, whether it is the
 * same-origin guard, or undefined when the statement is not one of the listed forms.
 */
function prologueStep(
  statements: readonly ts.Statement[],
  index: number,
  env: Env
): { next: number; origin?: true } | undefined {
  const statement = statements[index]!
  const declaration = soleConst(statement)
  if (declaration) {
    const value = strip(declaration.initializer)
    // Route params: `const { id } = await params`, `const params = await props.params`.
    if (
      ts.isAwaitExpression(value) &&
      isParamsRef(value.expression, env) &&
      simplePattern(declaration.name)
    ) {
      for (const bound of bindingDeclarations(declaration)) {
        env.allowed.add(bound)
        env.routeParams.add(bound)
      }
      return { next: index + 1 }
    }
    // Only the source-checked legal GET may parse its awaited kind and refuse it before tenant resolution.
    const kindRefusal = statements[index + 1]
    if (
      PUBLIC_FACTORY_ANALYSIS_MODULES.has(env.info) &&
      ts.isIdentifier(declaration.name) &&
      ts.isCallExpression(value) &&
      value.arguments.length === 1 &&
      (() => {
        const binding = importedCallee(value, env.info)
        const argument = strip(value.arguments[0]!)
        if (
          !binding ||
          !publicFactoryLegalKindIsInert(binding, env.info) ||
          !ts.isPropertyAccessExpression(argument) ||
          argument.name.text !== 'kind'
        )
          return false
        const params = strip(argument.expression)
        return (
          ts.isAwaitExpression(params) && isParamsRef(params.expression, env)
        )
      })() &&
      plainIf(kindRefusal) &&
      testsDenied(kindRefusal.expression, declaration, NULLABLE_RESULT)
    ) {
      env.allowed.add(declaration)
      return leaveProblem(kindRefusal.thenStatement, env)
        ? undefined
        : { next: index + 2 }
    }
    // The body: `const body = await request.json()` (optionally `.catch(() => null)`).
    if (
      ts.isIdentifier(declaration.name) &&
      ts.isAwaitExpression(value) &&
      bodyRead(value.expression, env)
    ) {
      env.allowed.add(declaration)
      return { next: index + 1 }
    }
    // In-memory rate limit and its refusal.
    const check = statements[index + 1]
    // The host may be resolved before identity on /current, preserving its
    // characterized 409/404/400 precedence. Continue analysing after refusal:
    // resolving a locadora does not authorize reading a membership.
    const hostCall = awaited(value)
    if (
      CURRENT_ORGANIZATION.test(env.route) &&
      ts.isIdentifier(declaration.name) &&
      ts.isAwaitExpression(value) &&
      ts.isCallExpression(hostCall) &&
      hostCall.arguments.length === 1 &&
      isRequest(hostCall.arguments[0], env) &&
      CURRENT_HOST_RESOLVERS.some((resolver) => {
        const binding = importedCallee(hostCall, env.info)
        return binding && sameBinding(binding, resolver)
      }) &&
      plainIf(check) &&
      testsDenied(check.expression, declaration, OK_RESULT)
    ) {
      env.allowed.add(declaration)
      return leaveProblem(check.thenStatement, env)
        ? undefined
        : { next: index + 2 }
    }
    if (
      ts.isIdentifier(declaration.name) &&
      ts.isCallExpression(value) &&
      value.arguments.length === 2 &&
      MEMORY_FACADES.includes(importedCallee(value, env.info)?.module ?? '') &&
      importedCallee(value, env.info)?.name === 'checkRateLimit' &&
      isRequest(value.arguments[0], env) &&
      importNamed(
        value.arguments[1]!,
        env.info,
        importedCallee(value, env.info)!.module,
        ['adminApiRateLimit', 'strictRateLimit']
      ) &&
      memoryFacadeProblem(importedCallee(value, env.info)!.module) ===
        undefined &&
      plainIf(check) &&
      testsFailure(check.expression, declaration, 'allowed')
    ) {
      env.allowed.add(declaration)
      return leaveProblem(check.thenStatement, env)
        ? undefined
        : { next: index + 2 }
    }
    // Same-origin guard and its refusal.
    if (
      ts.isIdentifier(declaration.name) &&
      requestCall(value, env, IDENTITY_MODULE, ['rejectCrossOriginMutation']) &&
      plainIf(check) &&
      testsDenial(check.expression, declaration)
    ) {
      env.allowed.add(declaration)
      return leaveProblem(check.thenStatement, env)
        ? undefined
        : { next: index + 2, origin: true }
    }
    return undefined
  }
  if (
    plainIf(statement) &&
    refusesOrigin(statement.expression, env) &&
    !leaveProblem(statement.thenStatement, env)
  )
    return { next: index + 1, origin: true }
  return undefined
}
/** `request.json()` or `request.json().catch(<INERT>)`. */
function bodyRead(node: ts.Expression, env: Env): boolean {
  let call = strip(node)
  if (
    ts.isCallExpression(call) &&
    ts.isPropertyAccessExpression(call.expression) &&
    call.expression.name.text === 'catch' &&
    call.arguments.length === 1 &&
    !inertProblem(call.arguments[0]!, env)
  )
    call = strip(call.expression.expression)
  return (
    ts.isCallExpression(call) &&
    call.arguments.length === 0 &&
    ts.isPropertyAccessExpression(call.expression) &&
    call.expression.name.text === 'json' &&
    isRequest(call.expression.expression, env)
  )
}

/** A gate a call stands for: an approved helper, or a delegate checked with the same rule. */
type Choice =
  | { type: 'guard'; guard: Guard; call: ts.CallExpression }
  | {
      type: 'delegate'
      label: string
      outcome: Outcome
      call: ts.CallExpression
    }

/** The guard a value names: an approved helper, or a same-file constant built by one (possibly wrapped). */
function guardValue(
  node: ts.Expression,
  info: ModuleInfo,
  depth = 0
): Guard | undefined {
  if (depth > 4) return undefined
  const value = strip(node)
  if (ts.isIdentifier(value)) {
    const declaration = declarationOf(value)
    if (!declaration) return undefined
    if (isImportName(declaration)) {
      const binding = info.imports.get(value.text)
      return binding && GUARDS.find((guard) => sameBinding(binding, guard))
    }
    const top = moduleLevel(declaration)
    return top &&
      top !== 'reassignable' &&
      ts.isVariableDeclaration(top) &&
      top.initializer
      ? guardValue(top.initializer, info, depth + 1)
      : undefined
  }
  if (ts.isCallExpression(value)) {
    const binding = importedCallee(value, info)
    if (
      binding &&
      HANDLER_WRAPPERS.some((wrapper) => sameBinding(binding, wrapper)) &&
      value.arguments[0]
    ) {
      const inner = strip(value.arguments[0])
      if (ts.isCallExpression(inner)) {
        const factory = importedCallee(inner, info)
        return factory && GUARDS.find((guard) => sameBinding(factory, guard))
      }
    }
    // `NextAuth(authOptions)`: the handler an approved identity factory builds.
    if (binding && binding.module === 'next-auth')
      return GUARDS.find((guard) => sameBinding(binding, guard))
  }
  return undefined
}

/** The gates a call (or a conditional between calls, folded on the delegate's literals) stands for. */
function gateChoices(node: ts.Expression, env: Env): Choice[] | undefined {
  const value = awaited(node)
  if (ts.isConditionalExpression(value)) {
    const folded = foldLiteral(value.condition, env)
    if (folded !== undefined)
      return gateChoices(folded ? value.whenTrue : value.whenFalse, env)
    if (inertProblem(value.condition, env)) return undefined
    const whenTrue = gateChoices(value.whenTrue, env)
    const whenFalse = gateChoices(value.whenFalse, env)
    return whenTrue && whenFalse ? [...whenTrue, ...whenFalse] : undefined
  }
  if (!ts.isCallExpression(value)) return undefined
  const binding = importedCallee(value, env.info)
  const guard = binding && GUARDS.find((entry) => sameBinding(binding, entry))
  if (guard) return [{ type: 'guard', guard, call: value }]
  if (binding && isDelegate(binding)) {
    const target = bindingNode(binding)
    const handler = target && resolveHandler(target.info, target.node)
    const label = `${binding.module}#${binding.name}`
    return [
      {
        type: 'delegate',
        label,
        call: value,
        outcome:
          handler && isFunctionLike(handler.node)
            ? checkFunction(handler.info, handler.node, env.route, {
                args: value.arguments,
                caller: env,
                depth: env.depth + 1,
              })
            : fail(UNRESOLVED),
      },
    ]
  }
  // A same-file constant holding a guard's handler: `legacyHandler(request, context)`.
  const held = guardValue(value.expression, env.info)
  return held ? [{ type: 'guard', guard: held, call: value }] : undefined
}

/** `param === 'literal'` (or `!==`, `!`) on a delegate parameter bound to a literal. */
function foldLiteral(node: ts.Expression, env: Env): boolean | undefined {
  const value = strip(node)
  if (
    ts.isPrefixUnaryExpression(value) &&
    value.operator === ts.SyntaxKind.ExclamationToken
  ) {
    const inner = foldLiteral(value.operand, env)
    return inner === undefined ? undefined : !inner
  }
  if (!ts.isBinaryExpression(value)) return undefined
  const operator = value.operatorToken.kind
  const literal = (side: ts.Expression): Literal | undefined => {
    const inner = strip(side)
    if (ts.isStringLiteralLike(inner)) return inner.text
    if (ts.isNumericLiteral(inner)) return Number(inner.text)
    const declaration = declOf(inner)
    return declaration ? env.literals.get(declaration) : undefined
  }
  if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
    const left = foldLiteral(value.left, env)
    return left === false ? false : undefined
  }
  const negated =
    operator === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
    operator === ts.SyntaxKind.ExclamationEqualsToken
  if (
    !negated &&
    operator !== ts.SyntaxKind.EqualsEqualsEqualsToken &&
    operator !== ts.SyntaxKind.EqualsEqualsToken
  )
    return undefined
  const left = literal(value.left)
  const right = literal(value.right)
  if (left === undefined || right === undefined) return undefined
  return negated ? left !== right : left === right
}

/** What the choices of one gate authorize, or why they do not. */
function choicesOutcome(
  choices: Choice[],
  env: Env
):
  | {
      kinds: Set<Kind>
      origin: boolean
      adminPrincipal: boolean
      shapes: ResultShape[]
      labels: string[]
    }
  | { problem: string } {
  const kinds = new Set<Kind>()
  let origin = true
  let adminPrincipal = false
  const shapes: ResultShape[] = []
  const labels: string[] = []
  for (const choice of choices) {
    if (choice.type === 'guard') {
      const { guard } = choice
      if (!accepts(guard, env.route))
        return { problem: `${guard.name} does not authorize this namespace` }
      if (
        guard.requestArgument !== undefined &&
        !isRequest(choice.call.arguments[guard.requestArgument], env) &&
        !(
          guard.module === PUBLIC_FACTORY_HOST &&
          guard.name === 'resolvePublicRequestTenant' &&
          enrollmentHostOnlyRequest(
            choice.call.arguments[guard.requestArgument],
            env
          )
        )
      )
        return { problem: `${guard.name} must receive the handler request` }
      // Every argument runs before the helper: INERT, except the callbacks it runs once authorized.
      for (const [position, argument] of choice.call.arguments.entries()) {
        if (guard.callbacks?.includes(position)) continue
        const problem = inertProblem(argument, env)
        if (problem)
          return {
            problem: `before the guard: ${guard.name} receives ${problem}`,
          }
      }
      kinds.add(guard.kind)
      if (!CENTRAL_KINDS.has(guard.kind)) origin = false
      if (guard.kind === 'tenant-principal' && ADMIN.test(env.route))
        adminPrincipal = true
      shapes.push(guard.result)
      labels.push(guard.name)
    } else {
      for (const argument of choice.call.arguments) {
        const problem = inertProblem(argument, env)
        if (problem)
          return {
            problem: `before the guard: ${choice.label} receives ${problem}`,
          }
      }
      if (!choice.outcome.ok) return { problem: choice.outcome.reason }
      for (const kind of choice.outcome.kinds) kinds.add(kind)
      if (!choice.outcome.origin) origin = false
      shapes.push(RESPONSE_RESULT)
      labels.push(choice.label.split('#')[1]!)
    }
  }
  return { kinds, origin, adminPrincipal, shapes, labels }
}

/** State shared by the statements of one function before its gate. */
type Walk = {
  kinds: Set<Kind>
  /** The same-origin guard ran (PROLOGUE) before this point. */
  origin: boolean
  /** Every earlier guarded return ran the same-origin guard. */
  branchesOrigin: boolean
  guarded: boolean
}

/** Whether the handler's text calls an approved helper or delegate anywhere (for the failure message). */
function mentionsGate(node: ts.Node, env: Env): boolean {
  let found = false
  const visit = (current: ts.Node) => {
    if (found) return
    if (ts.isCallExpression(current)) {
      const binding = importedCallee(current, env.info)
      if (
        binding &&
        (GUARDS.some((guard) => sameBinding(binding, guard)) ||
          isDelegate(binding))
      )
        found = true
    }
    ts.forEachChild(current, visit)
  }
  visit(node)
  return found
}

/**
 * Checks the statements of a function body until its gate: PROLOGUE forms, a try whose catch is INERT and
 * leaves, inert refusals and guarded returns, then the gate itself. `after`: the statements that follow each
 * enclosing try (they run only once the try block completes, after the gate).
 */
function checkStatements(
  statements: readonly ts.Statement[],
  env: Env,
  walk: Walk,
  after: ReadonlyArray<readonly ts.Statement[]>,
  body: ts.Node
): Outcome {
  let index = 0
  while (index < statements.length) {
    const statement = statements[index]!
    const step = prologueStep(statements, index, env)
    if (step) {
      if (step.origin) walk.origin = true
      index = step.next
      continue
    }
    if (ts.isTryStatement(statement)) {
      if (statement.finallyBlock)
        return fail(
          `before the guard: finally (${describeNode(statement.finallyBlock)})`,
          walk.origin
        )
      const clause = statement.catchClause!
      const problem = leaves(clause.block)
        ? inertProblem(clause, env)
        : `${describeNode(clause)} does not leave the handler`
      if (problem)
        return fail(`catch before authorization: ${problem}`, walk.origin)
      return checkStatements(
        statement.tryBlock.statements,
        env,
        walk,
        [statements.slice(index + 1), ...after],
        body
      )
    }
    const gate = gateStatement(statements, index, env, walk, after)
    if (gate) return gate
    // An inert refusal, or a return guarded by its own gate: `if (<inert>) return <inert | gate>`.
    if (plainIf(statement) && !inertProblem(statement.expression, env)) {
      const exit = soleReturn(statement.thenStatement)
      const choices = exit?.expression && gateChoices(exit.expression, env)
      if (choices) {
        const outcome = choicesOutcome(choices, env)
        if ('problem' in outcome) return fail(outcome.problem, walk.origin)
        if (outcome.adminPrincipal) return fail(ADMIN_ROLE, walk.origin)
        for (const kind of outcome.kinds) walk.kinds.add(kind)
        walk.branchesOrigin &&= walk.origin || outcome.origin
        walk.guarded = true
        index += 1
        continue
      }
      if (!leaveProblem(statement.thenStatement, env)) {
        index += 1
        continue
      }
    }
    const discarded = discardedGate(statement, env)
    if (discarded)
      return fail(`result of ${discarded} is discarded`, walk.origin)
    // A refusal that is not INERT: say what it reaches.
    const why = plainIf(statement)
      ? (inertProblem(statement.expression, env) ??
        leaveProblem(statement.thenStatement, env))
      : undefined
    return fail(
      mentionsGate(body, env)
        ? `before the guard: ${describeNode(statement)}${why ? ` (${why})` : ''}`
        : NO_GUARD,
      walk.origin
    )
  }
  return fail(
    walk.guarded ? 'a path leaves the guarded branches' : NO_GUARD,
    walk.origin
  )
}

/** `await requireAdmin()`, `void requireAdmin()`, `return void (await requireAdmin())`: the helper's name. */
function discardedGate(statement: ts.Statement, env: Env): string | undefined {
  let value: ts.Expression | undefined = ts.isExpressionStatement(statement)
    ? statement.expression
    : ts.isReturnStatement(statement)
      ? statement.expression
      : undefined
  if (!value) return undefined
  value = strip(value)
  if (ts.isVoidExpression(value)) value = strip(value.expression)
  else if (!ts.isExpressionStatement(statement)) return undefined
  const choices = gateChoices(value, env)
  return choices?.[0]?.type === 'guard' ? choices[0].guard.name : undefined
}

/** The gate at `index`, when the statement is one: its Outcome (the handler is then decided). */
function gateStatement(
  statements: readonly ts.Statement[],
  index: number,
  env: Env,
  walk: Walk,
  after: ReadonlyArray<readonly ts.Statement[]>
): Outcome | undefined {
  const statement = statements[index]!
  const finish = (
    kinds: Set<Kind>,
    origin: boolean,
    owner = false
  ): Outcome => {
    for (const kind of walk.kinds) kinds.add(kind)
    return {
      ok: true,
      kinds,
      origin: walk.branchesOrigin && (walk.origin || origin),
      owner,
    }
  }
  // The helper's result returned as is.
  if (ts.isReturnStatement(statement) && statement.expression) {
    const choices = gateChoices(statement.expression, env)
    if (!choices) return undefined
    const outcome = choicesOutcome(choices, env)
    if ('problem' in outcome) return fail(outcome.problem, walk.origin)
    if (outcome.adminPrincipal) return fail(ADMIN_ROLE, walk.origin)
    return finish(outcome.kinds, outcome.origin)
  }
  const handshake = handshakeGate(statements, index, env)
  if (handshake)
    return 'problem' in handshake
      ? fail(handshake.problem, walk.origin)
      : finish(new Set<Kind>(['webhook-handshake']), false)
  const declaration = soleConst(statement)
  if (!declaration || !ts.isIdentifier(declaration.name)) return undefined
  const choices = gateChoices(declaration.initializer, env)
  if (!choices) return undefined
  const outcome = choicesOutcome(choices, env)
  if ('problem' in outcome) return fail(outcome.problem, walk.origin)
  const label = outcome.labels.join(', ')
  const check = statements[index + 1]
  // `if (!access.ok || <role check>) return ...`: the role check may join the test of the result.
  let condition = check && plainIf(check) ? strip(check.expression) : undefined
  let joined: ts.Expression | undefined
  if (
    condition &&
    outcome.adminPrincipal &&
    ts.isBinaryExpression(condition) &&
    condition.operatorToken.kind === ts.SyntaxKind.BarBarToken
  ) {
    joined = condition.right
    condition = strip(condition.left)
  }
  if (
    !condition ||
    !outcome.shapes.every((shape) =>
      testsDenied(condition!, declaration, shape)
    )
  )
    return fail(`result of ${label} is not checked`, walk.origin)
  env.allowed.add(declaration)
  const leave = leaveProblem((check as ts.IfStatement).thenStatement, env)
  if (leave)
    return fail(`result of ${label}: the refusal ${leave}`, walk.origin)
  const rest = [statements.slice(index + 2), ...after]
  let origin = outcome.origin
  // Reading the session changes nothing: the same-origin guard may follow it at once.
  if (
    !origin &&
    choices.every(
      (choice) =>
        choice.type === 'guard' &&
        CSRF_INERT.some(
          (entry) =>
            entry.module === choice.guard.module &&
            entry.names.includes(choice.guard.name)
        )
    )
  )
    origin = originFollows(statements[index + 2], env)
  if (!outcome.adminPrincipal) return finish(outcome.kinds, origin)
  const role = roleGate(declaration, joined, rest, env)
  if ('problem' in role) return fail(role.problem, walk.origin)
  if (role.owner) {
    const problem = ownerProblem(
      role.rest,
      role.owner,
      declaration,
      role.principals,
      env
    )
    if (problem) return fail(`OWNER_CLIENT: ${problem}`, walk.origin)
  }
  return finish(outcome.kinds, origin, !!role.owner)
}

/** `if (!isTrustedMutationOrigin(request)) return ...`, possibly behind a condition that folds to true. */
function originFollows(statement: ts.Statement | undefined, env: Env): boolean {
  if (!plainIf(statement) || leaveProblem(statement.thenStatement, env))
    return false
  const condition = strip(statement.expression)
  if (refusesOrigin(condition, env)) return true
  return (
    ts.isBinaryExpression(condition) &&
    condition.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
    foldLiteral(condition.left, env) === true &&
    refusesOrigin(condition.right, env)
  )
}

/**
 * Meta verification handshake (webhook namespace): the integration lookup, then INERT statements, then the
 * constant-time comparison of the verify token that leaves on mismatch.
 */
function handshakeGate(
  statements: readonly ts.Statement[],
  index: number,
  env: Env
): { problem: string } | { ok: true } | undefined {
  const lookup = soleConst(statements[index])
  const call = lookup && awaited(lookup.initializer)
  const binding =
    call && ts.isCallExpression(call)
      ? importedCallee(call, env.info)
      : undefined
  const handshake =
    binding && HANDSHAKES.find((pair) => sameBinding(binding, pair.lookup))
  if (
    !lookup ||
    !call ||
    !ts.isCallExpression(call) ||
    !importedCallee(call, env.info) ||
    !handshake
  )
    return undefined
  if (!WEBHOOK.test(env.route))
    return {
      problem: `${handshake.lookup.name} does not authorize this namespace`,
    }
  for (const argument of call.arguments) {
    const problem = inertProblem(argument, env)
    if (problem) return { problem: `before the guard: ${problem}` }
  }
  for (const bound of bindingDeclarations(lookup)) env.allowed.add(bound)
  for (let at = index + 1; at < statements.length; at += 1) {
    const statement = statements[at]!
    if (plainIf(statement)) {
      const condition = strip(statement.expression)
      const compared =
        ts.isPrefixUnaryExpression(condition) &&
        condition.operator === ts.SyntaxKind.ExclamationToken &&
        ts.isCallExpression(strip(condition.operand))
          ? (strip(condition.operand) as ts.CallExpression)
          : undefined
      const verify = compared && importedCallee(compared, env.info)
      const problem =
        verify && sameBinding(verify, handshake.verify)
          ? compared.arguments
              .map((argument) => inertProblem(argument, env))
              .find(Boolean)
          : inertProblem(statement.expression, env)
      const leave = problem ?? leaveProblem(statement.thenStatement, env)
      if (leave) return { problem: `before the guard: ${leave}` }
      if (verify && sameBinding(verify, handshake.verify)) return { ok: true }
      continue
    }
    const declaration = soleConst(statement)
    if (declaration && !inertProblem(declaration.initializer, env)) {
      for (const bound of bindingDeclarations(declaration))
        env.allowed.add(bound)
      if (ts.isArrayBindingPattern(declaration.name))
        return { problem: `before the guard: ${describeNode(statement)}` }
      continue
    }
    return { problem: `before the guard: ${describeNode(statement)}` }
  }
  return { problem: `${handshake.verify.name} never gates the handshake` }
}

type RoleGate =
  | {
      owner?: ts.Node
      principals: Set<ts.Node>
      rest: ts.Statement[]
    }
  | { problem: string }

/**
 * Under /api/admin, resolveTenantPrincipal authorizes once a role check follows at once (only route params
 * and principal aliases in between): an `if` on the principal's role that leaves unless it is one of
 * STAFF_ROLES (or a CLIENT that owns the resource, OWNER_CLIENT), a role predicate of DELEGATES, or another
 * approved helper that checks the role.
 */
function roleGate(
  gate: ts.Node,
  joined: ts.Expression | undefined,
  rest: ReadonlyArray<readonly ts.Statement[]>,
  env: Env
): RoleGate {
  const principals = new Set<ts.Node>()
  const roles = new Set<ts.Node>()
  const flat = rest.flat()
  const context = { gate, principals, roles, env }
  if (joined) {
    const verdict = roleVerdict(joined, context)
    return 'problem' in verdict
      ? verdict
      : { owner: verdict.owner, principals, rest: flat }
  }
  for (let index = 0; index < flat.length; index += 1) {
    const statement = flat[index]!
    const step = prologueStep(flat, index, env)
    if (step) {
      index = step.next - 1
      continue
    }
    const declaration = soleConst(statement)
    if (declaration && principalAlias(declaration, context)) continue
    if (plainIf(statement)) {
      const leave = leaveProblem(statement.thenStatement, env)
      if (leave) return { problem: ADMIN_ROLE }
      const verdict = roleVerdict(statement.expression, context)
      return 'problem' in verdict
        ? verdict
        : { owner: verdict.owner, principals, rest: flat.slice(index + 1) }
    }
    // Another approved helper that checks the role (requireRoles, requireTenantPermission).
    if (declaration && ts.isIdentifier(declaration.name)) {
      const choices = gateChoices(declaration.initializer, env)
      const check = flat[index + 1]
      if (
        choices?.length &&
        choices.every(
          (choice) =>
            choice.type === 'guard' &&
            (choice.guard.kind === 'role' ||
              choice.guard.kind === 'tenant-permission')
        ) &&
        plainIf(check) &&
        choices.every(
          (choice) =>
            choice.type === 'guard' &&
            testsDenied(check.expression, declaration, choice.guard.result)
        ) &&
        !choices.some((choice) =>
          choice.call.arguments.some((argument) => inertProblem(argument, env))
        ) &&
        !leaveProblem(check.thenStatement, env)
      )
        return { principals, rest: flat.slice(index + 2) }
    }
    return { problem: ADMIN_ROLE }
  }
  return { problem: ADMIN_ROLE }
}

type RoleContext = {
  gate: ts.Node
  principals: Set<ts.Node>
  roles: Set<ts.Node>
  env: Env
}
/** `const principal = access.principal`, `const { principal } = access`, `const { role } = principal`. */
function principalAlias(
  declaration: ts.VariableDeclaration & { initializer: ts.Expression },
  context: RoleContext
): boolean {
  const value = strip(declaration.initializer)
  if (ts.isIdentifier(declaration.name) && isPrincipal(value, context)) {
    context.principals.add(declaration)
    context.env.allowed.add(declaration)
    return true
  }
  if (
    !ts.isObjectBindingPattern(declaration.name) ||
    !simplePattern(declaration.name)
  )
    return false
  const fromGate = declOf(value) === context.gate
  const fromPrincipal = isPrincipal(value, context)
  if (!fromGate && !fromPrincipal) return false
  for (const element of declaration.name.elements) {
    const property = propertyText(element.propertyName ?? element.name)
    if (fromGate && property === 'principal') context.principals.add(element)
    else if (fromPrincipal && property === 'role') context.roles.add(element)
    else return false
    context.env.allowed.add(element)
  }
  return true
}
/** `access.principal` of the gate, or an alias of it. */
function isPrincipal(node: ts.Expression, context: RoleContext): boolean {
  const value = strip(node)
  if (ts.isIdentifier(value)) {
    const declaration = declarationOf(value)
    return !!declaration && context.principals.has(declaration)
  }
  return (
    ts.isPropertyAccessExpression(value) &&
    value.name.text === 'principal' &&
    declOf(value.expression) === context.gate
  )
}
const isPrincipalMember = (
  node: ts.Expression,
  member: string,
  context: RoleContext
) => {
  const value = strip(node)
  return (
    ts.isPropertyAccessExpression(value) &&
    value.name.text === member &&
    isPrincipal(value.expression, context)
  )
}
const isRoleOf = (node: ts.Expression, context: RoleContext) => {
  const value = strip(node)
  if (ts.isIdentifier(value)) {
    const declaration = declarationOf(value)
    return !!declaration && context.roles.has(declaration)
  }
  return isPrincipalMember(value, 'role', context)
}
/** String literals of `['A', 'B']`, `new Set([...])`, or a same-file constant holding one. */
function literalStrings(
  node: ts.Expression,
  depth = 0
): Set<string> | undefined {
  if (depth > 4) return undefined
  const value = strip(node)
  if (ts.isArrayLiteralExpression(value))
    return value.elements.every((element) => ts.isStringLiteralLike(element))
      ? new Set(
          value.elements.map((element) => (element as ts.StringLiteral).text)
        )
      : undefined
  if (
    ts.isNewExpression(value) &&
    ts.isIdentifier(value.expression) &&
    value.expression.text === 'Set' &&
    !declarationOf(value.expression) &&
    value.arguments?.[0]
  )
    return literalStrings(value.arguments[0], depth + 1)
  if (ts.isIdentifier(value)) {
    const declaration = declarationOf(value)
    const top = declaration && moduleLevel(declaration)
    return top &&
      top !== 'reassignable' &&
      ts.isVariableDeclaration(top) &&
      top.initializer &&
      top === declaration
      ? literalStrings(top.initializer, depth + 1)
      : undefined
  }
  return undefined
}

const OTHER_ROLE = '\u0000another role'
/**
 * What a role condition lets through (the handler goes on when it is false): only STAFF_ROLES, or a CLIENT
 * when `principal.userId` equals a route param (the owner). Anything the evaluation cannot read fails.
 */
function roleVerdict(
  condition: ts.Expression,
  context: RoleContext
): { owner?: ts.Node } | { problem: string } {
  let owner: ts.Node | undefined
  let unknown = false
  const mentioned = new Set<string>()
  const collect = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node)) mentioned.add(node.text)
    ts.forEachChild(node, collect)
  }
  collect(condition)
  const evaluate = (
    node: ts.Expression,
    role: string,
    own: boolean,
    scope: RoleContext,
    depth: number
  ): boolean | undefined => {
    const value = strip(node)
    if (
      ts.isPrefixUnaryExpression(value) &&
      value.operator === ts.SyntaxKind.ExclamationToken
    ) {
      const inner = evaluate(value.operand, role, own, scope, depth)
      return inner === undefined ? undefined : !inner
    }
    if (ts.isBinaryExpression(value)) {
      const operator = value.operatorToken.kind
      if (
        operator === ts.SyntaxKind.AmpersandAmpersandToken ||
        operator === ts.SyntaxKind.BarBarToken
      ) {
        const left = evaluate(value.left, role, own, scope, depth)
        const right = evaluate(value.right, role, own, scope, depth)
        if (left === undefined || right === undefined) return undefined
        return operator === ts.SyntaxKind.AmpersandAmpersandToken
          ? left && right
          : left || right
      }
      const negated =
        operator === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
        operator === ts.SyntaxKind.ExclamationEqualsToken
      if (
        !negated &&
        operator !== ts.SyntaxKind.EqualsEqualsEqualsToken &&
        operator !== ts.SyntaxKind.EqualsEqualsToken
      )
        return undefined
      for (const [left, right] of [
        [value.left, value.right],
        [value.right, value.left],
      ] as const) {
        const other = strip(right)
        if (isRoleOf(left, scope) && ts.isStringLiteralLike(other))
          return negated ? role !== other.text : role === other.text
        if (isPrincipalMember(left, 'userId', scope)) {
          const declaration = declOf(other)
          if (!declaration || !scope.env.routeParams.has(declaration))
            return undefined
          if (owner && owner !== declaration) return undefined
          owner = declaration
          return negated ? !own : own
        }
      }
      return undefined
    }
    if (
      ts.isCallExpression(value) &&
      ts.isPropertyAccessExpression(value.expression)
    ) {
      const method = value.expression.name.text
      const [argument] = value.arguments
      if (
        (method === 'includes' || method === 'has') &&
        argument &&
        value.arguments.length === 1 &&
        isRoleOf(argument, scope)
      ) {
        const list = literalStrings(value.expression.expression)
        return list ? list.has(role) : undefined
      }
      return undefined
    }
    // A role predicate: a same-file function or one of DELEGATES, `(principal) => <condition>`.
    if (
      ts.isCallExpression(value) &&
      value.arguments.length === 1 &&
      isPrincipal(value.arguments[0]!, scope) &&
      depth < 3
    ) {
      const predicate = predicateOf(value, scope.env)
      if (!predicate) return undefined
      const [parameter] = predicate.fn.parameters
      if (
        !parameter ||
        !ts.isIdentifier(parameter.name) ||
        parameter.initializer
      )
        return undefined
      const inner: RoleContext = {
        gate: scope.gate,
        principals: new Set([parameter]),
        roles: new Set(),
        env: { ...scope.env, routeParams: new Set() },
      }
      return evaluate(predicate.condition, role, own, inner, depth + 1)
    }
    return undefined
  }
  const candidates = new Set([
    ...STAFF_ROLES,
    'CLIENT',
    OTHER_ROLE,
    ...mentioned,
  ])
  const passing: Array<[string, boolean]> = []
  for (const role of candidates)
    for (const own of [false, true]) {
      const result = evaluate(condition, role, own, context, 0)
      if (result === undefined) unknown = true
      else if (!result) passing.push([role, own])
    }
  if (unknown) return { problem: ADMIN_ROLE }
  let client = false
  for (const [role, own] of passing) {
    if (STAFF_ROLES.has(role)) continue
    if (role === 'CLIENT' && own && owner) {
      client = true
      continue
    }
    return { problem: ADMIN_ROLE }
  }
  return client ? { owner } : {}
}
/** A role predicate called on the principal: its function and the condition it returns. */
function predicateOf(
  call: ts.CallExpression,
  env: Env
): { fn: FunctionLike; condition: ts.Expression } | undefined {
  const callee = strip(call.expression)
  let fn: ts.Node | undefined
  if (ts.isIdentifier(callee)) {
    const declaration = declarationOf(callee)
    if (declaration && isImportName(declaration)) {
      const binding = env.info.imports.get(callee.text)
      if (!binding || !DELEGATES.some((entry) => sameBinding(binding, entry)))
        return undefined
      fn = bindingNode(binding)?.node
    } else if (declaration) {
      const top = moduleLevel(declaration)
      fn =
        top && top !== 'reassignable'
          ? ts.isVariableDeclaration(top)
            ? top.initializer && strip(top.initializer)
            : top
          : undefined
    }
  }
  if (!fn || !isFunctionLike(fn) || !fn.body) return undefined
  if (!ts.isBlock(fn.body)) return { fn, condition: fn.body }
  const [only] = fn.body.statements
  return fn.body.statements.length === 1 &&
    only &&
    ts.isReturnStatement(only) &&
    only.expression
    ? { fn, condition: only.expression }
    : undefined
}

/** Schema fields per Prisma delegate: scalar fields (relations are in RELATIONS). */
const SCALARS: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const schema = fs.readFileSync(
    path.join(ROOT, 'prisma', 'schema.prisma'),
    'utf8'
  )
  const models = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)]
  const names = new Set(models.map((model) => model[1]!))
  const scalars = new Map<string, ReadonlySet<string>>()
  for (const [, name, body] of models) {
    const fields = new Set<string>()
    for (const line of body!.split(/\r?\n/)) {
      const field = /^\s*(\w+)\s+(\w+)/.exec(line)
      if (field && !names.has(field[2]!) && !field[1]!.startsWith('@'))
        fields.add(field[1]!)
    }
    scalars.set(name!.charAt(0).toLowerCase() + name!.slice(1), fields)
  }
  return scalars
})()

/**
 * A filter (or new record) of `delegate` that names the owner at its top level: a scalar field equal to it
 * (`{ userId }`, `{ id: userId }`) or a compound unique key holding it (`{ tenantId_userId: { tenantId,
 * userId } }`, each part a field of the schema). Operators, combinators, relations and spreads never name it.
 */
function ownerFilter(
  node: ts.Expression | undefined,
  delegate: string,
  isOwner: (_node: ts.Node | undefined) => boolean
): boolean {
  const filter = node && strip(node)
  const fields = SCALARS.get(delegate)
  if (!filter || !fields || !ts.isObjectLiteralExpression(filter)) return false
  // A spread, a computed or a repeated key may override the owner (`{ userId, ['user' + 'Id']: undefined }`).
  if (
    filter.properties.some((property) => ts.isSpreadAssignment(property)) ||
    recordProblem(filter, NO_KEYS)
  )
    return false
  return filter.properties.some((property) => {
    if (ts.isShorthandPropertyAssignment(property))
      return fields.has(property.name.text) && isOwner(property.name)
    if (!ts.isPropertyAssignment(property)) return false
    const key = propertyText(property.name)
    if (!key) return false
    if (fields.has(key)) return isOwner(property.initializer)
    const parts = key.split('_')
    const compound = strip(property.initializer)
    return (
      parts.length > 1 &&
      parts.every((part) => fields.has(part)) &&
      ts.isObjectLiteralExpression(compound) &&
      !compound.properties.some((item) => ts.isSpreadAssignment(item)) &&
      !recordProblem(compound, NO_KEYS) &&
      compound.properties.some((item) =>
        ts.isShorthandPropertyAssignment(item)
          ? parts.includes(item.name.text) && isOwner(item.name)
          : ts.isPropertyAssignment(item) &&
            parts.includes(propertyText(item.name) ?? '') &&
            isOwner(item.initializer)
      )
    )
  })
}

/**
 * OWNER_CLIENT: once a CLIENT may pass as the owner, every statement that follows is INERT or reads/writes
 * data only through an access that names the owner in its argument (an OWNER_SCOPED helper, or one query
 * of `withTenantTransaction(principal, (tx) => tx.<model>.<operation>({ where: { <field>: owner } }))`).
 */
function ownerProblem(
  statements: readonly ts.Statement[],
  owner: ts.Node,
  gate: ts.Node,
  principals: Set<ts.Node>,
  env: Env
): string | undefined {
  const context: RoleContext = { gate, principals, roles: new Set(), env }
  const isOwner = (node: ts.Node | undefined) =>
    !!node &&
    ts.isExpression(node) &&
    (declOf(node) === owner || isPrincipalMember(node, 'userId', context))
  /** An access to data: `skip` when it names the owner, why not otherwise; undefined for any other call. */
  const access = (node: ts.Node): 'skip' | string | undefined => {
    if (!ts.isCallExpression(node)) return undefined
    const binding = importedCallee(node, env.info)
    const helper =
      binding && OWNER_SCOPED.find((entry) => sameBinding(binding, entry))
    if (helper) {
      if (!isOwner(node.arguments[helper.owner]))
        return `${describeNode(node)} does not hand ${helper.name} the owner`
      return (
        node.arguments
          .map((argument) => inertProblem(argument, env))
          .find(Boolean) ?? 'skip'
      )
    }
    if (!binding || !DATA_SCOPES.some((entry) => sameBinding(binding, entry)))
      return undefined
    const one = `${describeNode(node)} is not one query`
    const [scope, callback, ...others] = node.arguments
    const fn = callback && strip(callback)
    if (
      !scope ||
      others.length ||
      !fn ||
      !ts.isArrowFunction(fn) ||
      fn.parameters.length !== 1
    )
      return one
    const parameter = fn.parameters[0]!
    if (!ts.isIdentifier(parameter.name) || parameter.initializer) return one
    const scoped = inertProblem(scope, env)
    if (scoped) return scoped
    let body: ts.Node = fn.body
    if (ts.isBlock(body)) {
      const only = soleReturn(body)
      if (!only?.expression) return one
      body = only.expression
    }
    const query = awaited(body as ts.Expression)
    const callee = ts.isCallExpression(query)
      ? strip(query.expression)
      : undefined
    const model =
      callee && ts.isPropertyAccessExpression(callee)
        ? strip(callee.expression)
        : undefined
    if (
      !ts.isCallExpression(query) ||
      !callee ||
      !ts.isPropertyAccessExpression(callee) ||
      !model ||
      !ts.isPropertyAccessExpression(model) ||
      declOf(model.expression) !== parameter ||
      !PRISMA_OPERATIONS.has(callee.name.text) ||
      query.arguments.length !== 1
    )
      return one
    const argument = strip(query.arguments[0]!)
    if (
      !ts.isObjectLiteralExpression(argument) ||
      !ownerRecordOnly(argument, model.name.text)
    )
      return `${describeNode(query)} leaves the owner record`
    const inner = inertProblem(argument, env)
    if (inner) return inner
    const field = (key: string) =>
      argument.properties.find(
        (property): property is ts.PropertyAssignment =>
          ts.isPropertyAssignment(property) &&
          propertyText(property.name) === key
      )?.initializer
    const where = field('where')
    const named = where
      ? ownerFilter(where, model.name.text, isOwner)
      : CREATE_OPERATIONS.has(callee.name.text) &&
        ownerFilter(field('data'), model.name.text, isOwner)
    return named ? 'skip' : `${describeNode(query)} is not scoped by the owner`
  }
  const scoped = (node: ts.Node) => inertProblem(node, env, new Set(), access)
  for (const statement of statements) {
    const declaration = soleConst(statement)
    // The body, read as in the PROLOGUE: `const body = await request.json()`.
    const read = declaration && strip(declaration.initializer)
    if (
      declaration &&
      read &&
      ts.isIdentifier(declaration.name) &&
      ts.isAwaitExpression(read) &&
      bodyRead(read.expression, env)
    ) {
      env.allowed.add(declaration)
      continue
    }
    if (declaration && simplePattern(declaration.name)) {
      const problem = scoped(declaration.initializer)
      if (problem) return problem
      for (const bound of bindingDeclarations(declaration))
        env.allowed.add(bound)
      continue
    }
    if (plainIf(statement)) {
      const problem =
        scoped(statement.expression) ??
        (leaves(statement.thenStatement)
          ? scoped(statement.thenStatement)
          : `${describeNode(statement)} does not leave the handler`)
      if (problem) return problem
      continue
    }
    if (
      ts.isExpressionStatement(statement) ||
      ((ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) &&
        statement.expression)
    ) {
      const problem = scoped((statement as ts.ExpressionStatement).expression)
      if (problem) return problem
      continue
    }
    return `${describeNode(statement)} is not an owner-scoped statement`
  }
  return undefined
}

/**
 * The structural rule over one handler (or delegate, its parameters bound to the call's arguments): its
 * parameters carry no default that reaches data, and its body passes checkStatements.
 */
function checkFunction(
  info: ModuleInfo,
  fn: ts.Node,
  route: string,
  call: { args?: readonly ts.Expression[]; caller?: Env; depth?: number } = {}
): Outcome {
  const depth = call.depth ?? 0
  if (depth > 6) return fail('recursive delegation cannot be checked')
  if (ts.isCallExpression(fn)) {
    // `export { handler as GET }` with `const handler = NextAuth(options)`.
    const guard = guardValue(fn, info)
    if (!guard) return fail(UNRESOLVED)
    if (!accepts(guard, route))
      return fail(`${guard.name} does not authorize this namespace`)
    return {
      ok: true,
      kinds: new Set([guard.kind]),
      origin: false,
      owner: false,
    }
  }
  if (!isFunctionLike(fn) || !fn.body) return fail(UNRESOLVED)
  const env: Env = {
    info,
    route,
    params: new Set(),
    contexts: new Set(),
    allowed: new Set(),
    routeParams: new Set(),
    literals: new Map(),
    depth,
  }
  for (const [position, parameter] of fn.parameters.entries()) {
    if (parameter.dotDotDotToken)
      return fail(`${describeNode(parameter)}: rest parameter`)
    if (parameter.initializer) {
      const problem = inertProblem(parameter.initializer, env)
      if (problem)
        return fail(
          `before the guard: default ${describeNode(parameter)} reaches ${problem}`
        )
    }
    const argument = call.args?.[position]
    const name = parameter.name
    if (ts.isIdentifier(name)) {
      env.allowed.add(parameter)
      if (position === 0 && (!call.caller || isRequest(argument, call.caller)))
        env.request = parameter
      else if (position === 1 && !call.caller) env.contexts.add(parameter)
      const literal = argument && strip(argument)
      if (
        literal &&
        (ts.isStringLiteralLike(literal) || ts.isNumericLiteral(literal))
      )
        env.literals.set(
          parameter,
          ts.isNumericLiteral(literal) ? Number(literal.text) : literal.text
        )
      else if (literal?.kind === ts.SyntaxKind.TrueKeyword)
        env.literals.set(parameter, true)
      else if (literal?.kind === ts.SyntaxKind.FalseKeyword)
        env.literals.set(parameter, false)
      else if (argument === undefined && parameter.initializer) {
        const fallback = strip(parameter.initializer)
        if (
          fallback.kind === ts.SyntaxKind.TrueKeyword ||
          fallback.kind === ts.SyntaxKind.FalseKeyword
        )
          env.literals.set(
            parameter,
            fallback.kind === ts.SyntaxKind.TrueKeyword
          )
        else if (ts.isStringLiteralLike(fallback))
          env.literals.set(parameter, fallback.text)
      }
    } else if (
      ts.isObjectBindingPattern(name) &&
      position === 1 &&
      !call.caller
    ) {
      // `{ params }` of the handler context.
      for (const element of name.elements) {
        if (
          element.dotDotDotToken ||
          element.initializer ||
          !ts.isIdentifier(element.name)
        )
          return fail(`before the guard: ${describeNode(parameter)}`)
        env.allowed.add(element)
        if (propertyText(element.propertyName ?? element.name) === 'params')
          env.params.add(element)
      }
    } else return fail(`before the guard: ${describeNode(parameter)}`)
  }
  const walk: Walk = {
    kinds: new Set(),
    origin: false,
    branchesOrigin: true,
    guarded: false,
  }
  if (!ts.isBlock(fn.body)) {
    const outcome = gateStatement(
      [ts.factory.createReturnStatement(fn.body)],
      0,
      env,
      walk,
      []
    )
    return (
      outcome ??
      fail(
        mentionsGate(fn.body, env)
          ? `before the guard: ${describeNode(fn.body)}`
          : NO_GUARD
      )
    )
  }
  return checkStatements(fn.body.statements, env, walk, [], fn.body)
}

/** Global calls a route module may make when it loads: collections of literal data (`new Set(['A', 'B'])`). */
const LOAD_TIME_CALLS = new Set(['new Set', 'new Map'])
/**
 * The zod calls a route module may make when it loads (finding 112): schema construction only, a closed list kept
 * in sync with the installed zod (a builder runs nothing it receives: a callback given to `transform` or `refine`
 * runs only when a handler parses, under the guard rule). Anything else fails: parse, safeParse, parseAsync, decode
 * and every other run of a schema, config (a global error map a later parse calls), toJSONSchema, registries (meta,
 * describe), lazy, custom, preprocess, superRefine, check. ZOD_NAMESPACES are the members of `z` that group builders
 * (`z.coerce.number()`, `z.iso.datetime()`).
 */
const ZOD_BUILDERS: ReadonlySet<string> = new Set([
  'array',
  'boolean',
  'date',
  'datetime',
  'default',
  'email',
  'enum',
  'extend',
  'finite',
  'int',
  'literal',
  'max',
  'min',
  'nonnegative',
  'nullable',
  'number',
  'object',
  'omit',
  'optional',
  'or',
  'partial',
  'pick',
  'pipe',
  'positive',
  'record',
  'refine',
  'regex',
  'strict',
  'string',
  'transform',
  'trim',
  'union',
  'unknown',
  'uuid',
])
const ZOD_NAMESPACES: ReadonlySet<string> = new Set(['coerce', 'iso'])
/**
 * The builders that keep a callback for parse time, and the only place a function may be handed to zod when the
 * module loads: their first argument, a function of the code, of the file or of ZOD_CALLBACK_GLOBALS
 * (`transform((value) => value.trim())`, `transform(Number)`, `refine((value) => value > 0, { error: 'x' })`).
 * Anywhere else zod may run it as it builds: the params of every builder are spread into the schema's definition,
 * and a `checks: [{ _zod: { onattach: [fn] } }]` there runs `fn` at construction (finding 112, zod 4.6.5).
 */
const ZOD_CALLBACKS: ReadonlySet<string> = new Set(['transform', 'refine'])
/** Globals a ZOD_CALLBACKS builder may keep as its callback (`transform(Number)`). */
const ZOD_CALLBACK_GLOBALS: ReadonlySet<string> = new Set([
  'Number',
  'String',
  'Boolean',
])
/** The zod namespace (`import { z } from 'zod'` or `import * as z from 'zod'`): the only root of a zod chain. */
const zodNamespace = (binding: Binding | undefined) =>
  binding?.module === 'zod' &&
  installedPackage(binding) &&
  (binding.name === 'z' || binding.name === '*')
/** The syntax of what a route module evaluates when it loads (function bodies aside, which do not run then). */
const LOAD_SYNTAX: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.Identifier,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.BigIntLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.RegularExpressionLiteral,
  ts.SyntaxKind.TrueKeyword,
  ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.NullKeyword,
  ts.SyntaxKind.ObjectLiteralExpression,
  ts.SyntaxKind.PropertyAssignment,
  ts.SyntaxKind.ShorthandPropertyAssignment,
  ts.SyntaxKind.ArrayLiteralExpression,
  ts.SyntaxKind.CallExpression,
  ts.SyntaxKind.NewExpression,
  ts.SyntaxKind.ParenthesizedExpression,
  ts.SyntaxKind.AsExpression,
  ts.SyntaxKind.SatisfiesExpression,
  ts.SyntaxKind.NonNullExpression,
  ts.SyntaxKind.TypeAssertionExpression,
  ts.SyntaxKind.BinaryExpression,
  ts.SyntaxKind.PrefixUnaryExpression,
])
/** Literal data: primitives and arrays or plain records of literal data (`[['a', 1]]`, `6 * 60 * 1000`). */
function literalData(node: ts.Expression): boolean {
  const value = strip(node)
  if (primitiveLiteral(value)) return true
  if (ts.isArrayLiteralExpression(value))
    return value.elements.every(
      (element) => !ts.isSpreadElement(element) && literalData(element)
    )
  if (ts.isObjectLiteralExpression(value))
    return (
      !recordProblem(value, HOOK_KEYS) &&
      value.properties.every(
        (property) =>
          ts.isPropertyAssignment(property) && literalData(property.initializer)
      )
    )
  return (
    ts.isBinaryExpression(value) &&
    [
      ts.SyntaxKind.PlusToken,
      ts.SyntaxKind.MinusToken,
      ts.SyntaxKind.AsteriskToken,
      ts.SyntaxKind.SlashToken,
    ].includes(value.operatorToken.kind) &&
    literalData(value.left) &&
    literalData(value.right)
  )
}

/**
 * Why a route module is not safe to load (undefined when it is). When it loads it evaluates only the syntax
 * of LOAD_SYNTAX (function bodies do not run then): references, literal data, plain records (functions may be
 * values, never under HOOK_KEYS), and calls of three kinds: zod schema construction (a chain of ZOD_BUILDERS on
 * `z`, one of its ZOD_NAMESPACES or a zod schema of the file, receiving data only: literal data, plain records,
 * zod schemas, literal constants; a function only as the callback of ZOD_CALLBACKS), LOAD_TIME_FACTORIES,
 * HANDLER_WRAPPERS and NextAuth, and LOAD_TIME_CALLS of literal data. No member is read and no operator converts
 * anything but literal data. Declarations: functions, classes without static code that extend only a class of
 * INERT_CLASSES or of the file (loadBase), constants and imports only (no side-effect import, no top-level
 * statement).
 */
function loadProblem(info: ModuleInfo): string | undefined {
  const factories = (binding: Binding) =>
    LOAD_TIME_FACTORIES.some((entry) => sameBinding(binding, entry)) ||
    HANDLER_WRAPPERS.some((entry) => sameBinding(binding, entry))
  /**
   * A name a zod builder may receive as data when the module loads (zod reads it as it builds, or spreads it into
   * the schema's definition): a zod schema or a constant of literal data of the file, or a literal constant of an
   * import. Never a function: see ZOD_CALLBACKS.
   */
  const zodValue = (identifier: ts.Identifier): boolean => {
    const declaration = declarationOf(identifier)
    if (!declaration) return false
    if (isImportName(declaration)) {
      const binding = info.imports.get(identifier.text)
      return !!binding && literalConstant(binding)
    }
    const top = moduleLevel(declaration)
    if (!top || top === 'reassignable') return false
    return (
      zodSchema(top) ||
      (ts.isVariableDeclaration(top) &&
        top === declaration &&
        !!top.initializer &&
        literalData(top.initializer))
    )
  }
  /** The callback a ZOD_CALLBACKS builder keeps for parse time: a function of the code, of the file or a global. */
  const zodCallback = (argument: ts.Expression): boolean => {
    const value = strip(argument)
    if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return true
    if (!ts.isIdentifier(value)) return false
    const declaration = declarationOf(value)
    if (!declaration) return ZOD_CALLBACK_GLOBALS.has(value.text)
    const top = moduleLevel(declaration)
    return top === declaration && localFunction(top)
  }
  const loadInert = (node: ts.Node): string | undefined => {
    let problem: string | undefined
    /** Inside the arguments of a zod builder: every name is a zodValue and no function is handed over. */
    let zodArguments = 0
    /** A call that may run when the module loads; its receiver chain and arguments are visited. */
    const call = (current: ts.CallExpression | ts.NewExpression) => {
      const construct = ts.isNewExpression(current)
      const callee = strip(current.expression)
      const label = describeNode(current)
      if (ts.isIdentifier(callee)) {
        const declaration = declarationOf(callee)
        const imported = importedCallee(current, info)
        if (!declaration) {
          if (
            !LOAD_TIME_CALLS.has(`${construct ? 'new ' : ''}${callee.text}`) ||
            !(current.arguments ?? []).every(literalData)
          )
            problem = label
          return
        }
        if (
          construct ||
          !imported ||
          !(factories(imported) || imported.module === 'next-auth')
        ) {
          problem = label
          return
        }
      } else if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.name) &&
        ZOD_BUILDERS.has(callee.name.text) &&
        !construct
      ) {
        // zod builds a schema, keeping its callbacks for parse time.
        const root = callRoot(callee)
        const declaration = root && declarationOf(root)
        const namespace =
          !!root &&
          !!declaration &&
          isImportName(declaration) &&
          zodNamespace(info.imports.get(root.text))
        if (!declaration || !(namespace || zodSchema(declaration))) {
          problem = label
          return
        }
        // The receiver: `z`, one of its ZOD_NAMESPACES (`z.coerce`) or a call on it, checked as a call in turn.
        let receiver = strip(callee.expression)
        if (ts.isPropertyAccessExpression(receiver)) {
          if (
            !namespace ||
            !ts.isIdentifier(receiver.name) ||
            !ZOD_NAMESPACES.has(receiver.name.text)
          ) {
            problem = label
            return
          }
          receiver = strip(receiver.expression)
          if (!ts.isIdentifier(receiver)) {
            problem = label
            return
          }
        }
        if (ts.isCallExpression(receiver)) visit(receiver)
        else if (!ts.isIdentifier(receiver)) {
          problem = label
          return
        }
        if (problem) return
        zodArguments += 1
        for (const [index, argument] of (current.arguments ?? []).entries()) {
          // The callback of a ZOD_CALLBACKS builder: kept for parse time, its body does not run now.
          if (
            index === 0 &&
            ZOD_CALLBACKS.has(callee.name.text) &&
            zodCallback(argument)
          )
            continue
          visit(argument)
        }
        zodArguments -= 1
        return
      } else {
        problem = label
        return
      }
      for (const argument of current.arguments ?? []) visit(argument)
    }
    const visit = (current: ts.Node) => {
      if (problem) return
      // Function bodies do not run when the module loads (a method's name is checked with its record). Handed to
      // zod anywhere but the callback of ZOD_CALLBACKS, zod may run the function as it builds (finding 112).
      if (isFunctionLike(current)) {
        if (zodArguments > 0) problem = `${describeNode(current)} handed to zod`
        return
      }
      if (ts.isExpressionWithTypeArguments(current)) {
        problem = describeNode(current)
        return
      }
      if (ts.isTypeNode(current)) return
      if (!LOAD_SYNTAX.has(current.kind) && !isPunctuation(current.kind)) {
        problem = describeNode(current)
        return
      }
      if (ts.isCallExpression(current) || ts.isNewExpression(current)) {
        call(current)
        return
      }
      if (ts.isObjectLiteralExpression(current)) {
        const seen = new Set<string>()
        for (const property of current.properties) {
          const key = ts.isMethodDeclaration(property)
            ? staticKey(property.name)
            : ts.isPropertyAssignment(property) ||
                ts.isShorthandPropertyAssignment(property)
              ? staticKey(property.name)
              : undefined
          if (key === undefined || HOOK_KEYS.has(key) || seen.has(key)) {
            problem = describeNode(property)
            return
          }
          seen.add(key)
        }
      }
      // Operators run only on literal data: nothing is converted or written.
      if (
        (ts.isBinaryExpression(current) ||
          ts.isPrefixUnaryExpression(current)) &&
        !literalData(current)
      ) {
        problem = describeNode(current)
        return
      }
      if (
        zodArguments > 0 &&
        ts.isIdentifier(current) &&
        !isMemberName(current) &&
        !zodValue(current)
      ) {
        problem = `${describeNode(current)} handed to zod`
        return
      }
      ts.forEachChild(current, visit)
    }
    visit(node)
    return problem
  }
  /**
   * What a binding pattern destructures when the module loads (finding 124): reading its properties or iterating it
   * must run nothing, so only an object or array literal of the code (loadInert checks it: no accessor, spread or
   * hook key) or a same-file `const` initialized with one; never an import, a call or another value.
   */
  const patternSource = (initializer: ts.Expression | undefined): boolean => {
    let value = initializer && strip(initializer)
    if (value && ts.isIdentifier(value)) {
      const declaration = declarationOf(value)
      const top = declaration && moduleLevel(declaration)
      value =
        top &&
        top !== 'reassignable' &&
        top === declaration &&
        ts.isVariableDeclaration(top) &&
        ts.isIdentifier(top.name) &&
        top.initializer
          ? strip(top.initializer)
          : undefined
    }
    return (
      !!value &&
      (ts.isObjectLiteralExpression(value) ||
        ts.isArrayLiteralExpression(value))
    )
  }
  /**
   * Every node of a binding name runs under the grammar (finding 124): keys are static and outside
   * FORBIDDEN_MEMBERS, defaults (evaluated when the value is undefined) are loadInert, nested patterns recurse.
   */
  const bindingProblem = (name: ts.BindingName): string | undefined => {
    if (ts.isIdentifier(name)) return undefined
    for (const element of name.elements) {
      if (ts.isOmittedExpression(element)) continue
      const key = element.propertyName
        ? staticKey(element.propertyName)
        : ts.isObjectBindingPattern(name) && ts.isIdentifier(element.name)
          ? element.name.text
          : undefined
      if (
        (element.propertyName && key === undefined) ||
        (key !== undefined && FORBIDDEN_MEMBERS.has(key))
      )
        return `the pattern key of ${describeNode(element)}`
      const problem =
        (element.initializer && loadInert(element.initializer)) ||
        bindingProblem(element.name)
      if (problem) return problem
    }
    return undefined
  }
  /** Decorators run as the class (or its member) is defined: none, on the class, a member or a parameter. */
  const decorated = (node: ts.Node) =>
    ts.canHaveDecorators(node) && !!ts.getDecorators(node)?.length
  /**
   * The closed grammar of a class declaration when the module loads: no decorator, `extends` only a loadBase,
   * `implements` only a name, and members that run nothing where the class is defined. Methods, accessors and
   * constructors (bodies run when called) with static names and undecorated parameters, properties without
   * computed names whose initializer runs at construction (not static), index signatures and semicolons. Anything
   * else (a static block, a static initializer, a computed name, an unknown member) fails.
   */
  const classProblem = (node: ts.ClassDeclaration): string | undefined => {
    const label = `class ${node.name?.text ?? ''} runs code when the module loads`
    if (decorated(node)) return label
    // `extends X` reads X and its prototype as the class is defined: only a loadBase.
    for (const clause of node.heritageClauses ?? [])
      for (const type of clause.types)
        if (
          clause.token === ts.SyntaxKind.ExtendsKeyword
            ? !loadBase(type.expression)
            : !ts.isIdentifier(type.expression)
        )
          return label
    for (const member of node.members) {
      if (
        ts.isIndexSignatureDeclaration(member) ||
        ts.isSemicolonClassElement(member)
      )
        continue
      const known =
        ts.isMethodDeclaration(member) ||
        ts.isGetAccessorDeclaration(member) ||
        ts.isSetAccessorDeclaration(member) ||
        ts.isConstructorDeclaration(member) ||
        ts.isPropertyDeclaration(member)
      if (
        !known ||
        decorated(member) ||
        (member.name &&
          staticKey(member.name) === undefined &&
          !ts.isPrivateIdentifier(member.name)) ||
        (ts.isPropertyDeclaration(member) &&
          hasModifier(member, ts.SyntaxKind.StaticKeyword) &&
          !!member.initializer) ||
        (ts.isFunctionLike(member) && member.parameters.some(decorated))
      )
        return label
    }
    return undefined
  }
  /**
   * The closed grammar of the top level (finding 124): each statement kind lists every node it may hold, and a kind
   * it does not list fails. Imports with bindings and re-exports load a module; declarations of functions, types,
   * interfaces and ambient (`declare`) forms run nothing; a variable statement (no `using`) runs its initializers
   * (loadInert), then what its patterns read (a patternSource) and default (bindingProblem); a class runs
   * classProblem; an enum its static member names and loadInert initializers. Side-effect imports, namespaces, `export =`/`export default`
   * of an expression, `import x = …` and every other statement fail.
   */
  const statementProblem = (statement: ts.Statement): string | undefined => {
    if (hasModifier(statement, ts.SyntaxKind.DeclareKeyword)) return undefined
    if (ts.isImportDeclaration(statement))
      return statement.importClause
        ? undefined
        : `import '${(statement.moduleSpecifier as ts.StringLiteral).text}'`
    if (
      ts.isExportDeclaration(statement) ||
      ts.isFunctionDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEmptyStatement(statement)
    )
      return undefined
    if (ts.isVariableStatement(statement)) {
      if (statement.declarationList.flags & ts.NodeFlags.Using)
        return describeNode(statement)
      // In evaluation order: the initializer, then what its pattern reads and defaults.
      for (const declaration of statement.declarationList.declarations) {
        const problem =
          (declaration.initializer && loadInert(declaration.initializer)) ||
          (!ts.isIdentifier(declaration.name) &&
          !patternSource(declaration.initializer)
            ? `the pattern ${describeNode(declaration)}`
            : bindingProblem(declaration.name))
        if (problem) return problem
      }
      return undefined
    }
    if (ts.isClassDeclaration(statement)) return classProblem(statement)
    if (ts.isEnumDeclaration(statement)) {
      for (const member of statement.members) {
        if (staticKey(member.name) === undefined) return describeNode(member)
        const problem = member.initializer && loadInert(member.initializer)
        if (problem) return problem
      }
      return undefined
    }
    return describeNode(statement)
  }
  for (const statement of info.source.statements) {
    const problem = statementProblem(statement)
    if (problem) return problem
  }
  return undefined
}
/**
 * A class a class of the route module may extend when it loads (finding 112): `extends` reads its value and its
 * `prototype` then, so an import's getters or Proxy traps would run. A class of INERT_CLASSES (inertClass) or a
 * class declared at the top of the file, nothing else.
 */
function loadBase(node: ts.Expression): boolean {
  if (inertClass(node)) return true
  const value = strip(node)
  const declaration = ts.isIdentifier(value) ? declarationOf(value) : undefined
  return (
    !!declaration &&
    ts.isClassDeclaration(declaration) &&
    moduleLevel(declaration) === declaration
  )
}
/** The identifier a chain of members and calls starts from: `z` in `z.object({}).strict()`. */
function callRoot(node: ts.Expression): ts.Identifier | undefined {
  let value = strip(node)
  while (
    ts.isPropertyAccessExpression(value) ||
    ts.isElementAccessExpression(value) ||
    ts.isCallExpression(value)
  )
    value = strip(value.expression)
  return ts.isIdentifier(value) ? value : undefined
}
/** A same-file constant built by zod (`const Input = z.object(...)`): its calls when the module loads are ZOD_BUILDERS. */
function zodSchema(declaration: ts.Node): boolean {
  const top = moduleLevel(declaration)
  if (
    !top ||
    top === 'reassignable' ||
    !ts.isVariableDeclaration(top) ||
    top !== declaration ||
    !top.initializer
  )
    return false
  const root = callRoot(top.initializer)
  const rootDeclaration = root && declarationOf(root)
  return (
    !!root &&
    !!rootDeclaration &&
    isImportName(rootDeclaration) &&
    zodNamespace(moduleOf(root)?.imports.get(root.text))
  )
}

type Verdict =
  | { ok: true; kinds: Kind[]; followed: string[]; owner: boolean }
  | { ok: false; reason: string }
type CsrfVerdict = { ok: true } | { ok: false; reason: string }
type Endpoint = {
  route: string
  method: string
  facts: Facts
  verdict: Verdict
  /** Why the method is not INERT (undefined when it is), for the allowlist invariants that require it. */
  inert?: string
  /** Mutations only: whether the same-origin guard runs before any effect. */
  csrf: CsrfVerdict | null
}
const NO_ORIGIN = 'no same-origin guard before the first effect'

/**
 * The first specifier of a module (import, re-export, `import()`, `require()`, `import x = require()`) that names
 * more than one file, as the AmbiguousModule message (finding 123, scenario B); undefined when none does.
 */
function ambiguousImport(info: ModuleInfo): string | undefined {
  let found: string | undefined
  const visit = (node: ts.Node) => {
    if (found) return
    const argument =
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require'))
        ? node.arguments[0]
        : undefined
    const specifier =
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
        ? node.moduleSpecifier.text
        : ts.isExternalModuleReference(node) &&
            ts.isStringLiteral(node.expression)
          ? node.expression.text
          : argument && ts.isStringLiteralLike(argument)
            ? argument.text
            : undefined
    if (specifier)
      try {
        resolveModule(info.file, specifier)
      } catch (error) {
        if (!(error instanceof AmbiguousModule)) throw error
        found = error.message
      }
    ts.forEachChild(node, visit)
  }
  visit(info.source)
  return found
}

/** Enrollment resolves a public host first, but that alone never authorizes creation. */
function enrollmentIdentityProblem(
  info: ModuleInfo,
  node: ts.Node,
  route: string
): string | undefined {
  if (route !== 'apps/services/api/src/app/api/client/enroll/route.ts')
    return undefined
  if (!ts.isFunctionDeclaration(node) || !node.body)
    return 'enrollment identity handler is unresolved'
  const attempt = node.body.statements.find(ts.isTryStatement)
  if (!attempt) return 'enrollment identity is not checked'
  const statements = attempt.tryBlock.statements
  const index = statements.findIndex((statement) => {
    const declaration = soleConst(statement)
    const call = declaration && awaited(declaration.initializer)
    return (
      !!call &&
      ts.isCallExpression(call) &&
      ['apps/services/api/src/host/session'].some((module) =>
        sameBinding(importedCallee(call, info) ?? { module: '', name: '' }, {
          module,
          name: 'getServerSession',
        })
      )
    )
  })
  if (index < 0) return 'enrollment identity is not checked'
  const identity = statements[index + 1]
  const refusal = statements[index + 2]
  if (
    !identity ||
    !/^const userId = session\?\.user\?\.id;?$/.test(
      identity.getText().trim()
    ) ||
    !refusal ||
    !/^if \(!userId\) return reply\(\{ error: 'Authentication required' \}, 401\);?$/.test(
      refusal.getText().trim()
    )
  )
    return 'enrollment requires the session user id'
  // This route aliases session.user.id before its refusal, so explicitly bind
  // that id to the sole enrollment call instead of accepting the public gate.
  const writing = soleConst(statements[index + 3])
  const call = writing && awaited(writing.initializer)
  if (
    !call ||
    !ts.isCallExpression(call) ||
    call.expression.getText() !== 'enrollment.enrollClient' ||
    call.arguments.length !== 1 ||
    !ts.isObjectLiteralExpression(call.arguments[0]!)
  )
    return 'enrollment identity is not checked before writing'
  const owner = call.arguments[0]!.properties.find(
    (property) =>
      ts.isShorthandPropertyAssignment(property) &&
      property.name.text === 'userId'
  )
  if (!owner || !ts.isShorthandPropertyAssignment(owner))
    return 'enrollment does not use the session user id'
  let writes = 0
  const visit = (child: ts.Node) => {
    if (
      ts.isCallExpression(child) &&
      child.expression.getText() === 'enrollment.enrollClient'
    )
      writes += 1
    ts.forEachChild(child, visit)
  }
  visit(node.body)
  return writes === 1
    ? undefined
    : 'enrollment writes before the session refusal'
}

function analyzeRouteModule(file: string, text?: string): Endpoint[] {
  const info = parseModule(file, text)
  const ambiguity = ambiguousImport(info)
  const route = relative(file)
  const endpoints: Endpoint[] = []
  const surface = exportSurface(info)
  const source = info.source
  const load = loadTimeCode(source)
  // Side-effect imports load a module: a reference (and a call) of every handler.
  const sideEffects = source.statements.filter(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      !statement.importClause &&
      ts.isStringLiteral(statement.moduleSpecifier)
  )
  // A module that changes a class `instanceof` may name before a guard defeats the refusals of every handler, its
  // own and the other routes' (finding 111): none of its methods passes. sealedClassProblems also runs over the
  // whole server source.
  const sealed = sealedClassProblems(file, text)[0]
  for (const method of METHODS) {
    if (!surface.names.has(method)) continue
    const target = exportedNode(info, method)
    const handler = target && resolveHandler(target.info, target.node)
    if (!target || !handler) {
      endpoints.push({
        route,
        method,
        facts: emptyFacts(),
        verdict: { ok: false, reason: UNRESOLVED },
        csrf: UNSAFE_METHODS.has(method)
          ? { ok: false, reason: UNRESOLVED }
          : null,
      })
      continue
    }
    const facts = reach(target.info, target.node, load)
    const publicComposition = PUBLIC_FACTORY_COMPOSITIONS.get(target.info)
    if (publicComposition) {
      // These facts come from the actual host factory call, not an invented reference list.
      const original = reach(publicComposition.info, publicComposition.node)
      for (const reference of original.references)
        facts.references.add(reference)
      for (const status of original.statuses) facts.statuses.add(status)
      facts.calls.push(...original.calls)
      facts.followed.push(...original.followed)
    }
    for (const statement of sideEffects) {
      const module = moduleBinding(
        info.file,
        (statement.moduleSpecifier as ts.StringLiteral).text,
        '*'
      ).module
      facts.references.add(`${module}#*`)
      facts.calls.push({
        module,
        name: '*',
        node: statement as unknown as ts.CallExpression,
      })
    }
    // A specifier that names more than one file: the analysis may have read a file the server does not run.
    const ambiguous =
      ambiguity ??
      (handler.info !== info ? ambiguousImport(handler.info) : undefined)
    // The code the route module (and the module the handler lives in) runs when it loads, before any gate.
    const loading =
      loadProblem(info) ??
      (handler.info !== info ? loadProblem(handler.info) : undefined)
    const outcome = checkFunction(handler.info, handler.node, route)
    const enrollmentIdentity = enrollmentIdentityProblem(
      handler.info,
      handler.node,
      route
    )
    const changes =
      sealed && `the module changes a class after instanceof: ${sealed}`
    const inert = ambiguous
      ? ambiguous
      : loading
        ? `the module runs ${loading} when it loads`
        : (inertProblem(handler.node, {
            info: handler.info,
            route,
            params: new Set(),
            contexts: new Set(),
            allowed: new Set(),
            routeParams: new Set(),
            literals: new Map(),
            depth: 0,
          }) ?? changes)
    const verdict: Verdict = ambiguous
      ? { ok: false, reason: ambiguous }
      : loading
        ? { ok: false, reason: `the module runs ${loading} when it loads` }
        : !outcome.ok
          ? { ok: false, reason: outcome.reason }
          : enrollmentIdentity
            ? { ok: false, reason: enrollmentIdentity }
            : changes
              ? { ok: false, reason: changes }
              : outcome.kinds.has('public-tenant') &&
                  !PUBLIC_TENANT_SURFACE[route]?.methods.includes(method)
                ? { ok: false, reason: PUBLIC_TENANT_OUTSIDE_SURFACE }
                : {
                    ok: true,
                    kinds: [...outcome.kinds].sort(),
                    followed: facts.followed,
                    owner: outcome.owner,
                  }
    endpoints.push({
      route,
      method,
      facts,
      verdict,
      inert,
      csrf: !UNSAFE_METHODS.has(method)
        ? null
        : outcome.origin
          ? { ok: true }
          : {
              ok: false,
              reason: outcome.ok
                ? NO_ORIGIN
                : `${NO_ORIGIN} (${outcome.reason})`,
            },
    })
  }
  for (const specifier of surface.unresolved)
    endpoints.push({
      route,
      method: '*',
      facts: emptyFacts(),
      verdict: {
        ok: false,
        reason: `export * from ${specifier} could not be resolved statically`,
      },
      csrf: null,
    })
  return endpoints
}

function routeFiles(directory: string): string[] {
  const absolute = path.join(ROOT, directory)
  if (!fs.existsSync(absolute)) return []
  return fs
    .readdirSync(absolute, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? SKIP_DIRS.has(entry.name)
          ? []
          : routeFiles(path.join(directory, entry.name))
        : ROUTE_FILE.test(entry.name)
          ? [path.join(absolute, entry.name)]
          : []
    )
}

function invariantViolations(
  endpoint: Endpoint,
  invariant: Invariant
): string[] {
  const problems: string[] = []
  for (const reference of endpoint.facts.references) {
    const [module] = reference.split('#')
    if (
      !invariant.references.includes(reference) &&
      !invariant.references.includes(`${module}#*`)
    )
      problems.push(`references ${reference}`)
  }
  if (invariant.status && !endpoint.facts.statuses.has(invariant.status))
    problems.push(`does not answer ${invariant.status}`)
  return problems
}

/** What the endpoints of an allowlisted route reach beyond its invariant (a retired one calls nothing). */
function allowlistProblems(route: string, endpoints: Endpoint[]): string[] {
  const entry = PUBLIC_ALLOWLIST[route]
  if (!entry) return [`${route}: not in PUBLIC_ALLOWLIST`]
  const problems: string[] = []
  for (const method of entry.methods) {
    const endpoint = endpoints.find((item) => item.method === method)
    if (!endpoint) continue
    if (
      method === 'GET' &&
      PUBLIC_FACTORY_CLOSURES.some(
        ([, , , pathName]) =>
          route === `apps/services/api/src/app/api/${pathName}/route.ts`
      ) &&
      (!endpoint.verdict.ok ||
        !endpoint.verdict.kinds.includes('public-tenant'))
    )
      problems.push(
        `${route}#${method}: public factory has no checked tenant refusal before data`
      )
    if (endpoint.facts.calls.length && entry.invariant === RETIRED)
      problems.push(`${route}#${method}: retired handler calls a module`)
    if (entry.invariant.inert && endpoint.inert)
      problems.push(`${route}#${method}: not INERT (${endpoint.inert})`)
    for (const problem of invariantViolations(endpoint, entry.invariant))
      problems.push(`${route}#${method}: ${problem}`)
  }
  return problems
}

/**
 * A mutation authenticated by the session cookie: gated by a cookie helper,
 * or reading the session on its way; plus the anonymous account flows of the
 * allowlist (IDENTITY_FLOW), open on the tenant host. Retired (410) and the
 * catch-all 404 touch nothing.
 */
function cookieMutation(endpoint: Endpoint): boolean {
  if (!UNSAFE_METHODS.has(endpoint.method)) return false
  const allowed = PUBLIC_ALLOWLIST[endpoint.route]
  if (allowed?.methods.includes(endpoint.method))
    return allowed.invariant === IDENTITY_FLOW
  if (!endpoint.verdict.ok) return false
  return (
    endpoint.verdict.kinds.some((kind) => COOKIE_KINDS.has(kind)) ||
    endpoint.facts.references.has(
      'apps/services/api/src/host/session#getServerSession'
    )
  )
}

const allRouteFiles = ROUTE_ROOTS.flatMap(routeFiles).sort()
const inventory = allRouteFiles.flatMap((file) => analyzeRouteModule(file))
const key = (endpoint: Pick<Endpoint, 'route' | 'method'>) =>
  `${endpoint.route}#${endpoint.method}`
const find = (route: string, method: string) =>
  inventory.find(
    (endpoint) => endpoint.route === route && endpoint.method === method
  )

describe('route authentication inventory', () => {
  it('scans every Route Handler of the legacy, web and API hosts', () => {
    expect(allRouteFiles.length).toBeGreaterThanOrEqual(140)
    expect(inventory.length).toBeGreaterThanOrEqual(180)
    expect(allRouteFiles.map(relative)).toContain(
      'apps/services/api/src/app/api/health/route.ts'
    )
    for (const file of allRouteFiles)
      expect(
        inventory.some((endpoint) => endpoint.route === relative(file)),
        `${relative(file)} exports no HTTP method`
      ).toBe(true)
  })

  it('every exported method reaches an approved helper or is explicitly public', () => {
    const unguarded = inventory
      .filter((endpoint) => !endpoint.verdict.ok)
      .filter(
        (endpoint) =>
          !PUBLIC_ALLOWLIST[endpoint.route]?.methods.includes(endpoint.method)
      )
      .map(
        (endpoint) =>
          `${key(endpoint)}: ${endpoint.verdict.ok ? '' : endpoint.verdict.reason}`
      )
    expect(unguarded).toEqual([])
  })

  it('keeps the public allowlist exact and each entry within its invariant', () => {
    const problems: string[] = []
    for (const [route, entry] of Object.entries(PUBLIC_ALLOWLIST)) {
      expect(entry.reason.length).toBeGreaterThan(20)
      if (!fs.existsSync(path.join(ROOT, route))) {
        problems.push(`${route}: stale allowlist entry (file missing)`)
        continue
      }
      const exported = inventory
        .filter((endpoint) => endpoint.route === route)
        .map((endpoint) => endpoint.method)
      if ([...exported].sort().join() !== [...entry.methods].sort().join())
        problems.push(
          `${route}: allowlist methods ${entry.methods.join()} != exported ${exported.join()}`
        )
      problems.push(
        ...allowlistProblems(
          route,
          inventory.filter((endpoint) => endpoint.route === route)
        )
      )
    }
    expect(problems).toEqual([])
  })

  it('follows only delegates that still resolve to a project function', () => {
    for (const delegate of DELEGATES) {
      const file = resolveModule(
        path.join(ROOT, 'package.json'),
        `@/${delegate.module}`
      )
      expect(file, delegate.module).toBeDefined()
      expect(
        bindingNode({ ...delegate, file }),
        `${delegate.module}#${delegate.name}`
      ).not.toBeNull()
    }
  })

  it('evaluates the moved contract role predicate through its real public facade', () => {
    const file = path.join(
      ROOT,
      'packages/backend/src/modules/documents/rental-contracts.ts'
    )
    const source = fs.readFileSync(file, 'utf8')
    const original = "return ['ADMIN', 'OPERATOR'].includes(principal.role)"
    expect(source).toContain(original)
    const routes = [
      'apps/services/api/src/app/api/admin/rentals/[id]/contract/route.ts',
    ]
    for (const mutation of [
      'return true',
      "return ['CLIENT'].includes(principal.role)",
    ]) {
      FIXTURE_FILES.set(file, source.replace(original, mutation))
      try {
        for (const route of routes) {
          const results = analyzeRouteModule(path.join(ROOT, route)).map(
            (endpoint) => (endpoint.verdict.ok ? 'ok' : endpoint.verdict.reason)
          )
          expect(results, route + ' ' + mutation).toEqual([
            ADMIN_ROLE,
            ADMIN_ROLE,
          ])
        }
      } finally {
        FIXTURE_FILES.delete(file)
      }
    }
  })

  it('keeps STAFF_ROLES in sync with the Membership role enum', () => {
    const schema = fs.readFileSync(
      path.join(ROOT, 'prisma/schema.prisma'),
      'utf8'
    )
    const role = /model Membership \{[^}]*?\n\s*role\s+(\w+)/.exec(schema)?.[1]
    expect(role).toBeDefined()
    const values = new RegExp(`enum ${role} \\{([^}]*)\\}`).exec(schema)?.[1]
    expect((values ?? '').split(/\s+/).filter(Boolean).sort()).toEqual(
      [...STAFF_ROLES, 'CLIENT'].sort()
    )
  })

  it('classifies representative routes by the helper they actually use', () => {
    const expectations: Array<[string, string, Kind]> = [
      ['apps/services/api/src/app/api/cron/outbox/route.ts', 'GET', 'cron'],
      ['apps/services/api/src/app/api/cron/late-fees/route.ts', 'GET', 'cron'],
      [
        'apps/services/api/src/app/api/admin/categories/route.ts',
        'POST',
        'tenant-permission',
      ],
      [
        'apps/services/api/src/app/api/admin/rentals/route.ts',
        'GET',
        'tenant-principal',
      ],
      [
        'apps/services/api/src/app/api/admin/rentals/[id]/contract/route.ts',
        'POST',
        'tenant-principal',
      ],
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        'GET',
        'tenant-principal',
      ],
      [
        'apps/services/api/src/app/api/admin/quotes/[id]/download/route.ts',
        'GET',
        'tenant-permission',
      ],
      [
        'apps/services/api/src/app/api/quotes/[id]/download/route.ts',
        'GET',
        'tenant-principal',
      ],
      [
        'apps/services/api/src/app/api/orcamentos/route.ts',
        'POST',
        'public-tenant',
      ],
      [
        'apps/services/api/src/app/api/payments/pix/webhook/[integrationId]/route.ts',
        'POST',
        'webhook',
      ],
      [
        'apps/services/api/src/app/api/webhooks/whatsapp/[integrationId]/route.ts',
        'GET',
        'webhook-handshake',
      ],
      [
        'apps/services/api/src/app/api/auth/[...nextauth]/route.ts',
        'POST',
        'identity',
      ],
      [
        'apps/services/api/src/app/api/auth/organizations/selection/route.ts',
        'POST',
        'identity',
      ],
      [
        'apps/services/api/src/app/api/equipments/route.ts',
        'GET',
        'public-tenant',
      ],
    ]
    for (const [route, method, kind] of expectations) {
      const endpoint = find(route, method)
      expect(endpoint, `${route}#${method}`).toBeDefined()
      const result = endpoint!.verdict
      expect(
        result.ok && result.kinds.includes(kind),
        `${route}#${method}`
      ).toBe(true)
    }
  })

  // O serviço preserva a classificação por helper; o caso público também caracteriza sua composição explícita.
  it('classifies the representative routes of the shared API by the helper they actually use', () => {
    const api = (route: string) =>
      `apps/services/api/src/app/api/${route}/route.ts`
    const expectations: Array<[string, string, Kind]> = [
      [api('cron/outbox'), 'GET', 'cron'],
      [api('cron/late-fees'), 'GET', 'cron'],
      [api('admin/categories'), 'POST', 'tenant-permission'],
      [api('admin/rentals'), 'GET', 'tenant-principal'],
      [api('admin/rentals/[id]/contract'), 'POST', 'tenant-principal'],
      [api('admin/badges'), 'GET', 'tenant-principal'],
      [api('admin/quotes/[id]/download'), 'GET', 'tenant-permission'],
      [api('quotes/[id]/download'), 'GET', 'tenant-principal'],
      [api('orcamentos'), 'POST', 'public-tenant'],
      [api('payments/pix/webhook/[integrationId]'), 'POST', 'webhook'],
      [api('webhooks/whatsapp/[integrationId]'), 'GET', 'webhook-handshake'],
      [api('auth/[...nextauth]'), 'POST', 'identity'],
      [api('auth/organizations/selection'), 'POST', 'identity'],
    ]
    for (const [route, method, kind] of expectations) {
      const endpoint = find(route, method)
      expect(endpoint, `${route}#${method}`).toBeDefined()
      const result = endpoint!.verdict
      expect(
        result.ok ? result.kinds : result.reason,
        `${route}#${method}`
      ).toContain(kind)
    }
    // A lista pública do serviço reexporta a composição pública (`host/runtime`): ela é pública por lista, com o
    // invariante da composição pública da API, e não por um helper da rota.
    const publicList = api('equipments')
    expect(find(publicList, 'GET')).toBeDefined()
    expect(PUBLIC_ALLOWLIST[publicList]?.methods).toEqual(['GET'])
    expect(PUBLIC_ALLOWLIST[publicList]?.invariant).toBe(API_PUBLIC_COMPOSITION)
  })

  // E26 (onda 135): a superfície da API compartilhada é fixa e versionada. Rota ou método que some (ou aparece) muda a
  // fixture de propósito, no mesmo diff; os mínimos do primeiro caso continuam, mas quem fixa a superfície é esta lista.
  it('keeps the shared API surface equal to the versioned fixture (173 routes, 221 methods)', () => {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(ROOT, API_SURFACE_FIXTURE), 'utf8')
    ) as { routes: number; methods: number; endpoints: string[] }
    const prefix = 'apps/services/api/src/app'
    const ROUTE_SUFFIX = /\/route\.[cm]?[jt]sx?$/
    const surface = inventory
      .filter((endpoint) => endpoint.route.startsWith(`${prefix}/api/`))
      .map(
        (endpoint) =>
          `${endpoint.method} ${endpoint.route.slice(prefix.length).replace(ROUTE_SUFFIX, '')}`
      )
      .sort()
    expect(new Set(surface).size).toBe(surface.length)
    expect(surface).toEqual(fixture.endpoints)
    expect(fixture.endpoints).toHaveLength(fixture.methods)
    expect(
      new Set(fixture.endpoints.map((entry) => entry.split(' ')[1])).size
    ).toBe(fixture.routes)
    expect([fixture.routes, fixture.methods]).toEqual([173, 221])
    // Cada rota da árvore exporta ao menos um método da fixture (nenhuma `route.ts` muda sem aparecer aqui).
    const files = allRouteFiles
      .map(relative)
      .filter((file) => file.startsWith(`${prefix}/api/`))
      .map((file) => file.slice(prefix.length).replace(ROUTE_SUFFIX, ''))
    expect(files.sort()).toEqual(
      [...new Set(fixture.endpoints.map((entry) => entry.split(' ')[1]))].sort()
    )
  })
})

/** A function declared anywhere in `file` (also inside a factory), by name. */
function declaredFunction(
  file: string,
  name: string,
  text?: string
): (Located & { node: ts.FunctionDeclaration }) | undefined {
  const info = parseModule(path.join(ROOT, file), text)
  let found: ts.FunctionDeclaration | undefined
  const visit = (node: ts.Node) => {
    if (found) return
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node
    else ts.forEachChild(node, visit)
  }
  visit(info.source)
  return found && { info, node: found }
}

/**
 * Why an OWNER_SCOPED helper does not scope by its owner argument: its source must refuse any CLIENT other
 * than that owner (a throw on `principal.userId === owner` failing) and name the owner at the top level of
 * every `where` it writes.
 */
function ownerScopedProblems(
  entry: (typeof OWNER_SCOPED)[number],
  text?: string
): string[] {
  const found = declaredFunction(entry.source, entry.name, text)
  if (!found) return [`${entry.source}#${entry.name} not found`]
  const parameter = found.node.parameters[entry.owner]
  if (!parameter || !ts.isIdentifier(parameter.name))
    return [`${entry.name}: argument ${entry.owner} is not a named parameter`]
  const owner = parameter.name.text
  const problems: string[] = []
  const body = found.node.body
  const refuses = body?.statements.some(
    (statement) =>
      ts.isIfStatement(statement) &&
      statement.expression
        .getText()
        .replace(/\s+/g, ' ')
        .includes(`principal.userId === ${owner}`) &&
      ts.isThrowStatement(statement.thenStatement)
  )
  if (!refuses)
    problems.push(`${entry.name}: does not refuse a CLIENT other than ${owner}`)
  const isOwner = (node: ts.Node | undefined) =>
    !!node &&
    ts.isIdentifier(ts.isExpression(node) ? unwrap(node) : node) &&
    (unwrap(node as ts.Expression) as ts.Identifier).text === owner
  let filters = 0
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && propertyText(node.name) === 'where') {
      filters += 1
      if (!filterNamesOwner(node.initializer, isOwner))
        problems.push(
          `${entry.name}: ${describeNode(node)} does not name ${owner}`
        )
    }
    ts.forEachChild(node, visit)
  }
  if (body) visit(body)
  if (!filters) problems.push(`${entry.name}: no query filtered by ${owner}`)
  return problems
}

/** The file of a module id: a project module (backend catalog errors) or a backend export in its package.json. */
function moduleFile(module: string): string | undefined {
  if (module === '@gb-locacoes/contracts') {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, 'packages/contracts/package.json'),
        'utf8'
      )
    ) as { exports: Record<string, string> }
    const target = manifest.exports['.']
    return target ? path.join(ROOT, 'packages/contracts', target) : undefined
  }
  const backend = '@gb-locacoes/backend/'
  if (!module.startsWith(backend))
    return resolveModule(path.join(ROOT, 'package.json'), `@/${module}`)
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'packages/backend/package.json'), 'utf8')
  ) as { exports: Record<string, string> }
  const target = manifest.exports[`./${module.slice(backend.length)}`]
  return target ? path.join(ROOT, 'packages/backend', target) : undefined
}
/** The class a module exports under `name`, following `export { X } from` into the workspace packages. */
function exportedClass(
  binding: { module: string; name: string; file?: string },
  depth = 0
): ts.ClassDeclaration | undefined {
  const file = binding.file ?? moduleFile(binding.module)
  if (!file || depth > 8) return undefined
  const info = parseModule(file)
  const entry = info.exports.get(binding.name)
  if (entry?.from) return exportedClass(entry.from, depth + 1)
  if (entry && !entry.local) return undefined
  const declaration = info.locals.get(entry?.local ?? binding.name)
  return declaration &&
    ts.isClassDeclaration(declaration) &&
    (!!entry || hasModifier(declaration, ts.SyntaxKind.ExportKeyword))
    ? declaration
    : undefined
}
/**
 * Why a project entry of INERT_CLASSES may run code under `instanceof` (finding 111): its module must export the
 * class declared in `source` as `export class X extends <INERT_GLOBAL_CLASSES>` (or no base) with no static member
 * or block, computed name or decorator (the ways its declaration could give it a Symbol.hasInstance of its own),
 * and the class is never written or handed over in its file.
 */
function inertClassProblems(
  entry: (typeof INERT_CLASSES)[number],
  text?: string
): string[] {
  if (!entry.source) return [`${entry.module}#${entry.name} has no source`]
  const file = path.join(ROOT, entry.source)
  const declaration = parseModule(file, text).locals.get(entry.name)
  if (!declaration || !ts.isClassDeclaration(declaration))
    return [`${entry.source}#${entry.name} is not a class`]
  if (!hasModifier(declaration, ts.SyntaxKind.ExportKeyword))
    return [`${entry.name} is not exported by ${entry.source}`]
  const problems: string[] = []
  const exported = exportedClass(entry)
  if (
    !exported ||
    path.resolve(exported.getSourceFile().fileName) !== path.resolve(file) ||
    exported.name?.text !== entry.name
  )
    problems.push(
      `${entry.module}#${entry.name} is not the class of ${entry.source}`
    )
  for (const clause of declaration.heritageClauses ?? [])
    for (const type of clause.types)
      if (
        clause.token === ts.SyntaxKind.ExtendsKeyword &&
        !(
          ts.isIdentifier(type.expression) &&
          INERT_GLOBAL_CLASSES.has(type.expression.text) &&
          !declarationOf(type.expression)
        )
      )
        problems.push(`${entry.name} extends ${describeNode(type.expression)}`)
  if (ts.getDecorators(declaration)?.length)
    problems.push(`${entry.name} is decorated`)
  for (const member of declaration.members) {
    if (
      ts.isClassStaticBlockDeclaration(member) ||
      hasModifier(member, ts.SyntaxKind.StaticKeyword)
    )
      problems.push(`${entry.name} has static ${describeNode(member)}`)
    else if (member.name && ts.isComputedPropertyName(member.name))
      problems.push(`${entry.name} has computed ${describeNode(member)}`)
    else if (ts.canHaveDecorators(member) && ts.getDecorators(member)?.length)
      problems.push(`${entry.name} has decorated ${describeNode(member)}`)
  }
  const written = sealedProblem(declaration)
  if (written) problems.push(`${entry.name} ${written}`)
  return problems
}

/**
 * The source the server may load (finding 111): every script of the project but tests, tooling, docs, static
 * assets, stories, dot directories (.agents, .storybook) and the mobile client. Whatever runs in it after a guard
 * shares the process (and its classes) with the code before the guard of every other handler.
 */
const NOT_SERVER_DIRS = new Set([
  ...SKIP_DIRS,
  '__tests__',
  'coverage',
  'e2e',
  'test',
  'tests',
])
const NOT_SERVER_PATHS = new Set([
  'apps/clients/mobile',
  'design-tokens',
  'docs',
  'public',
  'reports',
  'scripts',
  'stories',
  'tests',
  'tools',
])
function serverSource(
  directory = '',
  extensions = /\.[cm]?[jt]sx?$/
): string[] {
  return fs
    .readdirSync(path.join(ROOT, directory), { withFileTypes: true })
    .flatMap((entry) => {
      const item = directory ? `${directory}/${entry.name}` : entry.name
      if (entry.isDirectory())
        return entry.name.startsWith('.') ||
          NOT_SERVER_DIRS.has(entry.name) ||
          NOT_SERVER_PATHS.has(item)
          ? []
          : serverSource(item, extensions)
      return extensions.test(entry.name) &&
        !/\.d\.[cm]?ts$/.test(entry.name) &&
        !/\.(?:test|spec|stories|native)\.[cm]?[jt]sx?$/.test(entry.name)
        ? [item]
        : []
    })
}
/**
 * The module ids of `files` (repo paths) that more than one file answers to as resolveModule tries them (finding
 * 123, scenario B): the path without a MODULE_EXTENSIONS extension or an `/index` file, scripts first (a `.json`
 * only competes with another `.json`). Each as `id: file, file` in resolution order.
 */
function moduleIdCollisions(files: string[]): string[] {
  const owners = new Map<string, string[]>()
  for (const file of files) {
    const id = file
      .replace(/\.(?:[cm]?[jt]sx?|json)$/, '')
      .replace(/\/index$/, '')
    owners.set(id, [...(owners.get(id) ?? []), file])
  }
  const competing = (list: string[]) => {
    const scripts = list.filter((file) => !file.endsWith('.json'))
    return scripts.length ? scripts : list
  }
  return [...owners]
    .map(([id, list]) => [id, competing(list)] as const)
    .filter(([, list]) => list.length > 1)
    .map(
      ([id, list]) =>
        `${id}: ${list
          .sort(
            (a, b) =>
              RESOLVE_SUFFIXES.indexOf(a.slice(id.length)) -
              RESOLVE_SUFFIXES.indexOf(b.slice(id.length))
          )
          .join(', ')}`
    )
}
/**
 * The server source the lint rule runtime/no-runtime-rewrite does not cover (finding 123), each with why: tooling
 * the server process never loads. A file here that the rule starts to cover, or an entry no file matches, fails:
 * the list only shrinks.
 */
const RUNTIME_RULE_UNCOVERED: ReadonlyArray<{
  path: string | RegExp
  reason: string
}> = [
  {
    path: /^vitest(?:\.[a-z]+)?\.config\.ts$/,
    reason: 'Vitest configuration, loaded by the test runner only',
  },
  {
    path: 'eslint.config.js',
    reason: 'ESLint configuration, loaded by the linter only',
  },
  { path: 'cspell.config.js', reason: 'spell checker configuration' },
  {
    path: 'postcss.config.cjs',
    reason: 'CSS build configuration, loaded by the bundler as it compiles CSS',
  },
  {
    path: 'tailwind.config.cjs',
    reason: 'CSS build configuration, loaded by the bundler as it compiles CSS',
  },
  { path: 'prisma.config.ts', reason: 'Prisma CLI configuration' },
  {
    path: 'prisma/seed.ts',
    reason:
      'seed script the Prisma CLI runs against a disposable database, never imported by the server',
  },
]
/**
 * The comment of `text` that switches the lint rule `rule` off, or undefined: an `eslint-disable` comment without
 * rules (it disables them all) or naming it, or an `eslint` config comment naming its plugin.
 */
function ruleSwitchedOff(text: string, rule: string): string | undefined {
  for (const [comment, rules = ''] of text.matchAll(
    /eslint-disable(?:-next-line|-line)?([^\n]*)/g
  )) {
    const listed = rules
      .replace(/\*\/.*$/, '')
      .split('--')[0]!
      .trim()
    if (!listed || listed.split(/[\s,]+/).includes(rule))
      return `${comment.trim()} switches ${rule} off`
  }
  const config = new RegExp(
    `/\\*\\s*eslint\\s[^*]*${rule.split('/')[0]}/`
  ).exec(text)
  return config ? `${config[0]} changes ${rule}` : undefined
}
/**
 * Where the server source changes or hands over a class `instanceof` may name before a guard (finding 111): a
 * global of INERT_GLOBAL_CLASSES (named, or `globalThis.Error`) or a project class of INERT_CLASSES (declared,
 * imported or read as `ns.CatalogError` under its name). Such a class is only constructed, called, extended,
 * tested with `instanceof` or `typeof`, exported under its own name, or has a SEALED_CALLS member called. Anything
 * else (`Object.defineProperty(CatalogError, Symbol.hasInstance, …)` in a guarded handler, `Error.x = …`, an
 * alias, an argument, `globalThis.Error = …`, a computed member of the global object) could give it a
 * Symbol.hasInstance that runs before the guard of another handler. zod's ZodError owns a non-configurable one.
 * What this cannot see is code reaching a class through a value (`new CatalogError().constructor`,
 * `Object.getPrototypeOf(RangeError)`): the lint rule runtime/no-runtime-rewrite (tools/eslint-runtime-rewrite.mjs)
 * forbids those primitives in the server source (finding 123), and a self-check keeps it on there.
 */
function sealedClassProblems(file: string, text?: string): string[] {
  const projectClasses = new Set(
    INERT_CLASSES.filter((entry) => entry.source).map((entry) => entry.name)
  )
  const content = text ?? fs.readFileSync(file, 'utf8')
  const names = [
    ...INERT_GLOBAL_CLASSES,
    ...projectClasses,
    ...SERVER_GLOBAL_OBJECTS,
  ]
  // A file that names none of them cannot reach them by name.
  if (!names.some((name) => content.includes(name))) return []
  const source = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    /\.[cm]?jsx?$/.test(file)
      ? ts.ScriptKind.JSX
      : /x$/.test(file)
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS
  )
  // The names that may reach one: the sealed names, and the local names a project class is imported or
  // destructured as.
  const named = new Set(names)
  const aliases = (node: ts.Node) => {
    if (
      (ts.isImportSpecifier(node) || ts.isBindingElement(node)) &&
      node.propertyName &&
      projectClasses.has(propertyText(node.propertyName) ?? '')
    )
      for (const name of ts.isIdentifier(node.name)
        ? [node.name.text]
        : boundNames(node.name))
        named.add(name)
    ts.forEachChild(node, aliases)
  }
  aliases(source)
  const problems: string[] = []
  const at = (node: ts.Node) =>
    `${relative(file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`
  /** `reference` names the sealed class `name`: what is done with it. */
  const handled = (reference: ts.Expression, name: string) => {
    let chain = outer(reference)
    const members: string[] = []
    while (
      (ts.isPropertyAccessExpression(chain.parent) ||
        ts.isElementAccessExpression(chain.parent)) &&
      chain.parent.expression === chain
    ) {
      const key = ts.isPropertyAccessExpression(chain.parent)
        ? chain.parent.name.text
        : ts.isStringLiteralLike(chain.parent.argumentExpression)
          ? chain.parent.argumentExpression.text
          : '[computed]'
      members.push(key)
      chain = outer(chain.parent)
    }
    const parent = chain.parent
    const called =
      (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
      parent.expression === chain
    if (
      members.length === 0 &&
      (called ||
        ts.isTypeOfExpression(parent) ||
        (ts.isBinaryExpression(parent) &&
          parent.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword &&
          parent.right === chain) ||
        (ts.isExpressionWithTypeArguments(parent) &&
          ts.isHeritageClause(parent.parent) &&
          parent.parent.token === ts.SyntaxKind.ExtendsKeyword))
    )
      return
    if (
      members.length === 1 &&
      ts.isCallExpression(parent) &&
      parent.expression === chain &&
      SEALED_CALLS.has(`${name}.${members[0]}`)
    )
      return
    problems.push(
      `${at(reference)}: ${name} ${isWritten(chain) ? 'is written' : 'is handed over'} in ${describeNode(parent)}`
    )
  }
  const visit = (node: ts.Node) => {
    // Ambient declarations (`declare global { ... }`) run nothing.
    if (hasModifier(node, ts.SyntaxKind.DeclareKeyword)) return
    if (ts.isExportSpecifier(node) || ts.isImportSpecifier(node)) {
      const original = (node.propertyName ?? node.name).text
      if (
        ts.isExportSpecifier(node) &&
        projectClasses.has(original) &&
        node.name.text !== original
      )
        problems.push(
          `${at(node)}: ${original} is exported as ${node.name.text}`
        )
      return
    }
    if (
      ts.isClassDeclaration(node) &&
      node.name &&
      projectClasses.has(node.name.text) &&
      hasModifier(node, ts.SyntaxKind.DefaultKeyword)
    )
      problems.push(`${at(node)}: ${node.name.text} is the default export`)
    if (
      (ts.isPropertyAccessExpression(node) &&
        projectClasses.has(node.name.text)) ||
      (ts.isElementAccessExpression(node) &&
        ts.isStringLiteralLike(node.argumentExpression) &&
        projectClasses.has(node.argumentExpression.text))
    ) {
      handled(
        node,
        ts.isPropertyAccessExpression(node)
          ? node.name.text
          : (node.argumentExpression as ts.StringLiteralLike).text
      )
    } else if (
      ts.isIdentifier(node) &&
      named.has(node.text) &&
      !isTypePosition(node) &&
      !isMemberName(node) &&
      !isDeclarationName(node)
    ) {
      const declaration = declarationOf(node)
      const imported =
        declaration &&
        (ts.isImportSpecifier(declaration)
          ? (declaration.propertyName ?? declaration.name).text
          : ts.isBindingElement(declaration)
            ? declaration.propertyName
              ? propertyText(declaration.propertyName)
              : node.text
            : ts.isImportClause(declaration) ||
                ts.isClassDeclaration(declaration)
              ? node.text
              : undefined)
      if (!declaration && SERVER_GLOBAL_OBJECTS.has(node.text)) {
        // The global object: a named member other than a sealed global, nothing else.
        const chain = outer(node)
        const parent = chain.parent
        const key =
          ts.isPropertyAccessExpression(parent) && parent.expression === chain
            ? parent.name.text
            : ts.isElementAccessExpression(parent) &&
                parent.expression === chain &&
                ts.isStringLiteralLike(parent.argumentExpression)
              ? parent.argumentExpression.text
              : undefined
        if (key !== undefined && INERT_GLOBAL_CLASSES.has(key))
          handled(parent as ts.Expression, key)
        else if (key === undefined && !ts.isTypeOfExpression(parent))
          problems.push(
            `${at(node)}: the global object is handed over in ${describeNode(parent)}`
          )
      } else if (!declaration && INERT_GLOBAL_CLASSES.has(node.text))
        handled(node, node.text)
      else if (imported && projectClasses.has(imported)) handled(node, imported)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return problems
}

/** Why a LOAD_TIME_FACTORIES entry is not a plain composition: it must be exported there and touch no data when called. */
function factoryProblems(
  entry: (typeof LOAD_TIME_FACTORIES)[number],
  text?: string
): string[] {
  const found = declaredFunction(entry.source, entry.name, text)
  if (!found) return [`${entry.source}#${entry.name} not found`]
  if (!hasModifier(found.node, ts.SyntaxKind.ExportKeyword))
    return [`${entry.name} is not exported by ${entry.source}`]
  // Only closures and the object returned: any call it runs (its injected dependencies included, whose data
  // access this rule cannot see) or data it touches happens when the route module loads.
  const calls: string[] = []
  const visit = (node: ts.Node) => {
    if (node !== found.node && ts.isFunctionLike(node)) return
    if (
      ts.isCallExpression(node) ||
      ts.isNewExpression(node) ||
      ts.isTaggedTemplateExpression(node) ||
      ts.isAwaitExpression(node)
    )
      calls.push(describeNode(node))
    ts.forEachChild(node, visit)
  }
  if (found.node.body) visit(found.node.body)
  if (calls.length) return [`${entry.name} runs ${calls[0]} when called`]
  // It reads only what it receives: no import, global or module value outside the closures it returns.
  const outside: string[] = []
  const read = (node: ts.Node) => {
    if (node !== found.node && ts.isFunctionLike(node)) return
    if (
      ts.isIdentifier(node) &&
      !isTypePosition(node) &&
      !isMemberName(node) &&
      !isDeclarationName(node)
    ) {
      const declaration = declarationOf(node)
      if (
        !declaration ||
        declaration.pos < found.node.pos ||
        declaration.end > found.node.end
      )
        outside.push(node.text)
    }
    ts.forEachChild(node, read)
  }
  if (found.node.body) read(found.node.body)
  return outside.length ? [`${entry.name} reads ${outside[0]} when called`] : []
}

/**
 * Why a HANDLER_WRAPPERS entry is not a plain wrapper: it must return `async (request, context) =>
 * refusal(request) ?? post(await handler(request, context))`, running only its approved refusal on the original
 * request (whose response it returns as is) and then calling the handler it receives before anything else.
 */
function wrapperProblems(
  entry: (typeof HANDLER_WRAPPERS)[number],
  text?: string
): string[] {
  const found = declaredFunction(entry.source, entry.name, text)
  if (!found) return [`${entry.source}#${entry.name} not found`]
  if (!hasModifier(found.node, ts.SyntaxKind.ExportKeyword))
    return [`${entry.name} is not exported by ${entry.source}`]
  const [handler] = found.node.parameters
  const only = found.node.body && soleReturn(found.node.body)
  const arrow = only?.expression && strip(only.expression)
  if (
    !handler ||
    !ts.isIdentifier(handler.name) ||
    !arrow ||
    !ts.isArrowFunction(arrow) ||
    ts.isBlock(arrow.body)
  )
    return [`${entry.name} does not return a handler`]
  const forwarded = (call: ts.Expression) => {
    const value = awaited(call)
    return (
      ts.isCallExpression(value) &&
      declOf(value.expression) === handler &&
      value.arguments.length === arrow.parameters.length &&
      value.arguments.every(
        (argument, index) => declOf(argument) === arrow.parameters[index]
      )
    )
  }
  const whole = strip(arrow.body)
  const refusal =
    ts.isBinaryExpression(whole) &&
    whole.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      ? strip(whole.left)
      : undefined
  const refusalBinding =
    refusal && ts.isCallExpression(refusal)
      ? importedCallee(refusal, found.info)
      : undefined
  if (
    !refusal ||
    !ts.isCallExpression(refusal) ||
    refusal.arguments.length !== 1 ||
    !arrow.parameters[0] ||
    declOf(refusal.arguments[0]) !== arrow.parameters[0] ||
    !refusalBinding ||
    !sameBinding(refusalBinding, entry.refusal)
  )
    return [
      `${entry.name} does not refuse with ${entry.refusal.name}(request) before the handler`,
    ]
  const body = strip((whole as ts.BinaryExpression).right)
  const first =
    forwarded(body) ||
    (ts.isCallExpression(body) &&
      body.arguments.length === 1 &&
      ts.isIdentifier(strip(body.expression)) &&
      forwarded(body.arguments[0]!))
  return first
    ? []
    : [`${entry.name} does not call the handler before anything else`]
}

/** Why the approved wrapper refusal reaches more than it did when pinned (`reaches`): data, I/O or another import. */
function wrapperRefusalProblems(
  refusal: (typeof HANDLER_WRAPPERS)[number]['refusal'],
  text?: string
): string[] {
  const found = declaredFunction(refusal.source, refusal.name, text)
  if (!found) return [`${refusal.source}#${refusal.name} not found`]
  if (!hasModifier(found.node, ts.SyntaxKind.ExportKeyword))
    return [`${refusal.name} is not exported by ${refusal.source}`]
  const references = [...reach(found.info, found.node).references].sort()
  return JSON.stringify(references) === JSON.stringify(refusal.reaches)
    ? []
    : [`${refusal.name} reaches ${references.join(', ') || 'nothing'}`]
}

/** Parses `file` (optionally with in-memory `text`) and finds the function `name` it declares. */

const CRON_FACADE_FILES = ['apps/services/api/src/host/tenant-cron.ts'] as const
function cronFacadeProblem(file: string, source?: string): string | undefined {
  const actual = source ?? fs.readFileSync(path.join(ROOT, file), 'utf8')
  const service = file.startsWith('apps/')
  const expected = file.endsWith('external-request-auth.ts')
    ? "import {requireCronAuthorization as sharedCronAuthorization} from '@gb-locacoes/backend/http'\nexport {secretsMatch} from '@gb-locacoes/backend/identity'\nexport function requireCronAuthorization(request: Request): Response | null {return sharedCronAuthorization(request)}"
    : 'import {createTenantCron' +
      (service ? ', requireCronAuthorization as sharedCronAuthorization' : '') +
      "} from '@gb-locacoes/backend/http'\n" +
      (service
        ? "import {getDatabaseRuntime} from '@gb-locacoes/backend/runtime'\nimport {withTenantTransaction} from './tenant-transaction'"
        : "import {prisma} from '@/tests/security/fixtures/authorization-scanner-data'\nimport { withTenantTransaction } from '@/apps/services/api/src/host/tenant-transaction'") +
      "\nexport type {CronBudget} from '@gb-locacoes/backend/http'\nconst runner = createTenantCron({getDatabase: () => " +
      (service ? 'getDatabaseRuntime().prisma' : 'prisma') +
      ',withTenantTransaction})\nexport function runTenantCron(request: Request, job: Parameters<typeof runner.runTenantCron>[1], options: Parameters<typeof runner.runTenantCron>[2]): Promise<Response> {return runner.runTenantCron(request,job,options)}\n' +
      (service
        ? 'export function requireCronAuthorization(request: Request): Response | null {return sharedCronAuthorization(request)}'
        : '')
  const shape = (node: ts.Node): unknown => {
    const children: unknown[] = []
    ts.forEachChild(node, (child) => {
      children.push(shape(child))
    })
    return {
      kind: node.kind,
      ...(ts.isIdentifier(node) ||
      ts.isStringLiteral(node) ||
      ts.isNumericLiteral(node)
        ? { text: node.text }
        : {}),
      children,
    }
  }
  const normalize = (text: string) =>
    JSON.stringify(
      shape(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true))
    )
  return normalize(actual) === normalize(expected)
    ? undefined
    : 'cron facade does not bind the shared guard, database and transaction runner exactly'
}
function sharedTenantCronFunction() {
  const file = 'packages/backend/src/http/tenant-cron.ts'
  const info = parseModule(path.join(ROOT, file))
  let node: ts.FunctionDeclaration | undefined
  const visit = (candidate: ts.Node) => {
    if (
      ts.isFunctionDeclaration(candidate) &&
      candidate.name?.text === 'runTenantCron'
    )
      node = candidate
    ts.forEachChild(candidate, visit)
  }
  visit(info.source)
  if (!node) throw new Error('shared tenant cron missing')
  return { info, node }
}

function helperFunction(
  file: string,
  name: string,
  text?: string
): Located & { node: FunctionLike } {
  const info = parseModule(path.join(ROOT, file), text)
  const node = info.locals.get(name)
  if (!node || !isFunctionLike(node)) throw new Error(`${file}#${name} missing`)
  return { info, node }
}

/**
 * The central cookie gates, and `principal`, the one function every
 * requireAdmin middleware goes through (checked below).
 */
const CENTRAL_HELPERS: Array<{ file: string; name: string }> = [
  {
    file: 'apps/services/api/src/host/private-identity.ts',
    name: 'resolveTenantPrincipal',
  },
  {
    file: 'apps/services/api/src/host/permissions.ts',
    name: 'requireTenantPermission',
  },
]
const PRINCIPAL_SOURCE =
  'packages/backend/src/modules/identity/tenant-request-principal.ts'
const PRINCIPAL_FACADES = [
  {
    file: 'apps/services/api/src/host/private-identity.ts',
    session: 'apps/services/api/src/host/session',
  },
] as const
const PERMISSION_SOURCE =
  'packages/backend/src/modules/identity/tenant-permission.ts'
const PERMISSION_FACADES = [
  {
    file: 'apps/services/api/src/host/permissions.ts',
    principal: 'apps/services/api/src/host/private-identity',
  },
] as const

const WEBHOOK_AUTH_SOURCE =
  'packages/backend/src/modules/identity/tenant-webhook.ts'
const WEBHOOK_AUTH_FACADES = [
  'apps/services/api/src/host/webhook-authentication.ts',
] as const

/** Shared authentication must receive the original arguments and the host's real database and credentials. */
function webhookAuthFacadeProblem(
  file: string,
  text?: string
): string | undefined {
  const found = helperFunction(file, 'authenticateTenantWebhook', text)
  const declOf = (expression: ts.Expression) => {
    const value = strip(expression)
    return ts.isIdentifier(value) ? declarationOf(value) : undefined
  }
  const returned =
    found.node.body &&
    ts.isBlock(found.node.body) &&
    soleReturn(found.node.body)
  const call = returned?.expression && strip(returned.expression)
  if (
    !call ||
    !ts.isCallExpression(call) ||
    !ts.isPropertyAccessExpression(call.expression) ||
    call.expression.name.text !== 'authenticateTenantWebhook' ||
    call.arguments.length !== 3 ||
    found.node.parameters.length !== 3 ||
    !call.arguments.every(
      (argument, index) => declOf(argument) === found.node.parameters[index]
    )
  )
    return 'does not solely forward the original webhook arguments'
  const variable = declOf(call.expression.expression)
  const factory =
    variable &&
    ts.isVariableDeclaration(variable) &&
    variable.initializer &&
    strip(variable.initializer)
  const binding =
    factory &&
    ts.isCallExpression(factory) &&
    importedCallee(factory, found.info)
  if (
    !factory ||
    !ts.isCallExpression(factory) ||
    factory.arguments.length !== 1 ||
    !binding ||
    !sameBinding(binding, {
      module: IDENTITY_MODULE,
      name: 'createTenantWebhookAuthentication',
    })
  )
    return 'does not use the shared webhook authentication factory'
  const dependencies = strip(factory.arguments[0]!)
  if (
    !ts.isObjectLiteralExpression(dependencies) ||
    dependencies.properties.length !== 2 ||
    dependencies.properties.some(
      (property) =>
        !ts.isPropertyAssignment(property) &&
        !ts.isShorthandPropertyAssignment(property)
    )
  )
    return 'unexpected webhook dependency wiring'
  const database = destructuredNode(found.info, dependencies, 'getPrisma')?.node
  if (
    !database ||
    !ts.isArrowFunction(database) ||
    database.parameters.length ||
    ts.isBlock(database.body)
  )
    return 'does not lazily supply its real database'
  const body = strip(database.body)
  // Historical branch for retired lib/security/tenant-webhook.ts; WEBHOOK_AUTH_FACADES now names only the API host.
  if (file === 'lib/security/tenant-webhook.ts') {
    if (
      !importNamed(
        body,
        found.info,
        'tests/security/fixtures/authorization-scanner-data',
        ['prisma']
      )
    )
      return 'wrong legacy database'
  } else {
    const getter =
      ts.isPropertyAccessExpression(body) &&
      ts.isCallExpression(body.expression) &&
      importedCallee(body.expression, found.info)
    if (
      !ts.isPropertyAccessExpression(body) ||
      body.name.text !== 'prisma' ||
      !ts.isCallExpression(body.expression) ||
      body.expression.arguments.length ||
      !getter ||
      !sameBinding(getter, {
        module: '@gb-locacoes/backend/runtime',
        name: 'getDatabaseRuntime',
      })
    )
      return 'wrong service database'
  }
  const credential = destructuredNode(
    found.info,
    dependencies,
    'resolveIntegrationCredential'
  )?.node
  const resolver =
    credential && ts.isExpression(credential) && declOf(credential)
  const initialization =
    resolver &&
    ts.isVariableDeclaration(resolver) &&
    resolver.initializer &&
    strip(resolver.initializer)
  const credentialFactory =
    initialization &&
    ts.isCallExpression(initialization) &&
    importedCallee(initialization, found.info)
  if (
    !initialization ||
    !ts.isCallExpression(initialization) ||
    initialization.arguments.length ||
    !credentialFactory ||
    !sameBinding(credentialFactory, {
      module: '@gb-locacoes/backend/runtime',
      name: 'createIntegrationCredentialResolver',
    })
  )
    return 'wrong integration credential resolver'
  return undefined
}

/** A facade may delegate only the original request to the shared factory with real session/database wiring. */
function principalFacadeProblem(
  file: string,
  texts: Partial<Record<string, string>>
): string | undefined {
  const facade = PRINCIPAL_FACADES.find((entry) => entry.file === file)
  if (!facade) return 'unknown principal facade'
  const found = helperFunction(file, 'resolveTenantPrincipal', texts[file])
  const returned = found.node.body && soleReturn(found.node.body)
  const call = returned?.expression && strip(returned.expression)
  if (
    !call ||
    !ts.isCallExpression(call) ||
    !ts.isIdentifier(call.expression) ||
    call.arguments.length !== 1 ||
    declarationOf(call.arguments[0]!) !== found.node.parameters[0]
  )
    return 'does not solely forward the original request'
  const variable = declarationOf(call.expression)
  const factory =
    variable &&
    ts.isVariableDeclaration(variable) &&
    variable.initializer &&
    strip(variable.initializer)
  const factoryBinding =
    factory &&
    ts.isCallExpression(factory) &&
    importedCallee(factory, found.info)
  if (
    !factory ||
    !ts.isCallExpression(factory) ||
    factory.arguments.length !== 1 ||
    !factoryBinding ||
    !sameBinding(factoryBinding, {
      module: IDENTITY_MODULE,
      name: 'createTenantPrincipalResolver',
    })
  )
    return 'does not use the shared principal factory'
  const dependencies = strip(factory.arguments[0]!)
  if (
    !ts.isObjectLiteralExpression(dependencies) ||
    dependencies.properties.length !== 3
  )
    return 'unexpected principal dependency wiring'
  if (
    dependencies.properties.some(
      (property) =>
        !ts.isPropertyAssignment(property) &&
        !ts.isShorthandPropertyAssignment(property)
    )
  )
    return 'unexpected principal dependency expression'
  const props = new Map(
    dependencies.properties.map((property) => [
      propertyText(
        (property as ts.PropertyAssignment | ts.ShorthandPropertyAssignment)
          .name
      ),
      property,
    ])
  )
  const value = (name: string) => {
    const property = props.get(name)
    return property && ts.isPropertyAssignment(property)
      ? property.initializer
      : undefined
  }
  const session = value('getSession')
  if (
    !session ||
    !importNamed(session, found.info, facade.session, ['getServerSession'])
  )
    return 'does not use its real application session reader'
  const database = value('getDatabase')
  if (
    !database ||
    !ts.isArrowFunction(database) ||
    database.parameters.length ||
    ts.isBlock(database.body)
  )
    return 'does not lazily supply its real database'
  const body = strip(database.body)
  // Historical branch for retired lib/tenant.ts; PRINCIPAL_FACADES now names only the API host's private identity.
  if (file === 'lib/tenant.ts') {
    if (
      !importNamed(
        body,
        found.info,
        'tests/security/fixtures/authorization-scanner-data',
        ['prisma']
      )
    )
      return 'wrong legacy database'
  } else {
    const binding =
      ts.isPropertyAccessExpression(body) &&
      ts.isCallExpression(body.expression) &&
      importedCallee(body.expression, found.info)
    if (
      !ts.isPropertyAccessExpression(body) ||
      body.name.text !== 'prisma' ||
      !ts.isCallExpression(body.expression) ||
      body.expression.arguments.length ||
      !binding ||
      !sameBinding(binding, {
        module: '@gb-locacoes/backend/runtime',
        name: 'getDatabaseRuntime',
      })
    )
      return 'wrong service database'
  }
  const publicTenant = props.get('resolvePublicTenant')
  if (!publicTenant || !ts.isShorthandPropertyAssignment(publicTenant))
    return 'wrong public tenant resolver'
  // Retired lib/tenant.ts keeps its historical spelling here; the live facade's public resolver is in API host/runtime.
  const publicFile =
    file === 'lib/tenant.ts' ? file : 'apps/services/api/src/host/runtime.ts'
  if (
    file !== 'lib/tenant.ts' &&
    !importNamed(
      publicTenant.name,
      found.info,
      'apps/services/api/src/host/runtime',
      ['resolvePublicTenant']
    )
  )
    return 'wrong public tenant binding'
  const publicFunction = helperFunction(
    publicFile,
    'resolvePublicTenant',
    texts[publicFile]
  )
  const publicReturn =
    publicFunction.node.body && soleReturn(publicFunction.node.body)?.expression
  if (
    !publicReturn ||
    !ts.isCallExpression(publicReturn) ||
    publicReturn.arguments.length !== 1 ||
    declarationOf(publicReturn.arguments[0]!) !==
      publicFunction.node.parameters[0] ||
    !ts.isPropertyAccessExpression(publicReturn.expression) ||
    publicReturn.expression.name.text !== 'resolvePublicTenant'
  )
    return 'public tenant facade does not forward the slug'
  const source = declaredFunction(
    PRINCIPAL_SOURCE,
    'createTenantPrincipalResolver',
    texts[PRINCIPAL_SOURCE]
  )
  const closure = source?.node.body && soleReturn(source.node.body)?.expression
  if (!closure || !ts.isFunctionExpression(closure) || !closure.body)
    return 'factory does not return the principal closure'
  const [first, second] = closure.body.statements
  const declaration = soleConst(first)
  const guard = declaration?.initializer && strip(declaration.initializer)
  const guardBinding =
    guard && ts.isCallExpression(guard) && importedCallee(guard, source!.info)
  if (
    !guard ||
    !ts.isCallExpression(guard) ||
    guard.arguments.length !== 1 ||
    !declaration ||
    !ts.isIdentifier(declaration.name) ||
    declaration.name.text !== 'crossOrigin' ||
    declarationOf(guard.arguments[0]!) !== closure.parameters[0] ||
    !guardBinding ||
    !sameBinding(guardBinding, {
      module: 'packages/backend/src/modules/identity/same-origin-mutation',
      name: 'rejectCrossOriginMutation',
    }) ||
    !second ||
    !/^if \(crossOrigin\) return \{ ok: false, response: crossOrigin(?:, error: 'Origem não permitida',?)? \}$/.test(
      second.getText().trim().replace(/\s+/g, ' ')
    )
  )
    return 'shared guard is not the first statement with its denial'
  return explicitOriginReadProblem(closure, source!.info)
}

/**
 * Wave 132 (finding 144): the same closure refuses an explicit foreign Origin on every method, reads included, with
 * the central denial, right after the membership refusal (the role is known; 401/400/404/409/403 keep their order)
 * and before the subscription admission, the success result and any data. It receives the original request: a
 * synthetic or headers-less one would let a sibling locadora read through the generic safe-method policy.
 */
function explicitOriginReadProblem(
  closure: ts.FunctionExpression,
  info: ModuleInfo
): string | undefined {
  const statements = [...closure.body.statements]
  const membership = statements.findIndex(
    (statement) =>
      plainIf(statement) &&
      statement.expression.getText().replace(/\s+/g, '') === '!result.ok'
  )
  const lookup = soleConst(statements[membership - 1])
  const resolved = lookup && awaited(lookup.initializer)
  if (
    membership < 1 ||
    !lookup ||
    !ts.isIdentifier(lookup.name) ||
    lookup.name.text !== 'result' ||
    !resolved ||
    !ts.isCallExpression(resolved) ||
    !sameBinding(importedCallee(resolved, info) ?? { module: '', name: '' }, {
      module: 'packages/backend/src/modules/identity/tenant-principal',
      name: 'resolvePrincipal',
    }) ||
    !leaves((statements[membership] as ts.IfStatement).thenStatement)
  )
    return 'explicit Origin on reads: no membership refusal to follow'
  const declaration = soleConst(statements[membership + 1])
  const guard = declaration && strip(declaration.initializer)
  const binding =
    guard && ts.isCallExpression(guard) && importedCallee(guard, info)
  const check = statements[membership + 2]
  if (
    !declaration ||
    !ts.isIdentifier(declaration.name) ||
    declaration.name.text !== 'explicitOrigin' ||
    !guard ||
    !ts.isCallExpression(guard) ||
    guard.arguments.length !== 1 ||
    !ts.isIdentifier(strip(guard.arguments[0]!)) ||
    declarationOf(strip(guard.arguments[0]!) as ts.Identifier) !==
      closure.parameters[0] ||
    !binding ||
    !sameBinding(binding, {
      module: 'packages/backend/src/modules/identity/same-origin-mutation',
      name: 'rejectExplicitCrossOrigin',
    }) ||
    !check ||
    !/^if \(explicitOrigin\) return \{ ok: false, response: explicitOrigin, error: 'Origem não permitida',? \}$/.test(
      check.getText().trim().replace(/\s+/g, ' ')
    )
  )
    return 'explicit Origin on reads is not refused right after the membership with the central denial'
  const earlier = statements
    .slice(0, membership + 1)
    .map((statement) => statement.getText())
    .join('\n')
  if (/createSubscriptionRequestAccess|\bok: true\b/.test(earlier))
    return 'explicit Origin on reads is refused after the subscription admission or a success result'
  return undefined
}
/** Closed process-local implementation: no imports, async work or unlisted calls before identity. */
function memorySourceProblem(text?: string): string | undefined {
  const found = declaredFunction(
    MEMORY_SOURCE,
    'createMemoryRateLimiters',
    text
  )
  if (!found?.node.body) return 'missing memory factory'
  const source = found.info.source
  const calls = new Set([
    'consumeFrom',
    'rateLimit',
    'limiter',
    'keyGenerator',
    'String',
    'Date.now',
    'Math.random',
    'Math.ceil',
    'JSON.stringify',
    'dependencies.clientIp',
    'target.sweep',
    'target.consume',
    'this.entries.get',
    'this.entries.set',
    'this.entries.delete',
    'this.entries.keys',
    'this.makeRoom',
    'this.hit',
    'this.sweep',
    'key.startsWith',
  ])
  const globals = new Set([
    'Map',
    'Response',
    'String',
    'Date',
    'Math',
    'JSON',
    'undefined',
    'Number',
  ])
  let problem: string | undefined
  const visit = (node: ts.Node) => {
    if (problem || ts.isTypeNode(node)) return
    if (
      ts.isImportDeclaration(node) ||
      ts.isImportEqualsDeclaration(node) ||
      ts.isAwaitExpression(node) ||
      ts.isYieldExpression(node) ||
      ts.isTaggedTemplateExpression(node)
    )
      problem = 'memory implementation imports or performs async work'
    else if (ts.isCallExpression(node) && !calls.has(node.expression.getText()))
      problem = `unlisted memory call: ${node.expression.getText()}`
    else if (
      ts.isNewExpression(node) &&
      !['Map', 'Response', 'MemoryRateLimitStore'].includes(
        node.expression.getText()
      )
    )
      problem = `unlisted memory construction: ${node.expression.getText()}`
    else if (
      ts.isIdentifier(node) &&
      !isTypePosition(node) &&
      !isMemberName(node) &&
      !isDeclarationName(node) &&
      !declarationOf(node) &&
      !globals.has(node.text)
    )
      problem = `unresolved memory reference: ${node.text}`
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (problem) return problem
  // Built-ins accept only their exact windows: no injected key generator, callback or side effect.
  for (const [name, window, maximum] of [
    ['authRateLimit', '15*60*1000', '5'],
    ['apiRateLimit', '60*1000', '100'],
    ['adminApiRateLimit', '60*1000', '200'],
    ['strictRateLimit', '60*1000', '10'],
  ]) {
    const declaration = found.node.body.statements
      .flatMap((s) =>
        ts.isVariableStatement(s) ? [...s.declarationList.declarations] : []
      )
      .find((d) => ts.isIdentifier(d.name) && d.name.text === name)
    const call = declaration?.initializer && strip(declaration.initializer)
    if (
      !call ||
      !ts.isCallExpression(call) ||
      call.expression.getText() !== 'rateLimit' ||
      call.arguments.length !== 1 ||
      !ts.isObjectLiteralExpression(call.arguments[0]!)
    )
      return 'unknown built-in memory limiter'
    const props = call.arguments[0]!.properties
    if (props.length !== 2 || props.some((p) => !ts.isPropertyAssignment(p)))
      return 'custom built-in memory key generator'
    const values = new Map(
      props.map((p) => [
        propertyText(p.name!),
        (p as ts.PropertyAssignment).initializer.getText().replace(/\s/g, ''),
      ])
    )
    if (
      values.get('windowMs') !== window ||
      values.get('maxRequests') !== maximum
    )
      return 'changed built-in memory window'
  }
  const rate = declaredFunction(MEMORY_SOURCE, 'rateLimit', text)!
  if (
    !rate.node.body?.getText().includes('new MemoryRateLimitStore(maxEntries)')
  )
    return 'shared limiter store'
  const check = declaredFunction(MEMORY_SOURCE, 'checkRateLimit', text)!
  const first = check.node.body && soleConst(check.node.body.statements[0])
  const call = first?.initializer && strip(first.initializer)
  if (
    !call ||
    !ts.isCallExpression(call) ||
    !ts.isIdentifier(call.expression) ||
    declarationOf(call.expression) !== check.node.parameters[1] ||
    call.arguments.length !== 1 ||
    !ts.isIdentifier(call.arguments[0]!) ||
    declarationOf(call.arguments[0]!) !== check.node.parameters[0]
  )
    return 'check does not call the original limiter with its request'
  const exports = found.node.body.statements.at(-1)
  if (
    !exports ||
    !ts.isReturnStatement(exports) ||
    !exports.expression ||
    !ts.isObjectLiteralExpression(exports.expression) ||
    exports.expression.properties.some(
      (p) => !ts.isShorthandPropertyAssignment(p)
    ) ||
    exports.expression.properties
      .map((p) => propertyText(p.name!))
      .sort()
      .join() !==
      ['consumeRateLimit', 'rateLimit', ...MEMORY_LIMITERS, 'checkRateLimit']
        .sort()
        .join()
  )
    return 'unknown memory factory surface'
  return undefined
}

/** The approved API host facade exposes one factory instance and the real trusted IP reader. */
function memoryFacadeProblem(
  module: string,
  texts: Partial<Record<string, string>> = {}
): string | undefined {
  if (!MEMORY_FACADES.includes(module)) return 'unknown memory facade'
  const file = `${module}.ts`
  const info = parseModule(path.join(ROOT, file), texts[file])
  // The former lib/rate-limit branch is retired; MEMORY_FACADES above accepts only the API host module.
  const names =
    module === 'lib/rate-limit'
      ? ['adminApiRateLimit', 'strictRateLimit', 'checkRateLimit']
      : ['adminApiRateLimit', 'strictRateLimit', 'checkRateLimit']
  let instance: ts.Node | undefined
  for (const name of names) {
    const exported = exportedNode(info, name)?.node
    if (
      !exported ||
      !ts.isPropertyAccessExpression(exported) ||
      exported.name.text !== name
    )
      return 'memory facade does not delegate unchanged'
    if (!ts.isIdentifier(exported.expression))
      return 'indirect memory delegation'
    const declaration = declarationOf(exported.expression)
    if (
      !declaration ||
      !ts.isVariableDeclaration(declaration) ||
      !(declaration.parent.flags & ts.NodeFlags.Const) ||
      (instance && instance !== declaration)
    )
      return 'different or mutable memory instances'
    instance = declaration
  }
  const call =
    instance &&
    ts.isVariableDeclaration(instance) &&
    instance.initializer &&
    strip(instance.initializer)
  const binding =
    call && ts.isCallExpression(call) && importedCallee(call, info)
  if (
    !call ||
    !ts.isCallExpression(call) ||
    call.arguments.length !== 1 ||
    !binding ||
    !sameBinding(binding, {
      module: '@gb-locacoes/backend/http',
      name: 'createMemoryRateLimiters',
    })
  )
    return 'wrong memory factory'
  const wired = strip(call.arguments[0]!)
  if (
    !ts.isObjectLiteralExpression(wired) ||
    wired.properties.length !== 1 ||
    !ts.isPropertyAssignment(wired.properties[0]!) ||
    propertyText(wired.properties[0]!.name) !== 'clientIp' ||
    !importNamed(wired.properties[0]!.initializer, info, IDENTITY_MODULE, [
      'clientIpFromHeaders',
    ])
  )
    return 'wrong trusted IP reader'
  const actual = bindingNode({ ...binding, file: moduleFile(binding.module) })
  if (
    !actual ||
    relative(actual.info.file) !== MEMORY_SOURCE ||
    !ts.isFunctionDeclaration(actual.node) ||
    actual.node.name?.text !== 'createMemoryRateLimiters'
  )
    return 'memory export is redirected'
  return memorySourceProblem(texts[MEMORY_SOURCE])
}

/** A permission facade preserves every argument and wires the current principal before any permission I/O. */
function permissionFacadeProblem(
  file: string,
  texts: Partial<Record<string, string>>
): string | undefined {
  const facade = PERMISSION_FACADES.find((entry) => entry.file === file)
  if (!facade) return 'unknown permission facade'
  const found = helperFunction(file, 'requireTenantPermission', texts[file])
  const returned = found.node.body && soleReturn(found.node.body)
  const call = returned?.expression && strip(returned.expression)
  if (
    !call ||
    !ts.isCallExpression(call) ||
    !ts.isIdentifier(call.expression) ||
    call.arguments.length !== 3 ||
    found.node.parameters.length !== 3 ||
    call.arguments.some(
      (argument, index) =>
        declarationOf(argument) !== found.node.parameters[index]
    )
  )
    return 'does not solely forward the original request, module and action'
  const variable = declarationOf(call.expression)
  const factory =
    variable &&
    ts.isVariableDeclaration(variable) &&
    variable.initializer &&
    strip(variable.initializer)
  const binding =
    factory &&
    ts.isCallExpression(factory) &&
    importedCallee(factory, found.info)
  if (
    !factory ||
    !ts.isCallExpression(factory) ||
    factory.arguments.length !== 1 ||
    !binding ||
    !sameBinding(binding, {
      module: IDENTITY_MODULE,
      name: 'createTenantPermissionResolver',
    })
  )
    return 'does not use the shared permission factory'
  const dependencies = strip(factory.arguments[0]!)
  if (
    !ts.isObjectLiteralExpression(dependencies) ||
    dependencies.properties.length !== 2 ||
    dependencies.properties.some(
      (property) =>
        !ts.isPropertyAssignment(property) &&
        !ts.isShorthandPropertyAssignment(property)
    )
  )
    return 'unexpected permission dependency wiring'
  const props = new Map(
    dependencies.properties.map((property) => [
      propertyText(property.name!),
      property,
    ])
  )
  const principal = props.get('resolveTenantPrincipal')
  if (
    !principal ||
    !ts.isShorthandPropertyAssignment(principal) ||
    !importNamed(principal.name, found.info, facade.principal, [
      'resolveTenantPrincipal',
    ])
  )
    return 'does not use its real current principal resolver'
  const property = props.get('getDatabase')
  const database =
    property && ts.isPropertyAssignment(property) && strip(property.initializer)
  if (
    !database ||
    !ts.isArrowFunction(database) ||
    database.parameters.length ||
    ts.isBlock(database.body)
  )
    return 'does not lazily supply the permission database'
  const body = strip(database.body)
  // Historical branch for retired lib/tenant-permissions.ts; PERMISSION_FACADES names the API host permission facade.
  if (file === 'lib/tenant-permissions.ts') {
    if (
      !importNamed(
        body,
        found.info,
        'tests/security/fixtures/authorization-scanner-data',
        ['prisma']
      )
    )
      return 'wrong legacy permission database'
  } else {
    const getter =
      ts.isPropertyAccessExpression(body) &&
      ts.isCallExpression(body.expression) &&
      importedCallee(body.expression, found.info)
    if (
      !ts.isPropertyAccessExpression(body) ||
      body.name.text !== 'prisma' ||
      !ts.isCallExpression(body.expression) ||
      body.expression.arguments.length ||
      !getter ||
      !sameBinding(getter, {
        module: '@gb-locacoes/backend/runtime',
        name: 'getDatabaseRuntime',
      })
    )
      return 'wrong service permission database'
  }
  const source = declaredFunction(
    PERMISSION_SOURCE,
    'createTenantPermissionResolver',
    texts[PERMISSION_SOURCE]
  )
  const closure = source?.node.body && soleReturn(source.node.body)?.expression
  if (
    !closure ||
    !ts.isFunctionExpression(closure) ||
    closure.parameters.length !== 3
  )
    return 'factory does not return the permission closure'
  const [first, second] = closure.body.statements
  const declaration = soleConst(first)
  const resolve = declaration && awaited(declaration.initializer)
  const check = plainIf(second) ? second : undefined
  const refusal = check && soleReturn(check.thenStatement)
  if (
    !resolve ||
    !ts.isCallExpression(resolve) ||
    !ts.isPropertyAccessExpression(resolve.expression) ||
    resolve.expression.name.text !== 'resolveTenantPrincipal' ||
    declarationOf(resolve.expression.expression) !==
      source!.node.parameters[0] ||
    resolve.arguments.length !== 1 ||
    declarationOf(resolve.arguments[0]!) !== closure.parameters[0] ||
    !declaration ||
    !check ||
    !testsFailure(check.expression, declaration, 'ok') ||
    !refusal?.expression ||
    declarationOf(refusal.expression) !== declaration
  )
    return 'shared permissions do not start with the current principal and its unchanged denial'
  return principalFacadeProblem(`${facade.principal}.ts`, texts)
}

/**
 * Why a central helper does not start with the same-origin guard: its first statement (after reading the
 * request headers with next/headers) is the guard with its refusal (PROLOGUE form), or a call of another
 * central helper whose failure it returns at once.
 */
function carriesOrigin(
  file: string,
  name: string,
  texts: Partial<Record<string, string>>,
  depth = 0
): string | undefined {
  if (depth > 3) return 'recursive helpers'
  if (
    PERMISSION_FACADES.some((entry) => entry.file === file) &&
    name === 'requireTenantPermission'
  )
    return permissionFacadeProblem(file, texts)
  if (
    PRINCIPAL_FACADES.some((entry) => entry.file === file) &&
    name === 'resolveTenantPrincipal'
  )
    return principalFacadeProblem(file, texts)
  const located = helperFunction(file, name, texts[file])
  const body = located.node.body
  if (!body || !ts.isBlock(body)) return 'no body'
  const [request] = located.node.parameters
  const env: Env = {
    info: located.info,
    route: file,
    request,
    params: new Set(),
    contexts: new Set(),
    allowed: new Set(located.node.parameters),
    routeParams: new Set(),
    literals: new Map(),
    depth: 0,
  }
  const statements = body.statements
  let index = 0
  const headers = soleConst(statements[0])
  const read = headers && awaited(headers.initializer)
  if (
    headers &&
    read &&
    ts.isCallExpression(read) &&
    importedCallee(read, located.info)?.module === 'next/headers'
  ) {
    for (const bound of bindingDeclarations(headers)) env.allowed.add(bound)
    index = 1
  }
  if (prologueStep(statements, index, env)?.origin) return undefined
  const declaration = soleConst(statements[index])
  const call = declaration && awaited(declaration.initializer)
  const check = statements[index + 1]
  const callee =
    call && ts.isCallExpression(call) ? strip(call.expression) : undefined
  const next =
    callee && ts.isIdentifier(callee)
      ? CENTRAL_HELPERS.find((helper) => helper.name === callee.text)
      : undefined
  if (
    !declaration ||
    !next ||
    !plainIf(check) ||
    !(
      testsFailure(check.expression, declaration, 'ok') ||
      testsFailure(check.expression, declaration, 'success')
    ) ||
    !leaves(check.thenStatement)
  )
    return 'does not start with the same-origin guard'
  const inner = carriesOrigin(next.file, next.name, texts, depth + 1)
  return inner && `${next.name}: ${inner}`
}

/** The service wrappers require and forward the original request before any work. */
function centralGuardProblems(
  texts: Partial<Record<string, string>> = {}
): string[] {
  const problems: string[] = []
  for (const { file, name } of CENTRAL_HELPERS) {
    const problem = carriesOrigin(file, name, texts)
    if (problem) problems.push(`${file}#${name}: ${problem}`)
  }
  const wrappers = [
    {
      file: 'apps/services/api/src/host/private-identity.ts',
      name: 'resolveTenantPrincipal',
      delegate: 'privatePrincipal',
    },
    {
      file: 'apps/services/api/src/host/permissions.ts',
      name: 'requireTenantPermission',
      delegate: 'tenantPermission',
    },
  ] as const
  for (const { file, name, delegate } of wrappers) {
    const located = helperFunction(file, name, texts[file])
    const parameters = located.node.parameters
    const request = parameters[0]
    if (
      !request ||
      !ts.isIdentifier(request.name) ||
      request.questionToken ||
      request.initializer
    )
      problems.push(`${file}#${name}: requires its original request`)
    const body = located.node.body
    const statements = body && ts.isBlock(body) ? body.statements : undefined
    const statement = statements?.[0]
    const returned =
      statement && ts.isReturnStatement(statement) && statement.expression
        ? unwrap(statement.expression)
        : undefined
    const call =
      returned && ts.isCallExpression(returned) ? returned : undefined
    if (
      !statements ||
      statements.length !== 1 ||
      !call ||
      !ts.isIdentifier(call.expression) ||
      call.expression.text !== delegate
    ) {
      problems.push(
        `${file}#${name}: must start and end with its central delegate`
      )
      continue
    }
    if (
      call.arguments.length !== parameters.length ||
      call.arguments.some((argument, index) => {
        const value = unwrap(argument)
        return (
          !ts.isIdentifier(value) || declarationOf(value) !== parameters[index]
        )
      })
    )
      problems.push(`${file}#${name}: does not forward its original arguments`)
  }
  return problems
}

describe('route authentication inventory: same-origin guard (CSRF)', () => {
  it('follows only the real permission factory, all original arguments and the current principal', () => {
    for (const { file } of PERMISSION_FACADES) {
      const original = fs.readFileSync(path.join(ROOT, file), 'utf8')
      expect(permissionFacadeProblem(file, {}), file).toBeUndefined()
      for (const [pattern, replacement] of [
        [
          /return tenantPermission\(request, module, action\)/,
          'return { ok: true, principal: forgedPrincipal }',
        ],
        [
          /return tenantPermission\(request, module, action\)/,
          "return tenantPermission(new Request('https://fixture.test'), module, action)",
        ],
        [
          /return tenantPermission\(request, module, action\)/,
          "return tenantPermission(request, 'OTHER', action)",
        ],
        [
          /return tenantPermission\(request, module, action\)/,
          "return tenantPermission(request, module, 'OTHER')",
        ],
        [
          /return tenantPermission\(request, module, action\)/,
          'await earlyEffect()\n  return tenantPermission(request, module, action)',
        ],
        [/createTenantPermissionResolver\(\{/, 'otherFactory({'],
        [
          /resolveTenantPrincipal,\s*getDatabase:/,
          'resolveTenantPrincipal: fakePrincipal,\n  getDatabase:',
        ],
        [/getDatabase: \(\) => [^,]+,/, 'getDatabase: () => fakeDatabase,'],
      ] as const) {
        const changed = original.replace(pattern, replacement)
        expect(changed, `${file}: applies ${pattern}`).not.toBe(original)
        expect(
          permissionFacadeProblem(file, { [file]: changed }),
          `${file}: ${pattern}`
        ).toBeDefined()
      }
    }
    const source = fs.readFileSync(path.join(ROOT, PERMISSION_SOURCE), 'utf8')
    for (const [pattern, replacement] of [
      [/if \(!access.ok\) return access/, ''],
      [
        /const access = await dependencies.resolveTenantPrincipal\(request\)/,
        'await dependencies.getDatabase().permission.findFirst({})\n    const access = await dependencies.resolveTenantPrincipal(request)',
      ],
      [
        /dependencies.resolveTenantPrincipal\(request\)/,
        "dependencies.resolveTenantPrincipal(new Request('https://fixture.test'))",
      ],
      [
        /if \(!access.ok\) return access/,
        'if (!access.ok) return { ok: true, principal: forgedPrincipal }',
      ],
    ] as const) {
      const changed = source.replace(pattern, replacement)
      expect(changed).not.toBe(source)
      for (const { file } of PERMISSION_FACADES)
        expect(
          permissionFacadeProblem(file, { [PERMISSION_SOURCE]: changed })
        ).toBeDefined()
    }
    const route = 'apps/services/api/src/app/api/admin/categories/route.ts'
    const original = fs.readFileSync(path.join(ROOT, route), 'utf8')
    for (const [pattern, replacement] of [
      [/if \(!access.ok\) return access.response/, ''],
      [
        /const access = await requireTenantPermission\(/,
        'await listCategories(forgedPrincipal)\n    const access = await requireTenantPermission(',
      ],
    ] as const) {
      const changed = original.replace(pattern, replacement)
      expect(changed).not.toBe(original)
      expect(
        analyzeRouteModule(path.join(ROOT, route), changed).find(
          (entry) => entry.method === 'GET'
        )?.verdict.ok
      ).toBe(false)
    }
  })
  it('follows only the real principal factory and rejects facade bypasses', () => {
    for (const { file } of PRINCIPAL_FACADES) {
      const original = fs.readFileSync(path.join(ROOT, file), 'utf8')
      expect(principalFacadeProblem(file, {}), file).toBeUndefined()
      for (const [pattern, replacement] of [
        [
          /return privatePrincipal\(request\)/,
          'return { ok: true, principal: forgedPrincipal }',
        ],
        [
          /return privatePrincipal\(request\)/,
          "return privatePrincipal(new Request('https://fixture.test'))",
        ],
        [
          /return privatePrincipal\(request\)/,
          'await getServerSession()\n  return privatePrincipal(request)',
        ],
        [/getSession: getServerSession,/, 'getSession: fakeSession,'],
        [/createTenantPrincipalResolver\(\{/, 'otherFactory({'],
        [/getDatabase: \(\) => [^,]+,/, 'getDatabase: () => fakeDatabase,'],
        [/resolvePublicTenant,\s*\}\)/, 'resolvePublicTenant: fakeTenant,\n})'],
      ] as const) {
        const mutated = original.replace(pattern, replacement)
        expect(mutated, `${file} applies ${pattern}`).not.toBe(original)
        expect(
          principalFacadeProblem(file, { [file]: mutated }),
          `${file}: ${pattern}`
        ).toBeDefined()
      }
    }
    const route = 'apps/services/api/src/app/api/admin/drivers/route.ts'
    const source = fs.readFileSync(path.join(ROOT, route), 'utf8')
    for (const [pattern, replacement] of [
      [/if \(!access.ok\) return access.response/, ''],
      [
        /if \(access.principal.role !== 'ADMIN'\)\s*return NextResponse.json\(\{ error: 'Forbidden' \}, \{ status: 403 \}\)/,
        '',
      ],
      [
        /const access = await resolveTenantPrincipal\(request\)/,
        'await listDrivers(forgedPrincipal)\n    const access = await resolveTenantPrincipal(request)',
      ],
    ] as const) {
      const mutated = source.replace(pattern, replacement)
      expect(mutated).not.toBe(source)
      expect(
        analyzeRouteModule(path.join(ROOT, route), mutated).find(
          (entry) => entry.method === 'GET'
        )?.verdict.ok
      ).toBe(false)
    }
  })
  it('every mutation authenticated by the session cookie passes the same-origin guard before any effect', () => {
    const cookie = inventory.filter(cookieMutation)
    expect(cookie.length).toBeGreaterThanOrEqual(80)
    const unguarded = cookie
      .filter(
        (endpoint) =>
          !OWN_CSRF_DEFENCE[endpoint.route]?.methods.includes(endpoint.method)
      )
      .filter(
        (endpoint) =>
          !CSRF_PENDING[endpoint.route]?.methods.includes(endpoint.method)
      )
      .filter((endpoint) => !endpoint.csrf?.ok)
      .map(
        (endpoint) =>
          `${key(endpoint)}: ${endpoint.csrf && !endpoint.csrf.ok ? endpoint.csrf.reason : 'not analysed'}`
      )
    expect(unguarded).toEqual([])
    // The anonymous account flows open on the tenant host are covered too (item 2).
    for (const prefix of ['apps/services/api/src/app'])
      for (const flow of ['register', 'forgot-password', 'reset-password'])
        expect(
          cookie.some(
            (endpoint) =>
              endpoint.route === `${prefix}/api/auth/${flow}/route.ts` &&
              endpoint.method === 'POST' &&
              endpoint.csrf?.ok
          ),
          `${prefix}/${flow}`
        ).toBe(true)
  })

  it('the central cookie gates carry the guard themselves', () => {
    expect(centralGuardProblems()).toEqual([])
  })

  it('keeps OWN_CSRF_DEFENCE and CSRF_PENDING exact: cookie mutations that do not pass the guard', () => {
    const problems: string[] = []
    for (const [route, entry] of Object.entries({
      ...OWN_CSRF_DEFENCE,
      ...CSRF_PENDING,
    })) {
      expect(entry.reason.length, route).toBeGreaterThan(40)
      for (const method of entry.methods) {
        const endpoint = find(route, method)
        if (!endpoint) problems.push(`${route}#${method}: stale entry`)
        else if (!cookieMutation(endpoint))
          problems.push(`${route}#${method}: not a cookie mutation`)
        else if (endpoint.csrf?.ok)
          problems.push(`${route}#${method}: passes the guard, drop the entry`)
      }
    }
    expect(problems).toEqual([])
  })

  it('classifies the gate of representative cookie mutations', () => {
    const central: Array<[string, string]> = [
      ['apps/services/api/src/app/api/admin/categories/route.ts', 'POST'],
      ['apps/services/api/src/app/api/admin/drivers/route.ts', 'POST'],
      [
        'apps/services/api/src/app/api/admin/zoho-mail/oauth/disconnect/route.ts',
        'DELETE',
      ],
      [
        'apps/services/api/src/app/api/admin/notifications/sync/route.ts',
        'POST',
      ],
      ['apps/services/api/src/app/api/addresses/route.ts', 'POST'],
      [
        'apps/services/api/src/app/api/auth/organizations/selection/route.ts',
        'POST',
      ],
      [
        'apps/services/api/src/app/api/auth/organizations/selection/route.ts',
        'DELETE',
      ],
      ['apps/services/api/src/app/api/client/enroll/route.ts', 'POST'],
      ['apps/services/api/src/app/api/auth/register/route.ts', 'POST'],
    ]
    for (const [route, method] of central) {
      const endpoint = find(route, method)
      expect(endpoint, `${route}#${method}`).toBeDefined()
      expect(cookieMutation(endpoint!), `${route}#${method}`).toBe(true)
      expect(endpoint!.csrf, `${route}#${method}`).toEqual({ ok: true })
    }
    // Safe methods are never analysed; webhooks and cron are not cookie mutations.
    expect(
      find('apps/services/api/src/app/api/admin/categories/route.ts', 'GET')!
        .csrf
    ).toBeNull()
    expect(
      cookieMutation(
        find(
          'apps/services/api/src/app/api/payments/pix/webhook/[integrationId]/route.ts',
          'POST'
        )!
      )
    ).toBe(false)
  })

  it('fails once the guard is removed, moved after an effect or bypassed (in-memory mutation)', () => {
    const routeMutations: Array<[string, string, RegExp, string]> = [
      // The guard of an anonymous account flow removed.
      [
        'apps/services/api/src/app/api/auth/register/route.ts',
        'POST',
        /const crossOrigin = rejectCrossOriginMutation\(request\)\s*if \(crossOrigin\) return crossOrigin/,
        '',
      ],
      // Moved after the account flow (a sibling would spend the budget).
      [
        'apps/services/api/src/app/api/auth/forgot-password/route.ts',
        'POST',
        /const crossOrigin = rejectCrossOriginMutation\(request\)\s*if \(crossOrigin\) return crossOrigin/,
        'await credentialAccountHandlers.forgotPassword(request)\n  const crossOrigin = rejectCrossOriginMutation(request)\n  if (crossOrigin) return crossOrigin',
      ],
      // Result discarded.
      [
        'apps/services/api/src/app/api/auth/reset-password/route.ts',
        'POST',
        /const crossOrigin = rejectCrossOriginMutation\(request\)\s*if \(crossOrigin\) return crossOrigin/,
        'void rejectCrossOriginMutation(request)',
      ],
      // A direct boolean guard removed.
      [
        'apps/services/api/src/app/api/client/enroll/route.ts',
        'POST',
        /if \(!isTrustedMutationOrigin\(request\)\)\s*return reply\(\{ error: 'Origem não permitida' \}, 403\)/,
        '',
      ],
      // The anonymous quote request back to the origin check only with a validated edge, after the tenant lookup.
      [
        'apps/services/api/src/app/api/quotes/route.ts',
        'POST',
        /const crossOrigin = rejectCrossOriginMutation\(request\)\s*if \(crossOrigin\) return crossOrigin/,
        '',
      ],
    ]
    const accountMutations = routeMutations
      .slice(0, 3)
      .map(
        ([route, method, _pattern, _replacement]) =>
          [
            route,
            method,
            /rejectCrossOriginMutation\(request\)/,
            'rejectCrossOriginMutation(new Request(request.url))',
          ] as [string, string, RegExp, string]
      )
    for (const [route, method, pattern, replacement] of [
      ...routeMutations,
      ...accountMutations,
    ]) {
      const file = path.join(ROOT, route)
      const original = fs.readFileSync(file, 'utf8')
      const csrfOf = (text: string) =>
        analyzeRouteModule(file, text).find(
          (endpoint) => endpoint.method === method
        )?.csrf
      expect(csrfOf(original), `${route} baseline`).toEqual({ ok: true })
      const mutated = original.replace(pattern, replacement)
      expect(mutated, `${route} mutation ${pattern} applies`).not.toBe(original)
      expect(csrfOf(mutated)?.ok, `${route} mutated with ${pattern}`).toBe(
        false
      )
    }

    const helperMutations: Array<[string, RegExp, string]> = [
      // Shared CSRF refusal removed from the common principal.
      [
        PRINCIPAL_SOURCE,
        /const crossOrigin = rejectCrossOriginMutation\(request\)\s*if \(crossOrigin\)\s*return \{ ok: false, response: crossOrigin(?:, error: 'Origem não permitida')? \}/,
        '',
      ],
      // Shared refusal moved after the session and membership lookup.
      [
        PRINCIPAL_SOURCE,
        /const crossOrigin = rejectCrossOriginMutation\(request\)\s*if \(crossOrigin\)\s*return \{ ok: false, response: crossOrigin(?:, error: 'Origem não permitida')? \}([\s\S]*?)( {2}if \(!result\.ok\))/,
        '$1  const crossOrigin = rejectCrossOriginMutation(request)\n  if (crossOrigin) return { ok: false, response: crossOrigin }\n$2',
      ],
      // Former synthetic-GET fallback: the API must never rebuild a mutation as a read.
      [
        'apps/services/api/src/host/private-identity.ts',
        /return privatePrincipal\(request\)/,
        "return privatePrincipal(new Request('https://fixture.test', { method: 'GET', headers: request.headers }))",
      ],
      // Former request ?? fallback bypass: the supplied request may not be discarded for headers only.
      [
        'apps/services/api/src/host/private-identity.ts',
        /return privatePrincipal\(request\)/,
        'return privatePrincipal({ method: null, url: null, headers: request.headers })',
      ],
      // Former current-headers replacement: preserve real headers as well as method and URL.
      [
        'apps/services/api/src/host/private-identity.ts',
        /return privatePrincipal\(request\)/,
        'return privatePrincipal({ method: request.method, url: request.url, headers: new Headers() })',
      ],
      // Former principal(request) -> principal(): no optional API request channel.
      [
        'apps/services/api/src/host/private-identity.ts',
        /return privatePrincipal\(request\)/,
        'return privatePrincipal()',
      ],
      // Former requireRoles(..., request) omission: permission must forward the request with module/action.
      [
        'apps/services/api/src/host/permissions.ts',
        /return tenantPermission\(request, module, action\)/,
        'return tenantPermission(undefined as never, module, action)',
      ],
      // Former independent session read around the gate: use the real service session port before the delegate.
      [
        'apps/services/api/src/host/permissions.ts',
        /^([\s\S]*?)(export async function requireTenantPermission\([\s\S]*?\): Promise<TenantPrincipalResolution> \{)/,
        "import { getServerSession } from './session'\n$1$2\n  await getServerSession()",
      ],
    ]
    for (const [file, pattern, replacement] of helperMutations) {
      const original = fs.readFileSync(path.join(ROOT, file), 'utf8')
      const mutated = original.replace(pattern, replacement)
      expect(mutated, `${file} mutation ${pattern} applies`).not.toBe(original)
      expect(
        centralGuardProblems({ [file]: mutated }),
        `${file} mutated with ${pattern}`
      ).not.toEqual([])
    }
  })

  it('refuses an explicit foreign Origin on reads in the common principal, after the membership and before the subscription (wave 132, finding 144)', () => {
    expect(centralGuardProblems()).toEqual([])
    const guard =
      /const explicitOrigin = rejectExplicitCrossOrigin\(request\)\s*if \(explicitOrigin\)\s*return \{\s*ok: false,\s*response: explicitOrigin,\s*error: 'Origem não permitida',?\s*\}/
    const original = fs.readFileSync(path.join(ROOT, PRINCIPAL_SOURCE), 'utf8')
    expect(guard.test(original), 'the read guard is in the principal').toBe(
      true
    )
    const mutations: Array<[string, RegExp, string]> = [
      ['removed', guard, ''],
      ['result discarded', guard, 'void rejectExplicitCrossOrigin(request)'],
      [
        'a synthetic request without Origin',
        /rejectExplicitCrossOrigin\(request\)/,
        "rejectExplicitCrossOrigin(new Request('https://fixture.test'))",
      ],
      [
        'back to the safe-method policy',
        /rejectExplicitCrossOrigin\(request\)/,
        'rejectCrossOriginMutation(request)',
      ],
      [
        'moved after the subscription admission',
        new RegExp(`(${guard.source})([\\s\\S]*?)(\\n\\s*return \\{ ok: true)`),
        '$2\n$1$3',
      ],
      [
        'refused without its denial',
        /return \{\s*ok: false,\s*response: explicitOrigin,\s*error: 'Origem não permitida',?\s*\}/,
        'void explicitOrigin',
      ],
    ]
    for (const [label, pattern, replacement] of mutations) {
      const mutated = original.replace(pattern, replacement)
      expect(mutated, `${label} applies`).not.toBe(original)
      expect(
        centralGuardProblems({ [PRINCIPAL_SOURCE]: mutated }),
        label
      ).not.toEqual([])
    }
  })
})

describe('route authentication inventory: structural rule self-checks', () => {
  const fixture = (route: string, source: string) =>
    analyzeRouteModule(path.join(ROOT, route), source)
  const reasons = (route: string, source: string) =>
    fixture(route, source).map((endpoint) =>
      endpoint.verdict.ok ? 'ok' : endpoint.verdict.reason
    )
  it('root Asaas guard is restricted to its exact route and requires its discriminated refusal', () => {
    const route =
      'apps/services/api/src/app/api/webhooks/asaas/platform/route.ts'
    const original = fs.readFileSync(path.join(ROOT, route), 'utf8')
    expect(reasons(route, original)).toEqual(['ok'])
    expect(
      reasons('apps/services/api/src/app/api/admin/new-hook/route.ts', original)
    ).not.toEqual(['ok'])
    expect(
      reasons(
        'apps/services/api/src/app/api/webhooks/asaas/[integrationId]/route.ts',
        original
      )
    ).not.toEqual(['ok'])
    const bad = original.replace(
      'if (!authenticated.ok)',
      'if (!authenticated)'
    )
    expect(bad).not.toBe(original)
    expect(reasons(route, bad)).not.toEqual(['ok'])
  })
  it('enrollment requires identity in addition to public host resolution, with CSRF before effects in the shared service', () => {
    for (const route of [
      'apps/services/api/src/app/api/client/enroll/route.ts',
    ]) {
      const original = fs.readFileSync(path.join(ROOT, route), 'utf8')
      expect(reasons(route, original), route).toEqual(['ok'])
      for (const [pattern, replacement] of [
        [
          /const session = await getServerSession\(\)/,
          "const session = { user: { id: 'forged' } }",
        ],
        [
          /if \(!userId\) return reply\(\{ error: 'Authentication required' \}, 401\)/,
          '',
        ],
        [/if \(!userId\)/, 'if (!session)'],
      ] as const) {
        const mutated = original.replace(pattern, replacement)
        expect(mutated, route).not.toBe(original)
        expect(reasons(route, mutated), route).not.toEqual(['ok'])
      }
      // This projection is an exact AST proof, not a general allowance for reconstructed requests.
      for (const [label, from, to] of [
        [
          'forged argument',
          'hostOnly(request)',
          'hostOnly(new Request(request.url))',
        ],
        ['full URL keeps query', 'url.origin + url.pathname', 'request.url'],
        [
          'query retained',
          'url.origin + url.pathname',
          'url.origin + url.pathname + url.search',
        ],
        [
          'foreign origin',
          'url.origin + url.pathname',
          "'https://foreign.example.test' + url.pathname",
        ],
        [
          'foreign headers',
          'headers: request.headers',
          'headers: new Headers()',
        ],
        [
          'body retained',
          '{ headers: request.headers }',
          '{ headers: request.headers, body: request.body }',
        ],
        [
          'method retained',
          '{ headers: request.headers }',
          '{ headers: request.headers, method: request.method }',
        ],
        ['reassignable helper', 'const hostOnly =', 'let hostOnly ='],
        [
          'parameter default',
          'const hostOnly = (request: Request)',
          "const hostOnly = (request: Request = new Request('https://example.test'))",
        ],
        [
          'extra helper effect',
          '  const url = new URL(request.url)',
          "  void fetch('https://example.test')\n  const url = new URL(request.url)",
        ],
        [
          'shadowed URL',
          'const hostOnly =',
          'const URL = globalThis.URL\nconst hostOnly =',
        ],
        [
          'shadowed Request',
          'const hostOnly =',
          'const Request = globalThis.Request\nconst hostOnly =',
        ],
      ] as const) {
        const changed = original.replace(from, to)
        expect(changed, `${route}: ${label} applies`).not.toBe(original)
        expect(reasons(route, changed), `${route}: ${label}`).not.toEqual([
          'ok',
        ])
      }
      expect(
        reasons(
          'apps/services/api/src/app/api/client/other-enrollment/route.ts',
          original
        )
      ).not.toEqual(['ok'])
      const noOrigin = original.replace(
        /if \(!isTrustedMutationOrigin\(request\)\)\s*return reply\(\{ error: 'Origem não permitida' \}, 403\)/,
        ''
      )
      expect(noOrigin).not.toBe(original)
      expect(fixture(route, noOrigin)[0]!.csrf?.ok).toBe(false)
    }
  })
  const methods = (route: string, source: string) =>
    fixture(route, source).map(
      (endpoint) =>
        `${endpoint.method}:${endpoint.verdict.ok ? 'ok' : endpoint.verdict.reason}`
    )
  const BEFORE = /^before the guard: /
  /** Rejected before the guard, or when the module loads (a prelude with top-level statements). */
  const REACHED =
    /^(?:before the guard: |catch before authorization: |the module runs .* when it loads)/
  const OWNER = /^OWNER_CLIENT: /
  /** The INERT invariant of an allowlisted route (retired, catch-all), apart from what its methods reach. */
  const INERT_PROBLEM = /#[A-Z]+: not INERT \(/
  const withoutInert = (problems: string[]) =>
    problems.filter((problem) => !INERT_PROBLEM.test(problem))
  const admin = 'apps/services/api/src/app/api/admin/new-feature/route.ts'
  /** A POST that runs `early` before requireAdmin. */
  const early = (code: string, prelude = '') => `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { z } from 'zod'
      import { NextResponse } from 'next/server'
      import { withTenantTransaction } from '@/apps/services/api/src/host/tenant-transaction'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      ${prelude}
      export async function POST(request: Request) {
        ${code}
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json({})
      }`
  /** A GET whose inert refusal (`if (<inert>) { ... }`) holds `code` before requireAdmin. */
  const refusal = (code: string, prelude = '') => `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { z } from 'zod'
      import { NextResponse } from 'next/server'
      import { withTenantTransaction } from '@/apps/services/api/src/host/tenant-transaction'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      ${prelude}
      export async function GET(request: Request) {
        if (request.headers.has('x-all')) {
          ${code}
        }
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json({})
      }`
  const ownerRoute =
    'apps/services/api/src/app/api/admin/clients/[id]/new-feature/route.ts'
  /** A DELETE that lets a CLIENT through as the owner named by the route, then runs `data`. */
  const owned = (data: string, prelude = '') => `
      import { resolveTenantPrincipal } from '@/apps/services/api/src/host/private-identity'
import { withTenantTransaction } from '@/apps/services/api/src/host/tenant-transaction'
      import { listClientDocuments } from '@/apps/services/api/src/host/client-documents'
      ${prelude}
      export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
        const access = await resolveTenantPrincipal(request)
        if (!access.ok) return access.response
        const principal = access.principal
        const { id: userId } = await params
        if (!['ADMIN', 'OPERATOR'].includes(principal.role) && !(principal.role === 'CLIENT' && principal.userId === userId))
          return Response.json({}, { status: 403 })
        ${data}
      }`

  it('fails a new route without any helper', () => {
    expect(
      reasons(
        'apps/services/api/src/app/api/admin/new-feature/route.ts',
        `import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
         export async function GET() { return Response.json(await prisma.user.findMany()) }`
      )
    ).toEqual([NO_GUARD])
  })

  it.each(['[id]/regenerate', 'verify'])(
    'keeps the shared boleto %s permission scope exact and rejects an unchecked guard',
    (endpoint) => {
      const route =
        'apps/services/api/src/app/api/payments/boleto/' +
        endpoint +
        '/route.ts'
      const source = `
      import { requireTenantPermission } from '@/apps/services/api/src/host/permissions'
      export async function PUT(request: Request) {
        const access = await requireTenantPermission(request, 'FINANCIAL', 'WRITE')
        if (!access.ok) return access.response
        return Response.json({})
      }`
      expect(reasons(route, source)).toEqual(['ok'])
      expect(reasons(route.replace(endpoint + '/', 'other/'), source)).toEqual([
        'requireTenantPermission does not authorize this namespace',
      ])
      expect(
        reasons(
          route,
          source.replace('if (!access.ok) return access.response', '')
        )
      ).not.toEqual(['ok'])
    }
  )

  it('ignores a same-named local function instead of the canonical helper', () => {
    expect(
      reasons(
        'apps/services/api/src/app/api/admin/new-feature/route.ts',
        `async function requireTenantPermission() { return { ok: true } }
         export async function GET(request: Request) {
           const access = await requireTenantPermission(request, 'X', 'READ')
           return Response.json(access)
         }`
      )
    ).toEqual([NO_GUARD])
  })

  it('does not accept a helper whose result is discarded', () => {
    for (const call of [
      "await requireAdmin(request, 'EQUIPMENTS', 'READ')",
      "void requireAdmin(request, 'EQUIPMENTS', 'READ')",
      "void (await requireAdmin(request, 'EQUIPMENTS', 'READ'))",
    ])
      expect(
        reasons(
          'apps/services/api/src/app/api/admin/new-feature/route.ts',
          `import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
           export async function DELETE(request: Request) { ${call}; return Response.json({}) }`
        ),
        call
      ).toEqual(['result of requireTenantPermission is discarded'])
    expect(
      reasons(
        'apps/services/api/src/app/api/admin/new-feature/route.ts',
        `import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
         export async function GET(request: Request) { return void (await requireAdmin(request, 'EQUIPMENTS', 'READ')) }`
      )
    ).toEqual(['result of requireTenantPermission is discarded'])
  })

  it('requires the original request and the ok refusal for the service guards', () => {
    const entries = [
      {
        module: 'apps/services/api/src/host/permissions',
        name: 'requireTenantPermission',
        route: 'apps/services/api/src/app/api/admin/new-feature/route.ts',
        tail: ", 'EQUIPMENTS', 'READ'",
        role: '',
      },
      {
        module: 'apps/services/api/src/host/private-identity',
        name: 'resolveTenantPrincipal',
        route: 'apps/services/api/src/app/api/admin/new-feature/route.ts',
        tail: '',
        role: "if (access.principal.role !== 'ADMIN') return Response.json({}, { status: 403 })",
      },
      {
        module: 'apps/services/api/src/host/runtime',
        name: 'resolvePublicRequestTenant',
        route: 'apps/services/api/src/app/api/categories/route.ts',
        tail: '',
        role: '',
      },
    ]
    for (const entry of entries) {
      const source = (
        argument: string,
        refusal = 'if (!access.ok) return access.response'
      ) =>
        `import { ${entry.name} } from '@/${entry.module}'
         export async function GET(request: Request) {
           const access = await ${entry.name}(${argument ? argument + entry.tail : ''})
           ${refusal}
           ${entry.role}
           return Response.json({})
         }`
      expect(
        reasons(entry.route, source('request')),
        entry.name + ' baseline'
      ).toEqual(['ok'])
      for (const argument of [
        '',
        'undefined',
        '{} as never',
        'new Request(request.url)',
        'request.headers as never',
      ])
        expect(
          reasons(entry.route, source(argument)),
          entry.name + ' ' + argument
        ).toEqual([entry.name + ' must receive the handler request'])
      for (const refusal of [
        'if (!access) return access.response',
        'if (access == null) return access.response',
        'if (!access.success) return access.response',
        'if (!access.ok) console.warn("denied")',
      ])
        expect(
          reasons(entry.route, source('request', refusal)),
          entry.name + ' ' + refusal
        ).not.toEqual(['ok'])
    }
    for (const [route, name, expectedMethods] of [
      [
        'apps/services/api/src/app/api/admin/categories/route.ts',
        'requireTenantPermission',
        2,
      ],
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        'resolveTenantPrincipal',
        1,
      ],
    ] as const) {
      const file = path.join(ROOT, route!)
      const original = fs.readFileSync(file, 'utf8')
      expect(reasons(route, original), route).toHaveLength(expectedMethods)
      expect(
        reasons(route!, original).every((reason) => reason === 'ok'),
        route! + ' baseline'
      ).toBe(true)
      const pattern = new RegExp(`\\b${name}\\(\\s*request(?=\\s*[,\\)])`, 'g')
      for (const argument of ['undefined', 'new Request(request.url)']) {
        const mutated = original.replace(pattern, `${name}(${argument}`)
        expect(mutated, route! + ' mutation applies').not.toBe(original)
        expect(
          reasons(route!, mutated).some(
            (reason) => reason === name + ' must receive the handler request'
          ),
          route!
        ).toBe(true)
      }
    }
  })

  it('requires a role check for resolveTenantPrincipal under /api/admin', () => {
    const source = (check: string) => `
      import { resolveTenantPrincipal } from '@/apps/services/api/src/host/private-identity'
      export async function POST(request: Request) {
        const access = await resolveTenantPrincipal(request)
        if (!access.ok) return access.response
        ${check}
        return Response.json({ tenantId: access.principal.tenantId })
      }`
    expect(reasons(admin, source(''))).toEqual([ADMIN_ROLE])
    expect(
      reasons(
        admin,
        source(
          "if (access.principal.role !== 'ADMIN') return Response.json({}, { status: 403 })"
        )
      )
    ).toEqual(['ok'])
    expect(
      reasons(
        'apps/services/api/src/app/api/client/new-feature/route.ts',
        source('')
      )
    ).toEqual(['ok'])
    // Returned as is, the principal authorizes nothing under /api/admin.
    expect(
      reasons(
        admin,
        `import { resolveTenantPrincipal } from '@/apps/services/api/src/host/private-identity'
         export async function GET(request: Request) { return resolveTenantPrincipal(request) }`
      )
    ).toEqual([ADMIN_ROLE])
  })

  it('keeps cron and identity helpers inside their namespaces', () => {
    const cron = `import { requireCronAuthorization } from '@/apps/services/api/src/host/tenant-cron'
      export function GET(request: Request) {
        const denied = requireCronAuthorization(request)
        if (denied) return denied
        return Response.json({})
      }`
    expect(
      reasons('apps/services/api/src/app/api/cron/new-job/route.ts', cron)
    ).toEqual(['ok'])
    expect(
      reasons('apps/services/api/src/app/api/admin/new-job/route.ts', cron)
    ).toEqual(['requireCronAuthorization does not authorize this namespace'])
    const session = `import { getServerSession } from '@/apps/services/api/src/host/session'
      export async function GET() {
        const session = await getServerSession()
        if (!session?.user?.id) return Response.json({}, { status: 401 })
        return Response.json(session)
      }`
    expect(
      reasons('apps/services/api/src/app/api/auth/new-flow/route.ts', session)
    ).toEqual(['ok'])
    for (const endpoint of ['organizations', 'slug-availability']) {
      expect(
        reasons(
          `apps/services/api/src/app/api/onboarding/${endpoint}/route.ts`,
          session
        )
      ).toEqual(['ok'])
      const route = `apps/services/api/src/app/api/onboarding/${endpoint}/route.ts`
      const service = session.replace(
        "'@/apps/services/api/src/host/session'",
        "'../../../../host/session'"
      )
      expect(reasons(route, service)).toEqual(['ok'])
      expect(
        reasons(
          route,
          service.replace(
            'const session = await getServerSession()',
            "const session = {user: {id: 'forged'}}"
          )
        )
      ).not.toEqual(['ok'])
    }
    expect(
      reasons(
        'apps/services/api/src/app/api/onboarding/status/route.ts',
        session
      )
    ).toEqual(['getServerSession does not authorize this namespace'])
    expect(
      reasons(
        'apps/services/api/src/app/api/onboarding/arbitrary/route.ts',
        session
      )
    ).toEqual(['getServerSession does not authorize this namespace'])
    expect(
      reasons('apps/services/api/src/app/api/client/new-flow/route.ts', session)
    ).toEqual(['getServerSession does not authorize this namespace'])
    for (const [helper, check] of [
      [
        'resolvePublicTenant',
        'if (!tenant) return Response.json({}, { status: 404 })',
      ],
      ['resolvePublicRequestTenant', 'if (!tenant.ok) return tenant.response'],
    ] as const) {
      const publicTenant = `import { ${helper} } from '@/apps/services/api/src/host/runtime'
        export async function GET(request: Request) {
          const tenant = await ${helper}(${helper === 'resolvePublicRequestTenant' ? 'request' : "new URL(request.url).searchParams.get('tenant') ?? ''"})
          ${check}
          return Response.json(tenant)
        }`
      expect(
        reasons(
          'apps/services/api/src/app/api/categories/route.ts',
          publicTenant
        ),
        helper
      ).toEqual(['ok'])
      expect(
        reasons(
          'apps/services/api/src/app/api/new-catalog/route.ts',
          publicTenant
        ),
        helper
      ).toEqual([PUBLIC_TENANT_OUTSIDE_SURFACE])
      expect(
        reasons(
          'apps/services/api/src/app/api/admin/new-catalog/route.ts',
          publicTenant
        ),
        helper
      ).toEqual([`${helper} does not authorize this namespace`])
    }
    // The API host runtime result shape of resolvePublicRequestTenant, after the body read of the PROLOGUE.
    const requestTenant = (check: string) => `
      import { NextResponse } from 'next/server'
      import { listPublicCategories } from '@/tests/security/fixtures/authorization-scanner-data'
      import { publicCacheHeaders } from '@gb-locacoes/backend/identity'
import { resolvePublicRequestTenant } from '@/apps/services/api/src/host/runtime'
      export async function POST(request: Request) {
        const body = await request.json().catch(() => null)
        const tenant = await resolvePublicRequestTenant(request, { bodySlug: body?.tenantSlug })
        ${check}
        return NextResponse.json(await listPublicCategories(tenant.context), {
          headers: publicCacheHeaders(tenant.edge, 'no-store'),
        })
      }`
    expect(
      reasons(
        'apps/services/api/src/app/api/contact/route.ts',
        requestTenant('if (!tenant.ok) return tenant.response')
      )
    ).toEqual(['ok'])
    expect(
      reasons(
        'apps/services/api/src/app/api/contact/route.ts',
        requestTenant('')
      )
    ).toEqual(['result of resolvePublicRequestTenant is not checked'])
  })

  it('checks the API session result before any data access, with the same auth namespace restriction', () => {
    const route = 'apps/services/api/src/app/api/auth/new-flow/route.ts'
    const source = `import { getServerSession } from '../../../../host/session'
      import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
      export async function GET() {
        const session = await getServerSession()
        if (!session?.user?.id) return Response.json({}, { status: 401 })
        return Response.json(await getDatabaseRuntime().prisma.membership.findMany({ where: { userId: session.user.id } }))
      }`
    expect(reasons(route, source)).toEqual(['ok'])
    const unchecked = source.replace(
      'if (!session?.user?.id) return Response.json({}, { status: 401 })',
      ''
    )
    expect(reasons(route, unchecked)).not.toEqual(['ok'])
    const early = source.replace(
      'const session = await getServerSession()',
      'await getDatabaseRuntime().prisma.membership.findMany(); const session = await getServerSession()'
    )
    expect(reasons(route, early)).not.toEqual(['ok'])
    expect(
      reasons(
        route,
        source.replace(
          'if (!session?.user?.id) return Response.json({}, { status: 401 })',
          'if (!session?.user?.id) Response.json({}, { status: 401 })'
        )
      )
    ).not.toEqual(['ok'])
    expect(
      reasons('apps/services/api/src/app/api/admin/new-flow/route.ts', source)
    ).not.toEqual(['ok'])
    for (const endpoint of inventory.filter((entry) =>
      entry.route.startsWith('apps/services/api/')
    )) {
      // Public adapters must also remain pure when composed at module load.
      const target = parseModule(path.join(ROOT, endpoint.route))
      const node = exportedNode(target, endpoint.method)
      const handler = node && resolveHandler(node.info, node.node)
      expect(handler, key(endpoint)).toBeDefined()
      expect(loadProblem(target), key(endpoint)).toBeUndefined()
      expect(loadProblem(handler!.info), key(endpoint)).toBeUndefined()
    }
  })

  it('host resolution on /current does not replace the identity gate or authorize another namespace', () => {
    for (const resolver of CURRENT_HOST_RESOLVERS) {
      const file = resolveModule(
        path.join(ROOT, 'package.json'),
        `@/${resolver.module}`
      )
      expect(file, resolver.module).toBeDefined()
      const source = ts.createSourceFile(
        file!,
        fs.readFileSync(file!, 'utf8'),
        ts.ScriptTarget.Latest,
        true
      )
      const declaration = source.statements.find(
        (node): node is ts.FunctionDeclaration =>
          ts.isFunctionDeclaration(node) && node.name?.text === resolver.name
      )
      expect(declaration, resolver.module).toBeDefined()
      expect(declaration!.type?.getText()).toBe('Promise<PublicRequestTenant>')
      expect(declaration!.body!.statements).toHaveLength(1)
      expect(declaration!.body!.statements[0]!.getText()).toMatch(
        /^return (?:publicTenants|tenant)\.resolveCurrentOrganizationTenant\(request\);?$/
      )
    }
    for (const route of [
      'apps/services/api/src/app/api/auth/organizations/current/route.ts',
    ]) {
      const source = fs.readFileSync(path.join(ROOT, route), 'utf8')
      expect(reasons(route, source), route).toEqual(['ok'])
      const uncheckedHost = source.replace(
        'if (!tenant.ok) return tenant.response',
        'if (!tenant) return tenant.response'
      )
      expect(uncheckedHost).not.toBe(source)
      expect(reasons(route, uncheckedHost)).not.toEqual(['ok'])
      const noIdentity = source.replace(
        /const session = await getServerSession\(\)\s+if \(!session\?\.user\?\.id\)\s+return reply\(\{ error: 'Authentication required' \}, 401\)\s+const userId = session\.user\.id/,
        "const userId = 'forged-identity'"
      )
      expect(noIdentity).not.toBe(source)
      expect(reasons(route, noIdentity)).not.toEqual(['ok'])
      const early = source.replace(
        'const session = await getServerSession()',
        "await readCurrentOrganizationMembership({} as never, tenant.context.tenantId, 'forged-identity'); const session = await getServerSession()"
      )
      expect(early).not.toBe(source)
      expect(reasons(route, early)).not.toEqual(['ok'])
      expect(
        reasons(route.replace('/current/', '/new-flow/'), source)
      ).not.toEqual(['ok'])
    }
  })

  it('takes the guard only where the handler names it: route delegation and exported aliases, never a local wrapper', () => {
    // A local wrapper hides the guard from the handler: the rule does not follow it.
    expect(
      reasons(
        admin,
        `import { requireTenantPermission as guard } from '@/apps/services/api/src/host/permissions'
         async function authorize(request: Request) { return guard(request, 'X', 'READ') }
         async function handler(request: Request) {
           const access = await authorize(request)
           return access.ok ? Response.json({}) : access.response
         }
         export { handler as GET }`
      )
    ).toEqual([NO_GUARD])
    // The same handler with the guard in it, exported under an alias and renamed on import.
    expect(
      reasons(
        admin,
        `import { requireTenantPermission as guard } from '@/apps/services/api/src/host/permissions'
         async function handler(request: Request) {
           const access = await guard(request, 'X', 'READ')
           if (!access.ok) return access.response
           return Response.json({})
         }
         export { handler as GET }`
      )
    ).toEqual(['ok'])
    const alias = `import { POST as createQuote } from '@/apps/services/api/src/app/api/quotes/route'
         export async function POST(request: Request) { return createQuote(request) }`
    expect(
      reasons('apps/services/api/src/app/api/orcamentos/route.ts', alias)
    ).toEqual(['ok'])
    // The delegated handler is public, so its alias is public too and must be listed.
    expect(
      reasons('apps/services/api/src/app/api/new-alias/route.ts', alias)
    ).toEqual([PUBLIC_TENANT_OUTSIDE_SURFACE])
    // The delegate receives INERT arguments only: they run before its own guard.
    expect(
      reasons(
        'apps/services/api/src/app/api/orcamentos/route.ts',
        `import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
         import { POST as createQuote } from '@/apps/services/api/src/app/api/quotes/route'
         export async function POST(request: Request) { return createQuote(request, await prisma.user.deleteMany()) }`
      )[0]
    ).toMatch(BEFORE)
  })

  it('accepts exactly the PROLOGUE forms before the guard', () => {
    const route =
      'apps/services/api/src/app/api/admin/new-feature/[id]/route.ts'
    const source = (prologue: string, prelude = '') => `
      import { NextResponse } from 'next/server'
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { checkRateLimit, strictRateLimit, consumeAuthAttempt } from '@/apps/services/api/src/host/rate-limit'
      import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
      import { isTrustedMutationOrigin } from '@/apps/services/api/src/host/mutation-origin'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      ${prelude}
      export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
        ${prologue}
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json({})
      }`
    const accepted: Array<[string, string?]> = [
      ['const { id } = await params'],
      ['const { id: rentalId } = await params\nconst again = await params'],
      [
        'const limit = checkRateLimit(request, strictRateLimit)\nif (!limit.allowed) return limit.response',
      ],
      [
        'const limit = checkRateLimit(request, strictRateLimit)\nif (!limit.allowed) {\n return limit.response\n}',
      ],
      [
        'const crossOrigin = rejectCrossOriginMutation(request)\nif (crossOrigin) return crossOrigin',
      ],
      [
        "if (!isTrustedMutationOrigin(request)) return NextResponse.json({ error: 'Origin' }, { status: 403 })",
      ],
      ['const body = await request.json()'],
      ['const body = await request.json().catch(() => null)'],
      [
        "if (request.headers.get('x-mode') === 'legacy') return Response.json({ error: 'Gone' }, { status: 410 })",
      ],
      [
        "if (process.env.WRITES_PAUSED === 'true') {\n return NextResponse.json({ error: 'Paused' }, { status: 503, headers: NO_STORE })\n}",
        "const NO_STORE = { 'Cache-Control': 'no-store' } as const",
      ],
      [
        "if (!request.headers.has('x-token')) return refuse('missing token')",
        "const refuse = (message: string) => NextResponse.json({ error: message }, { status: 400, headers: { 'Cache-Control': 'no-store' } })",
      ],
    ]
    for (const [prologue, prelude] of accepted)
      expect
        .soft(reasons(route, source(prologue, prelude)), prologue)
        .toEqual(['ok'])
    const rejected: Array<[string, string?]> = [
      // route params: const, no default, from the params of the route only
      ["const { id = 'x' } = await params"],
      ['let { id } = await params'],
      ['const { id } = await Promise.resolve({ id: request.url })'],
      // the rate limit: an in-memory limiter and its refusal, together
      [
        'const limit = checkRateLimit(request, customLimiter)\nif (!limit.allowed) return limit.response',
        "import { rateLimit } from '@/apps/services/api/src/host/rate-limit'\nconst customLimiter = (request: any) => ({ allowed: true, remaining: 1, resetTime: 0, request })",
      ],
      ['const limit = checkRateLimit(request, strictRateLimit)'],
      [
        "const limit = checkRateLimit(request, strictRateLimit)\nif (!limit.allowed) console.warn('limited')",
      ],
      [
        "const limit = await consumeAuthAttempt('login', { headers: request.headers, account: 'x' })\nif (!limit) return Response.json({}, { status: 429 })",
      ],
      // the same-origin guard: its result tested at once
      ['const crossOrigin = rejectCrossOriginMutation(request)'],
      ['void rejectCrossOriginMutation(request)'],
      // the body: `request.json()` read once, nothing else
      ['const body = await request.text()'],
      ['const body = await request.json().then((value: unknown) => value)'],
      ['const body = await request.json()\nconst name = body.name'],
      // refusals: INERT and leaving
      ["if (request.headers.has('x-debug')) console.warn('debug')"],
      [
        "if (request.headers.has('x-all')) return Response.json(await prisma.user.findMany())",
      ],
      // anything else, however inert
      ['const { searchParams } = new URL(request.url)'],
      ["const label = 'x'"],
      ["console.warn('before')"],
    ]
    for (const [prologue, prelude] of rejected)
      expect
        .soft(reasons(route, source(prologue, prelude))[0], prologue)
        .toMatch(BEFORE)
  })

  it('checks the try around the guard: its catch is INERT and leaves, and it has no finally', () => {
    const source = (handler: string) => `
      import { NextResponse } from 'next/server'
      import { ZodError } from 'zod'
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { CustomerError } from '@gb-locacoes/backend/customers'
      import { requireTenantPermission } from '@/apps/services/api/src/host/permissions'
      export async function GET(request: Request) {
        ${handler}
      }`
    const guarded = (catchClause: string, rest = '') => `
      try {
        const access = await requireTenantPermission(request, 'X', 'READ')
        if (!access.ok) return access.response
        return NextResponse.json(await prisma.user.count())
      } ${catchClause}
      ${rest}`
    const accepted = [
      "catch (error) {\n console.error('x', error)\n return NextResponse.json({ error: 'Erro' }, { status: 500 })\n}",
      "catch (error) {\n if (error instanceof CustomerError) return NextResponse.json({ error: error.message }, { status: error.status })\n if (error instanceof ZodError) return NextResponse.json({ issues: error.issues.map((issue) => issue.path.join('.')) }, { status: 400 })\n throw error\n}",
      'catch {\n return Response.json({}, { status: 503 })\n}',
    ]
    for (const clause of accepted)
      expect
        .soft(reasons(admin, source(guarded(clause))), clause)
        .toEqual(['ok'])
    const rejected: Array<[string, RegExp]> = [
      // the catch runs when the guard throws: before authorization
      [
        guarded(
          'catch (error) {\n await prisma.auditLog.create({ data: { error: String(error) } })\n return Response.json({}, { status: 500 })\n}'
        ),
        /^catch before authorization/,
      ],
      // a catch that goes on runs what follows the try without the guard
      [
        guarded(
          'catch (error) {\n console.error(error)\n}',
          'return NextResponse.json(await prisma.user.findMany())'
        ),
        /^catch before authorization/,
      ],
      [guarded('finally {\n console.warn(1)\n}'), BEFORE],
      [
        guarded(
          'catch {\n return Response.json({}, { status: 503 })\n} finally {\n void prisma.user.deleteMany()\n}'
        ),
        BEFORE,
      ],
      // the old pattern: a variable assigned in the try and tested after it
      [
        `let access: any
         try {
           access = await requireTenantPermission(request, 'X', 'READ')
         } catch {
           return Response.json({}, { status: 503 })
         }
         if (!access.ok) return access.response
         return Response.json({})`,
        BEFORE,
      ],
    ]
    for (const [handler, reason] of rejected)
      expect.soft(reasons(admin, source(handler))[0], handler).toMatch(reason)
  })

  it('accepts the gate patterns used by the real routes', () => {
    const accepted: Array<[string, string]> = [
      [
        admin,
        `import { NextResponse } from 'next/server'
         import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
         import { requireTenantPermission as requireAdminOrOperator } from '@/apps/services/api/src/host/permissions'
         export async function GET(request: Request) {
           const auth = await requireAdminOrOperator(request, 'EQUIPMENTS', 'READ')
           if (!auth.ok) {
             return NextResponse.json({ error: auth.error }, { status: auth.status })
           }
           return NextResponse.json(await prisma.user.count())
         }`,
      ],
      [
        admin,
        `import { NextResponse } from 'next/server'
         import { z } from 'zod'
         import { requireTenantPermission } from '@/apps/services/api/src/host/permissions'
         import { withTenantTransaction } from '@/apps/services/api/src/host/tenant-transaction'
         import { isTrustedMutationOrigin } from '@/apps/services/api/src/host/mutation-origin'
         const Input = z.object({ name: z.string() })
         export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
           if (!isTrustedMutationOrigin(request))
             return NextResponse.json({ error: 'Origin' }, { status: 403 })
           const { id } = await params
           const body = await request.json()
           try {
             const access = await requireTenantPermission(request, 'X', 'UPDATE')
             if (!access.ok) return access.response
             const input = Input.safeParse(body)
             if (!input.success) return NextResponse.json({}, { status: 400 })
             return NextResponse.json(await withTenantTransaction(access.principal, (tx) => tx.x.update({ where: { id } })))
           } catch (error) {
             console.error(error)
             return NextResponse.json({ error: 'Erro' }, { status: 500 })
           }
         }`,
      ],
      [
        'apps/services/api/src/app/api/cron/new-job/route.ts',
        `import { requireCronAuthorization } from '@/apps/services/api/src/host/tenant-cron'
         import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
         export async function GET(request: Request) {
           const denied = requireCronAuthorization(request)
           if (denied) return denied
           return Response.json(await prisma.organization.count())
         }`,
      ],
      [
        'apps/services/api/src/app/api/cron/new-job/route.ts',
        `import { runTenantCron } from '@/apps/services/api/src/host/tenant-cron'
         import { withTenantTransaction } from '@/apps/services/api/src/host/tenant-transaction'
         async function runJob(context: { tenantId: string }) {
           return Response.json(await withTenantTransaction(context, (tx) => tx.quote.count()))
         }
         export async function GET(request: Request) {
           return runTenantCron(request, runJob, { checkpoint: 'new-job', budgetMs: 1000 })
         }`,
      ],
      [
        admin,
        `import { resolveTenantPrincipal } from '@/apps/services/api/src/host/private-identity'
import { withTenantTransaction } from '@/apps/services/api/src/host/tenant-transaction'
         export async function GET(request: Request) {
           const access = await resolveTenantPrincipal(request)
           if (!access.ok || access.principal.role !== 'ADMIN')
             return Response.json({}, { status: 403 })
           return Response.json(await withTenantTransaction(access.principal, (tx) => tx.x.findMany()))
         }`,
      ],
      [
        'apps/services/api/src/app/api/client/new-feature/route.ts',
        `import { resolveTenantPrincipal } from '@/apps/services/api/src/host/private-identity'
import { withTenantTransaction } from '@/apps/services/api/src/host/tenant-transaction'
         export async function GET(request: Request) {
           try {
             const access = await resolveTenantPrincipal(request)
             if (!access.ok) return access.response
             return Response.json(await withTenantTransaction(access.principal, (tx) => tx.x.findMany()))
           } catch {
             return Response.json({}, { status: 503 })
           }
         }`,
      ],
      [
        'apps/services/api/src/app/api/admin/new-feature/[id]/route.ts',
        `import { NextResponse } from 'next/server'
         import { checkRateLimit, adminApiRateLimit } from '@/apps/services/api/src/host/rate-limit'
         import { resolveTenantPrincipal } from '@/apps/services/api/src/host/private-identity'
         export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
           const rateLimitCheck = checkRateLimit(request, adminApiRateLimit)
           if (!rateLimitCheck.allowed) {
             return rateLimitCheck.response
           }
           const params = await props.params
           try {
             const access = await resolveTenantPrincipal(request)
             if (!access.ok) return access.response
             if (!['ADMIN', 'OPERATOR'].includes(access.principal.role))
               return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
             return NextResponse.json({ id: params.id })
           } catch {
             return NextResponse.json({ error: 'Erro' }, { status: 500 })
           }
         }`,
      ],
      [
        'apps/services/api/src/app/api/auth/new-flow/route.ts',
        `import NextAuth from 'next-auth'
         import { authOptions } from '@/apps/services/api/src/host/session'
import { withSignInAvailability } from '@gb-locacoes/backend/http'
         import { handleIdentityRequest } from '@/apps/services/api/src/host/session'
import { identityMode } from '@gb-locacoes/backend/identity'
         const legacyHandler = withSignInAvailability(NextAuth(authOptions))
         async function handler(request: Request, context: { params: Promise<{ nextauth: string[] }> }) {
           if (identityMode(process.env) === 'better-auth') return handleIdentityRequest(request)
           return legacyHandler(request, context)
         }
         export { handler as GET, handler as POST }`,
      ],
    ]
    for (const [route, source] of accepted)
      expect(reasons(route, source), source).toEqual(
        source.includes('handler as POST') ? ['ok', 'ok'] : ['ok']
      )
  })

  it('rejects a helper whose result never gates the handler', () => {
    const imports = `import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      import { requireTenantPermission } from '@/apps/services/api/src/host/permissions'`
    // (a) result assigned but never tested
    expect(
      reasons(
        admin,
        `${imports}
         export async function GET(request: Request) {
           const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
           return Response.json(await prisma.user.findMany())
         }`
      )
    ).toEqual(['result of requireTenantPermission is not checked'])
    // (c) gate only in one branch
    for (const handler of [
      `const { searchParams } = new URL(request.url)
       if (searchParams.has('strict')) {
         const access = await requireTenantPermission(request, 'X', 'READ')
         if (!access.ok) return access.response
       }
       return Response.json(await prisma.user.findMany())`,
      `let access: any = null
       if (request.headers.has('x-strict')) {
         access = await requireTenantPermission(request, 'X', 'READ')
         if (!access.ok) return access.response
       }
       return Response.json(await prisma.user.findMany())`,
    ])
      expect(
        reasons(
          admin,
          `${imports}
           export async function GET(request: Request) { ${handler} }`
        )[0],
        handler
      ).toMatch(BEFORE)
    // (d) closure declared and never invoked
    expect(
      reasons(
        admin,
        `${imports}
         export async function GET(request: Request) {
           const check = async () => { const a = await requireAdmin(request, 'EQUIPMENTS', 'READ'); return a }
           return Response.json(await prisma.user.findMany())
         }`
      )[0]
    ).toMatch(BEFORE)
    // (e) query before the gate
    expect(
      reasons(
        admin,
        `${imports}
         export async function GET(request: Request) {
           const users = await prisma.user.findMany()
           const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
           if (!auth.ok) return Response.json({}, { status: 403 })
           return Response.json(users)
         }`
      )[0]
    ).toMatch(BEFORE)
    // (f) test that does not leave the handler
    expect(
      reasons(
        admin,
        `${imports}
         export async function GET(request: Request) {
           const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
           if (!auth.ok) console.warn('denied')
           return Response.json(await prisma.user.findMany())
         }`
      )[0]
    ).toMatch(
      /^result of requireTenantPermission: the refusal .* does not leave the handler/
    )
    // (f') a refusal that reaches data runs before authorization
    expect(
      reasons(
        admin,
        `${imports}
         export async function GET(request: Request) {
           const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
           if (!auth.ok) return Response.json(await prisma.user.findMany())
           return Response.json({})
         }`
      )[0]
    ).toMatch(
      /^result of requireTenantPermission: the refusal tests\/security\/fixtures\/authorization-scanner-data#prisma/
    )
    // (g) inverted test
    expect(
      reasons(
        admin,
        `${imports}
         export async function GET(request: Request) {
           const access = await requireTenantPermission(request, 'X', 'READ')
           if (access.ok) return Response.json({ ok: true })
           return Response.json(await prisma.user.findMany())
         }`
      )
    ).toEqual(['result of requireTenantPermission is not checked'])
    // (i) callbacks handed to an inert call still run before the gate
    for (const callback of [
      '(id) => prisma.user.delete({ where: { id } })',
      'remove',
    ])
      expect(
        reasons(
          admin,
          `${imports}
           async function remove(id: string) { return prisma.user.delete({ where: { id } }) }
           export async function GET(request: Request) {
             const ids = ['a', 'b']
             await Promise.all(ids.map(${callback}))
             const access = await requireTenantPermission(request, 'X', 'READ')
             if (!access.ok) return access.response
             return Response.json({})
           }`
        )[0],
        callback
      ).toMatch(BEFORE)
    // (j) an alias of the client is still the client
    expect(
      reasons(
        admin,
        `${imports}
         const db = prisma
         export async function GET(request: Request) {
           const users = db.user
           const rows = await users.findMany()
           const access = await requireTenantPermission(request, 'X', 'READ')
           if (!access.ok) return access.response
           return Response.json(rows)
         }`
      )[0]
    ).toMatch(BEFORE)
    // (k) the gate's arguments run before the helper
    expect(
      reasons(
        admin,
        `${imports}
         export async function GET(request: Request) {
           const access = await requireTenantPermission(request, await prisma.module.findFirst(), 'READ')
           if (!access.ok) return access.response
           return Response.json({})
         }`
      )[0]
    ).toMatch(
      /^before the guard: requireTenantPermission receives tests\/security\/fixtures\/authorization-scanner-data#prisma/
    )
    // (l) a parameter default runs before the body
    expect(
      reasons(
        admin,
        `${imports}
         export async function POST(_request: Request, _early = prisma.user.deleteMany()) {
           const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
           if (!auth.ok) return Response.json({}, { status: 403 })
           return Response.json({})
         }`
      )[0]
    ).toMatch(/^before the guard: default/)
  })

  it('accepts only allowlist role checks on the principal under /api/admin', () => {
    const source = (check: string, prelude = '') => `
      import { resolveTenantPrincipal } from '@/apps/services/api/src/host/private-identity'
import { withTenantTransaction } from '@/apps/services/api/src/host/tenant-transaction'
      const STAFF = ['ADMIN', 'OPERATOR'] as const
      export async function PUT(request: Request) {
        const access = await resolveTenantPrincipal(request)
        if (!access.ok) return access.response
        const context = access.principal
        const body = await request.json()
        ${prelude}
        ${check}
        return Response.json(await withTenantTransaction(context, (tx) => tx.permission.updateMany({ data: body })))
      }`
    const accepted = [
      "if (context.role !== 'ADMIN') return Response.json({}, { status: 403 })",
      "if (!['ADMIN', 'OPERATOR'].includes(context.role)) return Response.json({}, { status: 403 })",
      'if (!STAFF.includes(context.role)) return Response.json({}, { status: 403 })',
      "if (context.role !== 'ADMIN' && context.role !== 'FINANCIAL') throw new Error('forbidden')",
      "const { role } = context\nif (role !== 'ADMIN') return Response.json({}, { status: 403 })",
      "if (!(access.principal.role === 'ADMIN')) return Response.json({}, { status: 403 })",
    ]
    for (const check of accepted)
      expect(reasons(admin, source(check)), check).toEqual(['ok'])
    // Another approved helper after the principal, or a role predicate.
    const delegated = [
      [
        "import { requireTenantPermission as requireRoles } from '@/apps/services/api/src/host/permissions'",
        "const roles = await requireRoles(request, 'EQUIPMENTS', 'READ')\nif (!roles.ok) return Response.json({}, { status: 403 })",
      ],
      [
        "import { canManageContracts } from '@/apps/services/api/src/host/contracts'",
        'if (!canManageContracts(context)) return Response.json({}, { status: 403 })',
      ],
      [
        "function isStaff(principal: { role: string }) { return ['ADMIN', 'FINANCIAL'].includes(principal.role) }",
        'if (!isStaff(access.principal)) return Response.json({}, { status: 403 })',
      ],
    ]
    for (const [prelude, check] of delegated)
      expect(reasons(admin, `${prelude}\n${source(check!)}`), check).toEqual([
        'ok',
      ])
    expect(
      reasons(
        admin,
        `function isStaff(principal: { role: string }) { return principal.role.length > 0 }
         ${source('if (!isStaff(context)) return Response.json({}, { status: 403 })')}`
      )
    ).toEqual([ADMIN_ROLE])
    const rejected = [
      // payload and query results are not the principal
      "if (body.role !== 'ADMIN') return Response.json({}, { status: 403 })",
      "if (body.principal.role !== 'ADMIN') return Response.json({}, { status: 403 })",
      'if (!body.permissions.every((item: { role: string }) => item.role === body.permissions[0].role)) return Response.json({}, { status: 400 })',
      "const other = { role: 'ADMIN' }\nif (other.role !== 'ADMIN') return Response.json({}, { status: 403 })",
      // denylist or a constant that is not a staff allowlist
      "if (context.role === 'CLIENT') return Response.json({}, { status: 403 })",
      "if (context.role !== 'CLIENT') return Response.json({}, { status: 403 })",
      "if (context.role !== 'SUPERUSER') return Response.json({}, { status: 403 })",
      "if (!['ADMIN', 'CLIENT'].includes(context.role)) return Response.json({}, { status: 403 })",
      // compared, but the handler does not leave on failure
      "if (context.role !== 'ADMIN') console.warn('not admin')",
      "const isAdmin = context.role === 'ADMIN'",
      // an unrelated `.role` read
      'console.log([context].map((member) => member.role))',
      // CLIENT "owner" checks against values the caller controls (finding 13)
      "if (!['ADMIN'].includes(context.role) && !(context.role === 'CLIENT' && context.userId === body.userId)) return Response.json({}, { status: 403 })",
      "if (context.role !== 'ADMIN' && !(context.role === 'CLIENT' && context.userId === context.userId)) return Response.json({}, { status: 403 })",
      "if (context.role !== 'ADMIN' && !(context.role === 'CLIENT' && context.userId === new URL(request.url).searchParams.get('userId'))) return Response.json({}, { status: 403 })",
    ]
    for (const check of rejected)
      expect(reasons(admin, source(check)), check).toEqual([ADMIN_ROLE])
    // role check only after the data access
    expect(
      reasons(
        admin,
        source(
          "if (context.role !== 'ADMIN') return Response.json({}, { status: 403 })",
          'await withTenantTransaction(context, (tx) => tx.permission.deleteMany())'
        )
      )
    ).toEqual([ADMIN_ROLE])
  })

  it('accepts a CLIENT only for the resource named by the route parameter it hands to the data access (finding 13)', () => {
    const source = (declare: string, owner: string, data: string) => `
      import { resolveTenantPrincipal } from '@/apps/services/api/src/host/private-identity'
import { withTenantTransaction } from '@/apps/services/api/src/host/tenant-transaction'
      import { listClientDocuments } from '@/apps/services/api/src/host/client-documents'
      export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
        const access = await resolveTenantPrincipal(request)
        if (!access.ok) return access.response
        const principal = access.principal
        ${declare}
        if (!['ADMIN', 'OPERATOR'].includes(principal.role) && !(principal.role === 'CLIENT' && ${owner}))
          return Response.json({}, { status: 403 })
        return Response.json(${data})
      }`
    const accepted: Array<[string, string, string]> = [
      [
        'const { id: userId } = await params',
        'principal.userId === userId',
        'await listClientDocuments(principal, userId)',
      ],
      [
        'const { id } = await params',
        'id === principal.userId',
        'await withTenantTransaction(principal, (tx) => tx.clientDocument.findMany({ where: { userId: id } }))',
      ],
    ]
    for (const [declare, owner, data] of accepted)
      expect(reasons(ownerRoute, source(declare, owner, data)), owner).toEqual([
        'ok',
      ])
    // the route parameter is compared but the data access ignores it
    expect(
      reasons(
        ownerRoute,
        source(
          'const { id: userId } = await params',
          'principal.userId === userId',
          'await withTenantTransaction(principal, (tx) => tx.clientDocument.deleteMany({}))'
        )
      )[0]
    ).toMatch(OWNER)
    const rejected: Array<[string, string, string]> = [
      // the principal compared with itself
      [
        'const { id: userId } = await params',
        'principal.userId === principal.userId',
        'await listClientDocuments(principal, userId)',
      ],
      // values the caller chooses freely
      [
        'const body = await request.json()',
        'principal.userId === body.userId',
        'await listClientDocuments(principal, body.userId)',
      ],
      [
        "const userId = new URL(request.url).searchParams.get('id')",
        'principal.userId === userId',
        'await listClientDocuments(principal, userId)',
      ],
      // a route parameter that may be reassigned before the comparison
      [
        'let { id: userId } = await params\nuserId = (await request.json()).userId',
        'principal.userId === userId',
        'await listClientDocuments(principal, userId)',
      ],
    ]
    for (const [declare, owner, data] of rejected)
      expect(
        reasons(ownerRoute, source(declare, owner, data)),
        `${declare} / ${owner} / ${data}`
      ).toEqual([ADMIN_ROLE])
  })

  it('only accepts result tests that tell a denied request from an authorized one (finding 12)', () => {
    const guarded = (imports: string, bind: string, check: string) => `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      ${imports}
      export async function GET(request: Request) {
        ${bind}
        ${check}
        return Response.json(await prisma.user.findMany())
      }`
    const role = [
      "import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'",
      "const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')",
    ] as const
    const permission = [
      "import { requireTenantPermission } from '@/apps/services/api/src/host/permissions'",
      "const access = await requireTenantPermission(request, 'X', 'READ')",
    ] as const
    const accepted: Array<readonly [string, string, string]> = [
      [...role, 'if (!auth.ok) return Response.json({}, { status: 403 })'],
      [
        ...role,
        'if (auth.ok !== true) return Response.json({}, { status: 403 })',
      ],
      [
        ...role,
        'if (auth.ok === false) return Response.json({}, { status: 403 })',
      ],
      [...permission, 'if (!access.ok) return access.response'],
      [...permission, 'if (access.ok === false) return access.response'],
    ]
    for (const [imports, bind, check] of accepted)
      expect(reasons(admin, guarded(imports, bind, check)), check).toEqual([
        'ok',
      ])
    // requireAdmin/requireRoles and the tenant helpers always return an object.
    const rejected: Array<readonly [string, string, string, string]> = [
      [
        ...role,
        'if (!auth) return Response.json({}, { status: 401 })',
        'requireTenantPermission',
      ],
      [
        ...role,
        'if (auth == null) return Response.json({}, { status: 401 })',
        'requireTenantPermission',
      ],
      [
        ...role,
        'if (auth === undefined) return Response.json({}, { status: 401 })',
        'requireTenantPermission',
      ],
      [
        ...role,
        'if (auth.ok === undefined) return Response.json({}, { status: 401 })',
        'requireTenantPermission',
      ],
      [
        ...role,
        'if (auth.ok == null) return Response.json({}, { status: 401 })',
        'requireTenantPermission',
      ],
      [
        ...role,
        'if (!auth.user) return Response.json({}, { status: 401 })',
        'requireTenantPermission',
      ],
      [
        ...permission,
        'if (!access) return Response.json({}, { status: 403 })',
        'requireTenantPermission',
      ],
      [
        ...permission,
        'if (access === null) return Response.json({}, { status: 403 })',
        'requireTenantPermission',
      ],
    ]
    for (const [imports, bind, check, helper] of rejected)
      expect(reasons(admin, guarded(imports, bind, check)), check).toEqual([
        `result of ${helper} is not checked`,
      ])
    // A denial helper and a nullable helper are tested against null.
    const cron = (check: string) => `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { requireCronAuthorization } from '@/apps/services/api/src/host/tenant-cron'
      export async function GET(request: Request) {
        const denied = requireCronAuthorization(request)
        ${check}
        return Response.json(await prisma.organization.count())
      }`
    for (const check of [
      'if (denied !== null) return denied',
      'if (denied != null) return denied',
      'if (denied) return denied',
    ])
      expect(
        reasons(
          'apps/services/api/src/app/api/cron/new-job/route.ts',
          cron(check)
        ),
        check
      ).toEqual(['ok'])
    expect(
      reasons(
        'apps/services/api/src/app/api/cron/new-job/route.ts',
        cron('if (denied === undefined) return Response.json({})')
      )
    ).toEqual(['result of requireCronAuthorization is not checked'])
    const tenant = (helper: string, argument: string, check: string) => `
      import { listPublicCategories } from '@/tests/security/fixtures/authorization-scanner-data'
      import { ${helper} } from '@/apps/services/api/src/host/runtime'
      export async function GET(request: Request) {
        const tenant = await ${helper}(${argument})
        ${check}
        return Response.json(await listPublicCategories({ tenantId: 'x' }))
      }`
    const requestTenant = (check: string) =>
      tenant('resolvePublicRequestTenant', 'request', check)
    const slugTenant = (check: string) =>
      tenant('resolvePublicTenant', "'slug'", check)
    const catalog = 'apps/services/api/src/app/api/categories/route.ts'
    for (const check of [
      'if (!tenant.ok) return tenant.response',
      'if (tenant.ok !== true) return tenant.response',
    ])
      expect(reasons(catalog, requestTenant(check)), check).toEqual(['ok'])
    for (const check of [
      'if (!tenant) return Response.json({}, { status: 404 })',
      'if (tenant == null) return Response.json({}, { status: 404 })',
    ])
      expect(reasons(catalog, requestTenant(check)), check).toEqual([
        'result of resolvePublicRequestTenant is not checked',
      ])
    for (const check of [
      'if (!tenant) return Response.json({}, { status: 404 })',
      'if (tenant === null) return Response.json({}, { status: 404 })',
      'if (tenant == undefined) return Response.json({}, { status: 404 })',
    ])
      expect(reasons(catalog, slugTenant(check)), check).toEqual(['ok'])
    expect(
      reasons(
        catalog,
        slugTenant(
          'if (tenant === undefined) return Response.json({}, { status: 404 })'
        )
      )
    ).toEqual(['result of resolvePublicTenant is not checked'])
    // A delegated route handler answers a Response: `.ok` or a 2xx status, never its truthiness.
    const delegated = (check: string) => `
      import { POST as createQuote } from '@/apps/services/api/src/app/api/quotes/route'
      export async function POST(request: Request) {
        const response = await createQuote(request)
        ${check}
        return Response.json(await response.json())
      }`
    for (const check of [
      'if (!response.ok) return response',
      'if (response.status !== 201) return response',
      'if (!response || response.status !== 201) return response',
    ])
      expect(
        reasons(
          'apps/services/api/src/app/api/orcamentos/route.ts',
          delegated(check)
        ),
        check
      ).toEqual(['ok'])
    for (const check of [
      'if (!response) return response',
      'if (response.status !== 404) return response',
    ])
      expect(
        reasons(
          'apps/services/api/src/app/api/orcamentos/route.ts',
          delegated(check)
        ),
        check
      ).toEqual(['result of POST is not checked'])
  })

  it('rejects a data client loaded with import() or require() before the guard, and a guard loaded that way (finding 15)', () => {
    const source = (code: string) => `
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      export async function GET(request: Request) {
        ${code}
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json({})
      }`
    for (const code of [
      "const { prisma } = await import('@/tests/security/fixtures/authorization-scanner-data')\nawait prisma.user.findMany()",
      "const { prisma: db } = await import('@/tests/security/fixtures/authorization-scanner-data')\nconst users = db.user\nawait users.deleteMany()",
      "const client = await import('@/tests/security/fixtures/authorization-scanner-data')\nawait client.prisma.user.deleteMany()",
      "const { prisma } = require('@/tests/security/fixtures/authorization-scanner-data')\nawait prisma.user.deleteMany()",
      "await (await import('@/tests/security/fixtures/authorization-scanner-data')).prisma.user.deleteMany()",
      "await require('@/tests/security/fixtures/authorization-scanner-data').prisma.user.deleteMany()",
      "const moduleName = '@/tests/security/fixtures/authorization-scanner-data'\nconst { prisma } = await import(moduleName)\nawait prisma.user.deleteMany()",
      "await globalThis.fetch('https://example.test', { method: 'POST' })",
      // inert modules loaded on the spot are not a PROLOGUE form either
      "const { z } = await import('zod')\nz.string().parse('x')",
    ])
      expect(reasons(admin, source(code))[0], code).toMatch(BEFORE)
    // The guard must be imported from its module: one loaded on the spot is not a gate the rule can see.
    expect(
      reasons(
        admin,
        `import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
         export async function GET(request: Request) {
           const { requireTenantPermission: requireAdmin } = await import('@/apps/services/api/src/host/permissions')
           const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
           if (!auth.ok) return Response.json({}, { status: 403 })
           return Response.json(await prisma.user.findMany())
         }`
      )[0]
    ).toMatch(/^(?:before the guard: |no approved)/)
  })

  it('rejects anything but the PROLOGUE before the guard, whatever reaches data and whatever does not (finding 26)', () => {
    const wipe =
      'function wipe(db: typeof prisma) { return db.user.deleteMany() }'
    const repoClass =
      'class Repo { wipe() { return prisma.user.deleteMany() } }'
    const reached: Array<[string, string, string?]> = [
      ['same-file function handed the client', 'await wipe(prisma)', wipe],
      [
        'local arrow handed the client',
        'const wipe = async (db: typeof prisma) => db.user.deleteMany()\nawait wipe(prisma)',
      ],
      [
        'function handed an alias of the client',
        'const client = prisma\nawait wipe(client)',
        wipe,
      ],
      [
        'object literal of the module',
        'await repo.wipe()',
        'const repo = { wipe: () => prisma.user.deleteMany() }',
      ],
      [
        'object literal of the handler',
        'const repo = { wipe: () => prisma.user.deleteMany() }\nawait repo.wipe()',
      ],
      [
        'object literal method',
        'await repo.wipe()',
        'const repo = { async wipe() { return prisma.user.deleteMany() } }',
      ],
      ['class instance', 'await new Repo().wipe()', repoClass],
      [
        'class instance held in a local',
        'const repo = new Repo()\nawait repo.wipe()',
        repoClass,
      ],
      [
        'static method',
        'await Repo.wipe()',
        'class Repo { static wipe() { return prisma.user.deleteMany() } }',
      ],
      [
        'class declared in the handler',
        `${repoClass}\nawait new Repo().wipe()`,
      ],
      [
        'callback over an array holding the client',
        'await Promise.all([prisma].map((db) => db.user.deleteMany()))',
      ],
      [
        'same-file function as callback over the client',
        'await Promise.all([prisma].map(wipe))',
        wipe,
      ],
      [
        'loop over the client',
        'for (const db of [prisma]) await db.user.deleteMany()',
      ],
      [
        'local import() loader',
        "const load = () => import('@/tests/security/fixtures/authorization-scanner-data')\nawait (await load()).prisma.user.deleteMany()",
      ],
      [
        'module import() loader',
        'await (await load()).prisma.user.deleteMany()',
        "const load = () => import('@/tests/security/fixtures/authorization-scanner-data')",
      ],
      [
        'local require() loader',
        "const load = () => require('@/tests/security/fixtures/authorization-scanner-data')\nawait load().prisma.user.deleteMany()",
      ],
      [
        'function returning the client',
        'await client().user.deleteMany()',
        'function client() { return prisma }',
      ],
      [
        'member of the global object',
        'await (globalThis as any).prisma.user.deleteMany()',
      ],
      [
        'ambient global the file does not bind',
        'await db.user.deleteMany()',
        'declare const db: { user: { deleteMany(): Promise<unknown> } }',
      ],
    ]
    for (const [label, code, prelude] of reached)
      expect
        .soft(reasons(admin, early(code, prelude))[0], label)
        .toMatch(REACHED)
    // The same reach inside an inert refusal fails too: the refusal is not INERT.
    expect(
      reasons(
        admin,
        refusal(
          'return Response.json(await list(prisma))',
          'async function list(db: typeof prisma) { return db.user.findMany() }'
        )
      )[0]
    ).toMatch(BEFORE)
    expect(
      reasons(admin, refusal('return Response.json({}, { status: 404 })'))
    ).toEqual(['ok'])
    // Work that reaches no data is not a PROLOGUE form either: the guard comes first.
    const inert: Array<[string, string?]> = [
      ["const labels = ['a', 'b'].map((label) => label.toUpperCase())"],
      [
        'tidy(new URL(request.url).pathname)',
        'function tidy(value: string) { return value.trim() }',
      ],
      [
        "try { JSON.parse('x') } catch (error) { console.warn(String(error).trim()) }",
      ],
      ["for (const key of ['a']) key.trim()"],
      ["outer: for (const key of ['a']) { if (key.trim()) break outer }"],
      ["new Intl.NumberFormat('pt-BR').format(1)"],
      ["const box = { label: () => 'x' }\nbox.label()"],
      ['new Box().open()', 'class Box { open() { return 1 } }'],
      ["await Promise.resolve(request.headers.get('x'))"],
      [
        "tidy(SELECTED_TENANT_COOKIE)\ntidy(SELECTED_TENANT_COOKIE + '=x')",
        "import { TENANT_COOKIE_NAME as SELECTED_TENANT_COOKIE } from '@gb-locacoes/contracts'\nfunction tidy(value: string) { return value.trim() }",
      ],
    ]
    for (const [code, prelude] of inert)
      expect
        .soft(reasons(admin, early(code, prelude))[0], code)
        .toMatch(REACHED)
    // A class of the file is code (its constructor runs): INERT code never names it, not even after `instanceof`.
    const accessError =
      "class AccessError extends Error { constructor(readonly status: number) { super('denied') } }"
    expect(
      reasons(
        admin,
        early(
          "if (request.headers.has('x-deny')) throw new AccessError(403)",
          accessError
        )
      )[0]
    ).toMatch(BEFORE)
    expect(
      reasons(admin, refusal('throw new AccessError(403)', accessError))[0]
    ).toMatch(BEFORE)
    // Inside a refusal, INERT work is fine: a global error, a constant of another module.
    for (const [code, prelude] of [
      ["throw new Error('denied')", ''],
      [
        'return Response.json({ cookie: SELECTED_TENANT_COOKIE })',
        "import { TENANT_COOKIE_NAME as SELECTED_TENANT_COOKIE } from '@gb-locacoes/contracts'",
      ],
    ])
      expect.soft(reasons(admin, refusal(code!, prelude)), code).toEqual(['ok'])
  })

  it('sees a module loaded with import() or require() in an allowlisted route (finding 27)', () => {
    for (const name of ['analytics', 'security', 'seed-admin']) {
      const route = `apps/services/api/src/app/api/admin/${name}/route.ts`
      const inert = `export function GET() {
        return Response.json({ error: 'Endpoint retired' }, { status: 410 })
      }`
      expect(
        allowlistProblems(
          route,
          analyzeRouteModule(path.join(ROOT, route), inert)
        )
      ).toEqual([])
      const active = `export async function GET() {
        await (await import('@/tests/security/fixtures/authorization-scanner-data')).prisma.payment.count()
        return Response.json({ error: 'Endpoint retired' }, { status: 410 })
      }`
      expect(
        allowlistProblems(
          route,
          analyzeRouteModule(path.join(ROOT, route), active)
        )
      ).not.toEqual([])
    }
    for (const name of ['test-login', 'fix-storage', 'supabase-setup']) {
      const route = `apps/services/api/src/app/api/${name}/route.ts`
      const code = `export async function POST() {
        await (await import('@/tests/security/fixtures/authorization-scanner-data')).prisma.user.deleteMany()
        return Response.json({ error: 'Endpoint retired' }, { status: 410 })
      }`
      expect(
        allowlistProblems(
          route,
          analyzeRouteModule(path.join(ROOT, route), code)
        )
      ).not.toEqual([])
    }
    const serviceRest = 'apps/services/api/src/app/api/[...rest]/route.ts'
    const restMutation = `export async function GET() {
      await (await import('@/tests/security/fixtures/authorization-scanner-data')).prisma.organization.findMany()
      return Response.json({}, { status: 404 })
    }`
    expect(
      allowlistProblems(
        serviceRest,
        analyzeRouteModule(path.join(ROOT, serviceRest), restMutation)
      )
    ).not.toEqual([])
    const retired = (code: string) => `
      export async function POST(request: Request) {
        ${code}
        return Response.json({ error: 'Endpoint retired' }, { status: 410 })
      }
      export function GET() {
        return Response.json({ error: 'Endpoint retired' }, { status: 410 })
      }`
    const cases: Array<[string, string, string[]]> = [
      [
        'apps/services/api/src/app/api/admin/seed-admin/route.ts',
        retired(
          "const db = await import('@/tests/security/fixtures/authorization-scanner-data')\nawait db.prisma.user.deleteMany()"
        ),
        [
          'apps/services/api/src/app/api/admin/seed-admin/route.ts#POST: retired handler calls a module',
          'apps/services/api/src/app/api/admin/seed-admin/route.ts#POST: references tests/security/fixtures/authorization-scanner-data#*',
        ],
      ],
      [
        'apps/services/api/src/app/api/admin/seed-admin/route.ts',
        retired(
          "await (await import('@/tests/security/fixtures/authorization-scanner-data')).prisma.user.deleteMany()"
        ),
        [
          'apps/services/api/src/app/api/admin/seed-admin/route.ts#POST: retired handler calls a module',
          'apps/services/api/src/app/api/admin/seed-admin/route.ts#POST: references tests/security/fixtures/authorization-scanner-data#prisma',
        ],
      ],
      [
        'apps/services/api/src/app/api/admin/seed-admin/route.ts',
        retired(
          "const name = '@/tests/security/fixtures/' + 'authorization-scanner-data'\nawait (await import(name)).prisma.user.deleteMany()"
        ),
        [
          'apps/services/api/src/app/api/admin/seed-admin/route.ts#POST: retired handler calls a module',
          'apps/services/api/src/app/api/admin/seed-admin/route.ts#POST: references <computed module>#*',
        ],
      ],
      [
        'apps/services/api/src/app/api/test-login/route.ts',
        `export async function POST(request: Request) {
           const { prisma } = require('@/tests/security/fixtures/authorization-scanner-data')
           await prisma.session.create({ data: await request.json() })
           return Response.json({ error: 'Endpoint retired' }, { status: 410 })
         }`,
        [
          'apps/services/api/src/app/api/test-login/route.ts#POST: retired handler calls a module',
          'apps/services/api/src/app/api/test-login/route.ts#POST: references tests/security/fixtures/authorization-scanner-data#prisma',
        ],
      ],
      [
        'apps/services/api/src/app/api/[...rest]/route.ts',
        fs
          .readFileSync(
            path.join(ROOT, 'apps/services/api/src/app/api/[...rest]/route.ts'),
            'utf8'
          )
          .replace(
            /export function GET\(\) \{\r?\n/,
            "export async function GET() {\n  const m = await import('@/tests/security/fixtures/authorization-scanner-data')\n  await m.prisma.organization.findMany()\n"
          ),
        [
          'apps/services/api/src/app/api/[...rest]/route.ts#GET: references tests/security/fixtures/authorization-scanner-data#*',
        ],
      ],
    ]
    for (const [route, text, expected] of cases) {
      expect(text, route).toContain('prisma')
      const problems = allowlistProblems(
        route,
        analyzeRouteModule(path.join(ROOT, route), text)
      )
      // What the method reaches, exactly; and, on its own, the INERT invariant of these routes.
      expect.soft(withoutInert(problems), text).toEqual(expected)
      expect
        .soft(problems.some(INERT_PROBLEM.test, INERT_PROBLEM), text)
        .toBe(true)
    }
  })

  it('accepts a CLIENT owner only when every data access after the check receives the owner (finding 30)', () => {
    const rejected = [
      // the owner goes to one access, and the next one ignores it
      `await withTenantTransaction(principal, (tx) => tx.user.findUnique({ where: { id: userId } }))
       return Response.json(await withTenantTransaction(principal, (tx) => tx.clientDocument.deleteMany({})))`,
      // both in the same transaction
      `return Response.json(await withTenantTransaction(principal, async (tx) => {
         await tx.user.findUnique({ where: { id: userId } })
         return tx.clientDocument.deleteMany({})
       }))`,
      `await listClientDocuments(principal, userId)
       return Response.json(await withTenantTransaction(principal, (tx) => tx.clientDocument.findMany()))`,
    ]
    for (const data of rejected)
      expect.soft(reasons(ownerRoute, owned(data))[0], data).toMatch(OWNER)
    const accepted = [
      'return Response.json(await listClientDocuments(principal, userId))',
      `const user = await withTenantTransaction(principal, (tx) => tx.user.findUnique({ where: { id: userId } }))
       return Response.json({ user, documents: await listClientDocuments(principal, userId) })`,
    ]
    for (const data of accepted)
      expect(reasons(ownerRoute, owned(data)), data).toEqual(['ok'])
    expect(
      fixture(ownerRoute, owned(accepted[0]!)).map(
        (endpoint) => endpoint.verdict.ok && endpoint.verdict.owner
      )
    ).toEqual([true])
  })

  it('rejects assignments, defaults, accessors, inheritance, prototypes and containers before the guard (finding 26, second review)', () => {
    const reached: Array<[string, string, string?]> = [
      [
        'alias assigned after its declaration',
        'let db: any\ndb = prisma\nawait db.user.deleteMany()',
      ],
      [
        'alias assigned with ??=',
        'let db: any\ndb ??= prisma\nawait db.user.deleteMany()',
      ],
      [
        'alias assigned by destructuring',
        'let db: any\n;({ db } = { db: prisma })\nawait db.user.deleteMany()',
      ],
      [
        'data helper assigned after its declaration',
        'let run: any\nrun = withTenantTransaction\nawait run({}, (tx: any) => tx.rental.deleteMany({}))',
      ],
      [
        'function assigned after its declaration',
        'let wipe: any\nwipe = () => prisma.user.deleteMany()\nawait wipe()',
      ],
      [
        'module variable assigned at load',
        'await db.user.deleteMany()',
        'let db: any\ndb = prisma',
      ],
      [
        'parameter default',
        'await wipe()',
        'async function wipe(db: any = prisma) { return db.user.deleteMany() }',
      ],
      [
        'destructured parameter default',
        'await wipe()',
        'async function wipe({ db = prisma }: any = {}) { return db.user.deleteMany() }',
      ],
      [
        'arrow parameter default',
        'const wipe = async (db: any = prisma) => db.user.deleteMany()\nawait wipe()',
      ],
      [
        'object literal getter',
        'await repo.all',
        'const repo = { get all() { return prisma.user.deleteMany() } }',
      ],
      [
        'object literal setter',
        'repo.all = 1',
        'const repo = { set all(_value: unknown) { void prisma.user.deleteMany() } }',
      ],
      [
        'class getter',
        'await new Repo().all',
        'class Repo { get all() { return prisma.user.deleteMany() } }',
      ],
      [
        'inherited method',
        'await new Repo().wipe()',
        'class Base { wipe() { return prisma.user.deleteMany() } }\nclass Repo extends Base {}',
      ],
      [
        'inherited method of a local class',
        'class Base { wipe() { return prisma.user.deleteMany() } }\nclass Repo extends Base {}\nconst repo = new Repo()\nawait repo.wipe()',
      ],
      [
        'constructor parameter property with a default',
        'await new Repo().wipe()',
        'class Repo { constructor(private db: any = prisma) {} wipe() { return this.db.user.deleteMany() } }',
      ],
      [
        'method assigned to an object',
        'const repo: any = {}\nrepo.wipe = () => prisma.user.deleteMany()\nawait repo.wipe()',
      ],
      [
        'method assigned to a module object',
        'await repo.wipe()',
        'const repo: any = {}\nrepo.wipe = () => prisma.user.deleteMany()',
      ],
      [
        'client parked on an object',
        'const holder: any = {}\nholder.db = prisma\nawait holder.db.user.deleteMany()',
      ],
      [
        'client parked with Object.assign',
        'const repo: any = {}\nObject.assign(repo, { wipe: () => prisma.user.deleteMany() })\nawait repo.wipe()',
      ],
      [
        'getter defined with Object.defineProperty',
        "const repo: any = {}\nObject.defineProperty(repo, 'all', { get: () => prisma.user.deleteMany() })\nawait repo.all",
      ],
      [
        'client pushed into a list',
        'const list: any[] = []\nlist.push(prisma)\nawait list[0].user.deleteMany()',
      ],
      [
        'client kept in a WeakMap',
        'const map = new WeakMap<object, any>()\nconst key = {}\nmap.set(key, prisma)\nawait map.get(key).user.deleteMany()',
      ],
      [
        'client kept in a Map built with it',
        "const map = new Map([['db', prisma]])\nawait map.get('db')!.user.deleteMany()",
      ],
      [
        'Reflect.apply over a client method',
        'await Reflect.apply(prisma.user.deleteMany, prisma.user, [])',
      ],
      [
        'Proxy whose trap reaches data',
        'const repo: any = new Proxy({}, { get: () => prisma.user.deleteMany() })\nawait repo.all',
      ],
      [
        'function on a prototype',
        'await new (Repo as any)().wipe()',
        'function Repo(this: any) {}\nRepo.prototype.wipe = function () { return prisma.user.deleteMany() }',
      ],
      [
        'generator yielding the client',
        'for (const db of clients()) await db.user.deleteMany()',
        'function* clients() { yield prisma }',
      ],
      [
        'async generator yielding the client',
        'for await (const db of clients()) await db.user.deleteMany()',
        'async function* clients() { yield prisma }',
      ],
      [
        'helper that parks a closure on its argument',
        'const repo: any = {}\ninstall(repo)\nawait repo.wipe()',
        'function install(target: any) { target.wipe = () => prisma.user.deleteMany() }',
      ],
      [
        'client thrown and caught',
        'try { throw prisma } catch (db: any) { await db.user.deleteMany() }',
      ],
      [
        'require aliased',
        "const load = require\nawait load('@/tests/security/fixtures/authorization-scanner-data').prisma.user.deleteMany()",
      ],
      [
        'module loader of process',
        "await (process as any).mainModule.require('@/tests/security/fixtures/authorization-scanner-data').prisma.user.deleteMany()",
      ],
      [
        'parameter default that runs a data access (method)',
        'await repo.wipe()',
        'const repo = { wipe(_done = prisma.user.deleteMany()) { return 1 } }',
      ],
      [
        'parameter default that runs a data access (function)',
        'await wipe()',
        'async function wipe(_done = prisma.user.deleteMany()) { return 1 }',
      ],
      [
        'destructured default that runs a data access',
        'await wipe({})',
        'async function wipe({ done = prisma.user.deleteMany() }: any) { return 1 }',
      ],
      [
        'client handed to a local store',
        'const box = { items: [] as any[], put(value: any) { this.items.push(value) } }\nbox.put(prisma)\nawait box.items[0].user.deleteMany()',
      ],
      [
        'object with a getter serialized by an inert helper',
        'NextResponse.json(repo)',
        'const repo = { get all() { return prisma.user.deleteMany() } }',
      ],
      [
        'class static block run in the handler',
        'class Seed { static { void prisma.user.deleteMany() } }\nvoid Seed',
      ],
    ]
    for (const [label, code, prelude] of reached)
      expect
        .soft(reasons(admin, early(code, prelude))[0], label)
        .toMatch(REACHED)
    // Inside an inert refusal the same shapes are not INERT.
    for (const [label, code, prelude] of reached.filter(
      ([, , prelude]) => prelude && !prelude.startsWith('let ')
    ))
      expect
        .soft(
          reasons(
            admin,
            refusal(
              `return Response.json(await (async () => { ${code} })())`,
              prelude
            )
          )[0],
          label
        )
        .toMatch(REACHED)
    // A module list keeps the client one request parks after its gate for another request before its own.
    const kept = (read: string) => `
       import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
       import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
       const kept: any[] = []
       export async function POST(request: Request) {
         const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
         if (!auth.ok) return Response.json({}, { status: 403 })
         kept.push(prisma)
         return Response.json({})
       }
       export async function GET(request: Request) {
         ${read}
         const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
         if (!auth.ok) return Response.json({}, { status: 403 })
         return Response.json({})
       }`
    expect(methods(admin, kept('await kept[0]?.user.deleteMany()'))).toEqual([
      expect.stringMatching(/^GET:before the guard: /),
      'POST:ok',
    ])
    // Also from an inert refusal: `kept` is written by the other handler, so it is not INERT.
    expect(
      methods(
        admin,
        kept(
          "if (request.headers.has('x')) return Response.json(await kept[0].user.deleteMany())"
        )
      )
    ).toEqual([expect.stringMatching(/^GET:before the guard: /), 'POST:ok'])
    // The default of a wrapper holding the gate: the wrapper is not a gate at all.
    expect(
      reasons(
        admin,
        `import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
         import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
         async function authorize(_early = prisma.user.deleteMany()) { return requireAdmin(request, 'EQUIPMENTS', 'READ') }
         export async function POST(request: Request) {
           const auth = await authorize()
           if (!auth.ok) return Response.json({}, { status: 403 })
           return Response.json({})
         }`
      )
    ).toEqual([NO_GUARD])
  })

  it('keeps INERT code INERT: module values that can change or reach data are not', () => {
    const inertOk: Array<[string, string]> = [
      [
        'return Response.json({}, { headers: NO_STORE })',
        "const NO_STORE = { 'Cache-Control': 'no-store' } as const",
      ],
      [
        'return Response.json({}, { headers: { ...NO_STORE, Vary: HOST } })',
        "const NO_STORE = { 'Cache-Control': 'no-store' }\nconst HOST = 'Host'",
      ],
      [
        'return refuse(403)',
        "const headers = { 'Cache-Control': 'no-store' }\nconst refuse = (status: number) => Response.json({ error: 'x' }, { status, headers })",
      ],
    ]
    for (const [code, prelude] of inertOk)
      expect.soft(reasons(admin, refusal(code, prelude)), code).toEqual(['ok'])
    const changed: Array<[string, string, string]> = [
      // a flat constant written by other code of the file
      [
        'return Response.json({}, { headers: NO_STORE })',
        "const NO_STORE: any = { 'Cache-Control': 'no-store' }\nexport async function PATCH() { NO_STORE.x = 1; return Response.json({}) }",
        'NO_STORE is written',
      ],
      [
        'return Response.json(LIST)',
        "const LIST: any[] = ['a']\nfunction keep(value: unknown) { LIST.push(value) }",
        'LIST is written',
      ],
      // handed to code that could write it
      [
        'return Response.json({}, { headers: NO_STORE })',
        "const NO_STORE: any = { 'Cache-Control': 'no-store' }\nfunction install(target: any) { target.x = prisma }\nexport async function PATCH() { install(NO_STORE); return Response.json({}) }",
        'NO_STORE is handed over',
      ],
      // a function or class of the file given a member later
      [
        'return Response.json(await (refuse as any).db.user.findMany())',
        'function refuse() { return 1 }\nexport async function PATCH() { (refuse as any).db = prisma; return Response.json({}) }',
        'refuse is written',
      ],
      [
        'return Response.json(await (Box as any).db.user.findMany())',
        'class Box {}\nexport async function PATCH() { (Box as any).db = prisma; return Response.json({}) }',
        'Box is written',
      ],
      // a value built when the module loads
      [
        'return Response.json(await CACHE.get())',
        'const CACHE = new Map<string, unknown>()',
        'CACHE',
      ],
      // a nested object in a constant
      [
        'return Response.json(CONFIG.inner)',
        'const CONFIG = { inner: { a: 1 } }',
        'CONFIG holds a value built when the module loads',
      ],
    ]
    for (const [code, prelude, reason] of changed) {
      const [first] = reasons(admin, refusal(code, prelude))
      expect.soft(first, code).toMatch(BEFORE)
      expect.soft(first, code).toContain(reason)
    }
  })

  it('sees globals and the module code of an allowlisted route (finding 27, second review)', () => {
    const retired = (code: string, prelude = '') => `
      ${prelude}
      export async function POST(request: Request) {
        ${code}
        return Response.json({ error: 'Endpoint retired' }, { status: 410 })
      }
      export function GET() {
        return Response.json({ error: 'Endpoint retired' }, { status: 410 })
      }`
    const seed = 'apps/services/api/src/app/api/admin/seed-admin/route.ts'
    const problems = (route: string, text: string) =>
      allowlistProblems(route, analyzeRouteModule(path.join(ROOT, route), text))
    const cases: Array<[string, string, string[]]> = [
      [
        seed,
        retired('await (globalThis as any).__prisma.user.deleteMany()'),
        [
          `${seed}#POST: retired handler calls a module`,
          `${seed}#POST: references <global>#__prisma`,
        ],
      ],
      [
        seed,
        retired('await (global as any).__prisma.user.deleteMany()'),
        [
          `${seed}#POST: retired handler calls a module`,
          `${seed}#POST: references <global>#__prisma`,
        ],
      ],
      [
        seed,
        retired('await __prisma!.user.deleteMany()'),
        [
          `${seed}#POST: retired handler calls a module`,
          `${seed}#POST: references <global>#__prisma`,
        ],
      ],
      [
        seed,
        retired("await (globalThis as any).__pool.query('DELETE FROM users')"),
        [
          `${seed}#POST: retired handler calls a module`,
          `${seed}#POST: references <global>#__pool`,
        ],
      ],
      [
        seed,
        retired("await eval('globalThis.__prisma').user.deleteMany()"),
        [
          `${seed}#POST: retired handler calls a module`,
          `${seed}#POST: references <global>#eval`,
        ],
      ],
      [
        seed,
        retired(
          "await (process as any).mainModule.require('@/tests/security/fixtures/authorization-scanner-data').prisma.user.deleteMany()"
        ),
        [
          `${seed}#POST: retired handler calls a module`,
          `${seed}#POST: references <global>#process`,
        ],
      ],
      [
        seed,
        retired(
          "const load = require\nawait load('@/tests/security/fixtures/authorization-scanner-data').prisma.user.deleteMany()"
        ),
        [
          `${seed}#POST: retired handler calls a module`,
          `${seed}#POST: references <computed module>#*`,
        ],
      ],
      [
        seed,
        retired(
          '',
          "const { prisma } = require('@/tests/security/fixtures/authorization-scanner-data')\nvoid prisma.user.deleteMany()"
        ),
        [
          `${seed}#GET: retired handler calls a module`,
          `${seed}#GET: references tests/security/fixtures/authorization-scanner-data#prisma`,
          `${seed}#POST: retired handler calls a module`,
          `${seed}#POST: references tests/security/fixtures/authorization-scanner-data#prisma`,
        ],
      ],
      [
        seed,
        retired(
          '',
          "import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'\nvoid prisma.user.deleteMany()"
        ),
        [
          `${seed}#GET: retired handler calls a module`,
          `${seed}#GET: references tests/security/fixtures/authorization-scanner-data#prisma`,
          `${seed}#POST: retired handler calls a module`,
          `${seed}#POST: references tests/security/fixtures/authorization-scanner-data#prisma`,
        ],
      ],
      [
        'apps/services/api/src/app/api/[...rest]/route.ts',
        fs
          .readFileSync(
            path.join(ROOT, 'apps/services/api/src/app/api/[...rest]/route.ts'),
            'utf8'
          )
          .replace(
            /export function GET\(\) \{\r?\n/,
            'export async function GET() {\n  await (globalThis as any).__prisma.organization.deleteMany()\n'
          ),
        [
          'apps/services/api/src/app/api/[...rest]/route.ts#GET: references <global>#__prisma',
        ],
      ],
    ]
    for (const [route, text, expected] of cases) {
      // What the method reaches, exactly; and, on its own, the INERT invariant of these routes.
      expect
        .soft(withoutInert(problems(route, text)).sort(), text)
        .toEqual(expected.sort())
      expect
        .soft(
          problems(route, text).some(INERT_PROBLEM.test, INERT_PROBLEM),
          text
        )
        .toBe(true)
    }
    // Request work and inert globals are not references.
    expect(
      problems(
        seed,
        retired(
          'console.warn(new URL(request.url).pathname, process.env.NODE_ENV)'
        )
      )
    ).toEqual([])
  })

  it('fails a route module that runs code when it loads, before any handler runs', () => {
    const guarded = (prelude: string) => `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { z } from 'zod'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      import { getZohoAccessToken } from '@/tests/security/fixtures/authorization-scanner-data'
      ${prelude}
      export async function GET(request: Request) {
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json(await prisma.user.findMany())
      }`
    for (const prelude of [
      'void prisma.user.deleteMany()',
      'const users = await prisma.user.findMany()',
      'class Seed { static rows = prisma.user.deleteMany() }',
      'class Seed { static { void prisma.user.deleteMany() } }',
      'if (process.env.SEED) void prisma.user.deleteMany()',
      "import '@/tests/security/fixtures/seed'",
      'const token = getZohoAccessToken()',
      'const rows = [1, 2].map(() => prisma.user.count())',
      'const repo = { get all() { return prisma.user.findMany() } }',
      'const tagged = String.raw`${prisma}`',
    ])
      expect
        .soft(reasons(admin, guarded(prelude))[0], prelude)
        .toMatch(/^the module runs .* when it loads/)
    for (const prelude of [
      "export const dynamic = 'force-dynamic'",
      'const schema = z.object({ id: z.string() }).strict()',
      'const repo = { list: () => prisma.user.findMany() }',
      "const STATUSES = new Set(['A', 'B'])",
      'function helper() { return prisma.user.count() }',
    ])
      expect.soft(reasons(admin, guarded(prelude)), prelude).toEqual(['ok'])
  })

  it('accepts a CLIENT owner only through an owner-scoped helper or one query that names the owner (finding 30, second review)', () => {
    const transaction = (query: string) =>
      `return Response.json(await withTenantTransaction(principal, (tx: any) => ${query}))`
    const rejected: Array<[string, string, string?]> = [
      [
        'same-file helper that ignores the owner',
        'return Response.json(await removeDocuments(principal, userId))',
        'async function removeDocuments(principal: any, _owner: string) { return withTenantTransaction(principal, (tx: any) => tx.clientDocument.deleteMany({})) }',
      ],
      [
        'same-file helper that filters by the owner (the rule does not follow local helpers)',
        'return Response.json(await removeDocuments(principal, userId))',
        'async function removeDocuments(principal: any, owner: string) { return withTenantTransaction(principal, (tx: any) => tx.clientDocument.deleteMany({ where: { userId: owner } })) }',
      ],
      [
        'owner negated',
        transaction(
          'tx.clientDocument.deleteMany({ where: { NOT: { userId } } })'
        ),
      ],
      [
        'owner in an OR with everything',
        transaction(
          'tx.clientDocument.deleteMany({ where: { OR: [{ userId }, {}] } })'
        ),
      ],
      [
        'owner dropped by a condition',
        transaction(
          'tx.clientDocument.deleteMany({ where: userId ? {} : { userId } })'
        ),
      ],
      [
        'owner excluded by an operator',
        transaction(
          'tx.clientDocument.deleteMany({ where: { userId: { not: userId } } })'
        ),
      ],
      [
        'owner overridden by a spread',
        transaction(
          'tx.clientDocument.deleteMany({ where: { userId, ...{ userId: undefined } } })'
        ),
      ],
      [
        'owner only in the data of an update',
        transaction(
          "tx.clientDocument.updateMany({ where: {}, data: { userId, fileName: 'x' } })"
        ),
      ],
      [
        'owner in a relation filter',
        transaction(
          'tx.clientDocument.deleteMany({ where: { user: { id: userId } } })'
        ),
      ],
      [
        'owner in an invented compound key',
        transaction(
          'tx.clientDocument.deleteMany({ where: { a_b: { not: userId } } })'
        ),
      ],
      [
        'owner in a real compound key under an operator',
        transaction(
          'tx.zohoMailToken.deleteMany({ where: { tenantId_userId: { not: userId } } })'
        ),
      ],
      [
        'a model the schema does not know',
        transaction('tx.rental.deleteMany({ where: { userId } })'),
      ],
      [
        'owner handed to a helper that is not owner-scoped',
        'return Response.json(await cancelClientRentals(principal, userId))',
        "import { cancelClientRentals } from '@/tests/security/fixtures/authorization-scanner-data'",
      ],
      [
        'raw SQL after an owner-scoped helper',
        'await listClientDocuments(principal, userId)\nreturn Response.json(await withTenantTransaction(principal, (tx: any) => tx.$executeRaw`DELETE FROM rentals`))',
      ],
      [
        'transaction whose callback is handed by name',
        'const wipe = (tx: any) => tx.clientDocument.deleteMany({ where: { userId } })\nawait listClientDocuments(principal, userId)\nreturn Response.json(await withTenantTransaction(principal, wipe))',
      ],
    ]
    for (const [label, data, prelude] of rejected)
      expect
        .soft(reasons(ownerRoute, owned(data, prelude))[0], label)
        .toMatch(OWNER)
    const accepted: Array<[string, string]> = [
      [
        'owner-scoped helper',
        'return Response.json(await listClientDocuments(principal, userId))',
      ],
      [
        'owner as the filter',
        transaction('tx.clientDocument.deleteMany({ where: { userId } })'),
      ],
      [
        'owner beside other filters (ANDed at the top level)',
        transaction(
          "tx.clientDocument.findMany({ where: { tenantId: principal.tenantId, userId, OR: [{ type: 'SELFIE' }, { type: 'ID_DOCUMENT' }] } })"
        ),
      ],
      [
        'owner as the record',
        transaction('tx.user.findUnique({ where: { id: userId } })'),
      ],
      [
        'owner as principal.userId',
        transaction(
          'tx.clientDocument.findMany({ where: { userId: principal.userId } })'
        ),
      ],
      [
        'owner in a compound key',
        transaction(
          'tx.zohoMailToken.findUnique({ where: { tenantId_userId: { tenantId: principal.tenantId, userId } } })'
        ),
      ],
      [
        'owner as the data of a new record',
        transaction(
          "tx.notification.create({ data: { userId, type: 'SYSTEM', title: 'x', message: 'y' } })"
        ),
      ],
    ]
    for (const [label, data] of accepted)
      expect.soft(reasons(ownerRoute, owned(data)), label).toEqual(['ok'])
  })

  it('rejects tagged templates, inline objects, awaited results, zod chains and pattern defaults before the guard (finding 26, third review)', () => {
    const thenable =
      'async function job() { return { then: (resolve: any) => resolve(prisma.user.deleteMany()) } }'
    const reached: Array<[string, string, string?]> = [
      [
        'tagged template handing the client to a function',
        'await wipe`${prisma}`',
        'function wipe(_strings: TemplateStringsArray, db: any) { return db.user.deleteMany() }',
      ],
      [
        'tagged template handing the client to an arrow',
        'const wipe = (_strings: TemplateStringsArray, db: any) => db.user.deleteMany()\nawait wipe`${prisma}`',
      ],
      [
        'tagged template handing the client to an object method',
        'await repo.wipe`${prisma}`',
        'const repo = { wipe(_strings: TemplateStringsArray, db: any) { return db.user.deleteMany() } }',
      ],
      [
        'tagged template handing the client to a class method',
        'await new Repo().wipe`${prisma}`',
        'class Repo { wipe(_strings: TemplateStringsArray, db: any) { return db.user.deleteMany() } }',
      ],
      [
        'function taken from an array literal and handed the client',
        'await [wipe][0](prisma)',
        'function wipe(db: any) { return db.user.deleteMany() }',
      ],
      [
        'zod chain handed the client',
        'await z.any().transform((db: any) => db.user.deleteMany()).parseAsync(prisma)',
      ],
      [
        'zod chain handed the client, not awaited',
        'void z.any().transform((db: any) => db.user.deleteMany()).parseAsync(prisma)',
      ],
      [
        'inline thenable awaited',
        'await { then: (resolve: any) => resolve(prisma.user.deleteMany()) }',
      ],
      [
        'thenable returned by a local async function and awaited',
        'await job()',
        thenable,
      ],
      [
        'thenable returned by a local function and awaited',
        'await job()',
        'function job() { return { then: (resolve: any) => resolve(prisma.user.deleteMany()) } }',
      ],
      ['thenable resolved by a local async function', 'void job()', thenable],
      [
        'getter of an inline object read',
        'void ({ get a() { return prisma.user.deleteMany() } }).a',
      ],
      [
        'getter of an inline object destructured',
        'const { a } = { get a() { return prisma.user.deleteMany() } }\nvoid a',
      ],
      [
        'getter of an inline object spread',
        'void ({ ...{ get a() { return prisma.user.deleteMany() } } })',
      ],
      [
        'default of an object pattern',
        'const { a = prisma.user.deleteMany() } = {} as any\nvoid a',
      ],
      [
        'default of an array pattern',
        'const [a = prisma.user.deleteMany()] = [] as any[]\nvoid a',
      ],
      [
        'default of a loop pattern',
        'for (const { a = prisma.user.deleteMany() } of [{}] as any[]) void a',
      ],
      [
        'default of a catch pattern',
        "try { JSON.parse('x') } catch ({ message = prisma.user.deleteMany() }: any) { void message }",
      ],
      [
        'thenables awaited by for await',
        'for await (const a of [{ then: (resolve: any) => resolve(prisma.user.deleteMany()) }] as any[]) void a',
      ],
      [
        'thenable returned by the handler before the gate',
        "if (request.headers.has('x-early')) return { then: (resolve: any) => resolve(prisma.user.deleteMany()) } as any",
      ],
    ]
    for (const [label, code, prelude] of reached)
      expect
        .soft(reasons(admin, early(code, prelude))[0], label)
        .toMatch(REACHED)
    // The anonymous path of scenario 6: data handed out by an inert refusal through the same channels.
    for (const [label, prelude, code] of [
      [
        'tagged template',
        'function all(_strings: TemplateStringsArray, db: any) { return db.user.findMany() }',
        'return Response.json(await all`${prisma}`)',
      ],
      [
        'pattern default',
        '',
        'const { rows = prisma.user.findMany() } = {} as any\nreturn Response.json(await rows)',
      ],
    ])
      expect
        .soft(reasons(admin, refusal(code!, prelude))[0], label)
        .toMatch(BEFORE)
    // The same shapes without a client fail too: INERT is a closed grammar (no tagged template, no hook key,
    // no accessor), not a hunt for the client.
    for (const [code, prelude] of [
      [
        'return Response.json({ tag: tag`x${request.method}` })',
        "function tag(strings: TemplateStringsArray, ...values: unknown[]) { return strings.join('') + values.join('') }",
      ],
      [
        'return Response.json({ method: await { then: (resolve: any) => resolve(request.method) } })',
        '',
      ],
      ["return Response.json({ a: ({ get a() { return 'x' } }).a })", ''],
    ])
      expect
        .soft(reasons(admin, refusal(code!, prelude))[0], code)
        .toMatch(BEFORE)
    // Without them, the same values are INERT.
    expect(
      reasons(
        admin,
        refusal("return Response.json({ method: request.method, a: 'x' })")
      )
    ).toEqual(['ok'])
  })

  it('accepts a CLIENT owner only through the owner binding itself, whatever holds the client, and never beyond the owner record (finding 30, third review)', () => {
    const source = (data: string, prelude = '') =>
      owned(
        `const documents = await listClientDocuments(principal, userId)
        ${data}
        return Response.json({ documents })`,
        prelude
      )
    const transaction = (query: string) =>
      `await withTenantTransaction(principal, (tx: any) => ${query})`
    const rejected: Array<[string, string, string?]> = [
      [
        'loop variable over a model of the client',
        'await withTenantTransaction(principal, async (tx: any) => { for (const m of [tx.clientDocument]) await m.deleteMany({}) })',
      ],
      [
        'loop variable over the client',
        'await withTenantTransaction(principal, async (tx: any) => { for (const t of [tx]) await t.clientDocument.deleteMany({}) })',
      ],
      [
        'loop variable over a function reaching data',
        'for (const run of [() => withTenantTransaction(principal, (tx: any) => tx.clientDocument.deleteMany({}))]) await run()',
      ],
      [
        'tagged template handing the client',
        transaction('wipe`${tx}`'),
        'function wipe(_strings: TemplateStringsArray, t: any) { return t.clientDocument.deleteMany({}) }',
      ],
      [
        'function taken from an array literal and handed the client',
        transaction('[wipe][0](tx)'),
        'function wipe(t: any) { return t.clientDocument.deleteMany({}) }',
      ],
      [
        'owner shadowed by a loop variable',
        'const { userIds } = (await request.json()) as { userIds: string[] }\nfor (const userId of userIds) ' +
          transaction('tx.clientDocument.deleteMany({ where: { userId } })'),
      ],
      [
        'owner shadowed by a destructured loop variable',
        'const items = (await request.json()) as Array<{ userId: string }>\nfor (const { userId } of items) ' +
          transaction('tx.clientDocument.deleteMany({ where: { userId } })'),
      ],
      [
        'owner shadowed by a catch variable',
        'try { throw (await request.json()).victim } catch (userId: any) { ' +
          transaction('tx.clientDocument.deleteMany({ where: { userId } })') +
          ' }',
      ],
      [
        'owner shadowed by a callback parameter default',
        "const victim = new URL(request.url).searchParams.get('victim')\nawait withTenantTransaction(principal, (tx: any, userId = victim) => tx.clientDocument.deleteMany({ where: { userId } }))",
      ],
      [
        'owner shadowed by a block constant',
        "{ const userId = new URL(request.url).searchParams.get('victim')\n" +
          transaction('tx.clientDocument.deleteMany({ where: { userId } })') +
          ' }',
      ],
      [
        'related records read through include',
        transaction(
          'tx.user.findUnique({ where: { id: userId }, include: { memberships: true } })'
        ),
      ],
      [
        'related record read through select',
        transaction(
          'tx.user.findUnique({ where: { id: userId }, select: { memberships: { select: { tenantId: true } } } })'
        ),
      ],
      [
        'relation selected whole',
        transaction(
          'tx.user.findUnique({ where: { id: userId }, select: { id: true, memberships: true } })'
        ),
      ],
      [
        'nested write to a related record',
        transaction(
          'tx.user.update({ where: { id: userId }, data: { memberships: { deleteMany: {} } } })'
        ),
      ],
      [
        'nested write on a model the schema does not know',
        transaction(
          "tx.clientNote.update({ where: { userId }, data: { author: { update: { name: 'x' } } } })"
        ),
      ],
      [
        'data taken whole from the request',
        'const body = await request.json()\n' +
          transaction('tx.user.update({ where: { id: userId }, data: body })'),
      ],
      [
        'data spread from the request',
        'const body = await request.json()\n' +
          transaction(
            "tx.user.update({ where: { id: userId }, data: { name: 'x', ...body } })"
          ),
      ],
      [
        'model taken by a local alias inside the transaction',
        'await withTenantTransaction(principal, async (tx: any) => { const m = tx.clientDocument; await m.deleteMany({ where: { userId } }) })',
      ],
      [
        'query of a local arrow inside the transaction',
        'await withTenantTransaction(principal, async (tx: any) => { const go = () => tx.clientDocument.deleteMany({}); await go() })',
      ],
      [
        'loop over plain values (only owner accesses and INERT statements follow the check)',
        "for (const label of ['a', 'b']) label.trim()",
      ],
      [
        'an owner query awaited through a thenable (a hook key is never INERT)',
        'await { then: (resolve: any) => resolve(withTenantTransaction(principal, (tx: any) => tx.clientDocument.count({ where: { userId } }))) }',
      ],
    ]
    for (const [label, data, prelude] of rejected)
      expect
        .soft(reasons(ownerRoute, source(data, prelude))[0], label)
        .toMatch(OWNER)
    const accepted: Array<[string, string]> = [
      ['owner-scoped helper only', ''],
      [
        'scalar update of the owner record',
        transaction(
          "tx.user.update({ where: { id: userId }, data: { name: 'x', phone: null } })"
        ),
      ],
      [
        'scalar select of the owner record',
        transaction(
          'tx.user.findUnique({ where: { id: userId }, select: { id: true, name: true } })'
        ),
      ],
      [
        'owner filter with an order and a page',
        transaction(
          "tx.clientDocument.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 })"
        ),
      ],
    ]
    for (const [label, data] of accepted)
      expect.soft(reasons(ownerRoute, source(data)), label).toEqual(['ok'])
  })

  it('rejects the breaches the flow analysis let through (finding 108, harness vq-travas-r3)', () => {
    // run.mts with c1.json and c2.json: code before the guard that reaches data through an implicit call.
    const before: string[] = [
      'await prisma.user.deleteMany()',
      'for await (const x of ({ async *[Symbol.asyncIterator]() { yield prisma.user.deleteMany() } } as any)) void x',
      "void ({ [({ toString() { void prisma.user.deleteMany(); return 'k' } }) as any]: 1 })",
      "void ({} as any)[({ toString() { void prisma.user.deleteMany(); return 'k' } }) as any]",
      "void ((({ toString() { void prisma.user.deleteMany(); return 'k' } }) as any) in {})",
      'void ((({ valueOf() { void prisma.user.deleteMany(); return 1 } }) as any) == 1)',
      'void -(({ valueOf() { void prisma.user.deleteMany(); return 1 } }) as any)',
      'void ~(({ valueOf() { void prisma.user.deleteMany(); return 1 } }) as any)',
      'let x: any = { valueOf() { void prisma.user.deleteMany(); return 1 } }\nx++',
      'let x: any = { valueOf() { void prisma.user.deleteMany(); return 1 } }\nx += 1',
      "const o: any = { toString() { void prisma.user.deleteMany(); return 'k' } }\nvoid `${o}`",
      "const o: any = { toString() { void prisma.user.deleteMany(); return 'k' } }\nvoid ('' + o)",
      'const o: any = { valueOf() { void prisma.user.deleteMany(); return 1 } }\nvoid (o > 0)',
      "const o: any = { toString() { void prisma.user.deleteMany(); return 'k' } }\nvoid ({} as any)[o]",
      'const o: any = { *[Symbol.iterator]() { yield prisma.user.deleteMany() } }\nvoid [...o]',
      'const o = { get a() { return prisma.user.deleteMany() } }\nvoid o.a',
      'const o = { [Symbol.dispose]() { void prisma.user.deleteMany() } }\n{ using x = o\nvoid x }',
      'const o = { toJSON() { return prisma.user.deleteMany() } }\nJSON.stringify(o)',
      "const a: any[] = [{ toString() { void prisma.user.deleteMany(); return 'k' } }]\nvoid `${a[0]}`",
      "const mk = (): any => ({ toString() { void prisma.user.deleteMany(); return 'k' } })\nvoid `${mk()}`",
      'const mk = (): any => ({ valueOf() { void prisma.user.deleteMany(); return 1 } })\nvoid (mk() > 1)',
      'const mk = () => ({ get a() { return prisma.user.deleteMany() } })\nvoid mk().a',
      "class K { toString() { void prisma.user.deleteMany(); return '' } }\nvoid `${new K()}`",
      'class K { valueOf() { void prisma.user.deleteMany(); return 1 } }\nvoid ((new K() as any) > 1)',
      'class K { get a() { return prisma.user.deleteMany() } }\nconst k = new K()\nvoid k.a',
      'class K { [Symbol.dispose]() { void prisma.user.deleteMany() } }\n{ using k = new K()\nvoid k }',
      'class K { *[Symbol.iterator]() { yield prisma.user.deleteMany() } }\nconst k = new K()\nvoid [...k]',
      'class K { then(r: any) { r(prisma.user.deleteMany()) } }\nconst k = new K()\nawait k',
      'const o: any = { set a(_v: any) { void prisma.user.deleteMany() } }\no.a = 1',
      'class K { set a(_v: any) { void prisma.user.deleteMany() } }\nconst k: any = new K()\nk.a = 1',
      'const o = { db: prisma, run() { return this.db.user.deleteMany() } }\nawait o.run()',
      'class K { db = prisma; run() { return this.db.user.deleteMany() } }\nawait new K().run()',
      "if (request.method === 'X') throw { get digest() { return String(prisma.user.deleteMany()) } }",
      '{ using x = { [Symbol.dispose]() { void prisma.user.deleteMany() } }\nvoid x }',
      '{ await using x = { async [Symbol.asyncDispose]() { await prisma.user.deleteMany() } }\nvoid x }',
      'for (using x of [{ [Symbol.dispose]() { void prisma.user.deleteMany() } }]) void x',
      'const a = [{ get x() { return prisma.user.deleteMany() } }]\nvoid a[0].x',
      'const a = [{ then: (r: any) => r(prisma.user.deleteMany()) }]\nawait a[0]',
      'const a: any[] = [{ valueOf() { void prisma.user.deleteMany(); return 1 } }]\nvoid (a[0] > 1)',
      'const [o] = [{ get x() { return prisma.user.deleteMany() } }]\nvoid o.x',
      "const [o]: any[] = [{ toString() { void prisma.user.deleteMany(); return 'k' } }]\nvoid `${o}`",
      'const c = { o: { get x() { return prisma.user.deleteMany() } } }\nvoid c.o.x',
      "const c: any = { o: { toString() { void prisma.user.deleteMany(); return 'k' } } }\nvoid `${c.o}`",
      'const c = { o: { then: (r: any) => r(prisma.user.deleteMany()) } }\nawait c.o',
      'const { o } = { o: { get x() { return prisma.user.deleteMany() } } }\nvoid o.x',
      'const { o } = { o: { then: (r: any) => r(prisma.user.deleteMany()) } }\nawait o',
      "const m = new Map([['k', { get x() { return prisma.user.deleteMany() } }]])\nvoid m.get('k')!.x",
      "void `${[{ toString() { void prisma.user.deleteMany(); return 'k' } }][0]}`",
      'void [{ get x() { return prisma.user.deleteMany() } }][0].x',
      "void [{ toString() { void prisma.user.deleteMany(); return 'k' } }].join(',')",
      "const a = [{ toString() { void prisma.user.deleteMany(); return 'k' } }]\nvoid a.join(',')",
      "const a = [{ toString() { void prisma.user.deleteMany(); return 'k' } }]\nvoid `${a}`",
      "const o: any = { toString() { void prisma.user.deleteMany(); return 'k' } }\nvoid (o in {})",
      "void (({ toString() { void prisma.user.deleteMany(); return 'k' } }) in {})",
      "const o: any = { [Symbol.toPrimitive]() { void prisma.user.deleteMany(); return 'k' } }\nvoid `${o}`",
      'const a = [...[{ get x() { return prisma.user.deleteMany() } }]]\nvoid a[0].x',
      'for (const o of [{ get x() { return prisma.user.deleteMany() } }]) void o.x',
      'for (const o of [{ then: (r: any) => r(prisma.user.deleteMany()) }]) await o',
      "for (const o of [{ toString() { void prisma.user.deleteMany(); return 'k' } }]) void `${o}`",
      'const read = (o: any) => o.x\nvoid read({ get x() { return prisma.user.deleteMany() } })',
      "const show = (o: any) => `${o}`\nvoid show({ toString() { void prisma.user.deleteMany(); return 'k' } })",
      'const wait = async (o: any) => await o\nawait wait({ then: (r: any) => r(prisma.user.deleteMany()) })',
      'const hold = (o: any) => { using x = o; void x }\nhold({ [Symbol.dispose]() { void prisma.user.deleteMany() } })',
      "const has = (o: any) => o in {}\nvoid has({ toString() { void prisma.user.deleteMany(); return 'k' } })",
    ]
    for (const code of before)
      expect.soft(reasons(admin, early(code))[0], code).toMatch(BEFORE)
    // c3-leave.json and c4-leave.json: the same channels in a path that leaves before the guard.
    const leaving: string[] = [
      'return Response.json(await prisma.user.findMany())',
      'const q = { rows: { then: (r: any) => r(prisma.user.findMany()) } }\nreturn Response.json(await q.rows)',
      'const q = [{ then: (r: any) => r(prisma.user.findMany()) }]\nreturn Response.json(await q[0])',
      'return Response.json(await [{ get rows() { return prisma.user.findMany() } }][0].rows)',
      'const q = { rows: { then: (r: any) => r(prisma.user.findMany()) } }\nconst rows = await q.rows\nreturn Response.json(rows)',
      'const q = [{ then: (r: any) => r(prisma.user.findMany()) }]\nconst rows = await q[0]\nreturn Response.json(rows)',
      '{ using x = { [Symbol.dispose]() { void prisma.user.deleteMany() } }\nvoid x }\nreturn new Response(null, { status: 204 })',
      "void (({ toString() { void prisma.user.deleteMany(); return 'k' } }) in {})\nreturn new Response(null, { status: 204 })",
    ]
    for (const code of leaving)
      expect.soft(reasons(admin, refusal(code))[0], code).toMatch(BEFORE)
    // run30.mts with c30.json: after a CLIENT passes as the owner, an access without the owner in a local
    // function, an object literal or a container.
    const T =
      'withTenantTransaction(principal, (tx: any) => tx.clientDocument.deleteMany({}))'
    const afterOwner: string[] = [
      `await ${T}`,
      `await { then: (r: any) => r(${T}) }`,
      `const jobs = [{ then: (r: any) => r(${T}) }]\nawait jobs[0]`,
      `const jobs = { wipe: { then: (r: any) => r(${T}) } }\nawait jobs.wipe`,
      `await ({ get a() { return ${T} } }).a`,
      `{ using lease = { [Symbol.dispose]() { void ${T} } }\nvoid lease }`,
      `void \`\${{ toString() { void ${T}; return '' } }}\``,
      `;({ set a(_v: any) { void ${T} } } as any).a = 1`,
      `void [...({ *[Symbol.iterator]() { yield ${T} } } as any)]`,
      `await new Promise((r) => r(${T}))`,
      `class K { get a() { return ${T} } }\nawait new K().a`,
      `await (async () => ${T})()`,
      'await withTenantTransaction(principal, async (tx: any) => { await { then: (r: any) => r(tx.clientDocument.deleteMany({})) } })',
      'await withTenantTransaction(principal, async (tx: any) => { await ({ get a() { return tx.clientDocument.deleteMany({}) } }).a })',
      'await withTenantTransaction(principal, async (tx: any) => { const go = () => tx.clientDocument.deleteMany({}); await go() })',
      'await withTenantTransaction(principal, async (tx: any) => { const j = [{ then: (r: any) => r(tx.clientDocument.deleteMany({})) }]; await j[0] })',
      'await withTenantTransaction(principal, async (tx: any) => { const m = tx.clientDocument; await m.deleteMany({}) })',
      'await withTenantTransaction(principal, (tx: any) => tx.clientDocument.deleteMany({ where: { a_b: { not: userId } } }))',
      'await withTenantTransaction(principal, (tx: any) => tx.clientDocument.deleteMany({ where: { user: { id: userId } } }))',
      // run30.mts wrote `tx.rental`, a model the schema does not have: fail closed.
      "await withTenantTransaction(principal, (tx: any) => tx.rental.deleteMany({ where: { userId, OR: [{ id: 'x' }] } }))",
    ]
    const ownerThen = (data: string) =>
      owned(
        `const documents = await listClientDocuments(principal, userId)\n${data}\nreturn Response.json({ documents })`
      )
    expect(reasons(ownerRoute, ownerThen(''))).toEqual(['ok'])
    for (const data of afterOwner)
      expect.soft(reasons(ownerRoute, ownerThen(data))[0], data).toMatch(OWNER)
    // real26.mts and real30.mts: the same channels inserted in the real routes (the files are only read).
    const badges = 'apps/services/api/src/app/api/admin/badges/route.ts'
    const badgesSource = fs
      .readFileSync(path.join(ROOT, badges), 'utf8')
      .replace(/\r\n/g, '\n')
    const anchor =
      'export async function GET(request: NextRequest) {\n  const access = await resolveTenantPrincipal(request)'
    expect(badgesSource).toContain(anchor)
    expect(reasons(badges, badgesSource)).toEqual(['ok'])
    for (const code of [
      "await { then: (resolve: any) => resolve(readAdminBadges({ tenantId: 'foreign' })) }",
      "const jobs = [{ then: (resolve: any) => resolve(readAdminBadges({ tenantId: 'foreign' })) }]\n  await jobs[0]",
      "const jobs = { token: { then: (resolve: any) => resolve(readAdminBadges({ tenantId: 'foreign' })) } }\n  await jobs.token",
      "void [{ get token() { return readAdminBadges({ tenantId: 'foreign' }) } }][0].token",
      "{ using lease = { [Symbol.dispose]() { void readAdminBadges({ tenantId: 'foreign' }) } }\n  void lease }",
      "{ await using lease = { async [Symbol.asyncDispose]() { await readAdminBadges({ tenantId: 'foreign' }) } }\n  void lease }",
      "void (({ toString() { void readAdminBadges({ tenantId: 'foreign' }); return 'k' } }) in {})",
    ])
      expect
        .soft(
          reasons(
            badges,
            badgesSource.replace(
              anchor,
              `export async function GET(request: NextRequest) {\n  ${code}\n  const access = await resolveTenantPrincipal(request)`
            )
          )[0],
          code
        )
        .toMatch(BEFORE)
    const documents =
      'apps/services/api/src/app/api/admin/clients/[id]/documents/route.ts'
    const documentsSource = fs.readFileSync(path.join(ROOT, documents), 'utf8')
    const access =
      /const documents = await listClientDocuments\(principal, userId\)/
    const imported =
      "import { withTenantTransaction } from '@/apps/services/api/src/host/tenant-transaction'\n" +
      documentsSource
    expect(imported).not.toBe(documentsSource)
    expect(reasons(documents, imported)).toEqual(['ok'])
    for (const code of [
      'await withTenantTransaction(principal, (tx: any) => tx.rentals.deleteMany({}))',
      'await withTenantTransaction(principal, async (tx: any) => { const wipe = () => tx.rentals.deleteMany({}); await wipe() })',
      'await withTenantTransaction(principal, async (tx: any) => { async function wipe() { await tx.rentals.deleteMany({}) } await wipe() })',
      'await { then: (resolve: any) => resolve(withTenantTransaction(principal, (tx: any) => tx.rentals.deleteMany({}))) }',
      'await withTenantTransaction(principal, async (tx: any) => { await { then: (resolve: any) => resolve(tx.rentals.deleteMany({})) } })',
      "await (await import('@/apps/services/api/src/host/tenant-transaction')).withTenantTransaction(principal, (tx: any) => tx.rentals.deleteMany({}))",
    ]) {
      const mutated = imported.replace(
        access,
        `const documents = await listClientDocuments(principal, userId)\n    ${code}`
      )
      expect(mutated, code).not.toBe(imported)
      expect.soft(reasons(documents, mutated)[0], code).toMatch(OWNER)
    }
  })

  it('closes the grammar the second round broke: the Function constructor, writes, hook and computed keys (finding 108, vq-residuo-travas, vrf-residuo-travas-sk)', () => {
    const make =
      "(Object as any).constructor('return globalThis.__prisma.user.deleteMany()')"
    // v1.json and a1.json: before the guard, code that builds the Function constructor or changes what the guard sees.
    const before: string[] = [
      `if (${make}()) return Response.json({})`,
      "if ((() => 0).constructor('return globalThis.__prisma.user.deleteMany()')()) return Response.json({})",
      "if (([] as any).constructor.constructor('return globalThis.__prisma.user.deleteMany()')()) return Response.json({})",
      `if (await ${make}() === 'never') return Response.json({})`,
      `if (new ${make}() === 1) return Response.json({})`,
      "if (Reflect.apply(Object.constructor, null, ['return globalThis.__prisma.user.deleteMany()'])()) return Response.json({})",
      "if (request.method === 'POST') return Response.json(await (Object as any).constructor('return globalThis.__prisma.user.findMany()')())",
      'if ((Object as any).constructor(\'return process.getBuiltinModule("module").createRequire(process.cwd() + "/")("@prisma/client")\')()) return Response.json({})',
      "if ((process.env.IDENTITY_MODE = 'legacy') === 'x') return Response.json({})",
      'if (((Array.prototype as any).includes = () => true) && false) return Response.json({})',
      "if (Object.defineProperty(Object.prototype, 'success', { get: () => true, configurable: true }) === null) return Response.json({})",
      `const body = await request.json().catch(() => ${make}())`,
      "if (''.constructor.constructor('return this')().__prisma.user.deleteMany()) return new Response(null, { status: 400 })",
      "if (await (''.constructor.constructor('return this')()).__prisma.user.deleteMany()) return new Response(null, { status: 400 })",
      "if ((() => 0).constructor('return this')().__pool.query('DELETE FROM \"User\"')) return Response.json({}, { status: 400 })",
      "if (request.method === 'POST' && false) return Response.json(''.constructor.constructor('return this')().__prisma.user.findMany())",
      // The same family in other spellings: a string key, a destructured or computed member, a hook key, a write.
      "if ((('' as any)['constructor']['constructor']('return this')() as any).__prisma) return Response.json({})",
      "if (request.headers.has('x')) { const { constructor: build } = (() => 0) as any; return Response.json(build('return 1')()) }",
      "if (request.headers.has('x')) return Response.json((request as any)[request.headers.get('k')!])",
      "if (request.headers.has('x')) return Response.json({ toJSON: () => 'x' })",
      "if (request.headers.has('x')) return Response.json({ __proto__: { ok: true } })",
      'if (delete (process.env as any).IDENTITY_MODE) return Response.json({})',
      "if ((JSON.parse = (() => ({ role: 'ADMIN' })) as any)) return Response.json({})",
      "if (request.headers.has('x')) return Response.json({ role: 'ADMIN', role: 'CLIENT' } as any)",
      'if ((globalThis as any).__prisma) return Response.json({})',
    ]
    for (const code of before)
      expect.soft(reasons(admin, early(code))[0], code).toMatch(BEFORE)
    // v30.json, o1.json and o2.json: after a CLIENT passes as the owner.
    const ownerThen = (data: string) =>
      owned(
        `const documents = await listClientDocuments(principal, userId)\n${data}\nreturn Response.json({ documents })`
      )
    const T = (query: string) =>
      `await withTenantTransaction(principal, (tx: any) => ${query})`
    const afterOwner: string[] = [
      "await (Object as any).constructor('return globalThis.__prisma.rental.deleteMany({})')()",
      "await (() => 0).constructor('return globalThis.__prisma.rental.deleteMany({})')()",
      "return Response.json({ all: await (Object as any).constructor('return globalThis.__prisma.user.findMany()')() })",
      "await ''.constructor.constructor('return this')().__prisma.clientDocument.deleteMany({})",
      T(
        "tx.clientDocument.findMany({ where: { userId, notes: ''.constructor.constructor('return this')().__prisma.rental.deleteMany({}) } })"
      ),
      // A computed or repeated key after the owner overrides it: Prisma then filters nothing.
      T(
        "tx.clientDocument.deleteMany({ where: { userId, ['user' + 'Id']: undefined } })"
      ),
      `const body = await request.json()\n${T("tx.clientDocument.deleteMany({ where: { userId, ['user' + 'Id']: body.victim } })")}`,
      `const body = await request.json()\nconst stolen = ${T("tx.clientDocument.findMany({ where: { userId, [`${'userId'}`]: body.victim } })")}\nvoid stolen`,
      `const body = await request.json()\n${T("tx.notification.create({ data: { userId, ['user' + 'Id']: body.victim, title: 'x', message: 'y', type: 'z' } })")}`,
      `const body = await request.json()\n${T("tx.clientDocument.findMany({ where: { id: userId, ['i' + 'd']: body.victim } })")}`,
      T(
        'tx.clientDocument.deleteMany({ where: { userId, userId: undefined } })'
      ),
      T(
        "tx.clientDocument.deleteMany({ where: { userId, 'userId': undefined } })"
      ),
      T(
        "tx.membership.deleteMany({ where: { tenantId_userId: { tenantId: principal.tenantId, userId, ['user' + 'Id']: undefined } } })"
      ),
    ]
    for (const data of afterOwner)
      expect.soft(reasons(ownerRoute, ownerThen(data))[0], data).toMatch(OWNER)
    // Controls: the owner named once, and the body read as in the PROLOGUE.
    for (const data of [
      T('tx.clientDocument.deleteMany({ where: { userId } })'),
      `const body = await request.json()\n${T('tx.clientDocument.deleteMany({ where: { userId, id: body.id } })')}`,
    ])
      expect.soft(reasons(ownerRoute, ownerThen(data)), data).toEqual(['ok'])
    // The owner filter on its own (not only through the INERT grammar): a computed or repeated key never names it.
    const filter = (text: string) => {
      const source = ts.createSourceFile(
        'filter.ts',
        `const where = ${text}`,
        ts.ScriptTarget.Latest,
        true
      )
      const statement = source.statements[0] as ts.VariableStatement
      return statement.declarationList.declarations[0]!.initializer!
    }
    const isUserId = (node: ts.Node | undefined) =>
      !!node && ts.isIdentifier(node) && node.text === 'userId'
    expect(ownerFilter(filter('{ userId }'), 'clientDocument', isUserId)).toBe(
      true
    )
    expect(
      ownerFilter(
        filter("{ tenantId_userId: { tenantId: 't', userId } }"),
        'membership',
        isUserId
      )
    ).toBe(true)
    for (const [text, model] of [
      ["{ userId, ['user' + 'Id']: undefined }", 'clientDocument'],
      ['{ userId, userId: undefined }', 'clientDocument'],
      ["{ userId, 'userId': undefined }", 'clientDocument'],
      ["{ id: userId, ['i' + 'd']: undefined }", 'clientDocument'],
      [
        "{ tenantId_userId: { tenantId: 't', userId, ['user' + 'Id']: undefined } }",
        'membership',
      ],
      [
        "{ tenantId_userId: { tenantId: 't', userId, userId: undefined } }",
        'membership',
      ],
    ])
      expect
        .soft(ownerFilter(filter(text!), model!, isUserId), text)
        .toBe(false)
    // vload.json: what the module evaluates when it loads.
    const loaded = (prelude: string) => `
      import { z } from 'zod'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      ${prelude}
      export async function GET(request: Request) {
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json({})
      }`
    for (const prelude of [
      `void ${make}()`,
      `const wipe = ${make}()`,
      '(Array.prototype as any).includes = () => true',
      'const polluted = ((Array.prototype as any).includes = () => true)',
      "const defined = Object.defineProperty(Array.prototype, 'includes', { value: () => true })",
      "const applied = Reflect.apply(Object.constructor, null, ['return 1'])",
      "const schema = (z as any).constructor.constructor('return globalThis.__prisma')()",
      "const schema = (z.string() as any).constructor('x')",
      "const schema = (z as any)['string']()",
      `const values = new Set(${make}())`,
      "const hooks = { toString: () => 'x' }",
      "const label = `${{ toString: () => 'x' }}`",
      'const copy = [...({ *[Symbol.iterator]() { yield 1 } } as any)]',
    ])
      expect
        .soft(reasons(admin, loaded(prelude))[0], prelude)
        .toMatch(/^the module runs .* when it loads/)
    // Controls: the load-time code of the real routes.
    for (const prelude of [
      'const TTL = 6 * 60 * 60 * 1000',
      'const Input = z.object({ id: z.coerce.number().int().positive(), name: z.string().trim().min(1).optional() }).strict()',
      'const Id = z.string()\nconst Pair = z.object({ id: Id.optional() })',
      "const ROLES = new Map([['ADMIN', 1]])",
      "const repo = { list: () => 'x', named() { return 1 } }",
    ])
      expect.soft(reasons(admin, loaded(prelude)), prelude).toEqual(['ok'])
    // vallow.mts: an allowlisted method reaches the language itself; a retired one is not INERT either.
    const retired = (code: string) => `
      export async function POST(request: Request) {
        ${code}
        return Response.json({ error: 'Endpoint retired' }, { status: 410 })
      }
      export function GET() {
        return Response.json({ error: 'Endpoint retired' }, { status: 410 })
      }`
    const seed = 'apps/services/api/src/app/api/admin/seed-admin/route.ts'
    const problems = (route: string, text: string) =>
      allowlistProblems(route, analyzeRouteModule(path.join(ROOT, route), text))
    const reflective: Array<[string, string]> = [
      [
        "await (Object as any).constructor('return globalThis.__prisma')().user.deleteMany()",
        '<reflection>#constructor',
      ],
      [
        "await (() => 0).constructor('return globalThis.__prisma.user.deleteMany()')()",
        '<reflection>#constructor',
      ],
      [
        "await ((() => 0) as any)['constructor']('return globalThis.__prisma.user.deleteMany()')()",
        '<reflection>#constructor',
      ],
      [
        "const { constructor: build } = (() => 0) as any\nawait build('return globalThis.__prisma.user.deleteMany()')()",
        '<reflection>#constructor',
      ],
      [
        "const key = request.headers.get('k')!\nawait ((() => 0) as any)[key]('return globalThis.__prisma.user.deleteMany()')()",
        '<reflection>#[]',
      ],
      [
        "await Reflect.get(() => 0, 'constr' + 'uctor')('return globalThis.__prisma.user.deleteMany()')()",
        '<reflection>#Reflect',
      ],
      [
        "await Object.getOwnPropertyDescriptor(Object.getPrototypeOf(() => 0), 'constr' + 'uctor')!.value('return 1')()",
        '<reflection>#Object',
      ],
      [
        "Object.assign(JSON, { parse: () => ({ role: 'ADMIN' }) })",
        '<reflection>#Object',
      ],
      ["JSON.parse = () => ({ role: 'ADMIN' })", '<write>#JSON'],
      [
        '(Array.prototype as any).includes = () => true',
        '<reflection>#prototype',
      ],
      ['(Array.prototype as any).includes = () => true', '<write>#Array'],
      ["process.env.IDENTITY_MODE = 'legacy'", '<write>#process'],
      ['delete (process.env as any).IDENTITY_MODE', '<write>#process'],
      [
        "const alias: any = JSON\nalias.parse = () => ({ role: 'ADMIN' })",
        '<write>#alias',
      ],
      [
        'const seeded = { __proto__: null }\nvoid seeded',
        '<reflection>#__proto__',
      ],
    ]
    for (const [code, reference] of reflective) {
      const found = problems(seed, retired(code))
      expect
        .soft(found, code)
        .toContain(`${seed}#POST: references ${reference}`)
      expect
        .soft(found.some(INERT_PROBLEM.test, INERT_PROBLEM), code)
        .toBe(true)
    }
    // Mutate the real deferred database callback: the thin health route delegates to this host composition.
    const health = 'apps/services/api/src/app/api/health/route.ts'
    const healthSource = fs.readFileSync(path.join(ROOT, health), 'utf8')
    const healthHostFile = path.join(ROOT, PUBLIC_FACTORY_SOURCE)
    const healthHostSource = fs.readFileSync(healthHostFile, 'utf8')
    const probe = '() => getDatabaseRuntime().prisma.$queryRaw`SELECT 1`'
    expect(healthHostSource).toContain(probe)
    expect(problems(health, healthSource)).toEqual([])
    const withHealthProbe = (code: string) => {
      const mutated = healthHostSource.replace(
        probe,
        `async () => {
        const result = getDatabaseRuntime().prisma.$queryRaw\`SELECT 1\`
        ${code}
        return result
      }`
      )
      expect(mutated, code).not.toBe(healthHostSource)
      FIXTURE_FILES.set(healthHostFile, mutated)
      try {
        return problems(health, healthSource)
      } finally {
        FIXTURE_FILES.delete(healthHostFile)
      }
    }
    for (const [code, reference] of reflective.slice(0, 10)) {
      // The zero-argument health port has no handler request; retain an unknown computed key in its own scope.
      const scoped = code.replace(
        "request.headers.get('k')!",
        'String(Date.now())'
      )
      expect
        .soft(withHealthProbe(scoped), code)
        .toContain(`${health}#GET: references ${reference}`)
    }
    // Reading keys and entries is not reflection.
    expect(withHealthProbe('void Object.keys({ a: 1 }).length')).toEqual([])
    expect(problems(health, healthSource)).toEqual([])
    // vreal.mts, vreal2.mts and realdocs.mts: the same code inserted in the real routes (the files are only read).
    const contract =
      'apps/services/api/src/app/api/admin/rentals/[id]/contract/route.ts'
    const contractSource = fs.readFileSync(path.join(ROOT, contract), 'utf8')
    const guard =
      / {4}const access = await resolveTenantPrincipal\(request\)\r?\n {4}if \(!access\.ok\) return access\.response\r?\n {4}\/\/ O mesmo/
    expect(contractSource).toMatch(guard)
    expect(methods(contract, contractSource)).toEqual(['GET:ok', 'POST:ok'])
    for (const code of [
      `    if (await ${make}()) return NextResponse.json({})\n`,
      '    if (((Array.prototype as any).includes = () => true) === null) return NextResponse.json({})\n',
    ])
      expect
        .soft(
          methods(
            contract,
            contractSource.replace(guard, (matched) => code + matched)
          ),
          code
        )
        .toEqual(['GET:ok', expect.stringMatching(/^POST:before the guard: /)])
    const documents =
      'apps/services/api/src/app/api/admin/clients/[id]/documents/route.ts'
    const documentsSource = fs.readFileSync(path.join(ROOT, documents), 'utf8')
    const withTransaction =
      "import { withTenantTransaction } from '@/apps/services/api/src/host/tenant-transaction'\n" +
      documentsSource
    const list =
      'const documents = await listClientDocuments(principal, userId)'
    const principalCall =
      '    const access = await resolveTenantPrincipal(request)'
    expect(withTransaction).not.toBe(documentsSource)
    expect(withTransaction).toContain(list)
    expect(withTransaction).toContain(principalCall)
    for (const [text, reason] of [
      [
        withTransaction.replace(
          list,
          "const documents = await withTenantTransaction(principal, (tx) => tx.clientDocument.findMany({ where: { userId, ['user' + 'Id']: undefined } }))"
        ),
        OWNER,
      ],
      [
        withTransaction.replace(
          list,
          "await withTenantTransaction(principal, (tx) => tx.clientDocument.deleteMany({ where: { userId, ['user' + 'Id']: undefined } }))\n    " +
            list
        ),
        OWNER,
      ],
      [
        documentsSource.replace(
          list,
          "const documents = await ''.constructor.constructor('return this')().__prisma.clientDocument.findMany()"
        ),
        OWNER,
      ],
      [
        documentsSource.replace(
          principalCall,
          "    if (await ''.constructor.constructor('return this')().__prisma.clientDocument.deleteMany()) return NextResponse.json({}, { status: 400 })\n" +
            principalCall
        ),
        BEFORE,
      ],
      [
        documentsSource.replace(
          'await resolveTenantPrincipal(request)',
          "await resolveTenantPrincipal(request, ''.constructor.constructor('return this')().__prisma.clientDocument.deleteMany())"
        ),
        BEFORE,
      ],
    ] as const) {
      expect(text).not.toBe(documentsSource)
      expect.soft(reasons(documents, text)[0], text).toMatch(reason)
    }
  })

  it('keeps INERT and the module load a closed grammar: each form outside it fails, however harmless', () => {
    // Inside a refusal before the guard: every form outside the grammar fails, even when it reaches nothing.
    const outside: Array<[string, string?]> = [
      ['return Response.json({ kind: typeof (request as any).constructor })'],
      [
        'const { constructor: kind } = request as any\nreturn Response.json({ kind: typeof kind })',
      ],
      ['return Response.json({ max: Math.max(1, 2) })'],
      ['return Response.json({ pi: typeof Math })'],
      ["return Response.json({ id: parseInt('1', 10) })"],
      ["return Response.json({ label: 'x'.repeat(2) })"],
      [
        'const label = request.method\nreturn Response.json({ label: (label as any)() })',
      ],
      ['{ using lease = null as any\nvoid lease }\nreturn Response.json({})'],
      [
        'function* ids() { return 1 }\nreturn Response.json({ ids: typeof ids })',
      ],
      ['return Response.json({ box: new Box() })', 'class Box {}'],
      ['return Response.json({ box: typeof Box })', 'class Box {}'],
      [
        'return Response.json({ denied: request instanceof Denied })',
        'class Base {}\nclass Denied extends Base {}',
      ],
      // Finding 111: a class of the file is not in INERT_CLASSES, even without a base (a static block of a module
      // no load check covers could still give it a Symbol.hasInstance).
      [
        'return Response.json({ denied: request instanceof Denied })',
        'class Denied {}',
      ],
      [
        'const reply = (status: number) => { status = 500; return Response.json({}, { status }) }\nreturn reply(400)',
      ],
      ['return Response.json({ kind: typeof process.versions })'],
      ['return Response.json({ kind: typeof (prisma<never>) })'],
    ]
    for (const [code, prelude] of outside)
      expect
        .soft(reasons(admin, refusal(code!, prelude))[0], code)
        .toMatch(BEFORE)
    // Controls: the same values through the grammar.
    for (const [code, prelude] of [
      [
        'return Response.json({ label: String(request.method), at: new Date().toISOString() })',
      ],
      ['return Response.json({ denied: request instanceof Error })'],
      [
        'const reply = (status: number) => { let code = status; code = code + 1; return Response.json({}, { status: code }) }\nreturn reply(400)',
      ],
      [
        'return Response.json({ label: label(request.method) })',
        'function label(value: string) { return value }',
      ],
      ['return Response.json({ mode: process.env.NODE_ENV })'],
    ])
      expect.soft(reasons(admin, refusal(code!, prelude)), code).toEqual(['ok'])
    // When the module loads: a call of a global member and an operator on anything but literal data fail.
    const loaded = (prelude: string) => `
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      ${prelude}
      export async function GET(request: Request) {
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json({})
      }`
    for (const prelude of [
      'const LIMIT = Math.max(1, 2)',
      "const NAME = 'a'\nconst LABEL = NAME + 'b'",
    ])
      expect
        .soft(reasons(admin, loaded(prelude))[0], prelude)
        .toMatch(/^the module runs .* when it loads/)
    expect(reasons(admin, loaded("const LABEL = 'a' + 'b'"))).toEqual(['ok'])
  })

  it('closes instanceof before the guard to INERT_CLASSES: no other import, namespace, member chain, class of the file or value (finding 111, harness vq-travas-r4)', () => {
    // `instanceof` runs the right side's Symbol.hasInstance, and a member chain there runs its getters: with a
    // Wiper whose static [Symbol.hasInstance] deletes users, the anonymous POST ran deleteMany before its 403.
    const probe =
      "import { Wiper, Errors, CatalogError as Borrowed } from '@/tests/security/fixtures/probe-wiper'\nimport * as lib from '@/tests/security/fixtures/probe-wiper'"
    const outside: Array<[string, string?]> = [
      ['request instanceof Wiper', probe],
      ['request instanceof Errors.Validation', probe],
      ['request instanceof lib.Wiper', probe],
      // a listed name, imported from a module the list does not name
      ['request instanceof Borrowed', probe],
      ['request instanceof prisma'],
      ['request instanceof prisma.user.deleteMany'],
      ['request instanceof z.ZodType'],
      ['request instanceof Denied', 'class Denied {}'],
      ['request instanceof Proxy'],
      ['request instanceof Intl.Collator'],
      ['request instanceof Error.captureStackTrace'],
      ['request instanceof Error.prototype.constructor'],
      ['request instanceof (request as any)'],
    ]
    for (const [test, prelude] of outside) {
      expect
        .soft(
          reasons(
            admin,
            early(
              `if (${test}) return Response.json({}, { status: 400 })`,
              prelude
            )
          )[0],
          test
        )
        .toMatch(BEFORE)
      expect
        .soft(
          reasons(
            admin,
            refusal(`return Response.json({ denied: ${test} })`, prelude)
          )[0],
          test
        )
        .toMatch(BEFORE)
    }
    // The catch around the guard runs when the guard throws: the same closed list.
    const errors = [
      "import { ZodError } from 'zod'",
      "import { RentalMutationError } from '@/packages/backend/src/modules/rentals/errors'",
      "import { CustomerError } from '@gb-locacoes/backend/customers'",
      "import { Wiper, Errors } from '@/tests/security/fixtures/probe-wiper'",
    ].join('\n')
    const caught = (test: string) => `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { z } from 'zod'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      ${errors}
      export async function POST(request: Request) {
        try {
          const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
          if (!auth.ok) return Response.json({}, { status: 403 })
          return Response.json({ ok: await prisma.user.count() })
        } catch (error) {
          if (${test}) return Response.json({}, { status: 400 })
          throw error
        }
      }`
    for (const test of [
      'error instanceof Wiper',
      'error instanceof Errors.Validation',
      'error instanceof prisma',
    ])
      expect
        .soft(reasons(admin, caught(test))[0], test)
        .toMatch(/^catch before authorization: /)
    // Controls: the checks of the real routes (natives, zod and the project error classes of INERT_CLASSES).
    for (const test of [
      'error instanceof Error',
      'error instanceof SyntaxError',
      'error instanceof Response',
      'error instanceof ZodError',
      'error instanceof z.ZodError',
      'error instanceof RentalMutationError',
      '(error as any) instanceof (CustomerError)',
    ])
      expect.soft(reasons(admin, caught(test)), test).toEqual(['ok'])
    // The verifier's case, as written.
    expect(
      reasons(
        admin,
        `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { Wiper, Errors } from '@/tests/security/fixtures/probe-wiper'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      export async function POST(request: Request) {
        if (request instanceof Wiper) return Response.json({}, { status: 400 })
        if (request instanceof Errors.Validation) return Response.json({}, { status: 400 })
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json({ ok: await prisma.user.count() })
      }`
      )[0]
    ).toMatch(BEFORE)
  })

  it('names each module once: a project file or an alias never poses as zod or as a listed module (findings 111 and 112, verifier vrf-fech-travas)', () => {
    // The verifier's routes, as written: '@/zod' became the module id 'zod', so its ZodError and z.object passed as the
    // package's. With a stand-in zod.mjs the anonymous POST ran deleteMany before its 403, and loading the module ran
    // it with no request at all.
    const ROUTE_111 = `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { ZodError, z } from '@/zod'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      export async function POST(request: Request) {
        if (request instanceof ZodError) return Response.json({}, { status: 400 })
        if (request instanceof z.ZodError) return Response.json({}, { status: 400 })
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json({ ok: await prisma.user.count() })
      }`
    const ROUTE_111_CATCH = `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { ZodError } from '@/zod'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      export async function POST(request: Request) {
        try {
          const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
          if (!auth.ok) return Response.json({}, { status: 403 })
          return Response.json({ ok: await prisma.user.count() })
        } catch (error) {
          if (error instanceof ZodError) return Response.json({}, { status: 400 })
          throw error
        }
      }`
    const ROUTE_112 = `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { z } from '@/zod'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      const Input = z.object({ name: z.string().min(1) }).strict()
      export async function GET(request: Request) {
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json(await prisma.user.findMany())
      }`
    const from = (specifier: string) =>
      [ROUTE_111, ROUTE_111_CATCH, ROUTE_112].map((route) =>
        route.replaceAll("'@/zod'", `'${specifier}'`)
      )
    const refused = () => {
      for (const specifier of [
        '@/zod',
        '../../../../zod',
        '@/zod/index',
        '@/zod.ts',
      ] as Array<[string | RegExp, string]>) {
        const [early, caught, loaded] = from(specifier)
        expect.soft(reasons(admin, early!)[0], specifier).toMatch(BEFORE)
        expect
          .soft(reasons(admin, caught!)[0], specifier)
          .toMatch(/^catch before authorization: /)
        expect
          .soft(reasons(admin, loaded!)[0], specifier)
          .toMatch(/^the module runs .* when it loads/)
      }
    }
    // Missing, and then present as a project file: zod.ts or zod/index.ts (the package owns the id 'zod').
    refused()
    const standIn =
      "import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'\nexport class ZodError extends Error {\n  static [Symbol.hasInstance]() { void prisma.user.deleteMany(); return false }\n}\nexport const z = { ZodError, object: () => prisma.user.deleteMany() }\n"
    for (const file of ['zod.ts', 'zod/index.ts']) {
      FIXTURE_FILES.set(path.join(ROOT, file), standIn)
      try {
        expect(
          moduleBinding(path.join(ROOT, admin), '@/zod', 'ZodError').module
        ).toBe(`file:${file}`)
        refused()
      } finally {
        FIXTURE_FILES.delete(path.join(ROOT, file))
      }
    }
    // Control: the package itself.
    for (const route of from('zod'))
      expect.soft(reasons(admin, route), route).toEqual(['ok'])
    // A listed project module is its file alone: backend catalog errors/index.ts and errors.mjs are synthetic shadows.
    const catalog = (specifier: string) => `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { CatalogError } from '${specifier}'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      export async function POST(request: Request) {
        if (request instanceof CatalogError) return Response.json({}, { status: 400 })
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json({ ok: await prisma.user.count() })
      }`
    const poser =
      'export class CatalogError {\n  static [Symbol.hasInstance]() { return true }\n}\n'
    for (const [file, specifier] of [
      [
        'packages/backend/src/modules/catalog/errors/index.ts',
        '@/packages/backend/src/modules/catalog/errors/index',
      ],
      [
        'packages/backend/src/modules/catalog/errors.mjs',
        '@/packages/backend/src/modules/catalog/errors.mjs',
      ],
      [
        'packages/backend/src/modules/catalog/errors/index.ts',
        '../../../../../../../../packages/backend/src/modules/catalog/errors/index',
      ],
    ] as const) {
      FIXTURE_FILES.set(path.join(ROOT, file), poser)
      try {
        expect
          .soft(reasons(admin, catalog(specifier))[0], specifier)
          .toMatch(BEFORE)
      } finally {
        FIXTURE_FILES.delete(path.join(ROOT, file))
      }
    }
    expect(
      reasons(
        admin,
        catalog('@/packages/backend/src/modules/catalog/errors/index')
      )[0]
    ).toMatch(BEFORE)
    // Controls: the listed module, by any specifier of its own file.
    for (const specifier of [
      '@/packages/backend/src/modules/catalog/errors',
      '@/packages/backend/src/modules/catalog/errors.ts',
      '../../../../../../../../packages/backend/src/modules/catalog/errors',
    ])
      expect.soft(reasons(admin, catalog(specifier)), specifier).toEqual(['ok'])
    // A bare specifier is the package it resolves to: a `paths` alias is none, and zod is the one installed.
    const route = path.join(ROOT, admin)
    expect(moduleBinding(route, '@/zod', 'z')).toEqual({
      module: 'unresolved:@/zod',
      name: 'z',
    })
    expect(moduleBinding(route, '@gb-locacoes/ui', 'Button').module).toBe(
      'alias:@gb-locacoes/ui'
    )
    const installed = moduleBinding(route, 'zod', 'z')
    expect(installed).toMatchObject({ module: 'zod', package: /^zod@\d/ })
    expect(zodNamespace(installed)).toBe(true)
    expect(zodNamespace({ module: 'zod', name: 'z' })).toBe(false)
    expect(zodNamespace({ ...installed, package: 'zod@0.0.0' })).toBe(false)
    expect(zodNamespace({ ...installed, module: 'zod/v4' })).toBe(false)
  })

  it('lets a route module run only zod schema construction when it loads: no parse, config or value zod reads (finding 112, harness vq-travas-r4)', () => {
    const loaded = (prelude: string) => `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { z } from 'zod'
      import { Errors } from '@/tests/security/fixtures/probe-wiper'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      ${prelude}
      export async function GET(request: Request) {
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json(await prisma.user.findMany())
      }`
    const wipe = '() => prisma.user.deleteMany()'
    // With zod 4.6.5 each one runs deleteMany (or installs a callback a later parse runs) when the module loads.
    for (const prelude of [
      `const wipe = z.string().transform(${wipe}).parse('go')`,
      `const Wipe = z.string().refine(() => { void prisma.user.deleteMany(); return true })\nconst ran = Wipe.safeParse('go')`,
      `const wipe = z.preprocess(${wipe}, z.any()).parseAsync(1)`,
      `const wipe = z.string().transform(${wipe}).safeParseAsync('go')`,
      `const wipe = z.string().transform(${wipe}).spa('go')`,
      `const wipe = z.string().transform(${wipe}).decode('go')`,
      'const wipe = z.object({ user: z.any() }).parse(prisma)',
      `const wipe = z.coerce.number().transform(${wipe}).parse('1')`,
      `const configured = z.config({ customError: ${wipe} })`,
      `const configured = z.core.config({ customError: ${wipe} })`,
      `const schema = z.toJSONSchema(z.object({ at: z.string().default(${wipe}) }))`,
      // outside the builders, even when nothing runs yet
      `const Wipe = z.string().superRefine(${wipe})`,
      `const Wipe = z.string().check(${wipe})`,
      `const Wipe = z.lazy(${wipe})`,
      `const Wipe = z.custom(${wipe})`,
      "const Named = z.string().meta({ id: 'x' })",
      // the zod namespace is the only root, and only ZOD_NAMESPACES lead to a builder
      "import { coerce } from 'zod'\nconst Count = coerce.number()",
      'const Hooked = z.globalRegistry.optional()',
      // zod reads what it receives as it builds (check params, enum values) or first parses (a shape)
      'const Label = z.string(Errors)',
      'const Short = z.string().min(1, Errors)',
      'const Status = z.enum(Errors)',
      'const Shape = z.object({ user: prisma })',
    ])
      expect
        .soft(reasons(admin, loaded(prelude))[0], prelude)
        .toMatch(/^the module runs .* when it loads/)
    // Controls: the load-time zod of the real routes (a callback given to a builder runs only when a handler parses).
    for (const prelude of [
      'const postalCode = z.string().transform((value) => value.trim()).pipe(z.string().regex(/^[0-9]{8}$/))\nconst Input = z.object({ from: z.object({ postal_code: postalCode }), quantity: z.number().int().positive().max(10).default(1), value: z.number().nonnegative().optional() }).strict()',
      'const providerNumber = z.union([z.number(), z.string()]).transform(Number).pipe(z.number().finite().nonnegative())\nconst Option = z.object({ price: providerNumber, days: providerNumber.pipe(z.number().int()).optional() })',
      "const TAX_REGIMES = ['SIMPLES', 'LUCRO_REAL'] as const\nconst Settings = z.object({ regime: z.enum(TAX_REGIMES).optional(), rate: z.number().min(0).max(100).nullable().optional() })",
      "const Dates = z.object({ due: z.coerce.date(), at: z.union([z.iso.date(), z.iso.datetime({ offset: true })]), amount: z.coerce.number().refine((value) => value > 0, { error: 'x' }) })",
      'const Meta = z.record(z.string(), z.unknown()).or(z.literal(true)).or(z.boolean()).or(z.array(z.string().trim().min(1)))',
    ])
      expect.soft(reasons(admin, loaded(prelude)), prelude).toEqual(['ok'])
    // The verifier's case, as written.
    expect(
      reasons(
        admin,
        `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { z } from 'zod'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      const wipe = z.string().transform(() => prisma.user.deleteMany()).parse('go')
      export async function GET(request: Request) {
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json(await prisma.user.findMany())
      }`
      )[0]
    ).toMatch(/^the module runs .* when it loads/)
  })

  it('hands zod a function only as the callback of ZOD_CALLBACKS and extends only a known class when the module loads (finding 112, verifier vrf-ft-111-112)', () => {
    const loaded = (prelude: string) => `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { z } from 'zod'
      import { Wiper, Errors } from '@/tests/security/fixtures/probe-wiper'
      import * as lib from '@/tests/security/fixtures/probe-wiper'
      import { CatalogError } from '@/packages/backend/src/modules/catalog/errors'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      ${prelude}
      export async function GET(request: Request) {
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json(await prisma.user.findMany())
      }`
    const wipe = '() => prisma.user.deleteMany()'
    const hooked = (fn: string) =>
      `{ checks: [{ _zod: { onattach: [${fn}] } }] }`
    // zod 4.6.5 spreads a builder's params into the schema's definition and runs every check's onattach as it
    // builds: each of these ran deleteMany when the module loaded (zodattach.mjs, rt/run.mjs of the verifier).
    for (const prelude of [
      `const Wipe = z.string(${hooked(wipe)})`,
      `const Wipe = z.object({}, ${hooked(wipe)})`,
      `const wipe = ${wipe}\nconst Wipe = z.string(${hooked('wipe')})`,
      `const Wipe = z.number(${hooked('function () { return prisma.user.deleteMany() }')})`,
      `const Wipe = z.coerce.number(${hooked(wipe)})`,
      `const S = z.object({ a: z.string(${hooked(wipe)}) })`,
      `const Wipe = z.iso.datetime(${hooked(wipe)})`,
      `const Wipe = z.enum(['a'], ${hooked(wipe)})`,
      `const Wipe = z.string().min(1, ${hooked(wipe)})`,
      `const Wipe = z.string(${hooked('Number')})`,
      'const Wipe = z.string({ checks: [{ _zod: { onattach() { return 1 } } }] })',
      // a function anywhere but the callback of ZOD_CALLBACKS
      `const Wipe = z.string().refine((value) => value.length > 0, { error: ${wipe} })`,
      `const Wipe = z.string().min(1, ${wipe})`,
      `const Wipe = z.string().default(${wipe})`,
      `const Wipe = z.object({ user: ${wipe} })`,
      `const Wipe = z.string().transform(Number, ${wipe})`,
      // `extends` reads the import and its prototype as the class is defined (heritage.mjs: a Proxy trap ran).
      'class Local extends Wiper {}',
      'class Local extends Errors.Validation {}',
      'class Local extends lib.Wiper {}',
      'class Local extends (Wiper as any) {}',
      'const Base = Wiper\nclass Local extends Base {}',
    ])
      expect
        .soft(reasons(admin, loaded(prelude))[0], prelude)
        .toMatch(/^the module runs .* when it loads/)
    // The verifier's case, as written (it type-checks against zod's own types, no `any`).
    expect(
      reasons(
        admin,
        `
import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
import { z } from 'zod'
import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
const Wipe = z.string({ checks: [{ _zod: { def: { check: 'custom' }, check: () => undefined, onattach: [() => void prisma.user.deleteMany()] } }] })
export async function GET(request: Request) {
  const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
  if (!auth.ok) return Response.json({}, { status: 403 })
  return Response.json(await prisma.user.findMany())
}
`
      )[0]
    ).toMatch(/^the module runs .* when it loads/)
    // Controls: the callbacks the real routes keep for parse time, and the classes they may extend.
    for (const prelude of [
      "const Trimmed = z.string().transform((value) => value.trim()).refine((value) => value.length > 0, { error: 'x' })",
      'const Count = z.union([z.number(), z.string()]).transform(Number)',
      'function normalize(value: string) { return value.trim() }\nconst Name = z.string().transform(normalize)',
      "const check = (value: number) => value > 0\nconst Amount = z.coerce.number().refine(check, { error: 'x', path: ['amount'] })",
      'const Keep = z.transform((value: unknown) => String(value))',
      'class LocalError extends Error {}',
      'class Base {}\nclass Local extends Base {}',
      'class Local extends CatalogError {}',
      'class Local extends z.ZodError {}',
    ])
      expect.soft(reasons(admin, loaded(prelude)), prelude).toEqual(['ok'])
  })

  it('reads every node of the top-level statements under a closed grammar: pattern keys, defaults and sources, decorators and members (finding 124, verifier vrf3-ft-111-112)', () => {
    const loaded = (prelude: string) => `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { z } from 'zod'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      ${prelude}
      export async function GET(request: Request) {
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json({})
      }`
    const wipe =
      'z.string().transform((value) => { void prisma.user.deleteMany().then(() => undefined); return value })'
    const refused = [
      // The verifier's cases (pB2.mts, casesB.mjs): a default of a binding pattern runs when the module loads, and
      // with zod 4.6.5 each of these ran deleteMany then (runB.mjs).
      `const { parsed = ${wipe}.parse('go') } = {}`,
      "const [checked = z.string().refine(() => { void prisma.user.deleteMany().then(() => undefined); return true }).safeParse('go')] = []",
      "const { pending = z.string().transform(async (value) => { await prisma.user.deleteMany(); return value }).parseAsync('go') } = {}",
      `const { a: { b = ${wipe}.parse('go') } = {} } = {}`,
      // A computed key of a pattern runs too; a pattern reads (or iterates) what it destructures.
      'const { [String(prisma.user.deleteMany())]: key } = {}',
      "const { ['k']: key } = {}",
      'const { constructor: Base } = {}',
      'const { user } = prisma',
      "const [first] = new Set(['a'])",
      'const handlers = { a: 1 }\nlet source = handlers\nconst { a } = source',
      // `using` disposes when the module ends, a namespace runs its body, a class its decorators (of the class, a
      // member or a parameter), static code and computed names.
      'using lease = null as never',
      'namespace Boot { void prisma.user.deleteMany() }',
      'function tag(..._args: unknown[]) {}\n@tag class Tagged {}',
      'function tag(..._args: unknown[]) {}\nclass Tagged { @tag method() {} }',
      'function tag(..._args: unknown[]) {}\nclass Tagged { method(@tag value: string) { return value } }',
      'function tag(..._args: unknown[]) {}\nclass Tagged { constructor(@tag readonly value: string) {} }',
      'class Tagged { static { void prisma.user.deleteMany() } }',
      'class Tagged { static count = prisma.user.deleteMany() }',
      'class Tagged { static accessor count = prisma.user.deleteMany() }',
      'class Tagged { [String(prisma.user.deleteMany())]() {} }',
      'enum Kind { A = String(prisma.user.deleteMany()) }',
      'export default prisma.user.deleteMany()',
      "import boot = require('@/tests/security/fixtures/authorization-scanner-data')",
      "import '@/tests/security/fixtures/authorization-scanner-data'",
    ]
    for (const prelude of refused)
      expect
        .soft(reasons(admin, loaded(prelude))[0], prelude)
        .toMatch(/^the module runs .* when it loads/)
    // Controls: patterns over literal data or a same-file record, defaults of data or zod construction, and
    // classes, enums and ambient forms that run nothing where they are defined.
    for (const prelude of [
      "const { a = 'x', b: [c = 1] = [] } = { a: undefined, b: [2] }",
      "const [first = 'a', , ...rest] = ['b', 'c', 'd']",
      'const handlers = { a: 1, b: 2 }\nconst { a: renamed, ...others } = handlers',
      'const { Shape = z.object({ name: z.string().min(1) }) } = {}',
      "class Box { #value = 1; count = 0; static label(): string { return 'box' } constructor(readonly size: number) {} get value() { return this.#value } set value(next: number) { this.#value = next } }",
      "enum Kind { A = 'a', B = 'b' }",
      'declare namespace Ambient { const x: number }',
      'let counter = 0\nexport { counter }',
    ])
      expect.soft(reasons(admin, loaded(prelude)), prelude).toEqual(['ok'])
  })

  it('refuses a specifier that names more than one file, in a route and in the whole server source (finding 123, scenario B, verifier pC)', () => {
    const route = `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { CatalogError } from '@/packages/backend/src/modules/catalog/errors'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      export async function POST(request: Request) {
        if (request instanceof CatalogError) return Response.json({}, { status: 400 })
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json({ ok: await prisma.user.count() })
      }`
    const shadow =
      "import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'\nexport class CatalogError extends Error {\n  static [Symbol.hasInstance]() { void prisma.user.deleteMany(); return false }\n}\n"
    // Control: packages/backend/src/modules/catalog/errors.ts alone is the listed module.
    expect(reasons(admin, route)).toEqual(['ok'])
    const scripts = serverSource('', /\.(?:[cm]?[jt]sx?|json)$/)
    // Turbopack loads errors.tsx before errors.ts, webpack errors.js: whichever synthetic sibling sits beside it,
    // the route fails naming both, the id of the listed module fails, and so does the scan of the server source.
    for (const file of [
      'packages/backend/src/modules/catalog/errors.tsx',
      'packages/backend/src/modules/catalog/errors.js',
      'packages/backend/src/modules/catalog/errors.jsx',
      'packages/backend/src/modules/catalog/errors.mjs',
      'packages/backend/src/modules/catalog/errors.cjs',
      'packages/backend/src/modules/catalog/errors/index.ts',
      'packages/backend/src/modules/catalog/errors/index.js',
    ]) {
      FIXTURE_FILES.set(path.join(ROOT, file), shadow)
      try {
        expect
          .soft(reasons(admin, route), file)
          .toEqual([
            `ambiguous module: '@/packages/backend/src/modules/catalog/errors' from ${admin} names packages/backend/src/modules/catalog/errors.ts, ${file} (Next and TypeScript may load different files: keep one)`,
          ])
        expect
          .soft(
            () => moduleFile('packages/backend/src/modules/catalog/errors'),
            file
          )
          .toThrow(AmbiguousModule)
        expect
          .soft(moduleIdCollisions([...scripts, file]), file)
          .toEqual([
            `packages/backend/src/modules/catalog/errors: packages/backend/src/modules/catalog/errors.ts, ${file}`,
          ])
      } finally {
        FIXTURE_FILES.delete(path.join(ROOT, file))
      }
    }
    // Control: every resolver tries `.json` after the scripts, so the synthetic errors.json beside errors.ts changes nothing
    // (as packages/contracts/src/platform.json beside platform.ts).
    FIXTURE_FILES.set(
      path.join(ROOT, 'packages/backend/src/modules/catalog/errors.json'),
      '{}'
    )
    try {
      expect(reasons(admin, route)).toEqual(['ok'])
      expect(
        moduleIdCollisions([
          ...scripts,
          'packages/backend/src/modules/catalog/errors.json',
        ])
      ).toEqual([])
    } finally {
      FIXTURE_FILES.delete(
        path.join(ROOT, 'packages/backend/src/modules/catalog/errors.json')
      )
    }
    // The module a handler is re-exported from counts as the route itself.
    FIXTURE_FILES.set(
      path.join(ROOT, 'packages/backend/src/modules/catalog/errors.tsx'),
      shadow
    )
    FIXTURE_FILES.set(
      path.join(ROOT, 'tests/security/fixtures/probe-handler.ts'),
      route
    )
    try {
      expect(
        reasons(
          admin,
          "export { POST } from '@/tests/security/fixtures/probe-handler'"
        )
      ).toEqual([
        "ambiguous module: '@/packages/backend/src/modules/catalog/errors' from tests/security/fixtures/probe-handler.ts names packages/backend/src/modules/catalog/errors.ts, packages/backend/src/modules/catalog/errors.tsx (Next and TypeScript may load different files: keep one)",
      ])
    } finally {
      FIXTURE_FILES.delete(
        path.join(ROOT, 'packages/backend/src/modules/catalog/errors.tsx')
      )
      FIXTURE_FILES.delete(
        path.join(ROOT, 'tests/security/fixtures/probe-handler.ts')
      )
    }
    expect(
      reasons(
        admin,
        "export { POST } from '@/tests/security/fixtures/probe-handler'"
      )
    ).toEqual([UNRESOLVED])
    // The server source: every id names one file.
    expect(moduleIdCollisions(scripts)).toEqual([])
  })

  it('checks the webhook handshake: the lookup only in its namespace, then INERT statements, then the verify token', () => {
    const source = (window: string) => `
      import { NextResponse } from 'next/server'
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { secretsMatch } from '@gb-locacoes/backend/identity'
      import { resolveWebhookIntegration } from '@/apps/services/api/src/host/webhook-authentication'
      export async function GET(request: Request, route?: { params: Promise<{ integrationId: string }> }) {
        if (!route) return NextResponse.json({ error: 'Gone' }, { status: 410 })
        const resolved = await resolveWebhookIntegration('WHATSAPP', route)
        if (!resolved?.credential.verifyToken) return NextResponse.json({}, { status: 503 })
        ${window}
        return new NextResponse('ok')
      }`
    const verify =
      "const token = new URL(request.url).searchParams.get('hub.verify_token')\nif (!secretsMatch(token, resolved.credential.verifyToken)) return NextResponse.json({}, { status: 403 })"
    expect(
      reasons(
        'apps/services/api/src/app/api/webhooks/new-hook/route.ts',
        source(verify)
      )
    ).toEqual(['ok'])
    expect(
      reasons(
        'apps/services/api/src/app/api/admin/new-hook/route.ts',
        source(verify)
      )
    ).toEqual(['resolveWebhookIntegration does not authorize this namespace'])
    // Without the comparison nothing authorizes what follows the lookup.
    expect(
      reasons(
        'apps/services/api/src/app/api/webhooks/new-hook/route.ts',
        source('')
      )[0]
    ).toMatch(BEFORE)
    expect(
      reasons(
        'apps/services/api/src/app/api/webhooks/new-hook/route.ts',
        source(`await prisma.tenantIntegration.findMany()\n${verify}`)
      )[0]
    ).toMatch(BEFORE)
  })

  it('keeps the service Meta handshake in the same closed grammar and paired bindings', () => {
    const route =
      'apps/services/api/src/app/api/webhooks/whatsapp/[integrationId]/route.ts'
    const source = fs.readFileSync(path.join(ROOT, route), 'utf8')
    expect(reasons(route, source)).toEqual(['ok', 'ok'])
    for (const changed of [
      source.replace(
        'if (!secretsMatch(token, resolved.credential.verifyToken))',
        'if (false)'
      ),
      source.replace(
        'const resolved = await resolveWebhookIntegration',
        "await fetch('https://example.test')\nconst resolved = await resolveWebhookIntegration"
      ),
      source.replace(
        "return NextResponse.json({ error: 'Invalid verify token' }, { status: 403 })",
        "NextResponse.json({ error: 'Invalid verify token' }, { status: 403 })"
      ),
      source.replace(
        "from '@gb-locacoes/backend/identity'",
        "from '@/apps/services/api/src/host/tenant-cron'"
      ),
    ]) {
      expect(changed).not.toBe(source)
      expect(reasons(route, changed).some((reason) => reason !== 'ok')).toBe(
        true
      )
    }
    expect(
      reasons(
        'apps/services/api/src/app/api/admin/probe/route.ts',
        source
      ).some((reason) => reason !== 'ok')
    ).toBe(true)
  })

  it('lets a CLIENT through as the owner only in the routes that name it', () => {
    expect(
      inventory
        .filter((endpoint) => endpoint.verdict.ok && endpoint.verdict.owner)
        .map(key)
    ).toEqual([
      'apps/services/api/src/app/api/admin/clients/[id]/documents/route.ts#GET',
    ])
  })

  it('keeps OWNER_SCOPED, LOAD_TIME_FACTORIES and HANDLER_WRAPPERS in sync with their source', () => {
    for (const entry of OWNER_SCOPED) {
      expect(ownerScopedProblems(entry), entry.name).toEqual([])
      // The route-facing binding still exports it.
      const file = resolveModule(
        path.join(ROOT, 'package.json'),
        `@/${entry.module}`
      )
      expect(
        file && exportSurface(parseModule(file)).names.has(entry.name),
        entry.name
      ).toBe(true)
    }
    for (const entry of LOAD_TIME_FACTORIES) {
      expect(factoryProblems(entry), entry.name).toEqual([])
      const index = moduleFile(entry.module)
      expect(index, entry.module).toBeDefined()
      expect(
        exportSurface(parseModule(index!)).names.has(entry.name),
        entry.name
      ).toBe(true)
    }
    for (const entry of HANDLER_WRAPPERS) {
      expect(wrapperProblems(entry), entry.name).toEqual([])
      expect(wrapperRefusalProblems(entry.refusal), entry.name).toEqual([])
    }
    // Each check fails once the source drifts (in-memory mutation).
    const [documents] = OWNER_SCOPED
    const documentsSource = fs.readFileSync(
      path.join(ROOT, documents!.source),
      'utf8'
    )
    for (const [label, pattern, replacement] of [
      [
        'refusal removed',
        /if \(\s*!\['ADMIN', 'OPERATOR'\]\.includes\(principal\.role\) &&\s*!\(principal\.role === 'CLIENT' && principal\.userId === userId\)\s*\)\s*throw new CustomerError\('Acesso negado', 403\)/,
        '',
      ],
      [
        'owner dropped from a filter',
        /where: \{ tenantId: principal\.tenantId, userId \}/,
        'where: { tenantId: principal.tenantId }',
      ],
      [
        'owner under an operator',
        /where: \{ tenantId: principal\.tenantId, userId \}/,
        'where: { tenantId: principal.tenantId, tenantId_userId: { not: userId } }',
      ],
    ] as const) {
      const mutated = documentsSource.replace(pattern, replacement)
      expect(mutated, label).not.toBe(documentsSource)
      expect(ownerScopedProblems(documents!, mutated), label).not.toEqual([])
    }
    const enrollment = LOAD_TIME_FACTORIES.find(
      (entry) => entry.name === 'createCustomerEnrollmentService'
    )
    const enrollmentSource = fs.readFileSync(
      path.join(ROOT, enrollment!.source),
      'utf8'
    )
    const eager = enrollmentSource.replace(
      /(export function createCustomerEnrollmentService\(\{[\s\S]*?\) \{\r?\n)/,
      "$1  void withTenantTransaction({ tenantId: 'x' }, (tx) => tx.organization.count())\n"
    )
    expect(eager).not.toBe(enrollmentSource)
    expect(factoryProblems(enrollment!, eager)).toEqual([
      "createCustomerEnrollmentService runs withTenantTransaction({ tenantId: 'x' }, (tx) => tx.organization.count()) when called",
    ])
    const reading = enrollmentSource.replace(
      /(export function createCustomerEnrollmentService\(\{[\s\S]*?\) \{\r?\n)/,
      '$1  const early = globalThis\n  void early\n'
    )
    expect(reading).not.toBe(enrollmentSource)
    expect(factoryProblems(enrollment!, reading)).toEqual([
      'createCustomerEnrollmentService reads globalThis when called',
    ])
    const [wrapper] = HANDLER_WRAPPERS
    const wrapperSource = fs.readFileSync(
      path.join(ROOT, wrapper!.source),
      'utf8'
    )
    for (const [label, pattern, replacement] of [
      [
        'post-processing before the handler',
        /signInAvailability\(await handler\(request, context\)\)/,
        'signInAvailability(await handler(request, context), await prisma.user.count())',
      ],
      [
        'another handler',
        /await handler\(request, context\)/,
        'await other(request, context)',
      ],
      // Wave 133 (finding 149): the NextAuth reads refuse an explicit foreign Origin before the engine.
      ['refusal removed', /refuseNextAuthRead\(request\) \?\?\s*/, ''],
      [
        'refusal on a synthetic request',
        /refuseNextAuthRead\(request\)/,
        "refuseNextAuthRead(new Request('https://fixture.test'))",
      ],
      [
        'refusal after the engine',
        /refuseNextAuthRead\(request\) \?\?\s*signInAvailability\(await handler\(request, context\)\)/,
        'signInAvailability(await handler(request, context)) ?? refuseNextAuthRead(request)',
      ],
      [
        'refusal result discarded',
        /refuseNextAuthRead\(request\) \?\?/,
        '(void refuseNextAuthRead(request)) ??',
      ],
      [
        'another refusal',
        /refuseNextAuthRead\(request\) \?\?/,
        'refuseBetterAuthRead(request, process.env) ??',
      ],
      [
        'refusal with the context',
        /refuseNextAuthRead\(request\)/,
        'refuseNextAuthRead(context as unknown as Request)',
      ],
      [
        'or instead of nullish',
        /refuseNextAuthRead\(request\) \?\?/,
        'refuseNextAuthRead(request) ||',
      ],
    ] as const) {
      const mutated = wrapperSource.replace(pattern, replacement)
      expect(mutated, label).not.toBe(wrapperSource)
      expect(wrapperProblems(wrapper!, mutated), label).not.toEqual([])
    }
    const refusalSource = fs.readFileSync(
      path.join(ROOT, wrapper!.refusal.source),
      'utf8'
    )
    for (const [label, pattern, replacement] of [
      [
        'data before the engine',
        /return refuseEngineRead\(\s*request,\s*env,\s*NEXTAUTH_BASE_PATH,\s*NEXTAUTH_NAVIGATIONS\s*\)/,
        "void globalThis.fetch('https://fixture.test')\n  return refuseEngineRead(request, env, NEXTAUTH_BASE_PATH, NEXTAUTH_NAVIGATIONS)",
      ],
      [
        'another import',
        /return rejectExplicitCrossOrigin\(request, env\)/,
        'return identityBasePath(env) ? rejectExplicitCrossOrigin(request, env) : null',
      ],
      [
        'refusal no longer refuses',
        /return rejectExplicitCrossOrigin\(request, env\)/,
        'return null',
      ],
    ] as const) {
      const mutated = refusalSource.replace(pattern, replacement)
      expect(mutated, label).not.toBe(refusalSource)
      expect(
        wrapperRefusalProblems(wrapper!.refusal, mutated),
        label
      ).not.toEqual([])
    }
  })

  it('traces the actual selection closure and rejects rewired session ports, early effects and removed CSRF refusals', () => {
    const routes = SELECTION_FACADES.map(
      (_facade) =>
        'apps/services/api/src/app/api/auth/organizations/selection/route.ts'
    )
    const policy = fs.readFileSync(path.join(ROOT, SELECTION_SOURCE), 'utf8')
    for (const facade of SELECTION_FACADES) {
      const closed = selectionClosure({
        module: facade.module,
        name: 'organizationSelection',
        file: path.join(ROOT, `${facade.module}.ts`),
      })
      expect(closed?.info.imports.get('reply')?.module, facade.module).toBe(
        'packages/backend/src/http/organization-selection'
      )
    }
    for (const route of routes) {
      const endpoints = analyzeRouteModule(path.join(ROOT, route))
      expect(
        endpoints.map((endpoint) => endpoint.verdict.ok),
        route
      ).toEqual([true, true, true])
      expect(
        endpoints
          .filter((endpoint) => endpoint.csrf)
          .every((endpoint) => endpoint.csrf!.ok),
        route
      ).toBe(true)
    }
    for (const [from, to, csrfOnly] of [
      [
        'const session = await getServerSession()',
        "const session = { user: { id: 'forged' } }",
        false,
      ],
      [
        'const session = await getServerSession()',
        "await membership('forged', 'foreign')\n      const session = await getServerSession()",
        false,
      ],
      ["method !== 'GET' && !isTrustedMutationOrigin(request)", 'false', true],
      ['if (!session?.user?.id)', 'if (false)', false],
    ] as const) {
      const changed = policy.replace(from, to)
      expect(changed).not.toBe(policy)
      FIXTURE_FILES.set(path.join(ROOT, SELECTION_SOURCE), changed)
      try {
        for (const route of routes) {
          const endpoints = analyzeRouteModule(path.join(ROOT, route))
          expect(
            endpoints.some((endpoint) =>
              csrfOnly
                ? endpoint.csrf && !endpoint.csrf.ok
                : !endpoint.verdict.ok
            ),
            `${route}: ${from}`
          ).toBe(true)
        }
      } finally {
        FIXTURE_FILES.delete(path.join(ROOT, SELECTION_SOURCE))
      }
    }
    for (const facade of SELECTION_FACADES) {
      const file = path.join(ROOT, `${facade.module}.ts`)
      const source = fs.readFileSync(file, 'utf8')
      const changed = source.replace(
        '  getServerSession,',
        "  getServerSession: async () => ({ user: { id: 'forged' } }),"
      )
      expect(changed).not.toBe(source)
      FIXTURE_FILES.set(file, changed)
      try {
        const route = routes[SELECTION_FACADES.indexOf(facade)]!
        expect(
          analyzeRouteModule(path.join(ROOT, route)).every(
            (endpoint) => !endpoint.verdict.ok
          ),
          facade.module
        ).toBe(true)
      } finally {
        FIXTURE_FILES.delete(file)
      }
    }
  })

  it('pins the shared asset factory and login response wrapper to their real exports and rejects hidden I/O', () => {
    const file = moduleFile('@gb-locacoes/backend/http')!
    for (const [name, source] of [
      ['createDreiAssetProxy', 'packages/backend/src/http/drei-assets.ts'],
      [
        'withSignInAvailability',
        'packages/backend/src/http/legacy-auth-response.ts',
      ],
    ] as const) {
      const target = exportedNode(parseModule(file), name)
      expect(target, name).not.toBeNull()
      expect(relative(target!.info.file), name).toBe(source)
    }
    const asset = declaredFunction(
      'packages/backend/src/http/drei-assets.ts',
      'createDreiAssetProxy'
    )!
    expect([...reach(asset.info, asset.node).references]).toEqual([])
    const source = fs.readFileSync(
      path.join(ROOT, 'packages/backend/src/http/drei-assets.ts'),
      'utf8'
    )
    const changed = source.replace(
      'const response = await fetch(githubUrl, {',
      'const response = await globalThis.fetch(githubUrl, {'
    )
    expect(changed).not.toBe(source)
    const hidden = declaredFunction(
      'packages/backend/src/http/drei-assets.ts',
      'createDreiAssetProxy',
      changed
    )!
    expect([...reach(hidden.info, hidden.node).references]).not.toEqual([])
    const nextAuth = parseModule(
      path.join(
        ROOT,
        'apps/services/api/src/app/api/auth/[...nextauth]/route.ts'
      )
    )
    // Follow the host's real public-package import to the approved wrapper,
    // not an unrelated function with the approved facade name.
    const binding = nextAuth.imports.get('withSignInAvailability')
    const publicFile = binding && moduleFile(binding.module)
    const wrapper =
      binding && publicFile
        ? exportedNode(parseModule(publicFile), binding.name)
        : undefined
    expect(binding?.module).toBe('@gb-locacoes/backend/http')
    expect(binding?.name).toBe('withSignInAvailability')
    expect(wrapper?.node).toBeDefined()
    expect(relative(wrapper!.info.file)).toBe(
      HANDLER_WRAPPERS.find(
        (entry) =>
          entry.module === binding?.module && entry.name === binding?.name
      )?.source
    )
  })

  it('keeps the new quote transports guarded and refuses unvalidated tenant or limiter rewiring', () => {
    const route = 'apps/services/api/src/app/api/quotes/route.ts'
    const text = fs.readFileSync(path.join(ROOT, route), 'utf8')
    expect(reasons(route, text)).toEqual(['ok', 'ok'])
    for (const [from, to] of [
      [
        'if (!tenant.ok) return tenant.response',
        'if (false) return tenant.response',
      ],
      [
        'checkRateLimit(request, strictRateLimit)',
        'checkRateLimit(request, unknownLimiter)',
      ],
    ]) {
      const changed = text.replace(from!, to!)
      expect(changed).not.toBe(text)
      expect(reasons(route, changed).some((value) => value !== 'ok')).toBe(true)
    }
    const admin = 'apps/services/api/src/app/api/admin/quotes/[id]/route.ts'
    const adminText = fs.readFileSync(path.join(ROOT, admin), 'utf8')
    expect(reasons(admin, adminText)).toEqual(['ok', 'ok', 'ok'])
    const changed = adminText.replace(
      'instanceof QuoteUpdateRejected',
      'instanceof UnapprovedFailure'
    )
    expect(changed).not.toBe(adminText)
    expect(reasons(admin, changed).some((value) => value !== 'ok')).toBe(true)
  })

  it('rejects memory facade rewiring and any I/O inside the shared pre-auth limiter', () => {
    for (const module of MEMORY_FACADES) {
      const file = `${module}.ts`
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8')
      for (const [from, to] of [
        ['clientIp: clientIpFromHeaders', "clientIp: () => 'anonymous'"],
        ['createMemoryRateLimiters<NextRequest>', 'otherFactory<NextRequest>'],
        ['memoryLimiters.checkRateLimit', '() => ({ allowed: true })'],
        ['memoryLimiters.adminApiRateLimit', 'memoryLimiters.strictRateLimit'],
        ['memoryLimiters.strictRateLimit', 'memoryLimiters.adminApiRateLimit'],
      ]) {
        const changed = text.replace(from!, to!)
        expect(changed).not.toBe(text)
        expect(memoryFacadeProblem(module, { [file]: changed })).toBeDefined()
      }
    }
    const text = fs.readFileSync(path.join(ROOT, MEMORY_SOURCE), 'utf8')
    for (const [from, to] of [
      ['const result = limiter(request)', 'const result = prisma.user.count()'],
      [
        'const result = limiter(request)',
        "const result = limiter(new Request('https://fixture.test'))",
      ],
      [
        'const result = limiter(request)',
        'fetch("https://fixture.test")\n    const result = limiter(request)',
      ],
      [
        'const result = limiter(request)',
        'const leaked = globalThis\n    const result = limiter(request)',
      ],
      ['new MemoryRateLimitStore(maxEntries)', 'store'],
      ['maxRequests: 200', 'maxRequests: 200, keyGenerator: () => "all"'],
    ]) {
      const changed = text.replace(from!, to!)
      expect(changed).not.toBe(text)
      expect(memorySourceProblem(changed)).toBeDefined()
    }
    const route = 'apps/services/api/src/app/api/admin/equipments/route.ts'
    const routeText = fs.readFileSync(path.join(ROOT, route), 'utf8')
    expect(reasons(route, routeText)).toEqual(['ok', 'ok'])
    for (const [from, to] of [
      [
        'if (!rateLimitResult.allowed) return rateLimitResult.response!',
        'if (!rateLimitResult.allowed) console.log("limited")',
      ],
      [
        'checkRateLimit(request, adminApiRateLimit)',
        'checkRateLimit(new Request(request.url), adminApiRateLimit)',
      ],
      [
        'checkRateLimit(request, adminApiRateLimit)',
        'checkRateLimit(request, unknownLimiter)',
      ],
    ] as const) {
      for (const target of [0, 1]) {
        let occurrence = 0
        const changed = routeText.replaceAll(from, () =>
          occurrence++ === target ? to : from
        )
        expect(occurrence).toBe(2)
        expect(changed).not.toBe(routeText)
        const outcomes = reasons(route, changed)
        expect(outcomes).toHaveLength(2)
        expect(outcomes.filter((reason) => reason === 'ok')).toHaveLength(1)
        expect(outcomes.filter((reason) => reason !== 'ok')).toHaveLength(1)
      }
    }
  })

  it('keeps cron facades bound to the shared guard and their own database runner', () => {
    for (const file of CRON_FACADE_FILES) {
      const original = fs.readFileSync(path.join(ROOT, file), 'utf8')
      expect(cronFacadeProblem(file), file).toBeUndefined()
      const wrong = original.includes('return sharedCronAuthorization(request)')
        ? original.replace(
            'return sharedCronAuthorization(request)',
            'return null'
          )
        : original.replace(
            'runner.runTenantCron(request, job, options)',
            'job({tenantId: "foreign"}, {deadline: Infinity, minRemainingMs: 0})'
          )
      expect(wrong, file).not.toBe(original)
      expect(cronFacadeProblem(file, wrong), file).toBeDefined()
      if (!file.endsWith('external-request-auth.ts')) {
        const wrongDatabase = original.replace(
          file.startsWith('apps/')
            ? 'getDatabaseRuntime().prisma'
            : '() => prisma',
          file.startsWith('apps/') ? 'foreignPrisma' : '() => foreignPrisma'
        )
        expect(wrongDatabase, file).not.toBe(original)
        expect(cronFacadeProblem(file, wrongDatabase), file).toBeDefined()
      }
    }
  })

  it('keeps MEMORY_LIMITERS, INERT_IMPORTS and the guard callbacks in sync with their source', () => {
    for (const module of MEMORY_FACADES)
      expect(memoryFacadeProblem(module), module).toBeUndefined()
    // A guard with callbacks authorizes before anything else: it follows the rule itself.
    for (const guard of GUARDS.filter((entry) => entry.callbacks?.length)) {
      const file = resolveModule(
        path.join(ROOT, 'package.json'),
        `@/${guard.module}`
      )!
      const cron = CRON_FACADE_FILES.includes(
        relative(file) as (typeof CRON_FACADE_FILES)[number]
      )
      if (cron)
        expect(cronFacadeProblem(relative(file)), guard.module).toBeUndefined()
      const located = cron
        ? sharedTenantCronFunction()
        : helperFunction(relative(file), guard.name)
      const outcome = checkFunction(
        located.info,
        located.node,
        'apps/services/api/src/app/api/cron/any/route.ts'
      )
      expect(outcome, guard.name).toMatchObject({ ok: true })
    }
    // Every INERT_IMPORTS module resolves and still exports each name listed (a renamed module or a removed
    // function would leave an exception without object in the list: it must be noticed and dropped).
    for (const entry of INERT_IMPORTS) {
      const file = moduleFile(entry.module)
      expect(file, entry.module).toBeDefined()
      const info = parseModule(file!)
      for (const name of entry.names)
        expect(
          exportedNode(info, name),
          `${entry.module} exports ${name}`
        ).not.toBeNull()
    }
  })

  it('checks the moved organization/OAuth response/cookie helpers with the same INERT grammar', () => {
    for (const entry of [
      {
        module: 'packages/backend/src/http/organization-selection',
        name: 'organizationSelectionResponse',
        source: 'packages/backend/src/http/organization-selection.ts',
      },
      {
        module: '@gb-locacoes/backend/http',
        name: 'organizationCurrentResponse',
        source: 'packages/backend/src/http/organization-current.ts',
      },
      {
        module: '@gb-locacoes/backend/http',
        name: 'zohoOAuthAuthorizationFailure',
        source: 'packages/backend/src/http/zoho-oauth-response.ts',
      },
      {
        module: IDENTITY_MODULE,
        name: 'selectedTenantPreferenceCookie',
        source: 'packages/backend/src/modules/identity/tenant-preference.ts',
      },
    ]) {
      const check = (text?: string) => {
        const located = helperFunction(entry.source, entry.name, text)
        const env: Env = {
          info: located.info,
          route: entry.source,
          params: new Set(),
          contexts: new Set(),
          routeParams: new Set(),
          allowed: new Set(located.node.parameters),
          literals: new Map(),
          depth: 0,
        }
        return inertProblem(located.node, env)
      }
      const file = moduleFile(entry.module)
      expect(file).toBeDefined()
      const exported = bindingNode({
        module: entry.module,
        name: entry.name,
        file,
      })
      expect(exported).not.toBeNull()
      expect(relative(exported!.info.file)).toBe(entry.source)
      expect(check(), entry.name).toBeUndefined()
      const source = fs.readFileSync(path.join(ROOT, entry.source), 'utf8')
      for (const effect of [
        'fetch("https://example.test")',
        'process.env.SECRET = "changed"',
        'callback()',
      ]) {
        const changed = source
          .replace('  return (', `  ${effect};\n  return (`)
          .replace(
            '  return Response.json',
            `  ${effect};\n  return Response.json`
          )
          .replace(
            '  return redirectError(msg)',
            `  ${effect};\n  return redirectError(msg)`
          )
        expect(changed).not.toBe(source)
        expect(check(changed), `${entry.name}: ${effect}`).not.toBeUndefined()
      }
      if (entry.name === 'selectedTenantPreferenceCookie') {
        const contractFile = path.join(
          ROOT,
          'packages/contracts/src/tenancy.ts'
        )
        const contract = fs.readFileSync(contractFile, 'utf8')
        for (const replacement of [
          'export let TENANT_COOKIE_NAME = "selected-tenant-id";',
          'export const TENANT_COOKIE_NAME = process.env.SECRET;',
          'export const TENANT_COOKIE_NAME = callback();',
        ]) {
          const changed = contract.replace(
            /export const TENANT_COOKIE_NAME[^\n]+/,
            replacement
          )
          expect(changed).not.toBe(contract)
          FIXTURE_FILES.set(contractFile, changed)
          try {
            expect(check(), replacement).not.toBeUndefined()
          } finally {
            FIXTURE_FILES.delete(contractFile)
          }
        }
        expect(check()).toBeUndefined()
      }
    }
  })

  it('keeps INERT_CLASSES in sync: plain error classes their modules export, natives and zod as installed (finding 111)', async () => {
    for (const entry of INERT_CLASSES.filter((item) => item.source))
      expect(
        inertClassProblems(entry),
        `${entry.module}#${entry.name}`
      ).toEqual([])
    // Each check fails once the source drifts (in-memory mutation).
    const catalog = INERT_CLASSES.find(
      (entry) => entry.name === 'CatalogError'
    )!
    const source = fs.readFileSync(path.join(ROOT, catalog.source!), 'utf8')
    const head = 'export class CatalogError extends Error {'
    for (const [label, mutated] of [
      [
        'Symbol.hasInstance',
        source.replace(
          head,
          `${head}\n  static [Symbol.hasInstance]() { return true }`
        ),
      ],
      [
        'static block',
        source.replace(
          head,
          `${head}\n  static { Object.defineProperty(this, Symbol.hasInstance, { value: () => true }) }`
        ),
      ],
      [
        'static member',
        source.replace(head, `${head}\n  static of() { return 1 }`),
      ],
      [
        'another base',
        source.replace(
          head,
          'class Base {}\nexport class CatalogError extends Base {'
        ),
      ],
      [
        'not exported',
        source.replace(head, 'class CatalogError extends Error {'),
      ],
      [
        'written in its file',
        `${source}\nObject.defineProperty(CatalogError, Symbol.hasInstance, { value: () => true })\n`,
      ],
    ] as const) {
      expect(mutated, label).not.toBe(source)
      expect(inertClassProblems(catalog, mutated), label).not.toEqual([])
    }
    // An entry whose distinct canonical module does not export that class.
    expect(
      inertClassProblems({
        ...catalog,
        module: 'packages/backend/src/modules/rentals/errors',
      })
    ).toEqual([
      `packages/backend/src/modules/rentals/errors#CatalogError is not the class of ${catalog.source}`,
    ])
    // The natives keep the Symbol.hasInstance of Function.prototype; `z.ZodError` is a plain property of zod.
    for (const name of INERT_GLOBAL_CLASSES)
      expect(
        Object.getOwnPropertySymbols(
          (globalThis as unknown as Record<string, object>)[name]
        ),
        name
      ).not.toContain(Symbol.hasInstance)
    const zod = await import('zod')
    expect(Object.getOwnPropertyDescriptor(zod.z, 'ZodError')).toMatchObject({
      value: zod.ZodError,
    })
    expect(
      INERT_CLASSES.filter((entry) => !entry.source).map(
        (entry) =>
          `${entry.module}#${entry.name}${entry.member ? `.${entry.member}` : ''}`
      )
    ).toEqual(['zod#ZodError', 'zod#z.ZodError'])
  })

  it('public backend imports resolve the same sealed errors as their distinct canonical sources', () => {
    for (const [name, canonicalModule, publicModule] of [
      [
        'VehicleError',
        'packages/backend/src/modules/operations/vehicles',
        '@gb-locacoes/backend/operations',
      ],
      [
        'PaymentRequestError',
        'packages/backend/src/modules/billing/payment-errors',
        '@gb-locacoes/backend/billing',
      ],
      [
        'RentalMutationError',
        'packages/backend/src/modules/rentals/errors',
        '@gb-locacoes/backend/rentals',
      ],
    ] as const) {
      const canonical = INERT_CLASSES.find(
        (entry) => entry.module === canonicalModule && entry.name === name
      )!
      const shared = INERT_CLASSES.find(
        (entry) => entry.module === publicModule && entry.name === name
      )!
      expect(shared.module).not.toBe(canonical.module)
      expect(exportedClass(shared)).toBe(exportedClass(canonical))
      expect(shared.source).toBe(canonical.source)
      for (const entry of [canonical, shared]) {
        expect(inertClassProblems(entry)).toEqual([])
        const source = fs.readFileSync(path.join(ROOT, entry.source!), 'utf8')
        const head = `export class ${name} extends Error {`
        const poisoned = source.replace(
          head,
          `${head}\n static [Symbol.hasInstance]() { return true }`
        )
        expect(poisoned).not.toBe(source)
        expect(inertClassProblems(entry, poisoned)).not.toEqual([])
        expect(
          inertClassProblems(
            entry,
            `${source}\nObject.defineProperty(${name}, Symbol.hasInstance, { value: () => true })`
          )
        ).not.toEqual([])
      }
    }
  })

  it('NOT_SERVER_PATHS names only folders that exist: an entry without object would keep a recreated folder out of the server scan', () => {
    const missing = [...NOT_SERVER_PATHS].filter(
      (item) => !fs.existsSync(path.join(ROOT, item))
    )
    expect(missing).toEqual([])
  })

  it('the catalog public package exposes the same sealed error as its distinct canonical source', () => {
    const canonical = INERT_CLASSES.find(
      (entry) =>
        entry.module === 'packages/backend/src/modules/catalog/errors' &&
        entry.name === 'CatalogError'
    )!
    const shared = INERT_CLASSES.find(
      (entry) =>
        entry.module === '@gb-locacoes/backend/catalog' &&
        entry.name === 'CatalogError'
    )!
    expect(shared.module).not.toBe(canonical.module)
    expect(exportedClass(shared)).toBe(exportedClass(canonical))
    expect(shared.source).toBe('packages/backend/src/modules/catalog/errors.ts')
    expect(inertClassProblems(shared)).toEqual([])
    const source = fs.readFileSync(path.join(ROOT, shared.source!), 'utf8')
    expect(
      inertClassProblems(
        shared,
        source.replace(
          'export class CatalogError extends Error {',
          'export class CatalogError extends Error {\n static [Symbol.hasInstance]() { return true }'
        )
      )
    ).not.toEqual([])
    const code = `
      import { CatalogError as Failure } from '@gb-locacoes/backend/catalog'
      import { requireTenantPermission } from '../../../../../host/permissions'
      export async function GET(request: Request) {
        Object.defineProperty(Failure, Symbol.hasInstance, { value: () => true })
        const access = await requireTenantPermission(request, 'EQUIPMENTS', 'READ')
        if (!access.ok) return access.response
        return Response.json({})
      }`
    expect(
      sealedClassProblems(
        path.join(
          ROOT,
          'apps/services/api/src/app/api/admin/equipment-units/[id]/route.ts'
        ),
        code
      )
    ).not.toEqual([])
  })

  // Parses every server file (about 1.2 thousand) with TypeScript for the class scan: about 2 s alone, it passed the
  // 5 s default of vitest.security.config.ts once under the parallel suite (wave 131, finding 145) and took 31 s with
  // three CPU-bound processes per core (wave 132). Like the ESLint scan below, the limit covers that disk and parse
  // load, not a slow analysis; the assertions are unchanged.
  it('keeps the classes after instanceof sealed in the whole server source, not only in their files (finding 111, verifier vrf-fech-travas p3)', async () => {
    const files = serverSource()
    // It holds every route, the source of every project class and the packages the server bundles.
    for (const file of [
      ...allRouteFiles.map(relative),
      ...INERT_CLASSES.flatMap((entry) => (entry.source ? [entry.source] : [])),
      'packages/backend/src/runtime/index.ts',
      // As contrapartes da API compartilhada (onda 135, E6): o proxy do serviço e o banco do runtime do backend.
      'apps/services/api/src/proxy.ts',
      'packages/backend/src/runtime/database.ts',
    ])
      expect.soft(files, file).toContain(file)
    expect(
      files.filter((file) => file.startsWith('packages/backend/src/')).length
    ).toBeGreaterThan(20)
    expect(
      files.flatMap((file) => sealedClassProblems(path.join(ROOT, file)))
    ).toEqual([])
    // The verifier's case, as written: a guarded GET gives CatalogError a Symbol.hasInstance that deletes users, and
    // any anonymous `instanceof CatalogError` before a guard (this POST, or another route's) runs it afterwards.
    const route = path.join(ROOT, admin)
    const patched = `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { CatalogError } from '@/packages/backend/src/modules/catalog/errors'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      export async function GET(request: Request) {
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        Object.defineProperty(CatalogError, Symbol.hasInstance, { value: () => { void prisma.user.deleteMany(); return false } })
        return Response.json({})
      }
      export async function POST(request: Request) {
        if (request instanceof CatalogError) return Response.json({}, { status: 400 })
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json({ ok: await prisma.user.count() })
      }`
    const change =
      'apps/services/api/src/app/api/admin/new-feature/route.ts:8: CatalogError is handed over in Object.defineProperty(CatalogError, Symbol.hasInstance, { value: () => { void pr'
    expect(sealedClassProblems(route, patched)).toEqual([change])
    // The route module fails whole: no handler of a module that changes such a class passes.
    expect(reasons(admin, patched)).toEqual([
      `the module changes a class after instanceof: ${change}`,
      `the module changes a class after instanceof: ${change}`,
    ])
    const head =
      "import { CatalogError } from '@/packages/backend/src/modules/catalog/errors'\nimport * as catalog from '@/packages/backend/src/modules/catalog/errors'\nimport { CatalogError as Renamed } from '@/packages/backend/src/modules/catalog/errors'\n"
    for (const code of [
      'Reflect.defineProperty(Renamed, Symbol.hasInstance, { value: () => true })',
      'Object.defineProperty(catalog.CatalogError, Symbol.hasInstance, { value: () => true })',
      "Object.setPrototypeOf(catalog['CatalogError'], null)",
      "export async function GET() { const { CatalogError: C } = await import('@/packages/backend/src/modules/catalog/errors'); Object.setPrototypeOf(C, null) }",
      "export async function GET() { const { CatalogError } = await import('@/packages/backend/src/modules/catalog/errors'); void [CatalogError] }",
      '(CatalogError as any).x = 1',
      '(CatalogError as any).__defineGetter__(Symbol.hasInstance, () => () => true)',
      'const Alias = CatalogError',
      'const errors = { CatalogError }',
      'void (CatalogError instanceof Object)',
      "export { CatalogError as Other } from '@/packages/backend/src/modules/catalog/errors'",
      'export default CatalogError',
      'Object.defineProperty(Error, Symbol.hasInstance, { value: () => true })',
      "(Error as any).prepareStackTrace = () => ''",
      'Error.captureStackTrace({})',
      'Response.json = () => new Response()',
      'globalThis.Error = class extends Error {}',
      "(global as any)['Response'] = null",
      "const key = 'Error'\n;(globalThis as any)[key] = null",
      'const root: any = globalThis\nroot.Error = null',
      'Object.assign(globalThis, { Error: class {} })',
    ])
      expect.soft(sealedClassProblems(route, head + code), code).not.toEqual([])
    // Controls: what the server source does with them today.
    expect(
      sealedClassProblems(
        route,
        `${head}
      export class LocalError extends Error {}
      export class Sub extends CatalogError {}
      export { CatalogError }
      declare global { var __pool: unknown }
      global.__pool = 1
      void globalThis.fetch('x')
      const kind = typeof Response
      function isCatalog(error: unknown): error is CatalogError { return error instanceof catalog.CatalogError }
      export async function GET(request: Request) {
        try {
          throw new CatalogError('x', 400)
        } catch (error) {
          if (error instanceof CatalogError || error instanceof SyntaxError) return Response.json({}, { status: 400 })
          if (error instanceof Error) return new Response(null, { status: 500 })
          throw new TypeError('y')
        }
      }`
      )
    ).toEqual([])
    // zod's ZodError owns a Symbol.hasInstance nobody can redefine.
    const zod = await import('zod')
    expect(
      Object.getOwnPropertyDescriptor(zod.ZodError, Symbol.hasInstance)
    ).toMatchObject({ writable: false, configurable: false })
    expect(() =>
      Object.defineProperty(zod.ZodError, Symbol.hasInstance, {
        value: () => true,
      })
    ).toThrow(TypeError)
  }, 60_000)

  // Loads ESLint with the repository config and asks it for the config of every server file (about 1.2 thousand):
  // about 3 s alone, more under the parallel suite. The limit covers that load, not a slow analysis.
  it('relies on the lint rule "the server does not rewrite the runtime": on for the whole server source, never switched off (finding 123)', async () => {
    const { ESLint } = await import('eslint')
    const tool = await import('../../tools/eslint-runtime-rewrite.mjs')
    const eslint = new ESLint({ cwd: ROOT })
    const rule = tool.default.rules[tool.RULE_NAME]
    const problems: string[] = []
    const covered: string[] = []
    const uncovered = new Set<string>()
    for (const file of serverSource()) {
      const reason = RUNTIME_RULE_UNCOVERED.find((entry) =>
        typeof entry.path === 'string'
          ? entry.path === file
          : entry.path.test(file)
      )
      const absolute = path.join(ROOT, file)
      const config = (await eslint.isPathIgnored(absolute))
        ? undefined
        : ((await eslint.calculateConfigForFile(absolute)) as {
            rules?: Record<string, unknown[]>
            plugins?: Record<string, { rules?: Record<string, typeof rule> }>
          })
      // On as an error, and the plugin is the tool's (its rule's meta: messages, schema, description).
      const on =
        config?.rules?.[tool.RULE_ID]?.[0] === 2 &&
        JSON.stringify(
          config.plugins?.[tool.PLUGIN_NAME]?.rules?.[tool.RULE_NAME]?.meta
        ) === JSON.stringify(rule.meta)
      if (reason) {
        uncovered.add(file)
        if (on)
          problems.push(
            `${file}: covered by the rule, drop it from RUNTIME_RULE_UNCOVERED`
          )
      } else if (!on)
        problems.push(`${file}: server source without ${tool.RULE_ID}`)
      else covered.push(file)
    }
    // Each exclusion still names a server file (the list only shrinks).
    for (const entry of RUNTIME_RULE_UNCOVERED)
      if (
        ![...uncovered].some((file) =>
          typeof entry.path === 'string'
            ? entry.path === file
            : entry.path.test(file)
        )
      )
        problems.push(
          `RUNTIME_RULE_UNCOVERED ${String(entry.path)}: no server file`
        )
    // No comment switches it off where it is on.
    for (const file of covered) {
      const found = ruleSwitchedOff(
        fs.readFileSync(path.join(ROOT, file), 'utf8'),
        tool.RULE_ID
      )
      if (found) problems.push(`${file}: ${found}`)
    }
    for (const [text, off] of [
      [`// eslint-disable-next-line ${tool.RULE_ID}`, true],
      [`/* eslint-disable ${tool.RULE_ID} -- motivo */`, true],
      [`// eslint-disable-line no-console, ${tool.RULE_ID}`, true],
      ['/* eslint-disable */', true],
      ['// eslint-disable-next-line -- motivo', true],
      [`/* eslint ${tool.RULE_ID}: off */`, true],
      ['// eslint-disable-next-line react-hooks/exhaustive-deps', false],
      ['/* eslint-disable @typescript-eslint/no-explicit-any */', false],
    ] as const)
      expect.soft(!!ruleSwitchedOff(text, tool.RULE_ID), text).toBe(off)
    expect(problems).toEqual([])
    expect(covered.length).toBeGreaterThan(1000)
    // What the inventory cannot see (a class reached through a value) is what the rule refuses, in a route and in
    // any server file (verifier vrf3-ft-111-112: pA.mts, pA2.mts).
    const patched = (patch: string) => `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { CatalogError } from '@/packages/backend/src/modules/catalog/errors'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      export async function GET(request: Request) {
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        ${patch}
        return Response.json({})
      }
      export async function POST(request: Request) {
        if (request instanceof CatalogError) return Response.json({}, { status: 400 })
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json({ ok: await prisma.user.count() })
      }`
    const run =
      '{ value: () => { void prisma.user.deleteMany(); return false } }'
    for (const [file, text] of [
      [
        admin,
        patched(
          `Object.defineProperty(Object.getPrototypeOf(RangeError), Symbol.hasInstance, ${run})`
        ),
      ],
      [
        admin,
        patched(
          `Object.defineProperty(new CatalogError('x').constructor, Symbol.hasInstance, ${run})`
        ),
      ],
      [
        admin,
        patched(
          `Reflect.defineProperty(Reflect.getPrototypeOf(URIError) as object, Symbol.hasInstance, ${run})`
        ),
      ],
      [
        admin,
        patched(
          `try { JSON.parse('{') } catch (e) { Object.defineProperty(Object.getPrototypeOf((e as any).constructor), Symbol.hasInstance, ${run}) }`
        ),
      ],
      [
        'packages/backend/src/runtime/telemetry.ts',
        `import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'\nObject.defineProperty(Object.getPrototypeOf(RangeError), Symbol.hasInstance, ${run})\nexport const TELEMETRY = 'on'\n`,
      ],
    ] as const) {
      const [result] = await eslint.lintText(text, {
        filePath: path.join(ROOT, file),
      })
      expect
        .soft(
          result!.messages.filter((message) => message.ruleId === tool.RULE_ID)
            .length,
          text
        )
        .toBeGreaterThan(0)
    }
  }, 60_000)

  it('keeps ZOD_BUILDERS to zod calls that run nothing they receive, as installed (finding 112, verifier vrf-ft-111-112)', async () => {
    const { z } = await import('zod')
    let ran = 0
    const spy = (value?: unknown) => {
      ran += 1
      return value
    }
    const members = (value: unknown) => value as Record<string, unknown>
    const receivers: unknown[] = [
      z,
      ...[...ZOD_NAMESPACES].map((name) => members(z)[name]),
      z.string().transform(spy),
      z.number().refine(spy),
      z.date(),
      z.boolean(),
      z.unknown(),
      z.object({ at: z.string().transform(spy) }),
      z.array(z.string().transform(spy)),
      z.union([z.string().transform(spy), z.number()]),
      z.string().transform(spy).optional(),
      z.string().default('x'),
      z.string().transform(spy).pipe(z.string().transform(spy)),
    ]
    // What the load grammar lets a builder receive: data (literal data, plain records and arrays of it, zod schemas),
    // the params zod spreads into the schema's definition included (a `checks` record like the verifier's, holding
    // data), and a function only as the first argument of ZOD_CALLBACKS.
    const schema = z.string().transform(spy).refine(spy)
    const params = { error: 'x', abort: true, path: ['at'] }
    const data: unknown[][] = [
      [],
      [params],
      [schema, params],
      [{ at: schema }, params],
      [{ at: true }, params],
      [['a', 'b'], params],
      ['a', params],
      [1, params],
      [/x/, params],
      [schema, { checks: [schema] }],
      [{ checks: [{ _zod: { onattach: [] } }] }],
      [
        'a',
        {
          checks: [
            { _zod: { def: { check: 'custom' }, check: 'x', onattach: ['x'] } },
          ],
        },
      ],
    ]
    const callbacks: unknown[][] = [[spy], [spy, params], [spy, { checks: [] }]]
    const callable = new Set<string>()
    for (const name of ZOD_BUILDERS)
      for (const receiver of receivers) {
        const builder = members(receiver)[name]
        if (typeof builder !== 'function') continue
        callable.add(name)
        for (const args of ZOD_CALLBACKS.has(name)
          ? [...data, ...callbacks]
          : data) {
          try {
            const built: unknown = builder.apply(receiver, args)
            if (built instanceof Promise) built.catch(() => undefined)
          } catch {
            // A wrong argument throws: what counts is whether it ran what it received.
          }
        }
      }
    expect([...ZOD_BUILDERS].filter((name) => !callable.has(name))).toEqual([])
    expect(
      [...ZOD_CALLBACKS].filter((name) => !ZOD_BUILDERS.has(name))
    ).toEqual([])
    expect(ran).toBe(0)
    // Controls: the spy sees a callback zod runs, so the zero above is a measure. parse runs it (not a builder), and
    // so does construction when a function sits in the params (the load grammar refuses both).
    z.string().transform(spy).parse('x')
    expect(ran).toBe(1)
    z.string({ checks: [{ _zod: { onattach: [spy] } }] } as never)
    expect(ran).toBe(2)
  })

  it('accepts at load only zod code that runs nothing, run against the installed zod (finding 112, verifier vrf-ft-111-112)', async () => {
    const { z } = await import('zod')
    let ran = 0
    const prisma = {
      user: {
        deleteMany: () => {
          ran += 1
          return 0
        },
      },
    }
    const loaded = (prelude: string) => `
      import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
      import { z } from 'zod'
      import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      ${prelude}
      export async function GET(request: Request) {
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json({})
      }`
    const wipe = '() => prisma.user.deleteMany()'
    const hooked = (fn: string) =>
      `{ checks: [{ _zod: { onattach: [${fn}] } }] }`
    // Module code that deletes users as zod builds or parses (each must be refused), then shapes the rule refuses
    // without zod running them, then the real routes' shapes (each must be accepted and run nothing).
    const running = [
      `const Wipe = z.string(${hooked(wipe)})`,
      `const Wipe = z.object({}, ${hooked(wipe)})`,
      `const wipe = ${wipe}\nconst Wipe = z.string(${hooked('wipe')})`,
      `const Wipe = z.number(${hooked('function () { return prisma.user.deleteMany() }')})`,
      `const Wipe = z.coerce.number(${hooked(wipe)})`,
      `const S = z.object({ a: z.string(${hooked(wipe)}) })`,
      `const Wipe = z.iso.datetime(${hooked(wipe)})`,
      `const Wipe = z.enum(['a'], ${hooked(wipe)})`,
      "const Wipe = z.string({ checks: [{ _zod: { def: { check: 'custom' }, check: () => undefined, onattach: [() => void prisma.user.deleteMany()] } }] })",
      `const wipe = z.string().transform(${wipe}).parse('go')`,
      "const Wipe = z.string().refine(() => { void prisma.user.deleteMany(); return true })\nconst checked = Wipe.safeParse('go')",
      // Finding 124: the default of a binding pattern runs as the module loads (verifier casesB.mjs).
      `const { parsed = z.string().transform(${wipe}).parse('go') } = {}`,
      `const [checked = z.string().refine(${wipe}).safeParse('go')] = []`,
      `const { pending = z.string().transform(${wipe}).parseAsync('go') } = {}`,
      `const { a: { b = z.string().transform(${wipe}).parse('go') } = {} } = {}`,
    ]
    const corpus = [
      ...running,
      `const Wipe = z.string().min(1, ${wipe})`,
      `const Wipe = z.string().default(${wipe})`,
      `const Wipe = z.string().refine((value) => value.length > 0, { error: ${wipe} })`,
      `const Wipe = z.object({ user: ${wipe} })`,
      'const postalCode = z.string().transform((value) => value.trim()).pipe(z.string().regex(/^[0-9]{8}$/))\nconst Input = z.object({ from: z.object({ postal_code: postalCode }), quantity: z.number().int().positive().max(10).default(1) }).strict()',
      'const providerNumber = z.union([z.number(), z.string()]).transform(Number).pipe(z.number().finite().nonnegative())',
      "const TAX_REGIMES = ['SIMPLES', 'LUCRO_REAL'] as const\nconst Settings = z.object({ regime: z.enum(TAX_REGIMES).optional(), rate: z.number().min(0).max(100).nullable().optional() })",
      "const Dates = z.object({ due: z.coerce.date(), at: z.union([z.iso.date(), z.iso.datetime({ offset: true })]), amount: z.coerce.number().refine((value) => value > 0, { error: 'x' }) })",
      `const Keep = z.string().transform(${wipe}).refine(${wipe}, { error: 'x', path: ['a'] })`,
      "const Params = z.string({ error: 'x', checks: [{ _zod: { onattach: [] } }] })",
      // Pattern defaults that only build a schema.
      'const { Shape = z.object({ name: z.string().min(1) }) } = {}',
      `const [Kept = z.string().transform(${wipe})] = []`,
    ]
    const effects: string[] = []
    for (const prelude of corpus) {
      const verdict = reasons(admin, loaded(prelude))[0]
      ran = 0
      try {
        vm.runInNewContext(
          ts.transpileModule(prelude, {
            compilerOptions: { target: ts.ScriptTarget.ES2022 },
          }).outputText,
          { z, prisma }
        )
      } catch {
        // A shape zod rejects throws: what counts is whether it deleted anything first.
      }
      await new Promise((resolve) => setTimeout(resolve, 0))
      if (ran) effects.push(prelude)
      // Whatever the rule accepts runs nothing when the module loads.
      if (verdict === 'ok') expect.soft(ran, prelude).toBe(0)
      else
        expect
          .soft(verdict, prelude)
          .toMatch(/^the module runs .* when it loads/)
    }
    // The runs are real: each of these deleted users with the installed zod.
    expect(effects).toEqual(running)
  })

  it('rejects webhook facade wiring that bypasses shared authentication, database or credentials', () => {
    for (const file of WEBHOOK_AUTH_FACADES) {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
      expect(webhookAuthFacadeProblem(file), file).toBeUndefined()
      for (const [pattern, replacement] of [
        [
          'return authentication.authenticateTenantWebhook(',
          'return authentication.resolveWebhookIntegration(',
        ],
        [
          // The lib/ arm preserves the retired facade spelling; current WEBHOOK_AUTH_FACADES exercises the API branch.
          file.startsWith('lib/')
            ? '() => prisma'
            : '() => getDatabaseRuntime().prisma',
          '() => foreignPrisma',
        ],
        [
          /=\s*createIntegrationCredentialResolver\(\)/,
          '= fakeCredentialResolver()',
        ],
      ]) {
        const mutated = source.replace(pattern!, replacement!)
        expect(mutated, file).not.toBe(source)
        expect(webhookAuthFacadeProblem(file, mutated), file).toBeDefined()
      }
    }
  })

  it('traces bounded canonical public GET closures and rejects missing refusal, forged requests, early data and forged host resolution', () => {
    const hostFile = path.join(ROOT, PUBLIC_FACTORY_SOURCE)
    const hostText = fs.readFileSync(hostFile, 'utf8')
    for (const entry of PUBLIC_FACTORY_CLOSURES) {
      const [name, , stem, pathName, dataPort, , earlyArguments] = entry
      const route = `apps/services/api/src/app/api/${pathName}/route.ts`
      const canonical = `packages/backend/src/http/${stem}.ts`
      const sourceFile = path.join(ROOT, canonical)
      const text = fs.readFileSync(sourceFile, 'utf8')
      const baseline = () => analyzeRouteModule(path.join(ROOT, route))
      expect(
        baseline().map((endpoint) =>
          endpoint.verdict.ok ? 'ok' : endpoint.verdict.reason
        ),
        name
      ).toEqual(['ok'])
      expect(allowlistProblems(route, baseline()), name).toEqual([])
      const closed = publicFactoryClosure({
        module: PUBLIC_FACTORY_HOST,
        name,
        file: hostFile,
      })
      expect(closed, name).not.toBeNull()
      expect(
        PUBLIC_FACTORY_COMPOSITIONS.get(closed!.info)?.node.getText(),
        name
      ).toContain(entry[1])
      const mutations: Array<readonly [string, string, string]> = [
        ['missing refusal', 'if (!tenant.ok) return tenant.response', ''],
        [
          'forged request',
          'deps.resolveTenant(request',
          'deps.resolveTenant(new Request(request.url)',
        ],
        [
          'early data',
          'const tenant = await deps.resolveTenant(request',
          `await deps.${dataPort}(${earlyArguments})
      const tenant = await deps.resolveTenant(request`,
        ],
      ]
      if (stem === 'storefront-legal')
        mutations.push(
          ['missing kind refusal', 'if (!kind) return unknownKind()', ''],
          [
            'wrong kind refusal',
            'if (!kind) return unknownKind()',
            'if (kind) return unknownKind()',
          ],
          [
            'kind from query',
            '(await params).kind',
            "new URL(request.url).searchParams.get('kind') ?? ''",
          ],
          [
            'effect in kind refusal',
            'if (!kind) return unknownKind()',
            "if (!kind) { await deps.getDocument({ tenantId: 'foreign' }, 'terms'); return unknownKind() }",
          ]
        )
      for (const [label, from, to] of mutations) {
        const changed = text.replace(from, to)
        expect(changed, `${name}: ${label} applies`).not.toBe(text)
        FIXTURE_FILES.set(sourceFile, changed)
        try {
          const endpoints = baseline()
          expect(endpoints, `${name}: ${label}`).toHaveLength(1)
          expect(endpoints[0]!.verdict.ok, `${name}: ${label}`).toBe(false)
          expect(
            allowlistProblems(route, endpoints),
            `${name}: ${label}`
          ).not.toEqual([])
        } finally {
          FIXTURE_FILES.delete(sourceFile)
        }
        expect(
          baseline().map((endpoint) => endpoint.verdict.ok),
          name
        ).toEqual([true])
      }
      // Replace precisely this composition's port, even when several arrows share the same text.
      const host = parseModule(hostFile, hostText)
      const call = host.locals.get(name) as ts.CallExpression
      const object = strip(call.arguments[0]!) as ts.ObjectLiteralExpression
      const property = object.properties.find(
        (candidate) =>
          ts.isPropertyAssignment(candidate) &&
          propertyText(candidate.name) === 'resolveTenant'
      ) as ts.PropertyAssignment
      const forged =
        hostText.slice(0, property.initializer.getStart()) +
        "async () => ({ ok: true, context: { tenantId: 'foreign' } } as any)" +
        hostText.slice(property.initializer.end)
      expect(forged, `${name}: forged host resolver applies`).not.toBe(hostText)
      FIXTURE_FILES.set(hostFile, forged)
      try {
        expect(
          publicFactoryClosure({
            module: PUBLIC_FACTORY_HOST,
            name,
            file: hostFile,
          }),
          name
        ).toBeNull()
        const endpoints = baseline()
        expect(endpoints, name).toHaveLength(1)
        expect(endpoints[0]!.verdict.ok, `${name}: forged host resolver`).toBe(
          false
        )
        expect(allowlistProblems(route, endpoints), name).not.toEqual([])
      } finally {
        FIXTURE_FILES.delete(hostFile)
      }
      expect(
        baseline().map((endpoint) => endpoint.verdict.ok),
        name
      ).toEqual([true])
    }
    const legalFile = path.join(
      ROOT,
      'packages/contracts/src/storefront-legal.ts'
    )
    const legalText = fs.readFileSync(legalFile, 'utf8')
    const altered = legalText.replace(
      /return \(\s*STOREFRONT_LEGAL_KINDS\.find\(/,
      "void globalThis.fetch('https://fixture.test')\n  return (\n    STOREFRONT_LEGAL_KINDS.find("
    )
    expect(altered, 'the pure parser mutation applies').not.toBe(legalText)
    FIXTURE_FILES.set(legalFile, altered)
    try {
      expect(publicFactoryLegalKindSourceIsInert()).toBe(false)
      expect(
        publicFactoryClosure({
          module: PUBLIC_FACTORY_HOST,
          name: 'publicStorefrontLegal',
          file: hostFile,
        })
      ).toBeNull()
    } finally {
      FIXTURE_FILES.delete(legalFile)
    }
    expect(publicFactoryLegalKindSourceIsInert()).toBe(true)
  })

  it('keeps the result shape of every approved helper in sync with its source', () => {
    for (const guard of GUARDS) {
      if (guard.module === 'next-auth') continue
      const file = guard.source
        ? path.join(ROOT, guard.source)
        : resolveModule(path.join(ROOT, 'package.json'), `@/${guard.module}`)
      expect(file, guard.module).toBeDefined()
      const source = ts.createSourceFile(
        file!,
        fs.readFileSync(file!, 'utf8'),
        ts.ScriptTarget.Latest,
        true
      )
      const declaration = source.statements.find(
        (statement): statement is ts.FunctionDeclaration =>
          ts.isFunctionDeclaration(statement) &&
          statement.name?.text === guard.name
      )
      expect(declaration, `${guard.module}#${guard.name}`).toBeDefined()
      if (guard.requestArgument !== undefined) {
        const request = declaration!.parameters[guard.requestArgument]
        expect(
          request,
          `${guard.module} required request parameter`
        ).toBeDefined()
        expect(request!.questionToken, guard.module).toBeUndefined()
        expect(request!.initializer, guard.module).toBeUndefined()
      }
      const declared = declaration!.type?.getText() ?? ''
      const where = `${guard.module}#${guard.name}`
      if (guard.result.type === 'discriminated') {
        if (
          guard.module === 'apps/services/api/src/host/runtime' &&
          guard.name === 'resolvePublicRequestTenant'
        ) {
          expect(declaration!.body!.statements).toHaveLength(1)
          expect(declaration!.body!.statements[0]!.getText()).toMatch(
            /^return tenant\.resolvePublicRequestTenant\(request, options\);?$/
          )
        }
        // Its own body or the helper it delegates to answers `{ <property>: false }`.
        const facade = PRINCIPAL_FACADES.find(
          (entry) => entry.file.replace(/\.ts$/, '') === guard.module
        )
        if (facade)
          expect(principalFacadeProblem(facade.file, {}), where).toBeUndefined()
        const permission = PERMISSION_FACADES.find(
          (entry) => entry.file.replace(/\.ts$/, '') === guard.module
        )
        if (permission)
          expect(
            permissionFacadeProblem(permission.file, {}),
            where
          ).toBeUndefined()
        const webhook = WEBHOOK_AUTH_FACADES.find(
          (entry) => entry.replace(/\.ts$/, '') === guard.module
        )
        if (webhook)
          expect(webhookAuthFacadeProblem(webhook), where).toBeUndefined()
        const source = facade
          ? path.join(ROOT, PRINCIPAL_SOURCE)
          : permission
            ? path.join(ROOT, PERMISSION_SOURCE)
            : webhook
              ? path.join(ROOT, WEBHOOK_AUTH_SOURCE)
              : guard.module === 'apps/services/api/src/host/runtime' &&
                  guard.name === 'resolvePublicRequestTenant'
                ? path.join(
                    ROOT,
                    'packages/backend/src/modules/identity/public-tenant.ts'
                  )
                : file!
        expect(fs.readFileSync(source, 'utf8'), where).toMatch(
          new RegExp(`\\b${guard.result.property}: false\\b`)
        )
        expect(declared, where).not.toMatch(/\bnull\b/)
      } else if (guard.result.type === 'denial')
        expect(declared, where).toMatch(/^Response \| null$/)
      else if (guard.result.type === 'nullable')
        expect(declared, where).toMatch(/\| null>$/)
      else if (guard.result.type === 'response')
        expect(declared, where).toBe('Promise<Response>')
    }
  })

  it('keeps the result shape of the same-origin guards of the PROLOGUE in sync with their source', () => {
    const guards: Array<[string, string, string]> = [
      [
        'packages/backend/src/modules/identity/same-origin-mutation.ts',
        'rejectCrossOriginMutation',
        'Response | null',
      ],
      [
        'packages/backend/src/modules/identity/same-origin-mutation.ts',
        'isSameOriginMutation',
        'boolean',
      ],
      [
        'apps/services/api/src/host/mutation-origin.ts',
        'isTrustedMutationOrigin',
        'boolean',
      ],
    ]
    for (const [file, name, declared] of guards) {
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(path.join(ROOT, file), 'utf8'),
        ts.ScriptTarget.Latest,
        true
      )
      const declaration = source.statements.find(
        (statement): statement is ts.FunctionDeclaration =>
          ts.isFunctionDeclaration(statement) && statement.name?.text === name
      )
      expect(declaration, `${file}#${name}`).toBeDefined()
      expect(declaration!.type?.getText(), `${file}#${name}`).toBe(declared)
    }
  })

  it('keeps PUBLIC_TENANT_SURFACE exact: each entry is a public tenant method outside /api/admin', () => {
    const problems: string[] = []
    for (const [route, entry] of Object.entries(PUBLIC_TENANT_SURFACE)) {
      expect(entry.reason.length, route).toBeGreaterThan(20)
      if (ADMIN.test(route)) problems.push(`${route}: under /api/admin`)
      for (const method of entry.methods) {
        const endpoint = find(route, method)
        if (!endpoint) problems.push(`${route}#${method}: stale entry`)
        else if (
          !endpoint.verdict.ok ||
          !endpoint.verdict.kinds.includes('public-tenant')
        )
          problems.push(
            `${route}#${method}: not authorized by public tenant resolution`
          )
      }
    }
    expect(problems).toEqual([])
  })

  it('inventories destructured, renamed and re-exported methods', () => {
    const guarded = `import { requireTenantPermission as requireAdmin } from '@/apps/services/api/src/host/permissions'
      export async function GET(request: Request) {
        const auth = await requireAdmin(request, 'EQUIPMENTS', 'READ')
        if (!auth.ok) return Response.json({}, { status: 403 })
        return Response.json({})
      }`
    const route = 'apps/services/api/src/app/api/admin/new-feature/route.ts'
    expect(
      methods(
        route,
        `import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
         ${guarded}
         export const { POST } = { POST: async () => Response.json(await prisma.user.deleteMany()) }`
      )
    ).toEqual(['GET:ok', `POST:${NO_GUARD}`])
    expect(
      methods(
        route,
        `import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
         const handlers = {
           async PUT() { return Response.json(await prisma.user.deleteMany()) },
           DELETE: async () => Response.json(await prisma.user.deleteMany()),
         }
         ${guarded}
         export const { PUT, DELETE: remove, DELETE } = handlers`
      )
    ).toEqual(['GET:ok', `PUT:${NO_GUARD}`, `DELETE:${NO_GUARD}`])
    expect(
      methods(
        route,
        `import { makeHandlers } from '@/tests/security/fixtures/handlers'
         ${guarded}
         export const { POST } = makeHandlers()
         export let PATCH = async () => Response.json({})`
      )
      // makeHandlers() runs when the module loads: a project helper outside LOAD_TIME_FACTORIES.
    ).toEqual([
      'GET:the module runs makeHandlers() when it loads',
      `POST:${UNRESOLVED}`,
      `PATCH:${UNRESOLVED}`,
    ])
    expect(
      methods(
        route,
        `import { prisma } from '@/tests/security/fixtures/authorization-scanner-data'
         ${guarded}
         async function wipe() { return Response.json(await prisma.user.deleteMany()) }
         export { wipe as DELETE }`
      )
    ).toEqual(['GET:ok', `DELETE:${NO_GUARD}`])
    expect(
      methods(
        route,
        `${guarded}
         export * from '@/apps/services/api/src/app/api/payments/pix/webhook/route'`
      )
    ).toEqual(['GET:ok', `POST:${NO_GUARD}`])
    expect(
      methods(
        route,
        `${guarded}
         export { POST } from '@/apps/services/api/src/app/api/payments/pix/webhook/route'`
      )
    ).toEqual(['GET:ok', `POST:${NO_GUARD}`])
    expect(
      methods(
        route,
        `${guarded}
         export * from 'some-route-kit'`
      )
    ).toEqual([
      'GET:ok',
      '*:export * from some-route-kit could not be resolved statically',
    ])
    // re-exporting a guarded route keeps its verdict
    expect(
      methods(
        route,
        `export * from '@/apps/services/api/src/app/api/admin/categories/route'`
      ).every((entry) => entry.endsWith(':ok'))
    ).toBe(true)
    // `export const X = importedHandler` is the same value as a re-export (onda 135, C5: the OpenAPI generator only
    // reads `export const`): the imported handler is followed and keeps its own verdict, guarded or not, and the
    // facts an allowlist invariant checks are the ones of the real composition, never the alias itself.
    expect(
      methods(
        route,
        `import { GET as list } from '@/apps/services/api/src/app/api/admin/categories/route'
         import { POST as webhook } from '@/apps/services/api/src/app/api/payments/pix/webhook/route'
         export const GET = list
         export const POST = webhook`
      )
    ).toEqual(['GET:ok', `POST:${NO_GUARD}`])
    const publicList = 'apps/services/api/src/app/api/categories/route.ts'
    const facts = (source: string) =>
      fixture(publicList, source).map((endpoint) => ({
        method: endpoint.method,
        references: [...endpoint.facts.references].sort(),
        problems: invariantViolations(endpoint, API_PUBLIC_COMPOSITION),
      }))
    const reexported = facts(
      `export { publicCategories as GET } from '../../../host/runtime'`
    )
    expect(reexported).toHaveLength(1)
    expect(reexported[0]!.references).toContain(
      '@gb-locacoes/backend/http#createPublicCategoriesHandler'
    )
    expect(reexported[0]!.problems).toEqual([])
    expect(
      facts(
        `import { publicCategories } from '../../../host/runtime'
         export const GET = publicCategories`
      )
    ).toEqual(reexported)
  })

  it('fails real routes once their authorization is removed or weakened (in-memory mutation)', () => {
    const mutations: Array<[string, RegExp, string]> = [
      [
        'apps/services/api/src/app/api/admin/categories/route.ts',
        /await requireTenantPermission\(([^)]*)\)/g,
        '({ ok: true } as any)',
      ],
      [
        'apps/services/api/src/app/api/admin/rentals/route.ts',
        /principal\.role !== 'ADMIN'/g,
        'false',
      ],
      [
        'apps/services/api/src/app/api/cron/outbox/route.ts',
        /requireCronAuthorization\(request\)/g,
        'null',
      ],
      [
        'apps/services/api/src/app/api/addresses/route.ts',
        /await resolveTenantPrincipal\(request\)/g,
        '({ ok: true } as any)',
      ],
      // PUT keeps payload `.role` reads only.
      [
        'apps/services/api/src/app/api/admin/permissions/route.ts',
        /if \(context\.role !== 'ADMIN'\)\s*return NextResponse\.json\(\{ error: 'Não autorizado' \}, \{ status: 403 \}\)/,
        '',
      ],
      [
        'apps/services/api/src/app/api/admin/permissions/route.ts',
        /if \(access\.principal\.role !== 'ADMIN'\)\s*return NextResponse\.json\(\{ error: 'Não autorizado' \}, \{ status: 403 \}\)/,
        '',
      ],
      // Role compared with a constant that is not a staff allowlist.
      [
        'apps/services/api/src/app/api/admin/permissions/route.ts',
        /context\.role !== 'ADMIN'/g,
        "context.role !== 'CLIENT'",
      ],
      [
        'apps/services/api/src/app/api/admin/audit-logs/route.ts',
        /access\.principal\.role !== 'ADMIN'/g,
        "access.principal.role === 'CLIENT'",
      ],
      // The check of the helper's result is deleted.
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /if \(!access\.ok\)\s*return new NextResponse\(access\.response\.body, \{[\s\S]*?\n {4}\}\)/,
        '',
      ],
      // Gate moved into a branch.
      [
        'apps/services/api/src/app/api/admin/drivers/route.ts',
        /const access = await resolveTenantPrincipal\(request\)\s*if \(!access\.ok\) return access\.response\s*if \(access\.principal\.role !== 'ADMIN'\)/,
        "if (request.headers.has('x-strict')) {\nconst access = await resolveTenantPrincipal(request)\nif (!access.ok) return access.response\n}\nif (access.principal.role !== 'ADMIN')",
      ],
      // Gate helper result discarded with void.
      [
        'apps/services/api/src/app/api/cron/outbox/route.ts',
        /const denied = requireCronAuthorization\(request\)\s*if \(denied\) return denied/,
        'void requireCronAuthorization(request)',
      ],
      // Finding 12: truthiness of a result that is always an object.
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /if \(!access\.ok\)/,
        'if (!access)',
      ],
      // Finding 13: the CLIENT "owner" compared with itself.
      [
        'apps/services/api/src/app/api/admin/clients/[id]/documents/route.ts',
        /principal\.userId === userId/,
        'principal.userId === principal.userId',
      ],
      // Finding 14: a private route that resolves the public tenant instead of the principal.
      [
        'apps/services/api/src/app/api/addresses/route.ts',
        /resolveTenantPrincipal/g,
        'resolvePublicRequestTenant',
      ],
      // Finding 15: a data client loaded with import() and used before the gate.
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /const access = await resolveTenantPrincipal\(request\)/,
        "const { getDatabaseRuntime: early } = await import('@gb-locacoes/backend/runtime')\n  await early().prisma.user.count()\n  const access = await resolveTenantPrincipal(request)",
      ],
      // Finding 26: data reached through an object literal, a class or a callback parameter.
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /const access = await resolveTenantPrincipal\(request\)/,
        "const zoho = { token: () => readAdminBadges({ tenantId: 'foreign' }) }\n  await zoho.token()\n  const access = await resolveTenantPrincipal(request)",
      ],
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /const access = await resolveTenantPrincipal\(request\)/,
        "class Mail { token() { return readAdminBadges({ tenantId: 'foreign' }) } }\n  await new Mail().token()\n  const access = await resolveTenantPrincipal(request)",
      ],
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /const access = await resolveTenantPrincipal\(request\)/,
        "await Promise.all([readAdminBadges].map((send) => send({ tenantId: 'foreign' })))\n  const access = await resolveTenantPrincipal(request)",
      ],
      // Finding 30: the CLIENT owner reaches a second access that ignores the owner.
      [
        'apps/services/api/src/app/api/admin/clients/[id]/documents/route.ts',
        /const documents = await listClientDocuments\(principal, userId\)/,
        "const documents = await listClientDocuments(principal, userId)\n    await (await import('@/apps/services/api/src/host/tenant-transaction')).withTenantTransaction(principal, (tx: any) => tx.rentals.deleteMany({}))",
      ],
      // Finding 26 (second review): assignment, default, accessor, inheritance, member assigned later.
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /const access = await resolveTenantPrincipal\(request\)/,
        "let early: any\n  early = readAdminBadges\n  await early({ tenantId: 'foreign' })\n  const access = await resolveTenantPrincipal(request)",
      ],
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /const access = await resolveTenantPrincipal\(request\)/,
        "const early = async (run: any = readAdminBadges) => run({ tenantId: 'foreign' })\n  await early()\n  const access = await resolveTenantPrincipal(request)",
      ],
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /const access = await resolveTenantPrincipal\(request\)/,
        "const zoho = { get token() { return readAdminBadges({ tenantId: 'foreign' }) } }\n  await zoho.token\n  const access = await resolveTenantPrincipal(request)",
      ],
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /const access = await resolveTenantPrincipal\(request\)/,
        "class Base { token() { return readAdminBadges({ tenantId: 'foreign' }) } }\n  class Mail extends Base {}\n  await new Mail().token()\n  const access = await resolveTenantPrincipal(request)",
      ],
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /const access = await resolveTenantPrincipal\(request\)/,
        "const mail: any = {}\n  mail.token = () => readAdminBadges({ tenantId: 'foreign' })\n  await mail.token()\n  const access = await resolveTenantPrincipal(request)",
      ],
      // Finding 30 (second review): the owner handed to a local helper that ignores it, or negated in the filter.
      [
        'apps/services/api/src/app/api/admin/clients/[id]/documents/route.ts',
        /const documents = await listClientDocuments\(principal, userId\)/,
        "const documentsOf = async (p: any, _owner: string) => (await import('@/apps/services/api/src/host/tenant-transaction')).withTenantTransaction(p, (tx: any) => tx.clientDocument.findMany())\n    const documents = await documentsOf(principal, userId)",
      ],
      [
        'apps/services/api/src/app/api/admin/clients/[id]/documents/route.ts',
        /const documents = await listClientDocuments\(principal, userId\)/,
        "const documents = await (await import('@/apps/services/api/src/host/tenant-transaction')).withTenantTransaction(principal, (tx: any) => tx.clientDocument.findMany({ where: { NOT: { userId } } }))",
      ],
      // Finding 26 (third review): tagged template, array literal, zod or promise chain, thenable, getter, default.
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /const access = await resolveTenantPrincipal\(request\)/,
        "function wipe(_strings: TemplateStringsArray, run: any) { return run({ tenantId: 'foreign' }) }\n  await wipe`${readAdminBadges}`\n  const access = await resolveTenantPrincipal(request)",
      ],
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /const access = await resolveTenantPrincipal\(request\)/,
        "const send = (run: any) => run({ tenantId: 'foreign' })\n  await [send][0](readAdminBadges)\n  const access = await resolveTenantPrincipal(request)",
      ],
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /const access = await resolveTenantPrincipal\(request\)/,
        "await Promise.resolve().then(() => ({ tenantId: 'foreign' })).then(readAdminBadges)\n  const access = await resolveTenantPrincipal(request)",
      ],
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /const access = await resolveTenantPrincipal\(request\)/,
        "await { then: (resolve: any) => resolve(readAdminBadges({ tenantId: 'foreign' })) }\n  const access = await resolveTenantPrincipal(request)",
      ],
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /const access = await resolveTenantPrincipal\(request\)/,
        "void ({ get token() { return readAdminBadges({ tenantId: 'foreign' }) } }).token\n  const access = await resolveTenantPrincipal(request)",
      ],
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /const access = await resolveTenantPrincipal\(request\)/,
        "const { token = readAdminBadges({ tenantId: 'foreign' }) } = {} as any\n  void token\n  const access = await resolveTenantPrincipal(request)",
      ],
      // Finding 30 (third review): loop variable over the client, owner shadowed, relation read.
      [
        'apps/services/api/src/app/api/admin/clients/[id]/documents/route.ts',
        /const documents = await listClientDocuments\(principal, userId\)/,
        "const documents = await listClientDocuments(principal, userId)\n    await (await import('@/apps/services/api/src/host/tenant-transaction')).withTenantTransaction(principal, async (tx: any) => { for (const m of [tx.rentals]) await m.deleteMany({}) })",
      ],
      [
        'apps/services/api/src/app/api/admin/clients/[id]/documents/route.ts',
        /const documents = await listClientDocuments\(principal, userId\)/,
        "const documents = await listClientDocuments(principal, userId)\n    for (const userId of ((await request.json()) as { userIds: string[] }).userIds) await (await import('@/apps/services/api/src/host/tenant-transaction')).withTenantTransaction(principal, (tx: any) => tx.rentals.deleteMany({ where: { userId } }))",
      ],
      [
        'apps/services/api/src/app/api/admin/clients/[id]/documents/route.ts',
        /const documents = await listClientDocuments\(principal, userId\)/,
        "const documents = await (await import('@/apps/services/api/src/host/tenant-transaction')).withTenantTransaction(principal, (tx: any) => tx.user.findUnique({ where: { id: userId }, include: { memberships: true } }))",
      ],
      // A route module that touches data when it loads, before any handler runs.
      [
        'apps/services/api/src/app/api/admin/badges/route.ts',
        /export const dynamic = 'force-dynamic'/,
        "export const dynamic = 'force-dynamic'\nvoid readAdminBadges({ tenantId: 'foreign' })",
      ],
      // Finding 108: the normalized routes back to work before the guard.
      [
        'apps/services/api/src/app/api/admin/rentals/[id]/contract/route.ts',
        /\s*\/\/ O mesmo 403 que generateRentalContract devolve, antes de qualquer leitura\.\s*if \(!canManageContracts\(access\.principal\)\)\s*return NextResponse\.json\(\{ error: 'Acesso negado' \}, \{ status: 403 \}\)/,
        '',
      ],
      [
        'apps/services/api/src/app/api/admin/zoho-mail/oauth/callback/route.ts',
        /export async function GET\(request: NextRequest\) \{\r?\n/,
        "import { receivedCode } from '@/packages/backend/src/http/zoho-oauth-response'\nexport async function GET(request: NextRequest) {\n  const early = receivedCode(new URL(request.url).searchParams)\n  if ('failure' in early) return early.failure\n",
      ],
    ]
    for (const [route, pattern, replacement] of mutations) {
      const original = fs.readFileSync(path.join(ROOT, route), 'utf8')
      expect(
        analyzeRouteModule(path.join(ROOT, route), original).every(
          (endpoint) => endpoint.verdict.ok
        ),
        `${route} baseline`
      ).toBe(true)
      const mutated = original.replace(pattern, replacement)
      expect(mutated, `${route} mutation ${pattern} applies`).not.toBe(original)
      expect(
        analyzeRouteModule(path.join(ROOT, route), mutated).some(
          (endpoint) => !endpoint.verdict.ok
        ),
        `${route} mutated with ${pattern}`
      ).toBe(true)
    }
  })
})
