# Testing Guide - GB Locacoes

This guide describes the integration workflow used by `pnpm test` and the wider
checkpoint validation. The goal is to validate the critical business flows
required for the project to operate correctly.

## Cadência proporcional (decisão humana de 2026-10-09)

Durante edição, execute os testes do assunto e dos consumidores afetados:
`pnpm test:unit <arquivo>`, `pnpm test:platform <arquivo>` ou o perfil HTTP
focado pertinente. Mudanças em ferramentas usam `pnpm test:gates`; mudanças
visuais usam suas ferramentas e o cenário real afetado. Um foco parcial não
certifica a bateria inteira. Não desative isolamento global para ganhar tempo:
as suítes usam globals, mocks, env e runtimes com estado.

No fechamento da etapa, congele as fontes e execute `pnpm test:all`, gates,
tipos, lint e builds pertinentes. HTTP/auth/SSR/clientes executam nos motores
suportados; suítes puras não precisam repetir por uma flag que não afeta seu
contrato. Repita uma verificação depois de mudança relevante ou falha, evitando
rodadas integrais a cada ajuste. O hook de commit formata apenas Markdown
preparado; ele não impõe toda essa bateria ao desenvolvimento diário.

`test:all` reúne unit, security, identity, contract, platform, mobile, web, API,
integration e visual-tools. API exige perfil/banco próprios; jornadas e captura
visual reais são opt-in explícitos, não os skips do comando web padrão.
`test:gates` é um subconjunto da unitária e não precisa ser rodado outra vez
quando o mesmo source já passou a unitária inteira. Upload pertence à unitária;
os 21 testes tributários pertencem à suíte colocada de domínio. Schemas puros
não iniciam a API. Nenhum corte remove provas de dinheiro, RLS/tenant,
autenticação, concorrência, outbox, rollback ou recuperação.

`pnpm test`/`test:integration` executam somente a seleção de integração abaixo;
`ci:full` histórico também não representa todas as suítes de `test:all`. A
verificação complementar sem banco é focada nos casos que o perfil com
`TEST_DATABASE_URL` pula. Skips deliberados devem ser identificados no
relatório.

## What `pnpm test` runs

- Starts the **compiled shared API** (`apps/services/api`, the Next standalone
  server from `pnpm build:api`) for the HTTP checks (default port `3101`); the
  legacy root's `next dev` is no longer used (wave 135, E4). Run
  `pnpm build:api` first: without the build the setup stops with that
  instruction instead of falling back to the legacy root.
- Runs `prisma migrate deploy` against `TEST_DATABASE_URL` before starting the
  server (`tests/global-setup.ts`; the migrations carry the RLS policies)
- Runs Vitest unit + integration tests; the fixtures and the suite read the
  database through the backend runtime (`getDatabaseRuntime()` from
  `@gb-locacoes/backend/runtime`), the same singleton the shared API uses, and
  the critical payment/quote tests run against the legacy facade and the shared
  API composition (`apps/services/api/src/host/*`) side by side until the legacy
  root is removed
- Stops the server when tests finish

## API parity (`pnpm test:api`) with or without the legacy root

`tests/api-host/global-setup.ts` reads `API_LEGACY_MODE`:

- `production`: `next start` over the legacy root build (CI profile while the
  root exists);
- `absent`: only the shared API starts and `context.legacy` is `null`; the log
  says `service only (legacy root absent)`;
- empty or `dev`: `next dev` on the root, for local debugging. Any other value
  is refused before the database is touched.

Sessions are always created on the shared API (`tests/api-host/identity.ts`) and
`NEXTAUTH_URL` points at the API's HTTP origin, so NextAuth keeps its cookie
names and the forged-cookie checks keep reading the forged value. Test files
walk the running hosts through `tests/api-host/targets.ts` (`parityTargets`,
`namedParityTargets`, `rotatingTarget` for concurrent bursts,
`sequentialTargets`/`otherTarget` for single-use and idempotency proofs with two
real requests). A host-to-host comparison goes through `compareAcrossTargets`,
which throws with fewer than two hosts instead of passing empty; without the
root those comparisons must become explicit expectations.

Every parity file checks each running host against an **explicit expectation
built from the fixture** (status, body and the headers it reads), never one host
against the other (wave 135, B2). `tests/unit/api-host-parity-scan.test.ts` (in
`pnpm test:unit`) fails on the old patterns: the root as oracle
(`toEqual(legacy…)`, `const [legacy, …]`), a hand-written host list,
`compareAcrossTargets(` outside `targets.ts`, an element of a list compared with
another element of the same list and `new Set(…).size`. The last two are
accepted only with a `// parity-scan: <reason>` comment (same line or up to
three lines above) when they compare real calls to the same host (idempotency,
concurrency, single use).

The scanner also follows mutable HTTP captures by AST symbol, including
arbitrary names and response-returning helpers, and rejects `B2-CAPTURE`
placeholders in HTTP tests. It distinguishes local fixture data, shadowed
symbols and visual baselines from captured response oracles. This bounded static
check complements execution; it does not prove functional equivalence by itself.
PDF checks include business values and tenant identity separately from the
direct/proxy byte comparison. Binary asset checks use non-UTF-8 bytes and
`arrayBuffer`; provider bridges must preserve those bytes too.

`tests/api-host/parity-setup.ts` (loaded by `vitest.api.config.ts`) records,
outside the repository, every request of the run to a host (`api` or `legacy`:
method, path and status, also through the web proxy bridge), every case
(`expect.getState().assertionCalls`) and every file that ran. The folder is
`%TEMP%/locadora-api-parity/<legacy mode>-<engine>/` (or
`API_PARITY_RECORD_DIR`); each run truncates only its own files. Reports
(`tests/api-host/parity-report.mjs`):

- **Coverage (B3)**: when the whole suite ran, the global teardown checks that
  each of the 221 methods of `tests/security/fixtures/api-surface.json` had an
  expected success on the API (2xx, or a 410/503 written in its own `route.ts`);
  refusals (401/403/404/409…) do not count. A method without success fails the
  run unless it is listed with a reason in
  `tests/api-host/route-coverage-exceptions.json` (the list only shrinks: an
  entry already covered, outside the surface or without a reason fails).
  `node tests/api-host/parity-report.mjs coverage <record dir>` prints it.
- **Assertions (B11)**:
  `node tests/api-host/parity-report.mjs assertions <dir with the root> <dir without it>`
  compares the cases of a run with the root (`API_LEGACY_MODE=production`) and
  one without it (`absent`): every case without the root needs at least one
  assertion and at least half of the assertions it had with the root; a case
  that exists only with the root must be a root arm (its name says
  legado/legacy/raiz). Case names are normalized (`<api>`, `<legacy>`, `<run>`,
  `<uuid>`) so runs compare. The CLI rejects missing/empty records, failed
  cases, incomplete files, mismatched engines/profiles and a changed test/API
  surface. Both runs must use compiled production hosts. `meta.json`
  fingerprints the API surface and test sources, API fixture/helpers,
  role/migration SQL and the API Vitest configuration; changing any of these
  requires fresh records. `completion.json` links the final Vitest file/test
  states and unhandled-error count to that run's start. The global teardown
  writes it only after fixture cleanup and coverage succeed. Intentional
  skips/todos remain explicit. Records from before this format need new runs; a
  filtered run can finish but cannot certify B11 for the whole surface.

The base parity fixture has no subscriptions and explicitly starts its owned
servers with `PLATFORM_SUBSCRIPTION_ENFORCEMENT=off`, matching that fixture's
contract. An inherited empty value is invalid and correctly returns 503; the
harness must not rely on a developer `.env` to choose this mode. Policy-on
checks use isolated receiving-account fixtures with their own subscriptions and
explicit configuration. This does not change the application's defaults.

Owned server shutdown uses `tests/helpers/owned-process.ts`: a successful
signal/taskkill request is insufficient; the actual child must finish within the
deadline. The taskkill child is also observed. Cleanup tries sibling children
and local bridges/providers/logs even after a failure, then throws an aggregate
error. That error prevents database deletion/drop and parity completion, while
owned database clients/pools are disconnected. No process is selected by an
occupied port, executable name or external PID.

`tests/api-host/onboarding.http.test.ts` (B10) proves the tenant signup over
real HTTP: with the signup off (today's default) on the hosts of the run, and
with it on in an isolated fixture (own database, roles and API) where, on
`better-auth`, the owner registers, confirms the e-mail through the real link,
signs in, checks the address and creates the rental company once with an
`Idempotency-Key`; on `legacy` the enabled configuration is refused. The captcha
Siteverify and the leaked-password range are loopback doubles
(`startReceivingAccountFixture({ interceptHosts, provider })`).

Real account e-mails go to a loopback Resend double (`RESEND_BASE_URL`,
`tests/api-host/resend-provider.ts`): `email-links.http.test.ts` follows the
verification and reset links on both identity engines. Run the CI profile
(`API_HOST_MODE=production`, both `API_AUTH_MODE` values) after
`pnpm exec next build`, `pnpm build:api` and `pnpm build:web`.

`AUTH_MODE` is a private runtime setting in the compiled API/root, so the HTTP
matrix can exercise both identity engines with those builds. The web browser
bundle embeds `NEXT_PUBLIC_AUTH_MODE` at build time. Passing the HTTP matrix
does not validate browser J1–J7 in both modes: rebuild the web for each mode,
align the private runtime mode, then run those journeys. Extracting and
forwarding real cookies in HTTP also does not prove the browser's cookie
storage/SameSite/Secure policy, hydration or login/logout UI.

`tests/e2e/journeys.spec.ts` runs those journeys with `JOURNEYS_E2E=1` and
`JOURNEYS_AUTH_MODE` matching the compiled web. It uses ephemeral TLS for
`*.journeys.test`, resolved only by its Chromium, and requires free local port
443 because production origins have no configurable public port. Authentication
is real; only external providers/captcha are local doubles. Separate canonical
business/platform roles use an owned disposable database. Cookie artifacts omit
values. Cleanup observes all owned children and preserves the database/roles if
any shutdown fails; logs and screenshots stay outside the repository.

The final Better Auth run passed eight cases and one contractual skip in nine,
in 84.77s, using web build `r2B-vsczGQAqwkg72XsRq`. Evidence lives in
`%TEMP%/locadora-journeys-2cWyfY`; the resume directory contains
`journeys-better-auth-final-coherent-dom.log` and
`journeys-better-auth-final-record.json`, which fixes the source/build hashes.
J1 reads the expected item, absent other-tenant item, controls and values in one
DOM snapshot while preserving remote cart, database, quote and outbox
assertions. Its delivery proof records item 200 + fee 30 = 230, one quote and an
empty cart after reload. J4 checks the account menu before/after reload. J7
follows the real verification callback, observes the actual successful sign-in
POST, then checks the company step, one session read and organization/checklist
creation.

The login helper uses a bounded 500ms/30s loop that fails on the first non-200;
production rate limits remain unchanged. Passive browser diagnostics recorded 96
session GETs, all 200, plus verified owner-account 200 in the final run. The old
polling observed 429 in `hPjWdt`, but the cause of the later UI timeout in
`tVke0w` was not captured. A passive run retaining 50ms also passed, with 91
session GETs before J7; shared budget pressure remains a hypothesis for that
timeout. Browser counts do not include SSR or internal server calls.

The final legacy run on the same test SHA-256
`9c3c1624e7789ffed2d02c687e9d187e1ec84558314119b18e6bb6b69c55c5ae` passed seven
cases and two contractual skips in nine, in 32.56s, using web build
`qUsWUvj6ANYgIJAuWlNLR`. Evidence: `%TEMP%/locadora-journeys-N7wbsX`,
`journeys-legacy-final-coherent-dom.log` and
`build-legacy-final-coherent-dom.json`. J1's guest delivery proof records 200 +
30 = 230, one quote and an empty cart after reload. The subsequent Better Auth
rebuild `R7kHAAzDS69RA5Yc0oQ1F` prepares the full visual run without changing
product sources (`build-better-auth-final-coherent-dom.json`); the Better Auth
journey result above retains its original build provenance. Full visual
acceptance remains pending.

The original `tests/e2e/tenant-hosts.spec.ts` separately exercises T5/T6 over
owned `*.localhost` hosts: routing, two-tenant isolation, catalogue/detail and
Chromium client navigation/reload. The legacy run passed 7/7 with no skips in
5.85s. The browser recorded no page errors or hydration warnings; diagnostics
allowed owned loopback traffic only and fabricated no responses/authentication.
`%TEMP%/locadora-wave135-resume-20261008/tenant-hosts-legacy-ef0267e0e7/completion.json`
records success, observed child shutdown and successful cleanup, with no
database or roles preserved. The browser artifacts were captured before its
original close. This proof used API build `zWY7S7AvPwHTl8TUb4CeS` and web build
`q_qL-hP87HrDszOcj6H0K`; it does not certify later source changes.

The original T5/T6 spec also passed 7/7 with no skips in 5.86s on Better Auth,
using API build `zWY7S7AvPwHTl8TUb4CeS` and Better Auth web build
`r2B-vsczGQAqwkg72XsRq`.
`%TEMP%/locadora-wave135-resume-20261008/tenant-hosts-better-auth-a99ccdf7a6/completion.json`
records success, zero page/artifact errors, observed child shutdown and
successful cleanup with no database or roles preserved. Browser artifacts were
captured before the original close; diagnostics fabricated no
responses/authentication. This host/catalogue/detail proof does not certify
Better Auth identity journeys or later source changes. Visual comparison has
pending records awaiting acceptance, and A10 remains partial; catalogue/detail
navigation does not mount or validate the 3D carousel.

The production visual run
`visual-narrow/full-v4-better-auth-20261009T013001Z-84d4e6b9` passed 80 cases in
747.728s, but its catalogue files contained only `base`. The 78 valid
non-catalogue pages/162 states were retained. After the empty-filter/parser
repair and the exact 187-key catalogue guard, a separate unfiltered catalogue
run passed two cases in 20.4 minutes. Visual tools passed 93/93 in six files;
focused type diagnostics were 0/0 and focused lint exited 0.

The executed composition in `visual-narrow/composed-v4-pages-catalog-final`
contains **80 JSON files, 536 states and 536 screenshots**: 162 states from 78
pages plus 374 from two catalogue captures. `composition-manifest.json` retains
each file's origin/SHA-256 and both reports/fingerprints, including the
different spec/input hashes. `summary.json` records zero selected page errors,
pending network, unmapped APIs, unstable waits and new/missing/stale files. The
baseline has 528 states; the extra eight are documented configuration states.
This is selected evidence from two runs, not one integral execution or full
repeatability evidence.

The comparator exited **1: 16,272 pending records and 372 already approved**.
These records describe computed CSS properties and element/state/section
presence, not pixel differences. Capture/composition/comparison ran, but image
inspection and visual acceptance remain open; triage is recorded below.
Product/build/ ModelViewer, fixtures, preparation and baselines were unchanged.

Read-only triage attributes 16,260 pending records to the eight historical panel
screens in issue 295. The other twelve are `background-image` serialization
candidates: `to right` versus `90deg`, with identical three RGB colours/stops
(four recovery/reset, two A9 equipment-edit, six storefront detail). This
creates no approval; the literal comparator still exits 1. Other reviewed A9
scenarios add no further pending records.

The current 390px Dialog/open screenshot and historical f1/f2 are byte/SHA
identical (`CB4A7E…`, 13,975 bytes), with the same 25-element tree and
dialog/backdrop CSS. The visibility gap predates this capture; no regression was
demonstrated. Runtime positioning/cause and visibility proof remain open.
Neither oracle nor baseline was changed to remove these records (issues
295/335).

A subsequent external diagnostic ran one case/four cells (frozen/real clock ×
screenshot allow/disabled), with a 13.4s wrapper, zero errors/unmapped APIs/
pending network, observed child exit 0 and owned ports free. As recorded in
`visual-narrow/dialog-geometry-readonly-analysis.md`, scrolling to the marker
left the 390×844 VisualViewport at [32,422]×[480,1324], entirely outside the
stable popup box (x591.406/y1350.406/w377.188/h675.188) in all four conditions.
This explains the capture-sequence limitation. The origin of inner 1560×3376
remains open; the diagnostic certifies neither usability nor universal absence
of a product defect. Product/spec/baseline/oracle were unchanged.

The current acceptance backlog and effort ranges are in the handoff, sections
8–9. Closed HTTP v2/B11, both journey modes and original T5/T6 are retained;
there is no new blanket two-engine rerun in the current local estimate. Review
issue 295, the twelve gradient candidates and Dialog visibility; complete the
partial Slow 3G proof; update only checks affected by later edits. Docker needs
a usable CLI/daemon. The authorized exact commit/tag, independent clone/P2/M7
and post-F revalidation remain separate future milestones; the full batteries
prescribed for those future rootless states do not invalidate today's closed
evidence. No percentage of overall completion is inferred.

The executed pre-documentation audit in
`final-audit-before-checkpoint/audit.json` exited 0: all 478 original entries
accounted for (408 byte-identical, 68 changed within scope, two preexisting
deletions), no new loss/deletion or staging. Three known parity-source returns
to HEAD reconcile the inventory: 506 dirty files and 31 additions outside the
baseline. HEAD 873d8fbc and original `.expo` were preserved. Cleanup completed
with zero pending/unconfirmed owned resources and no audit problems; owned
PostgreSQL stopped with exit 0 and data preserved. This attestation precedes the
final Markdown edits; the coordinator will refresh it afterward. Architecture/
tokens/test names/CSS/hygiene, global lint and broad typing (14 tasks) exited 0.

The owner's subscription commands (`activate`, `cancel`, `undo-cancel`,
`reactivate`) run over real HTTP in `subscription-commands.http.test.ts`, on the
isolated database and platform role of `receiving-account.ts`. A storefront
quote (`POST /api/quotes`) is created through the compiled web proxy of a tenant
host in `web-consumers.http.test.ts`.

## Required environment variables

Use a **dedicated test database**. Tests create and delete records.

```env
TEST_DATABASE_URL="postgresql://username:password@host:port/database?schema=public"
TEST_PORT="3101"
TEST_BASE_URL="http://localhost:3101"
```

Notes:

- `TEST_DATABASE_URL` is required; tests abort if it matches `DATABASE_URL` or
  points to the same non-local host.
- `TEST_PORT` defaults to `3101`.
- `TEST_BASE_URL` defaults to `http://localhost:${TEST_PORT}`.

## Safety defaults used in tests

To avoid external side effects, tests force safe defaults:

- `BOLETO_GATEWAY_TYPE=direct` (overrides env, no external boleto gateway)
- `RESEND_API_KEY` cleared (no outbound emails) in the integration suite; the
  parity suite sets a fixture-only key and `RESEND_BASE_URL` to its loopback
  double, so nothing reaches the provider
- `FROM_EMAIL` and `CONTACT_EMAIL` cleared
- `TEST_MODE=true` (suppresses expected validation error logs during tests)

If you **want** to test real integrations, run them manually, outside of
`pnpm test`.

## Database privileges in tests

Test files run in parallel against the same disposable database. A test that
grants or revokes privileges on a shared object (the `public` schema, tables
such as `organizations`, `settings` or `categories`), runs `DROP OWNED`,
`DROP ROLE` or `ALTER ... OWNER TO`, or applies a `prisma/sql/roles/*.sql`
script must call `alterSharedAcl` (its own transaction) or
`alterSharedAclInTransaction` (inside a transaction the test already opened)
from `tests/helpers/shared-acl.ts`. Both start with the same transaction
advisory lock: without it, two such changes at the same time rewrite the same
catalog row and PostgreSQL fails one of them with
`XX000 tuple concurrently updated` (wave 134).

The lock lasts until the helper's own `COMMIT` for every kind of connection a
test passes (`pg.Client`, `pg.Pool`, `PrismaClient`):
`tests/unit/shared-acl.test.ts` stops each kind in the middle of its statements
(on an advisory lock of its own) and checks that it still holds the lock, then
runs a burst of parallel changes of that kind. A lock taken outside the
transaction makes both checks fail. The `pg.Pool` it uses has two connections:
while the change is stopped, a request queued on the same pool must only get the
change's connection after its `COMMIT`, outside any transaction, so a change
that sends each statement through `pool.query` fails too. Other test files hold
the helper's lock at any moment of `pnpm test:unit`, so these checks wait for
the exact lock (the helper's or the test's own) instead of the first wait they
see, and pass under that contention.

`tests/unit/shared-acl.gate.test.ts` fails on any of these statements outside
the helper in the test directories, including inside a `DO $$ ... $$` block, an
`EXECUTE` of a dynamic string, and a variable that is later sent to the
database. Its exceptions, each listed in the gate with its reason, are files
that change privileges in a database or schema they create and drop themselves,
with roles of their own. The helper cannot serialize anything there anyway:
PostgreSQL scopes an advisory lock to its database, so another database takes
the same key without waiting. One of them,
`tests/unit/migration-preflight-rls.test.ts`, also grants `CREATE` on the shared
test database itself to its own role and revokes it with `DROP OWNED`; both
rewrite that database's row in `pg_database`, which no other test changes. If
another test starts changing it, both use the helper and the entry leaves the
list. A new test with its own database or schema is added to the list with its
reason; a file that moves to the shared database leaves the list and uses the
helper.

## How to run

1. Set `TEST_DATABASE_URL` (required).
2. Run:

```bash
pnpm test
```

## Critical flows covered

- Quote creation with item pricing and automatic boleto generation
- Stock blocking rules (pending vs paid rentals)
- Admin approval and price adjustment rules
- Payment processing updates (quote approval, rental activation)
- Late fee calculation and application

## Troubleshooting

- `Failed to sync test database schema`: verify connectivity to
  `TEST_DATABASE_URL` and check duplicate data that may block unique
  constraints.
- `API server not available`: the test server could not start on `TEST_PORT`.
  Choose a different port: `TEST_PORT=3102 pnpm test`.
- `TEST_DATABASE_URL must not match DATABASE_URL`: ensure the test database uses
  a different host or project.
- `TEST_DATABASE_URL is required`: configure `TEST_DATABASE_URL` with a
  dedicated test database.
- Slow startup: ensure the database is reachable and responsive.
