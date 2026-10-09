# Backoffice da plataforma

> **Status**: Critical **Last updated**: 2026-09-26

---

## 1. Purpose

A equipe da plataforma opera assinaturas, planos, contas de recebimentos e
suporte em `app.<raiz>/backoffice`, sem nunca ver os dados de negócio das
locadoras. Esta página descreve o contrato do backoffice e do acesso de suporte,
definido pelo ADR `docs/architecture/adr-saas-subscription.md` (B.9, D16 e D17).

O lote S0 entrega só o contrato em `@gb-locacoes/contracts/backoffice`. A API,
as telas, o 2FA e as auditorias vêm no lote S12.

## 2. Scope

**In scope**

- Papéis: `PLATFORM_ADMIN`, `PLATFORM_FINANCE`, `PLATFORM_SUPPORT` e
  `PLATFORM_VIEWER`.
- Matriz de permissões da seção B.9 (`BACKOFFICE_PERMISSIONS` e `staffCan`).
- Entradas das ações, todas com motivo de 10 a 500 caracteres: publicar versão
  de plano, cortesia, estender teste (1 a 30 dias), exceção de plano, estorno,
  bloqueio administrativo e break-glass (categoria obrigatória, até 4 h).
- Acesso de suporte concedido pelo dono: 1, 24 ou 72 h, somente leitura.
- Leituras: locadora (com contato do dono), uso, métricas, auditoria e inbox de
  plataforma.
- Códigos de erro 403 da equipe e do suporte.

**Out of scope**

- Guarda de identidade da equipe, 2FA TOTP e sessão fresca (S12, depois do H6).
- Principal sintético de suporte no contexto da locadora (S8 e S12).

## 3. Entry Points

- Contrato: `packages/contracts/src/backoffice.ts`, exportado como
  `@gb-locacoes/contracts/backoffice`.
- Rotas futuras (B.13):
  `/api/backoffice/{tenants,tenants/[id]/*,plans,metrics,audit,support,payment-accounts/[id]/retry,inbox}`
  e `GET|POST|DELETE /api/admin/support-access` (só o dono).

## 4. Core Flow

1. A pessoa da equipe entra com 2FA; a guarda consulta `PlatformStaff`.
2. Cada ação confere `staffCan(papel, ação)` e exige motivo; tudo é auditado.
3. Para ver a locadora por dentro, o suporte precisa de concessão vigente do
   dono (somente GET e HEAD); cada requisição é auditada na locadora e na
   plataforma.
4. Break-glass (incidente, fraude ou ordem legal) exige dois ADMIN distintos,
   dura até 4 h e o dono é avisado depois, salvo impedimento legal.

## 5. Components and Files

- `packages/contracts/src/backoffice.ts`
- `packages/contracts/src/backoffice.test.ts`

## 6. Data and State

- Tabelas futuras (S2): `platform_staff`, `support_access_grants`,
  `platform_audit_logs`, `platform_webhook_inbox`, `tenant_usage_snapshots`,
  mais as tabelas de assinatura.
- Métricas em string decimal, calculadas em `Decimal` só sobre tabelas de
  plataforma: MRR (anual/12), MRR em teste, MRR em risco, churn de logos e de
  receita, conversão de teste, inadimplência e arrecadado.
- `storageBytes` trafega como inteiro em string (vem de `BigInt`).

## 7. Constraints and Edge Cases

| Ação                                             | ADMIN | FINANCE | SUPPORT | VIEWER |
| ------------------------------------------------ | ----- | ------- | ------- | ------ |
| Ver locadoras                                    | sim   | sim     | sim     | sim    |
| Ver métricas                                     | sim   | sim     | não     | sim    |
| Publicar versão de plano                         | sim   | não     | não     | não    |
| Cortesia, estender teste, exceção, estorno       | sim   | sim     | não     | não    |
| Bloqueio administrativo e desbloqueio            | sim   | não     | não     | não    |
| Reenfileirar, runbooks de chave e webhook, inbox | sim   | não     | sim     | não    |
| Sessão de suporte com concessão                  | sim   | não     | sim     | não    |
| Break-glass (com um segundo ADMIN)               | sim   | não     | não     | não    |

- A lista de locadoras nunca carrega equipamentos, clientes, orçamentos, CNPJ ou
  telefone; a conta de recebimentos aparece só com modo, estado e saúde.
- A auditoria mostrada não tem IP nem metadata.
- Publicar versão de plano aceita só `MONTHLY` no MVP.
- O motivo mínimo de 10 caracteres segue o CHECK de `SupportAccessGrant.reason`
  e vale para todas as ações (definição do S0).

## 8. Error Handling

- Quem não é da equipe (inclusive membro de locadora) recebe 404 neutro.
- 403 com `{ error, code }`: `STAFF_TWO_FACTOR_REQUIRED`,
  `STAFF_ROLE_FORBIDDEN`, `SUPPORT_GRANT_REQUIRED` e `SUPPORT_READ_ONLY`.

## 9. Performance and Accessibility

- Contrato puro e universal (só zod).
- Páginas do backoffice com `noindex`; o app mobile nunca importa as páginas do
  backoffice (regra `BACKOFFICE-WEB-ONLY`, S2 e S12).

## 10. Tests and Validation

- `pnpm exec vitest run --config vitest.platform.config.ts packages/contracts`
- Os testes provam: a matriz exata da seção B.9 (VIEWER só lê, SUPPORT sem
  métricas); motivo obrigatório; limites de teste, break-glass e concessão;
  somente leitura; leituras sem dado de negócio, segredo, IP ou metadata;
  métricas e bytes em string.

## 11. Related Docs

- `docs/architecture/adr-saas-subscription.md`
- `docs/features/assinatura-plataforma.md`
- `docs/features/limites-plano.md`
- `docs/features/conta-recebimentos.md`

## 12. Change Log

- 2026-09-26: Contrato do backoffice e do acesso de suporte criado (lote S0).

---

_Template version: 2026-01-20_
