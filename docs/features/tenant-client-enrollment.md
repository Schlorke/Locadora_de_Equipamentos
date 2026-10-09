# Vínculo do cliente com a locadora do host e área do cliente em modo host

> **Status**: Critical **Last updated**: 2026-10-02

---

## 1. Purpose

No host de locadora (`{slug}.<raiz>`), a locadora vem só do host. Um usuário com
conta na plataforma que entra pela primeira vez numa locadora precisa de um
vínculo explícito, com consentimento, para usar a área do cliente dela. Faz
parte do Lote 6 da ADR `docs/architecture/adr-tenant-hosts.md` (identidade
multi-host).

## 2. Scope

**In scope**

- `POST /api/client/enroll` e o caso de uso `customers/enroll`.
- `RuntimeBootstrap` em modo `host`: vínculo por
  `GET /api/auth/organizations/current`, sem seletor e sem `x-tenant-id`.
- Página `/vincular` (web com consentimento; native informativa).
- Confirmação do `?locadora=` no painel (`app.<raiz>`).

**Out of scope**

- Desenho definitivo e texto de LGPD da tela de vínculo (decisão U3 da ADR). A
  tela atual é provisória, feita só com componentes do design system.
- Vínculo mediado pela equipe quando o documento já pertence a um cliente de
  balcão (decisão pendente).
- Fluxo de vínculo no app mobile (Lote 7b).

## 3. Entry Points

- API legada: `app/api/client/enroll/route.ts`, ativa.
- Serviço parcial: `apps/services/api/src/app/api/client/enroll/route.ts`;
  composição de sessão e resolução pública em `src/host`. Os clientes ainda usam
  a origem legada configurada.
- Entrada estrita comum: `packages/contracts/src/customer-enrollment.ts`.
- Backend: `packages/backend/src/modules/customers/enroll.ts` (exportado pelo
  index de `customers`).
- Frontend: `packages/frontend/src/pages/vincular-locadora`,
  `packages/frontend/src/features/selecionar-locadora/model/{use-host-tenant,use-tenant-suggestion,suggested-tenant}.ts`,
  `ui/HostMembershipNotice.tsx`, `app/providers/RuntimeBootstrap.tsx`.
- Rota do host web:
  `apps/clients/web/src/app/(public)/[locadora]/(auth)/vincular/page.tsx`.

## 4. Core Flow

1. No modo `host` (padrão quando há prefixo interno `/{slug}`), o
   `RuntimeBootstrap` usa `useHostTenantMembership`, que chama
   `GET /api/auth/organizations/current`.
2. 404 `NO_MEMBERSHIP` abre o `HostMembershipNotice`, com botão para
   `/vincular`; 403 mostra aviso de vínculo suspenso ou encerrado.
3. Em `/vincular`, o usuário confirma o consentimento; a página envia só
   `{ consent: true }`.
4. A rota confere origem da mutação, corpo estrito, locadora pela borda
   (`hostKind = 'tenant'`), `x-tenant-id` coerente e sessão. O caso de uso cria
   `Membership(CLIENT, ACTIVE)` e `ClientProfile` com os dados do `User`, mais o
   `AuditLog` `CLIENT_ENROLLED` (consentimento e IP da borda), numa
   `withTenantTransaction`.
5. O vínculo é reconsultado só em `update()` explícito da sessão, não a cada
   navegação. Sair não limpa seleção.

No painel (`app.<raiz>`), `?locadora=<slug>` só gera pedido de confirmação
quando o usuário tem vínculo com a locadora sugerida e ela difere da seleção
atual; confirmar usa a rota explícita de seleção; slug desconhecido é ignorado.

## 5. Components and Files

- `app/api/client/enroll/route.ts`
- `packages/backend/src/modules/customers/enroll.ts`
- `packages/frontend/src/pages/vincular-locadora/**`
- `packages/frontend/src/features/selecionar-locadora/**`
- `packages/frontend/src/app/providers/RuntimeBootstrap.tsx`

## 6. Data and State

- Tabelas: `memberships` (papel fixo `CLIENT`), `client_profiles`, `audit_logs`.
- Vínculo ativo existente, de qualquer papel, é devolvido sem alteração.
- `memberships` é metadado global de identidade e não possui RLS: o caso de uso
  filtra explicitamente usuário e locadora. Perfil e auditoria ficam sob FORCE
  RLS e GUC local de locadora; as três criações usam a mesma transação.
- Estado do frontend: `idle`, `loading`, `member`, `no-membership`, `forbidden`
  e `error`; uma falha transitória numa revalidação não derruba um vínculo já
  confirmado.

## 7. Constraints and Edge Cases

- Nunca cria papel de equipe e nunca reativa vínculo suspenso ou revogado.
- Documento (CPF/CNPJ) que já pertence a outro `ClientProfile` da locadora dá
  409 `PROFILE_CONFLICT`, sem assumir o perfil.
- Corrida (P2002) é relida e devolve o vínculo criado pela outra requisição.
- Com `AUTH_MODE=legacy`, `/vincular` fica oculta pelo layout `(auth)` e por
  `TENANT_ACCOUNT_PATHS` no proxy.
- `apps/clients/web/src/host/routing/decide.visible-routes.test.ts` conhece
  `/vincular` (48 URLs) desde o commit `be859915`.
- No host de locadora, a API de conta liberada é a lista mínima
  `TENANT_ACCOUNT_API` (inclui `organizations/current`; `organizations` e
  `organizations/selection` ficam na `TENANT_API_DENYLIST`), só fora do modo
  legacy (onda 4, entrada 189 de `docs/issues/known-issues.md`).

## 8. Error Handling

| Situação                                    | Resposta                                           |
| ------------------------------------------- | -------------------------------------------------- |
| Origem de mutação não confiável             | 403                                                |
| Corpo inválido ou sem consentimento         | 400                                                |
| Fora de host de locadora                    | 409 `TENANT_REQUIRED`                              |
| `x-tenant-id` diferente da locadora do host | 400 `TENANT_CONFLICT`                              |
| Sem sessão                                  | 401                                                |
| Vínculo suspenso ou revogado                | 403 `MEMBERSHIP_INACTIVE`, sem escrita             |
| Documento de outro perfil da locadora       | 409 `PROFILE_CONFLICT`, sem escrita                |
| Vínculo criado / já existente               | 201 / 200 `{ membership, created }`, `no-store`    |
| Falha inesperada                            | 503 `{ error: 'Vínculo indisponível no momento' }` |

## 9. Performance and Accessibility

- Uma consulta de vínculo por sessão; revalidação só sob pedido.
- A tela provisória usa só componentes do design system; a revisão de
  acessibilidade fica com o desenho definitivo (U3).

## 10. Tests and Validation

- `tests/identity/enroll.integration.test.ts` (banco descartável).
- `tests/unit/customer-enrollment-api.test.ts`: mesma caracterização nos dois
  adapters, usando o caso de uso real com banco simulado.
- `tests/api-host/enrollment.http.test.ts`: builds locais de produção, sessão
  real nos dois modos, estado persistido, consentimento, CSRF, ownership,
  idempotência, concorrência, rollback por falha de grants e RLS de INSERT.
- `tests/identity/multi-host.integration.test.ts` (T9 e T10 da ADR de hosts).
- `packages/frontend/src/app/providers/RuntimeBootstrap.host-tenant.test.tsx`,
  `packages/frontend/src/features/selecionar-locadora/ui/TenantSelector.suggestion.test.tsx`
  e
  `packages/frontend/src/pages/vincular-locadora/ui/VincularLocadoraPage.web.test.tsx`.
- `tests/security/route-auth-inventory.test.ts` cobre a rota nova.
- Comandos: `pnpm test:identity` e `pnpm test:platform`.

## 11. Related Docs

- `docs/architecture/adr-tenant-hosts.md` (Identidade, Lote 6)
- `docs/features/organization-selection.md`
- `docs/features/tenant-request-resolution.md`
- `docs/issues/known-issues.md` (entrada 180)

## 12. Change Log

- 2026-10-02 (corte 26, sem commit): adapter POST no host compartilhado, schema
  estrito comum e caso de uso original preservado. A caracterização antecedeu a
  alteração de produção; sem cutover ou remoção do legado. Evidências e limites
  em `docs/features/shared-api-host.md`.

- 2026-09-26: vínculo com consentimento, área do cliente em modo host e
  confirmação do `?locadora=` (Lote 6, onda 3, commit `be859915`).
- 2026-09-26 (onda 4, sem commit): pendências do H6 resolvidas (links de e-mail
  na origem do host, `?token=` nas páginas `reset-password`, `cookiePrefix` no
  `expoClient`) e API de conta mínima no host de locadora.

---

_Template version: 2026-01-20_
