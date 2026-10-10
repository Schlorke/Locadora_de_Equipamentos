# Seleção de locadora

> Status: em implementação no frontend; API verificada em PostgreSQL
> descartável.

## 1. Purpose

Permitir que uma identidade escolha explicitamente em qual locadora trabalha,
mantendo papéis e dados separados. Não selecionar a primeira organização
automaticamente.

## 2. Scope

Listagem de vínculos ativos do usuário, escolha, retomada validada e limpeza da
preferência. Não provisiona empresas, não migra identidades nem atribui dados
históricos.

## 3. Entry Points

- GET /api/auth/organizations: memberships com TenantContext.
- GET /api/auth/organizations/selection: selection atual ou null.
- POST /api/auth/organizations/selection: JSON com tenantId; retorna selection
  validada.
- DELETE /api/auth/organizations/selection: remove preferência.
- GET /api/auth/organizations/current: modo host (área do cliente no subdomínio
  da locadora). Devolve só o vínculo com a locadora do host, sem listar as
  outras (V26). Ver "Modo host" abaixo.

## 4. Core Flow

1. Exigir sessão para todas as operações.
2. Listar somente vínculos ativos com organizações ativas.
3. Usuário escolhe uma organização. O servidor verifica o vínculo e determina o
   papel.
4. Web recebe cookie HttpOnly, SameSite=Lax, Secure em produção, válido por 30
   dias. O cookie representa somente uma preferência e não concede autorização.
5. Native envia x-tenant-id; o host deve persistir por identidade e revalidar a
   seleção após reinício.
6. Cada operação de negócio verifica novamente sessão, organização e vínculo.
   Troca e logout limpam os caches e o carrinho em memória da seleção anterior.
   Desde a onda 5, o carrinho salvo de cada escopo (locadora e id do usuário)
   fica guardado e volta quando o escopo volta; outra pessoa no mesmo aparelho
   não o vê (entrada 197 de `docs/issues/known-issues.md`). Apagar o carrinho
   salvo ao sair da conta é decisão pendente do usuário.

## 5. Components and Files

- apps/services/api/src/host/organization-selection.ts: composição atual de
  sessão, consulta de vínculo, origem e cookie. A fachada antiga
  lib/organization-selection.ts foi retirada em F.
- apps/services/api/src/host/private-identity.ts: principal obrigatório por
  createTenantPrincipalResolver; parser/formatter de cookie permanece em
  backend/identity. A antiga lib/tenant.ts foi retirada em F.
- packages/backend/src/modules/identity/organization-memberships.ts: consulta e
  DTO de vínculos ativos da identidade, usados pelo adapter HTTP atual.
- packages/backend/src/modules/identity/organization-selection.ts e
  tenant-preference.ts: política de leitura e parser/formatter da preferência.
- packages/backend/src/http/organization-selection.ts: resposta HTTP sem I/O de
  dados, com cache, Vary e cookie preservados.
- packages/backend/src/http/organization-selection-handler.ts: política única de
  GET/POST/DELETE, incluindo sessão antes de dados, origem, parsing e cookie.
- packages/backend/src/modules/identity/public-tenant.ts e
  organization-current.ts: resolução do host antes da sessão e consulta do
  vínculo atual em transação de locadora, sem escolha pela preferência.
- packages/backend/src/http/organization-current.ts: transporte privado, com os
  cabeçalhos originais das respostas de vínculo.
- apps/services/api/src/app/api/auth/organizations/route.ts e selection/route.ts
  e current/route.ts: operações autenticadas incrementais. GET/POST/DELETE da
  seleção e motores de login estão montados na API do workspace. As rotas
  antigas foram retiradas em F; web encaminha para a API configurada e o Expo
  injeta transporte escopado. Callbacks externos precisam ser configurados no
  ambiente real; não são certificados por essa reancoragem documental.
- packages/contracts/src/tenancy.ts: contrato público TenantContext.
- tests/unit/organization-selection.test.ts: handlers com Prisma e vínculos
  reais.
- tests/unit/organization-selection-read.test.ts: mesma caracterização dos dois
  adapters, incluindo falhas e precedência de autenticação.
- tests/unit/current-organization-read.test.ts: host antes da identidade,
  consulta composta e contexto SQL da locadora, erros, projeção e ordem dos
  efeitos.
- tests/api-host/organizations.http.test.ts: paridade entre processos com
  cookies reais, vínculos e revogação dos dois engines.

## 6. Data and State

User é identidade global; Membership define papel por Organization. A seleção
não altera nenhuma dessas tabelas. Todas as respostas da API são no-store. Vary
distingue cookie e cabeçalho.

## 7. Constraints and Edge Cases

Papel informado pelo cliente não é usado. Cookie duplicado ou header/cookie
conflitantes produz 400. GET de seleção revogada retorna null e limpa cookie.
POST sem vínculo ativo produz 403. Não existe fallback para User.role, para a
primeira empresa ou para GB-Locações.

## 8. Error Handling

401 sem sessão, 400 seleção inválida, 403 sem vínculo/origem cruzada, 415 para
POST sem JSON, 503 se a seleção não puder ser validada. Origem de navegador deve
coincidir com a API; native sem Origin segue sujeito à sessão e ao vínculo.

## 9. Performance and Accessibility

Consultas usam identidade e tenant explícitos. A interface deve oferecer nomes
legíveis, estado de carregamento/erro e escolha por teclado ou toque. A
validação da API não comprova interação em dispositivo.

## 10. Tests and Validation

Sete testes com PostgreSQL descartável: nenhuma escolha implícita; identidade
com papéis diferentes; empresa sem vínculo; revogação e suspensão; troca e
limpeza; ambiguidade de contexto; origem/JSON e sessão obrigatória. Nenhuma
chamada a provedor externo.

## 11. Related Docs

- [Isolamento multiempresa](../architecture/multiempresa.md)
- [Frontend compartilhado](modernization-frontend.md)

## 12. Change Log

- 2026-10-02 (sem commit): POST/DELETE montados no serviço sobre a política
  compartilhada anterior, sem escolha implícita ou mudança do papel informado
  pelo vínculo. Cookies reais emitidos pelo serviço são lidos nos dois hosts. A
  regressão anterior agora verifica escrita e leitura em ambos, preservando os
  valores exatos de cookie, revogação, JSON, HEAD e OPTIONS. Os 26 casos da
  seleção passaram com cada motor de identidade. Detalhes na onda 55 de
  [API compartilhada](shared-api-host.md).
- 2026-10-01 (sem commit): `/current` montado no serviço com resolução de host e
  consulta compartilhadas. Preferências não trocam a locadora; contexto não
  substitui sessão. Escritas, clientes e tráfego preservados. Provas no corte 11
  de [API compartilhada](shared-api-host.md).
- 2026-10-01 (sem commit): GET de seleção montado no serviço, delegando a
  política e a consulta ao backend. Cookie/header continuam preferências; papel
  vem do vínculo atual. POST/DELETE continuam apenas no legado, sem mudança de
  origem dos clientes. Provas e limites no corte 10 de
  [API compartilhada](shared-api-host.md).
- Unreleased: API de preferência de locadora validada e coberta por regressões
  reais; integração visual ainda em andamento.
- 2026-10-01 (sem commit): listagem de vínculos compartilhada com o serviço;
  caracterização protege sessão antes do banco, filtro de identidade/atividade,
  papéis dos vínculos, projeção, ordenação e lista vazia. A prova HTTP usa
  cookies reais dos dois engines e revalida revogação/suspensão. Sem mudança de
  preferência ou de URL dos clientes. Detalhes em
  [API compartilhada](shared-api-host.md).
- 2026-09-26 (onda 2, commit `da19f601`): `GET /api/auth/organizations/current`
  e candidatas de locadora (host, header, cookie) no principal.
- 2026-09-26 (onda 3, commit `be859915`): `RuntimeBootstrap` em modo host com
  `/current` e confirmação do `?locadora=` no painel.
- 2026-09-26 (onda 4, commit `4b02f52f`): contrato de `/current` fora de host de
  locadora (409 com `code`, `private` e `Vary`, sem consulta) e
  `/api/auth/organizations` e `/selection` na `TENANT_API_DENYLIST` do host de
  locadora.
- 2026-09-29 (onda 5, sem commit): seletor do painel como barra compacta no web
  (`TenantSelector.web.tsx`, contrato em `ui/contract.ts`); carrinho salvo por
  escopo preservado na troca; `WEB_PUBLIC_ORIGIN` vale para toda mutação de
  navegador sem borda.

## Modo host (locadora pelo subdomínio)

No host de locadora (`{slug}.<raiz>`), a locadora vem só da borda validada do
proxy; seletor, cookie e `x-tenant-id` não escolhem outra.

- `GET /api/auth/organizations/current`: 200 `{ membership: TenantContext }`;
  404 `NO_MEMBERSHIP` sem nenhum vínculo; 403 com vínculo suspenso ou revogado
  (a tela de vínculo não reativa vínculo revogado); 401 sem sessão; todos com
  `private, no-store` e `Vary: Cookie, Host`. Fora de host de locadora, sempre
  409 `{ error, code: 'TENANT_REQUIRED' }` com os mesmos cabeçalhos, sem
  consultar o banco e ignorando `tenantSlug` na query (onda 4). No host de
  locadora, `tenantSlug` de outra locadora dá 400 `TENANT_CONFLICT` e locadora
  inexistente ou suspensa dá o 404 neutro, com os cabeçalhos canônicos
  (`no-store`) de todas as rotas.
- No principal privado, a locadora do host entra como candidata junto de
  `x-tenant-id` e do cookie; ids distintos respondem 400
  `Conflicting tenant selection` antes de buscar membership.
- O proxy do host web remove o cookie `selected-tenant-id` do `Cookie` repassado
  em host de locadora e nega `/api/auth/organizations` e
  `/api/auth/organizations/selection` ali.
- Lote 6 (onda 3, commit `be859915`): o `RuntimeBootstrap` tem `tenantMode`
  `'selection' | 'host'`. Em modo `host` (padrão quando há prefixo interno
  `/{slug}`) ele usa só `/current`, sem seletor e sem `x-tenant-id`; 404 abre o
  aviso com o botão para `/vincular` e 403 mostra vínculo suspenso ou encerrado.
  Ver `docs/features/tenant-client-enrollment.md`.
- Painel (`app.<raiz>`): `?locadora=<slug>` só pede confirmação quando o usuário
  tem vínculo com a locadora sugerida e ela difere da seleção atual. Confirmar
  usa `POST /api/auth/organizations/selection`; slug desconhecido é ignorado sem
  revelar nada (`useTenantSuggestion`, `features/selecionar-locadora`).
- Seletor do painel (onda 5, lote D2): o `TenantSelector` tem contrato e textos
  em `features/selecionar-locadora/ui/contract.ts`. No web
  (`TenantSelector.web.tsx`) é uma barra compacta de 53 px: região "Locadora do
  painel", rótulo "Locadora" que dá nome ao seletor (`Label`, `Select`,
  `Button`, cores de token e ícone `Building2`), com a pergunta do `?locadora=`
  e o erro (`role="alert"`) na própria barra; no celular, com a pergunta, 170
  px. No app, `TenantSelector.native.tsx` mantém o bloco antigo. O comportamento
  é o mesmo (trocar, confirmar ou dispensar a sugestão, tentar de novo). O bloco
  antigo do web media 466 px por causa do `line-height` sem unidade do `Text`
  (entrada 204).

Detalhes: `docs/features/tenant-request-resolution.md` e
`docs/features/tenant-hosts-web.md`.

## Origem pública durante a transição dos hosts

O novo host usa `WEB_API_ORIGIN` privada para encaminhar as APIs ainda legadas.
O backend configura `WEB_PUBLIC_ORIGIN` com a origem pública exata (protocolo,
domínio e porta, sem caminho), alinhada a `NEXTAUTH_URL` ou `BETTER_AUTH_URL`.
Desde a onda 5, toda mutação de navegador com cookie sem borda validada (não só
seleção e configurações) confere o Origin contra essa origem explícita, pelo
guard central de `resolveTenantPrincipal`, preservando a proteção CSRF mesmo
quando o proxy muda o Host interno (entrada 196 de
`docs/issues/known-issues.md`). Cabeçalhos `Forwarded` e `X-Forwarded-Host` não
concedem confiança; sem configuração, exige a própria origem da requisição, e um
valor inválido recusa navegador. Fluxos native sem `Origin` nem `Sec-Fetch-Site`
continuam sujeitos à sessão e membership.
