# Modernização da plataforma de locação de equipamentos

Onda 135 — decisão vigente de 2026-10-09: o dono aceitou a interface e
autorizou, após a validação da fonte final, o commit e o push da primeira etapa
para o novo repositório público vazio `Schlorke/Locadora_de_Equipamentos`.
Depois, a modernização continua até a aposentadoria do app antigo, seguindo
P0/P1/P2 e F; essa autorização não declara essas fases concluídas.

A publicação terá história inicial limpa, sem pais do histórico antigo. O
histórico anterior e suas referências ficam no arquivo local de preservação; não
publicar commits, tags ou ramos antigos que transportem segredos. Não alterar
nem revogar credenciais reais: elas podem ser compartilhadas com a GB. O backend
nesta etapa usa PostgreSQL local descartável. Infraestrutura, provedores, banco
de produção e corte operacional ficam para etapas posteriores.

A fonte atual do frontend tem zero ocorrências de `UNIVERSAL-DOM-JSX` e
`UNIVERSAL-WEB-LIB`. O gate de arquitetura ainda registra 43 ocorrências em 16
arquivos, todas do legado; passar a catraca não encerra a retirada. F será
aplicado primeiro em clone independente da referência imutável de pré-exclusão,
após a preservação e as provas exigidas, antes de importar e revalidar o
resultado. Não apagar a raiz do checkout atual antes desse clone.

Evidências desta retomada: `%TEMP%/locadora-wave135-finish-20261009` (`FINISH`),
incluindo `arch.log`, `visual-human-acceptance.json`, o bundle local de
histórico e os relatórios em `reviews/`. As novas suítes e seus resultados
pertencem à consolidação dessa execução; a fila ainda está em curso, sem
declaração de verde geral. O handoff mantém os resultados anteriores com suas
datas e origens. Os parágrafos datados abaixo preservam o histórico e não
substituem esta decisão.

Onda 135 (2026-10-08, sem commit, continuidade Codex autorizada após o handoff):
reconciliação dos seis vínculos de dependência sem mudar resoluções, três builds
de produção verdes, prova A4 sensível à retirada de metadados e comparador B11
com conclusão real do Vitest. B2 recebeu expectativas explícitas de fixtures; B3
recebeu sucessos de plataforma e exceções contratuais por motor. Os seis gates
estáticos passaram. A matriz HTTP e a suíte ampla seguem em validação; P0/P1/P2
e aposentadoria da raiz não estão concluídos. Escopo, evidências e limites em
`docs/features/shared-api-host.md` e `CLAUDE_TO_CODEX_HANDOFF.md`.

Onda 134 (2026-10-07, sem commit, Claude): decisões do dono de 2026-10-06 e
2026-10-07 implementadas em três lotes paralelos com planos revisados por
crítico, três rodadas de verificação independente e mutação. **S9:** criação da
conta de recebimentos com o faturamento exato, instalada nos dois hosts e nos
crons atrás de `PLATFORM_SUBACCOUNT_CREATION` (desligada): pedido atômico do
dono, worker que busca antes de criar e grava a intenção antes do único POST,
chave selada na hora, incerto sem novo POST, recusa devolvida ao dono, dados
declarados apagados em todo desfecho, saúde com integração ativa só na aprovação
e barreira 409 de emissão; a terceira rodada achou e corrigiu a aprovação que se
desfazia quando a organização não tinha documento normalizado. **Vitrine:**
conteúdo institucional, 11 compromissos (desligados por padrão) e textos legais
por locadora, com painel web e nativo, páginas legais no ar na pausa e script da
GB uma vez por campo. **Testes:** porta única para ACL do banco compartilhado.
Pendentes do S9: documentos (BaaS), confirmação anual, recuperação assistida de
chave, barreira na conta conectada, liberação de `BLOCKED` (S12) e homologação.
Pendentes da vitrine: frota e nota com fonte da GB (dono, no painel), Termos
para publicar (D-C(2)) e versão aceita no orçamento (D-F) em lotes próprios,
frete por locadora (P-1) e a linha de base do painel depois da moldura
administrativa (entrada 295).

Onda 133 (2026-10-06, sem commit, Claude): a vitrine volta a mostrar horário e
CNPJ da própria locadora (leitura pública aditiva nos dois hosts, sem CPF), as
telas de senha usam a sigla da locadora, a prévia SEO perdeu a nota inventada e
`pnpm tokens` voltou ao verde com tokens semânticos de mesmo valor. As leituras
de conta e os GET dos dois motores de identidade (Better Auth e NextAuth)
recusam Origin explícito estrangeiro, com as navegações de OAuth e de e-mail
isentas. Em 2026-10-06 o dono decidiu: faturamento exato para a subconta,
conteúdo institucional e textos legais por locadora no painel e páginas legais
no ar durante a pausa (ADR SaaS B.18; ADR de hosts U5); a onda 134 implementa.
Pendências da vitrine: horário e CNPJ no app móvel e formulário do horário no
painel.

Onda 132 (2026-10-06, sem commit, Claude): a vitrine mostra só dados e fatos da
própria locadora (T12 da ADR de hosts, ampliado a fatos da empresa); a pausa tem
moldura neutra; o principal privado comum dos dois hosts recusa Origin explícito
estrangeiro também em GET/HEAD (prova nos builds de produção, 2.897 e 2.891
casos). O site da GB no host novo depende de decisões: horário e CNPJ públicos
por locadora (Decreto 7.962/2013; em curso na onda 133), conteúdo institucional
por locadora (D2) e textos legais (U5); o runbook
`docs/operations/gb-site-settings.md` lista o que muda e bloqueia o corte da GB
até lá. Infraestrutura de testes endurecida (guarda do banco como o driver pg,
integração sem segredos dos `.env`, catraca de paleta). A catraca acusou 29
classes de paleta que mudaram de grafia em arquivos divididos (`pnpm tokens`
vermelho; onda 133). Limites aceitos e documentados: grafias exóticas que fogem
da catraca (`VAR(_--…)`) e URLs `socket:` na guarda do banco são modelo de erro
acidental, não adversário. Detalhes em shared-api-host.md, onda 132.

Onda 131 (2026-10-06, sem commit, Claude): estabilização das suítes. A validação
consolidada da onda 130 tinha rodado `test:api` fora do perfil (dois workers e
hosts em dev); no perfil do CI apareceu uma regressão de segurança herdada da
onda 97 (GET com Origin de locadora irmã lia badges e WhatsApp), corrigida nos
dois hosts. Integração voltou a 81/81 (a guarda do banco de teste recusava o
valor gravado pelo próprio setup, efeito da fixture da onda 130). Fixtures,
dublês e testes desatualizados do checkpoint foram corrigidos na causa.
Validação em série no perfil do CI: gates, três builds, integração, API
2.851/2.845, identidade, plataforma, web, mobile e contrato verdes; três casos
de unit/segurança estouram tempo só sob carga (onda 132). Legado, scheduler e
flags reais preservados. Detalhes em shared-api-host.md, onda 131.

Onda 130 (2026-10-06, sem commit, Claude): S13 parcial e jobs de divulgação do
S8. A vitrine de cada locadora fica LIVE, PAUSED (503 SITE_PAUSED, página neutra
com contato e área do cliente, noindex) ou OFF (404 do D10), por regra única do
domínio aplicada pelo resolvedor dos dois hosts; o proxy web entrega o 503 real
e robots.txt/sitemap.xml respondem por estado. A publicação não depende da
fiscalização; off/shadow nunca pausam. A migration 0104 mantém LIVE as locadoras
vivas. Os jobs de tenant declaram obrigação ou divulgação no runner único; com
fiscalização on, divulgação pula SETUP/RESTRICTED/ARCHIVED e obrigação nunca é
pulada. Provas focadas, 41 mutações mortas, 70 verificações HTTP nos builds de
produção e os três builds passaram. A validação consolidada encontrou suítes
vermelhas (parte regressão de fixtures da onda, parte herdada do checkpoint),
tratadas na onda 131. Decisões abertas: leitura do cartão pelo proxy (D2 da ADR
de hosts), páginas legais em pausa, Retry-After e despublicação. Limites em
shared-api-host.md, onda 130.

Onda 129 (2026-10-05, sem commit): inspeção UNKNOWN de subconta usa apenas
consulta da conta raiz e a fila existente, compartilhada pelos dois cron hosts.
Conta encontrada sem chave local exige recuperação manual; ausência nunca repete
criação. 280 provas focadas, tipos/gates e builds API/legado passaram. Dois
símbolos ganharam consumidores reais e suas tolerâncias antigas de higiene
encolheram. S9 continua parcial; coleta de faturamento aguarda decisão humana.
Legado e flags reais preservados. Limites em shared-api-host.md, onda 129.

Status: em implementação. Este registro não certifica paridade mobile nem
implantação. Serviço com 170 rotas/215 métodos, iguais ao inventário legado
(inventário local de 2026-10-05). A onda 58 desacopla arquivos públicos da
origem da API e prova consumidores web/mobile, proxy real e rollback de sessão
local nos dois motores. A onda 59 acrescenta aceite HTTP/SSR de documentos,
OAuth, cache e jobs. A onda 60 corrige a disputa de inserção da inbox e o
formato inválido do cookie OAuth. A API legada e seu scheduler continuam ativos;
não houve cutover operacional. Contagem de métodos não mede conclusão geral nem
autoriza remover a raiz.

Onda 120: consulta do dono de recebimentos nos dois hosts e página web FSD
/admin/recebimentos. RLS/snapshot de leitura existentes, projeção sem segredos e
estado separado por identidade/locadora preservados. Moldura administrativa
compartilhada pelos hosts, com seletor acessível no main. 460 casos distintos,
três builds e 42 verificações HTTP/Chrome locais passaram (limites em
shared-api-host.md). Consulta não cria ou conecta conta Asaas. S9, S13,
backoffice e homologação/operação continuam pendentes; API legada permanece
ativa.

Onda 121: conexão inicial de conta própria nos dois hosts, em payment-accounts.
Prova de CNPJ por leitura do provedor, cofre e auditoria atômicos, dono atual
revalidado após o I/O e restrição preservada até configurar eventos. S9 continua
parcial; interface/conclusão da conexão e homologação real ainda faltam. Legado,
proxy, scheduler e flags reais permanecem. Progresso geral ~60% é estimativa de
esforço, sem denominador certificado; não é contagem de rotas.

Onda 122: configuração e inspeção diária dos webhooks da conta própria conectada
no runtime compartilhado, usando o scheduler e o cofre existentes. Intenções de
criação/atualização e reconciliação sobrevivem a falhas e a eventos de saúde;
aprovação exige os quatro estados atuais. Transporte Asaas simulado e PostgreSQL
descartável protegem concorrência, rollback e isolamento. Reconciliação
financeira, subcontas BaaS, interface de conexão e homologação real ainda
faltam. API legada e flags reais preservadas; S9 parcial. Progresso geral ~60%
continua estimativa de esforço, sem denominador certificado.

Onda 124 (2026-10-05, sem commit): formulário web de conexão própria usa o POST
compartilhado já existente. Chave efêmera mascarada, limpeza do campo, escopo de
identidade/locadora e recibo separado de aprovação foram exercitados. 228 testes
focados, tipos, gates, builds web/legado e interface Chromium com fixtures
passaram. A sonda HTTP recebeu 403; a onda 125 comprovou Host substituído pelo
fetch do Node e usa o helper HTTP existente. Vinte casos no proxy real passam em
cada motor para ambos os backends, sem relaxar origem ou papel. Aceite 202 do
dono e integração externa não foram certificados (entrada 300). S9,
homologação/operação e retirada do legado seguem pendentes. Geral ~60% continua
estimativa de esforço, sem denominador certificado.

Onda 126 (2026-10-05, sem commit): aceite 202 do dono atravessa o proxy real e
os dois backends compilados, em legacy e Better Auth. Banco próprio migrado,
papéis canônicos isolados e provedor sintético comprovam persistência cifrada,
restrição, idempotência, seleção e isolamento. Nenhuma regra de produção mudou.
38 casos HTTP passaram por motor, além dos 32 unitários associados; tipos dos
arquivos novos e lint passaram. S9, BaaS, backoffice, homologação externa,
aparelhos e retirada do legado permanecem pendentes. Geral ~60% continua uma
estimativa de esforço, sem denominador certificado.

## Decisões aprovadas

Onda 127 (2026-10-05, sem commit): recuperação guiada de recebimentos usa
recibos sanitizados do incidente/chave atuais. GET/POST compartilhados nos dois
hosts e interface web com confirmação explícita, sem polling ou repetição
automática. Comando usa a outbox existente e conserva backoff/leases; dono e
sessão são revalidados. Conferência concluída nunca simula entrega recuperada.
S9, recuperação final, homologação e retirada do legado continuam pendentes.
Geral ~60% permanece estimativa de esforço sem denominador certificado.

Onda 123 (2026-10-05, sem commit): recuperação financeira de contas próprias com
fila interrompida usa o processador compartilhado e o papel de negócio, em
páginas de até cinco consultas. Incidente e progresso duráveis conservam
histórico, isolamento e retomada. Uma fotografia concluída não libera a fila;
revisão, reconciliação final e aceite da entrega continuam pendentes. 251 casos
distintos e builds API/legado passaram localmente. Sem alteração de grants,
baselines, flags reais ou produção. Legado ativo; geral ~60% permanece
estimativa de esforço.

O clone evolui para várias locadoras independentes. GB-Locações é a origem do
legado, não o produto final. A confirmação posterior do usuário substitui a
premissa de operação única do plano inicial. Ver
[isolamento multiempresa](multiempresa.md). Toda etapa passa a exigir evidência
de isolamento entre locadoras.

- Hosts finos em `apps/clients/web` e `apps/clients/mobile` (Expo/React Native).
- Uma árvore FSD em `packages/frontend`, design system em `packages/ui` e tokens
  canônicos em `packages/design-tokens`.
- Backend modular servidor, contratos de rede e cálculos puros compartilhados em
  pacotes separados.
- API compartilhada em `apps/services/api`, consumida por web e mobile (decisão
  do usuário em 2026-09-30). Categories/health e equipamentos/busca/settings
  públicos, disponibilidade, detalhe, cartão, diretório e leitura autenticada
  dos vínculos, seleção, vínculo do host, motoristas, endereços, categorias e
  unidades físicas administrativas instalados localmente; transferência completa
  e cutover pendentes. `app/api` permanece ativo até o substituto passar pela
  validação.
- Paridade final de site, área do cliente e administração. Preservar identidade
  visual e o comportamento do primeiro modelo 3D sem zoom.
- UPFRONT/ON_DELIVERY reservam após confirmação do pagamento; AT_END na
  aprovação/conversão; locação manual na criação.
- ACTIVE significa retirada efetiva após checkout e documentos obrigatórios.
  Pagamento não equivale a retirada.
- Better Auth com Prisma e plugin Expo é o destino da identidade; a troca exige
  preflight, migração e validação próprios.
- Locadora por subdomínio (`{slug}.<raiz>`), painel em `app.<raiz>`, app mobile
  único e nome provisório central (decisão do usuário em 2026-09-26). Desenho e
  plano em lotes: [ADR de hosts](adr-tenant-hosts.md).
- Produto é uma plataforma SaaS por assinatura: locadoras assinam, a receita é
  só a mensalidade, os pagamentos dos clientes vão para a locadora (Asaas com
  uma subconta por locadora). Desenho e lotes S0–S17:
  [ADR SaaS](adr-saas-subscription.md).
- Regras permanentes do usuário: `!important` proibido (CSS, Tailwind e inline);
  teste colocado com o nome do arquivo testado (`pnpm check:test-names`); nunca
  junção/symlink para o repositório nem remoção recursiva em pasta com links.
- Referência visual é a produção (`main`, `eb4c0098`, Tailwind 3.4.17): a
  cascata da produção foi restaurada na onda 5 (as classes utilitárias vencem as
  regras de elemento; known-issues 195). O anel de foco por teclado é o laranja
  da marca (`#ea580c`, token `--focus-ring`), nunca no clique (aplicado na onda
  5). Nas ondas 8 e 9, a paleta, os tamanhos de texto e a semântica das demais
  classes também voltaram aos da produção, com teste de paridade; essa
  restauração foi aplicada por padrão e aguarda o aval do dono (seção "Ondas 6 a
  9").

## Baseline e acompanhamento

O ponto de partida tem 1.150 entradas alteradas/não rastreadas no Git sobre
`eb4c0098`. Essas alterações são anteriores à implementação e devem ser
preservadas. Não há autorização implícita para commit, publicação ou alterações
em produção.

O commit local `0cff7b65` (2026-09-26) registra o trabalho do Codex, a
estabilização e a onda 1. O commit local `da19f601` (2026-09-26) registra a onda
2 (lotes 0, 1, 2, 3, 4a e 4b do plano de hosts, correções da revisão adversarial
da onda 1, extração de cotação/locação e gates/CI). O commit local `be859915`
(2026-09-26) registra a onda 3. O commit local `4b02f52f` (2026-09-26) registra
a onda 4 (seção "Onda 4" abaixo: correção dos 28 achados da revisão da onda 3 e
CSS sem `!important`). As ondas 5 a 9c (seções "Onda 5" e "Ondas 6 a 9") foram
incorporadas no commit local `55763c1e` (2026-09-30), sobre `4b02f52f`. O
[handoff Claude → Codex](../ai/claude-codex-handoff-2026-09-30.md) confere esse
checkpoint com o histórico persistido e registra a validação retomada.

### Primeiro incremento após o handoff (2026-09-30, sem commit)

`apps/services/api` agora instala categories/health sobre módulos
compartilhados. Resolução pública de locadora e runtime Prisma/pg saíram para
`packages/backend`; as fachadas da raiz preservam os consumidores. Nenhuma URL
de cliente, rota legada, sessão, cobrança ou scheduler foi desligada ou
redirecionada.

Provas: caracterização antes da mudança (112), matriz dos dois adapters (128),
20 testes HTTP com artefato standalone e RLS sem bypass, unitários completos
(819), identidade (134) e segurança (660 aprovados/18 condicionais pulados).
Builds API/raiz/web e tipos/lint/arch/ratchet/higiene aprovados, sem aumento ou
alteração de baseline. CI foi configurado, mas não executado remotamente.
Docker, troca de tráfego e retirada do legado continuam pendentes.

Escopo, configuração, responsabilidades, arquivos e limitações:
[API compartilhada](../features/shared-api-host.md) e
[ADR de extração](adr-backend-extraction.md). O checkpoint canônico do handoff
permanece histórico e não foi reescrito para incluir este incremento.

### Segundo incremento após o handoff (2026-09-30, sem commit)

GETs públicos de equipamentos, busca e configurações montados no serviço sobre o
`createPublicCatalog` existente. Antes da adaptação: 128 unitários e 73 testes
HTTP no legado aprovados. Factories de transporte em `backend/http` conservam
DTOs, Decimal, ordenação, cache, códigos e erros; as rotas e a operação legadas
continuam ativas. Serviço parcial com cinco rotas; disponibilidade e identidade
aguardam cortes próprios. Resultados atuais em
[API compartilhada](../features/shared-api-host.md).

Validação final local: 178 HTTP, 828 unitários e 660 de segurança aprovados; 18
condicionais anteriores pulados. Build API, tipos, lint, arquitetura, ratchet e
higiene passaram, com baselines intactas. Sem commit ou publicação.

### Disponibilidade, detalhe e cartão após o handoff (2026-09-30, sem commit)

O serviço parcial tem oito rotas; domínio e infraestrutura permanecem em
backend. Disponibilidade e cartão reutilizam serviços existentes. A consulta e
projeção do detalhe saíram da rota legada para o catálogo compartilhado; seu
adapter antigo continua ativo. Os 341 HTTP entre hosts passaram com PostgreSQL
RLS, sem alterar clientes, jobs ou baselines. Caracterização, artefatos usados,
gates e limitações em [API compartilhada](../features/shared-api-host.md). Busca
do diretório, identidade privada e efeitos ainda exigem cortes próprios.

### Busca do diretório após o handoff (2026-09-30, sem commit)

Serviço parcial com nove rotas. A busca reutiliza query/projeção e contador
persistente existentes; identificação confiável de IP e critério de segredo
foram movidos ao backend compartilhado com fachadas na raiz. O guard estrutural
continua exigindo um único chamador do segredo e inclui o serviço na varredura.
A API legada, os clientes e o scheduler permanecem ativos. Caracterização,
paridade entre processos e limitações em
[API compartilhada](../features/shared-api-host.md). Identidade privada e
efeitos ainda exigem cortes próprios.

### Composição de identidade após o handoff (2026-09-30, sem commit)

As dependências persistentes de autenticação e o transporte de e-mail também
foram compartilhados: `createIdentityLimiters`, `createLegacySignInGuard`,
`createIdentityMailSender` e `createResendClient`. Fachadas legadas fornecem
Prisma, segredo, IP e configuração reais. Janelas PostgreSQL, 429/503, payload,
idempotência e prazo de 15 segundos preservados; nenhum callback privado ou
scheduler foi transferido. Os reexports internos sem uso foram retirados, sem
alterar a baseline de higiene neste passo. Estado/provas no corte 8 de
`docs/features/shared-api-host.md`.

Política de sessão, opções/callbacks de NextAuth e lifecycle do Better Auth
extraídos para factories de identity no backend. As fachadas da raiz continuam
ligando cabeçalhos Next, banco, e-mail e limitadores reais. Contratos HTTP, flag
de corte, revogação de JWT, guard central e API legada preservados; serviço
permanece com nove leituras públicas e nenhuma rota privada. A versão de
NextAuth não mudou. A sobra `default` sem consumidor em `lib/auth.ts` foi
retirada, com remoção apenas do seu registro na baseline de higiene; nenhuma
exceção aumentou. Validação e próximo corte em
[API compartilhada](../features/shared-api-host.md).

### Primeira leitura autenticada após o handoff (2026-10-01, sem commit)

O serviço tem dez GETs. `GET /api/auth/organizations` reutiliza consulta/DTO de
backend/identity e a política de sessão compartilhada. O inventário de
autorização abrange legado, web e API, com guard obrigatório nesta leitura
privada. Testes usam cookies emitidos pelo login HTTP legado, credenciais e
vínculos reais em PostgreSQL descartável; callbacks, seleção, guard central e
efeitos continuam legados. Estado e resultados atuais no corte 9 de
[API compartilhada](../features/shared-api-host.md).

### Leitura da preferência após o handoff (2026-10-01, sem commit)

O serviço parcial passa a onze GETs com `/api/auth/organizations/selection`.
Política, parser/formatter e consulta continuam compartilhados em backend; não
há regra duplicada no host. A seleção permanece preferência, nunca autorização:
os dois adapters revalidam identidade e vínculo, revogação e suspensão. Escritas
POST/DELETE, login/callbacks, guard central, clientes e jobs continuam legados.
Arquivos, paridade e limites no corte 10 de
[API compartilhada](../features/shared-api-host.md).

### Vínculo da locadora do host após o handoff (2026-10-01, sem commit)

Serviço parcial com doze GETs, incluindo `/api/auth/organizations/current`. Host
e sessão mantêm sua precedência de recusa; preferências não escolhem a locadora.
Consulta composta, projeção e transação ficam no backend; ambos os adapters
delegam. O inventário exige identidade depois da preparação do host, sem
confundir contexto com autorização. Não houve mudança nos clientes, escritas,
jobs ou autoridade legada. Provas no corte 11 de
[API compartilhada](../features/shared-api-host.md).

### Principal privado e leitura de motoristas (2026-10-01, sem commit)

O corte 12 extrai a composição privada para backend/identity e instala
`GET /api/admin/drivers` no serviço, que passa a treze GETs. O guard de mesma
origem roda antes da sessão; conflitos e vínculo atual continuam revalidados sob
a transação da locadora. Papel ADMIN continua explícito antes da consulta
compartilhada em operations. O inventário segue a delegação e recusa bypasses,
sem ampliar baselines. POST, outras permissões privadas, clientes, scheduler e
autoridade de escrita permanecem legados. Provas e riscos no corte 12 de
[API compartilhada](../features/shared-api-host.md).

### Leitura de endereços do cliente (2026-10-01, sem commit)

O corte 13 monta `GET /api/addresses` com o principal compartilhado e o serviço
customers existente. A consulta exige tenant e usuário do principal, mantendo o
mesmo ownership para todos os papéis. RLS cobre a locadora; a aplicação cobre o
usuário. Envelope, DTO, ordenação, erros, HEAD/OPTIONS e writes legados
permanecem preservados. São quatorze GETs no novo host, com as 149 rotas da raiz
ativas. Não houve mudança dos clientes, schema, proxy ou produção.

Caracterização anterior à instalação e paridade nos dois modos de autenticação
estão no corte 13 de [API compartilhada](../features/shared-api-host.md).

### Categorias administrativas e permissões compartilhadas (2026-10-01, sem commit)

O corte 14 extrai a política granular para `createTenantPermissionResolver` e
monta `GET /api/admin/categories`. A regra continua baseada no vínculo ativo e
na concessão exata da locadora, papel, módulo e ação; ADMIN dispensa a consulta
e CLIENT é recusado. A consulta catalog existente permanece única, com DTO,
contagem, ordem e transação preservados. São quinze GETs no novo host; todas as
escritas e as 149 rotas da raiz continuam ativas. Clientes, jobs, schema e
produção não mudaram. Provas no corte 14 de
[API compartilhada](../features/shared-api-host.md).

### Unidades físicas administrativas (2026-10-01, sem commit)

O corte 15 instala GETs de lista e detalhe de unidades físicas no serviço,
reutilizando catalog e EQUIPMENTS/READ. Filtros, DTO completo, Decimal textual,
ordenação, erros, params, transação e isolamento permanecem como no legado. São
dezessete GETs no host parcial; as 149 rotas e 193 métodos da raiz e todas as
mutações continuam instalados. Não houve mudança de cliente, proxy, cookie,
scheduler, schema ou produção. Caracterização anterior e paridade HTTP nos dois
modos de autenticação: corte 15 de
[API compartilhada](../features/shared-api-host.md).

### Detalhe administrativo de equipamento (2026-10-01, sem commit)

O corte 16 instala `GET /api/admin/equipments/[id]`, reutilizando catalog e a
permissão EQUIPMENTS/READ. Mantém DTO completo, conversão de preço, decimais
textuais, disponibilidade, contagens, transação, params e erros. Serviço parcial
com dezoito GETs; 149 rotas/193 métodos legados preservados. Lista
administrativa aguarda a extração/caracterização do limitador; PUT/DELETE e a
autoridade dos clientes continuam legados. Provas no corte 16 de
[API compartilhada](../features/shared-api-host.md).

Inventário reproduzível:
`node tools/modernization-inventory.mjs --output .tmp/modernization/inventory.json`.
O inventário lista entradas reais; presença de arquivo não prova comportamento,
autorização ou paridade. Na árvore da onda 4 (2026-09-26): 149 arquivos de rota
em `app/api` com 193 métodos declarados (iguais à onda 3; eram 147/191 na onda
2); 53 páginas no host web, com 48 URLs distintas (23 no host de locadora, 28 no
host `app` e 2 no apex). A página nova da onda 4 é o login da equipe,
`app.<raiz>/login`; `/login` já existia no host de locadora. A onda 5 não criou
página nem rota; o inventário não foi repetido nela. As ondas 6 a 9 também não
criaram rota: o inventário de guarda das ondas 7 e 8 mediu os mesmos 149
arquivos de rota e 193 endpoints.

| Etapa                   | Critério de saída                                                                            | Estado       | Situação em 2026-09-30                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Baseline             | Rotas, operações, referência visual, regressões e achados rastreáveis                        | Em andamento | Inventário por host; linha de base visual do web regravada na onda 5 (cascata da produção e anel laranja), na onda 8 (paleta e tipografia da produção) e na onda 9 (semântica da produção em todas as categorias de classe; 478 capturas com o estado novo `foco-teclado-categoria`); `approved-changes.json` vazio; paridade com a produção provada classe por classe por `tailwind-parity.test.ts`. Primeiro modelo 3D sem zoom provado só em Chromium headless (onda 4); Teste 1 em GPU real pendente.                                                                                                                                                                                                                                                                           |
| 1. Segurança e gates    | Superfície operacional fechada; ownership; webhooks/crons; testes isolados; gates confiáveis | Em andamento | Onda 4: guarda por rota com formato de resultado e `PUBLIC_TENANT_SURFACE`; `ratchet-guard` pela configuração da base; CSRF entre locadoras fechado. Onda 5: guard de mesma origem central (painel no host `app`, fluxos anônimos de conta, sem borda) e passagem CSRF no inventário de rotas; `token-check` lê o config JS do Tailwind e reprova escapes no JSX. Ondas 6 a 9: inventário de rotas com regra estrutural e gramática fechada, regra de lint `runtime/no-runtime-rewrite` e modelo de ameaça em `security.md`; `ratchet-guard` com política de configuração e `css-important` sem isenção; testes sem rede; login CSRF pelos proxies de OAuth fechado; gate `pnpm hygiene`. `ratchet:guard` aprovado após o lote higiene-final e confirmado no handoff de 2026-09-30. |
| 2. Workspace/fronteiras | Imports válidos; cálculos canônicos; adaptadores funcionais                                  | Em andamento | `pnpm arch` exit 0 com 1108 ocorrências em 91 arquivos na onda 4 e 1050 na onda 9 (a faxina só baixou a linha de base); `WORKSPACE-ESCAPE` 0; teste do layout mobile deixou de importar `node_modules` do host a partir de `packages/frontend` (onda 4); regra única de modo e `basePath` da identidade em `packages/contracts`, usada por web, proxy, mobile e backend (onda 8).                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3. Identidade           | Migração ensaiada e sessão/revogação web, Android e iOS                                      | Em andamento | Onda 4: um caminho de credencial para v1 e v2, teto por conta, pendências do H6 resolvidas e login da equipe no `app`. Onda 5: limitador no ramo better-auth de `register`/`forgot-password`, segredo pelo critério da plataforma, log da identidade e casca da plataforma nas páginas de conta do `app`. Ondas 6 e 7: respostas neutras no better-auth, 503 com `Retry-After` quando o limitador não conta (também na rota real do NextAuth), links de e-mail pela conta, e-mail de verificação depois do commit com reenvio pelo cadastro repetido e plugin `appAuthorization`. Better Auth não ativado; Android/iOS pendentes.                                                                                                                                                   |
| 4. Dados/domínio        | Migrations ensaiadas; estoque/conversão idempotentes; inbox/outbox                           | Em andamento | Migrations `202609260001`–`0006` em banco descartável; `0004` com `lock_timeout` e quitação em centavos (onda 4); `0001`–`0003` com os mesmos timeouts (onda 5); `DROP INDEX IF EXISTS` na `0004` e preflights com `migrate resolve --rolled-back` (ondas 6 e 7); regra única da obrigação do orçamento (onda 6); emissão no Asaas com religação pelo cron e recusa definitiva só pelo domínio (ondas 6 a 9); S1 e S4 na onda 3; S2 (schema SaaS) pendente.                                                                                                                                                                                                                                                                                                                         |
| 5. Design system        | Tokens únicos e catálogo funcional nos dois renderizadores                                   | Em andamento | Onda 4: `!important` zerado (tolerância zero), tokens CSS no design-tokens, estilos de controles nos componentes e `lint:css`. Onda 5: camadas `theme, base, components, utilities` (sem `legacy`), token `--focus-ring`, fim do `legacy.css` (variáveis com nome de hash viraram tokens nomeados). Onda 8: paleta do Tailwind 3 em hex (`palette.css`), `text-base` fluido, `Text` em px, erro por `aria-invalid` e anéis só `FOCUS_RING`. Onda 9: escalas, contorno e breakpoints da produção (`scales.css`, `outline.web.css`). Propagação web de tokens não provada (3 níveis).                                                                                                                                                                                                 |
| 6. Produto              | Todos os fluxos da matriz executados nas três plataformas                                    | Pendente     | Sem execução em dispositivo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7. Operação/legado      | Build/deploy único; métricas; rollback; retirada de substituições                            | Em andamento | `ci.yml` volta a ser YAML válido, push não é cancelado e `test:contract`/`lint:css` entraram (onda 4); `docker build` só no job do CI; onda 9: gate `pnpm hygiene` no job `architecture`, dependências declaradas por pacote e scripts e configs mortos removidos; staging multi-host (Lote 8) pendente.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## Achados e evidências necessárias

| Grupo                           | Correção                                                             | Prova de encerramento                                                                      | Estado em 2026-09-30                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoints operacionais públicos | Desativar bootstrap, diagnóstico de login e provisionamento remoto   | HTTP anônimo sem leitura sensível nem efeitos                                              | Rotas operacionais e webhooks globais respondem 410; guarda estrutural por rota; o proxy dos hosts nega `test-login`, `cron`, `internal`.                                                                                                                                                                                                                           |
| Criação de pagamentos           | Ownership, valor e titular canônicos                                 | Cliente A/B, valores adulterados, referência inválida, nenhum gateway antes da autorização | Não revisado nas ondas 1 e 2; onda 6: obrigação do orçamento pela regra única e cobrança já emitida nunca reprecificada por edição (409).                                                                                                                                                                                                                           |
| Upload                          | Permissão antes do processamento, conteúdo validado                  | Anônimo/cliente recusados, conteúdo falso rejeitado                                        | Não revisado nas ondas 1 e 2; `/api/upload` negado no host de locadora.                                                                                                                                                                                                                                                                                             |
| Webhooks/crons                  | Configuração obrigatória, assinatura, corpo único, estado monotônico | Ausência de secret, assinatura falsa, válido, repetido, evento atrasado                    | `cron/outbox` 503/401 (onda 1); jobs de orçamento com `tenantId` (onda 2); outbox limpa janelas de rate limit (onda 3); `paidAt` na data de São Paulo (onda 6); o cron da outbox religa emissões presas (ondas 7 a 9); cron de boleto vencido sem e-mail no log (onda 9).                                                                                           |
| Conversão/estoque               | Transação única, locks e reserva canônica                            | Concorrência em PostgreSQL descartável e replay após commit                                | Conversão idempotente (savepoint, onda 1); quitação só sobre cobranças vigentes (onda 2); ordem de locks preservada na extração.                                                                                                                                                                                                                                    |
| Cobranças/contratos             | Tentativas, conciliação, efeitos duráveis e versões imutáveis        | Timeout externo, reemissão, retomada e preservação de assinado                             | Reemissão de boleto (onda 2) só com prova de fim no provedor e quitação em centavos (onda 4); adapter do Asaas (S4, onda 3); leitor do provedor ligado, critério também no pedido de PIX/boleto e relatório de centavos (onda 5); emissão: falha sem efeito volta à fila, conciliação pela referência em rodadas e recusa definitiva só pelo domínio (ondas 6 a 9). |
| Identidade/ACL                  | Principal comum e políticas vigentes                                 | Revogação, mudança de papel e isolamento por cliente                                       | Candidatas no principal (onda 2); Lote 6 e limitador persistente (onda 3); mutações do cliente só da origem do host (onda 4); guard de mesma origem central, inclusive no painel (onda 5); links de e-mail pela conta e login CSRF pelos proxies de OAuth fechado (ondas 6 e 7).                                                                                    |
| FSD/runtime                     | Retirar imports de raiz, shims e DOM no native                       | AST/grafo transitivo, tipos, builds e interação real                                       | Dívida congelada por catraca (inclusive na raiz legada); interação real não provada.                                                                                                                                                                                                                                                                                |
| Tokens/paridade                 | Fonte única, contratos de componentes, composição compartilhada      | Estilos renderizados e catálogo em dispositivo                                             | Button web ainda usa classes literais; tokens CSS no design-tokens e molduras de controle em `packages/ui` (onda 4); cascata da produção e anel laranja (onda 5); paleta, tipografia e escalas da produção com teste de paridade (ondas 8 e 9); catálogo em dispositivo pendente.                                                                                   |
| Qualidade/operação              | Suites completas, logs, migrations, budgets e rollback               | CI exit 0, restauração ensaiada e métricas de release                                      | Suítes da árvore da onda 4 na seção "Onda 4"; na onda 5, só as provas de cada lote (seção "Onda 5"); nas ondas 6 a 9, as rodadas relatadas pelos lotes (seção "Ondas 6 a 9"), sem `test:integration`; CI não executado (branch local; o `ci.yml` de `be859915` era YAML inválido, corrigido na onda 4).                                                             |

## Revisão adversarial da onda 1

A revisão de 2026-09-26 registrou 24 achados: 22 confirmados e 2 refutados. Na
onda 2, todos os confirmados que eram defeitos do código receberam correção com
teste que falha quando a correção é revertida.

| Área             | Achados                                                            | Resultado                                                                              | Onde está registrado       |
| ---------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | -------------------------- |
| public-surface   | #0, #1, #3 confirmados; #2 refutado (escolha deliberada)           | Corrigidos no analisador de rotas                                                      | known-issues 159           |
| identity         | #0–#6 confirmados                                                  | Corrigidos (`lib/auth.ts`, `lib/rate-limit.ts`, rotas de identidade)                   | known-issues 154           |
| data-integrity   | #0 (alto) e #1 confirmados                                         | Corrigidos (quitação vigente; preflight sob FORCE)                                     | known-issues 156 e 157     |
| gates-tokens     | #1–#5 confirmados; #0 refutado como defeito, mas tratado           | Corrigidos (âncora da catraca, raiz legada, TW 4.3.3, listas web-only, matiz negativa) | known-issues 160           |
| frontend-runtime | #0 (incidente de ambiente causado pelo revisor); #1–#4 confirmados | #0 reparado no ambiente; #1–#4 corrigidos                                              | known-issues 161–163 e 171 |

## Revisão adversarial da onda 3

A revisão da árvore da onda 3 (2026-09-26) registrou 28 achados, quatro de
severidade alta (1, 7, 24 e 25). Na onda 4, todos foram reproduzidos contra o
código de `be859915` mais a árvore de trabalho e todos foram corrigidos na
causa, com teste escrito antes da correção. Cada teste novo falha com a correção
revertida (mutação e restauração conferida por sha256).

| #   | Achado                                                                                                        | Desfecho  | Registro                                         |
| --- | ------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------ |
| 1   | Alto. Backend de produção sem `WEB_API_ORIGIN`: `readPlatformEdgeContext` nulo em toda requisição             | Corrigido | known-issues 188                                 |
| 2   | CSRF entre locadoras irmãs em 16 handlers de mutação com cookie                                               | Corrigido | known-issues 190                                 |
| 3   | Teste de borda forjada vazio (`beta` é reservado)                                                             | Corrigido | known-issues 188                                 |
| 4   | `organizations/current` fora de host de locadora: corpo sem `code`, sem `Vary` e consulta ao banco pela query | Corrigido | known-issues 188; `tenant-request-resolution.md` |
| 5   | Teste de preflight com papel LOGIN sem senha falhava com SCRAM                                                | Corrigido | known-issues 192                                 |
| 6   | Migration `0004` bloqueava leituras em `payments` sem `lock_timeout`                                          | Corrigido | known-issues 192                                 |
| 7   | Alto. Total fracionário pago pelo valor cobrado nunca quitava                                                 | Corrigido | known-issues 186                                 |
| 8   | Boleto reemitido sobre `CANCELLED` local sem prova no provedor                                                | Corrigido | known-issues 187                                 |
| 9   | Multas e taxas fracionárias gravadas e cobradas                                                               | Corrigido | known-issues 186                                 |
| 10  | `ratchet-guard` aceitava baseline redirecionada e escopo estreitado                                           | Corrigido | known-issues 192; `ratchet-gates.md`             |
| 11  | Transferência de dívida aceita sem prova de renomeação                                                        | Corrigido | known-issues 192; `ratchet-gates.md`             |
| 12  | Inventário de rotas aceitava teste de verdade sobre resultado sempre presente                                 | Corrigido | known-issues 192                                 |
| 13  | Dono `CLIENT` aceitava comparação consigo mesmo ou com `body.userId`                                          | Corrigido | known-issues 192                                 |
| 14  | `resolvePublicRequestTenant` autorizava mutação em qualquer rota                                              | Corrigido | known-issues 192                                 |
| 15  | `import()`, `require()` e `globalThis.fetch` antes da guarda não contavam                                     | Corrigido | known-issues 192                                 |
| 16  | CI cancelava pushes e não rodava `tests/contract/**`; o `ci.yml` era YAML inválido                            | Corrigido | known-issues 192                                 |
| 17  | Login v2 fora do limitador e sem bcrypt para conta inexistente                                                | Corrigido | known-issues 191                                 |
| 18  | Sem teto por conta contra tentativas paralelas de muitos IPs                                                  | Corrigido | known-issues 191                                 |
| 19  | Borda validada sem `client-ip` caía no `x-real-ip` do proxy                                                   | Corrigido | known-issues 191                                 |
| 20  | Limitadores genéricos dividiam um store em memória (consumo e despejo cruzados)                               | Corrigido | known-issues 191                                 |
| 21  | `/orcamento` montava no web com o carrinho da locadora anterior                                               | Corrigido | known-issues 193                                 |
| 22  | `callbackUrl` com segmentos de ponto (`/.//evil.test`) saía da origem                                         | Corrigido | known-issues 162                                 |
| 23  | Teste de navegação copiava a lógica do host e importava `node_modules` do mobile                              | Corrigido | known-issues 161                                 |
| 24  | Alto. Mesma causa do 1: `identityConfiguration` falhava no modo better-auth                                   | Corrigido | known-issues 188                                 |
| 25  | Alto. Host `app` sem login da equipe: `/login` 404 e `/admin/login` preso                                     | Corrigido | known-issues 189                                 |
| 26  | `/api/auth/**` inteiro no host de locadora (sessões, perfil, exclusão)                                        | Corrigido | known-issues 189                                 |
| 27  | Teste da allowlist conferia só 3 rotas; entradas sem chamador                                                 | Corrigido | known-issues 189                                 |
| 28  | Teste do proxy só verificava `typeof`                                                                         | Corrigido | known-issues 189                                 |

## Revisão adversarial da onda 4

A revisão da árvore da onda 4 (`4b02f52f`), em 2026-09-29, registrou 32 achados;
o revisor marcou cinco como de severidade alta (11, 12, 13, 18 e 31). A onda 5
corrigiu os de CSS, do carrinho e da assinatura; as ondas 6 e 7, os demais. Os
lotes reproduziram cada achado contra o código da época antes de corrigir (o 22
já estava corrigido pela onda 5 quando a onda 6 o conferiu e ganhou só a trava),
e cada teste novo falha com a correção revertida (mutação e restauração
conferida por sha256).

| #   | Achado                                                                           | Onda  | Desfecho                                                  | Registro               |
| --- | -------------------------------------------------------------------------------- | ----- | --------------------------------------------------------- | ---------------------- |
| 1   | Anel de foco no X do diálogo aberto por clique                                   | 5     | Corrigido                                                 | known-issues 200       |
| 2   | `Drawer` fora da liberação da trava de rolagem                                   | 5     | Corrigido                                                 | known-issues 200       |
| 3   | `slide-in-up` subia 30 px (60 na produção)                                       | 5     | Corrigido                                                 | known-issues 201       |
| 4   | `css-important` não lia o config JS do Tailwind                                  | 5     | Corrigido                                                 | known-issues 202       |
| 5   | `forgot-password` e `register` do better-auth sem limite nem resposta neutra     | 5 e 6 | Corrigido                                                 | known-issues 191 e 210 |
| 6   | Login CSRF na conclusão do `oauth-proxy`                                         | 6     | Corrigido                                                 | known-issues 210       |
| 7   | Falha do limitador vazava no `?error=` do NextAuth                               | 6 e 7 | Corrigido                                                 | known-issues 211       |
| 8   | Link de redefinição da conta global na origem de qualquer locadora               | 6     | Corrigido (regressão da 1ª correção fechada na 2ª rodada) | known-issues 212       |
| 9   | `callback/*/oauth-proxy` do NextAuth alcançável no host de locadora (modo v2)    | 6 e 8 | Corrigido                                                 | known-issues 213       |
| 10  | `enroll` fora de host de locadora sem o 409 `TENANT_REQUIRED`                    | 6     | Corrigido                                                 | known-issues 213       |
| 11  | Alto. `PATCH` do orçamento mudava o valor de cobrança já emitida                 | 6 e 7 | Corrigido                                                 | known-issues 205       |
| 12  | Alto. Aprovação de multa contava a multa duas vezes                              | 6     | Corrigido                                                 | known-issues 205       |
| 13  | Alto. Recalcular itens ou datas ignorava o `finalTotal`                          | 6     | Corrigido                                                 | known-issues 205       |
| 14  | `finalTotal` alterado sem reprecificar a cobrança pendente                       | 6     | Corrigido                                                 | known-issues 205       |
| 15  | Falha sem efeito no Asaas deixava a tentativa `UNKNOWN` para sempre              | 6 e 7 | Corrigido                                                 | known-issues 207       |
| 16  | `total` do `PATCH` gravado sem arredondar a centavos                             | 6     | Corrigido                                                 | known-issues 205       |
| 17  | `buildQuotePricing` arredondava o float: meio centavo 1 centavo abaixo           | 6 e 7 | Corrigido                                                 | known-issues 206       |
| 18  | Alto. Cortesia vencida: acesso para sempre ou encerramento no dia seguinte       | 5     | Corrigido (regras aguardam aval)                          | ADR SaaS, B.5          |
| 19  | Dívida de chargeback nunca quitável                                              | 5     | Corrigido (regras aguardam aval)                          | ADR SaaS, B.5          |
| 20  | `paidAt` de boleto/PIX lido como meia-noite UTC                                  | 6     | Corrigido                                                 | known-issues 209       |
| 21  | Testes de `DELETE /subscriptions` e de faturas pendentes não provavam nada       | 6     | Corrigido                                                 | known-issues 209       |
| 22  | Testes de banco com papel LOGIN sem senha (SCRAM no CI)                          | 5 e 6 | Corrigido                                                 | known-issues 192 e 216 |
| 23  | `0004` com `DROP INDEX` sem `IF EXISTS`                                          | 6     | Corrigido                                                 | known-issues 217       |
| 24  | Runbook do `55P03` levava ao `P3009`                                             | 6 e 7 | Corrigido                                                 | known-issues 192 e 217 |
| 25  | Busca do diretório com NUL: 500 depois de gastar a janela                        | 6     | Corrigido                                                 | known-issues 214       |
| 26  | Inventário não via dados por parâmetro, objeto, classe ou callback               | 6 a 9 | Corrigido                                                 | known-issues 218       |
| 27  | Invariantes da `PUBLIC_ALLOWLIST` ignoravam `import()`/`require()` por namespace | 6     | Corrigido                                                 | known-issues 218       |
| 28  | `ratchet-guard`: `ignoreFiles` escondia `!important`                             | 6     | Corrigido                                                 | known-issues 216       |
| 29  | `ratchet-guard`: escopo estreitado onde ainda não há dívida                      | 6     | Corrigido                                                 | known-issues 216       |
| 30  | `OWNER_CLIENT` aceito com acesso sem dono depois da checagem                     | 6 e 7 | Corrigido                                                 | known-issues 218       |
| 31  | Alto. Trocar o escopo do carrinho apagava o carrinho salvo                       | 5     | Corrigido                                                 | known-issues 197       |
| 32  | Sugestão `?locadora=` perdida no redirecionamento do `/admin`                    | 6     | Corrigido                                                 | known-issues 215       |

## Revisões dos resíduos (ondas 6 a 9)

Depois de cada onda, dois verificadores céticos por lote (reprodução e mutação)
tentaram reproduzir cada cenário e reverter cada correção. O que ainda
reproduzia, o que ficava sem prova e as regressões das correções viraram achados
novos, corrigidos na onda seguinte: 101 a 110 (resíduos da onda 6, corrigidos na
onda 7), 111 a 122 (resíduos da onda 7 e pendências de estilo da onda 5, onda 8)
e 123 a 127 (resíduos da onda 8, onda 9).

| #   | Achado                                                                             | Onda | Desfecho                 | Registro         |
| --- | ---------------------------------------------------------------------------------- | ---- | ------------------------ | ---------------- |
| 101 | Trava `:issue:` da reprecificação sem teste de concorrência                        | 7    | Corrigido                | known-issues 205 |
| 102 | Falha incerta no `POST /customers` deixava a primeira cobrança `UNKNOWN`           | 7    | Corrigido (duas rodadas) | known-issues 207 |
| 103 | Total do carrinho arredondava a unidade antes da quantidade                        | 7    | Corrigido                | known-issues 206 |
| 104 | `withSignInAvailability` fora da rota real do NextAuth                             | 7    | Corrigido                | known-issues 211 |
| 105 | Alto. Login CSRF no host `app` pelo `expo-authorization-proxy`                     | 7    | Corrigido (duas rodadas) | known-issues 210 |
| 106 | Falha do e-mail de verificação depois do commit virava falha de cadastro           | 7    | Corrigido                | known-issues 212 |
| 107 | Mapeamento modo → `basePath` repetido no host web                                  | 8    | Corrigido (como 113)     | known-issues 213 |
| 108 | Inventário: métodos implícitos, funções locais e contêineres                       | 7    | Seguiu como 111 e 112    | known-issues 218 |
| 109 | `tenant-request.test.ts` afirmava a ordem antiga do guard em `POST /api/quotes`    | 7    | Corrigido                | known-issues 196 |
| 110 | Mensagens dos preflights levavam ao `P3009`                                        | 7    | Corrigido                | known-issues 217 |
| 111 | `instanceof` com valor importado antes do guard                                    | 8    | Seguiu como 123          | known-issues 218 |
| 112 | A carga do módulo rodava callbacks pelo zod                                        | 8    | Seguiu como 124          | known-issues 218 |
| 113 | Regra modo → `basePath` repetida no web, no proxy, no mobile e no backend          | 8    | Corrigido                | known-issues 213 |
| 114 | Cópia de `signInHref` no `RuntimeBootstrap`                                        | 8    | Corrigido                | known-issues 215 |
| 115 | Host `app`: `/admin` sem sessão preso no portão                                    | 8    | Corrigido (duas rodadas) | known-issues 215 |
| 116 | Tentativas de emissão presas sem religação                                         | 8    | Corrigido (duas rodadas) | known-issues 208 |
| 117 | Alto. Paleta OKLCH do Tailwind 4 diferente da produção                             | 8    | Corrigido (duas rodadas) | known-issues 219 |
| 118 | Alto. `text-base` e `text-small` como cor, sem tamanho                             | 8    | Corrigido                | known-issues 219 |
| 119 | `Text.web.tsx` com `lineHeight` sem unidade                                        | 8    | Corrigido                | known-issues 219 |
| 120 | Anéis de foco próprios em `orange-500`                                             | 8    | Corrigido (duas rodadas) | known-issues 221 |
| 121 | Molduras de campo anulavam o estado de erro                                        | 8    | Corrigido                | known-issues 220 |
| 122 | Build da raiz lia `docs/` e gerava `!important`                                    | 8    | Corrigido                | known-issues 222 |
| 123 | Classe alcançada por valor, resolução de módulo diferente da do Next, lint e tempo | 9    | Corrigido                | known-issues 218 |
| 124 | Padrões de desestruturação no topo do módulo rodavam na carga                      | 9    | Corrigido                | known-issues 218 |
| 125 | Alto. 400 em leitura depois do `POST /payments` aceito tratado como recusa         | 9    | Corrigido                | known-issues 208 |
| 126 | Cobrança aberta sem tentativa e sem evento vivo ficava sem emissão                 | 9    | Corrigido                | known-issues 208 |
| 127 | Alto. Paridade Tailwind 3 × 4 incompleta                                           | 9    | Corrigido (duas rodadas) | known-issues 223 |

## Evidências parciais confirmadas

- Migrations 001–013 ensaiadas somente em PostgreSQL descartável local; nenhuma
  aplicação em dados reais.
- Migrations 001–013 também aplicadas desde banco vazio; pg_dump/pg_restore
  ensaiados em outro banco descartável, preservando 13 migrations e 31 tabelas
  com FORCE RLS. Não equivale a ensaio dos dados históricos reais.
- Role sem superuser/BYPASSRLS: 6 testes de isolamento, FK cruzada e outbox
  passaram.
- Identidade Better Auth + Prisma: 7 testes reais de sessão, revogação, bcrypt
  legado e recuperação passaram.
- O verificador arquitetural ampliado expôs violações DOM/native antes
  invisíveis. A arquitetura ainda bloqueia a conclusão; a migração não está
  certificada.
- Grupos de rotas no novo host preservam as 47 URLs inventariadas. Hosts raiz e
  novo ainda coexistem durante a migração.
- Gates no commit `0cff7b65`: `test:unit` 369, `test:identity` 43,
  `test:security` 342, `test:platform` 956 e `test:integration` 81 verdes em
  PostgreSQL descartável.
- Execução sobre a árvore da onda 2 em 2026-09-26, num PostgreSQL descartável
  com as migrations até `202609260005`:

  | Comando                                              | Resultado                                                                                        |
  | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
  | `pnpm arch`                                          | exit 0; 1109 ocorrências em 92 arquivos, 0 acima da baseline                                     |
  | `pnpm tokens`                                        | exit 1; 15 violações, todas das 3 páginas de auth movidas sem `--rename`                         |
  | `pnpm check:tokens`                                  | exit 0; 3 níveis não provados, todos listados com motivo                                         |
  | `pnpm test:gates`                                    | 60 de 60                                                                                         |
  | `pnpm test:security`                                 | 447 passaram, 16 pulados                                                                         |
  | `pnpm test:identity`                                 | 39 passaram, 10 falharam (`contracts-database`: fixture de slug)                                 |
  | `pnpm test:unit`                                     | 457 passaram, 16 pulados; 3 arquivos falharam no `beforeAll` (fixtures de slug)                  |
  | `pnpm test:platform`                                 | 1227 passaram, 2 pulados, 1 timeout sob carga (`Editar.web.test.tsx`, que passa isolado: 3 de 3) |
  | `pnpm test:mobile`                                   | 36 de 36                                                                                         |
  | `pnpm exec vitest run --config vitest.web.config.ts` | 109 passaram, 7 pulados (e2e desligado sem `TENANT_HOSTS_E2E=1`)                                 |

  `test:integration`, `lint`, `type-check` e `build:web` não foram repetidos
  nesta consolidação; os relatórios dos lotes registram `build:web` verde e
  `docker build` não validado localmente.

## Pendências registradas pela onda 2

- Resolvidas antes do commit `da19f601`: transferência das três páginas de auth
  (`tools/ratchet-transfers.json`) e fixtures de slug (known-issues 158).
- Validações sem execução: teste visual do primeiro modelo 3D sem zoom,
  `docker build` com health 200 (job `docker`), T16 em preview da Vercel e T6
  com papel sem `BYPASSRLS`.
- Dockerfile: a saída `standalone` exige `output: 'standalone'` no
  `next.config.mjs` da raiz; hoje a imagem leva o workspace construído inteiro.
  Quando `apps/clients/web` virar o host de produção, a imagem precisa trocar
  para `pnpm build:web`. O job `storybook-build` saiu junto com o `test.yml`.
- `TRUSTED_PROXY_HOPS`: entrou no `.env.example` na onda 5, com comentário;
  continua fora do guia de deploy.
- Lotes 5 e 7b a 12 do plano de hosts (6 e 7a entraram na onda 3).

## Onda 3 (commit `be859915`)

Lotes executados em paralelo em 2026-09-26, com escopos disjuntos, e registrados
no commit local `be859915`. Cada lote provou as correções com teste que falha
quando a correção é revertida (mutação e restauração byte a byte).

| Lote                 | Entrega                                                                                                                        | Provas relatadas                                                                                              | Registro                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| names                | 41 testes colocados renomeados; `pnpm check:test-names` com allowlist e passo no CI                                            | 46 órfãos antes, 0 fora da allowlist depois; conteúdo idêntico por sha256 (2 caminhos ajustados)              | `docs/ai/boot.md`, `docs/features/ratchet-gates.md`   |
| S0                   | Contratos `subscription`, `entitlements`, `onboarding`, `payment-account`, `backoffice`; reservados e termos bloqueados        | 401 testes do contracts; 22 mutações mortas                                                                   | ADR SaaS B.16; 5 docs de feature                      |
| S1                   | `@gb-locacoes/domain/assinatura` e `/documento`                                                                                | 166 casos, 100% de ramos nos arquivos novos, 15 mutações mortas                                               | ADR SaaS B.16; `assinatura-plataforma.md`             |
| S4                   | Cliente HTTP único do Asaas, dinheiro em Decimal, CNPJ alfanumérico, eventos e dublê de contrato                               | 73 testes de contrato (fora das configs do vitest); 12 de 13 mutações mortas, a sobrevivente equivalente      | `modernization-billing.md`; known-issues 173 e 174    |
| H7a (hosts 7a)       | Diretório público, `directoryListed`, `platform_rate_limits` e limitador de autenticação persistente                           | T13; concorrência entre duas instâncias no banco; mutações de escape, opt-in, ACTIVE, `take` e segredo mortas | `tenant-directory-search.md`; known-issues 176        |
| H6 (hosts 6)         | Better Auth multi-host, vínculo com consentimento, modo host da área do cliente, Zoho no `app.`                                | T9 e T10 pelo caminho real; 22 mutações mortas                                                                | `tenant-client-enrollment.md`; known-issues 172 e 180 |
| pendências da onda 2 | ILIKE em categorias e CLI, IP da auditoria, bcrypt assíncrono, prorrogação 409/404, texto cp850, sanitização native, modo host | Testes novos falham com a correção revertida                                                                  | known-issues 172, 175, 181, 182, 184 e 185            |
| CSS (catraca)        | Regra `css-important` e linha de base visual do web                                                                            | 415 ocorrências medidas; duas capturas seguidas sem diferença                                                 | known-issues 177; `tests/visual/README.md`            |
| CSS limpo (parcial)  | Camadas, estilos nos componentes, arquivo global dividido; `!important` de 415 para 22                                         | Comparação visual final sem diferença não aprovada (30 aprovações do anel de foco); 26 testes com mutação     | known-issues 177–179; `design-system.md`              |

Execução na árvore da onda 3 em 2026-09-26, com PostgreSQL descartável e as
migrations até `202609260006`:

| Comando                 | Resultado                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `pnpm arch`             | exit 0; 1108 ocorrências em 91 arquivos, 0 acima da baseline                                                                 |
| `pnpm tokens`           | exit 0; `css-important` 22/22                                                                                                |
| `pnpm check:tokens`     | exit 0; 3 níveis não provados, todos listados com motivo                                                                     |
| `pnpm check:test-names` | exit 0; 386 testes colocados, 4 órfãos na allowlist                                                                          |
| `pnpm ratchet:guard`    | exit 0                                                                                                                       |
| `pnpm test:gates`       | 81 de 81                                                                                                                     |
| `pnpm test:unit`        | 497 de 497                                                                                                                   |
| `pnpm test:security`    | 471 passaram, 16 pulados                                                                                                     |
| `pnpm test:identity`    | 82 de 82                                                                                                                     |
| `pnpm test:platform`    | 1704 passaram, 2 pulados                                                                                                     |
| `pnpm test:mobile`      | 36 de 36                                                                                                                     |
| `pnpm test:web`         | 107 passaram, 7 pulados, 2 falharam (`decide.visible-routes.test.ts` sem `/vincular`)                                        |
| `pnpm typecheck`        | exit 0                                                                                                                       |
| `pnpm lint`             | exit 1; 1 erro (`no-constant-condition`) na fixture `tests/unit/__fixtures__/tokens/important/packages/ui/src/important.tsx` |
| Ferramentas visuais     | `tests/visual/compare.test.ts`: 9 de 10; o caso que exige `approved-changes.json` vazio falha                                |

Não repetidos nesta consolidação: `test:integration` (sobe servidor Next),
`type-check` da raiz, `build:web`, `docker build`, a captura visual (cerca de 30
min) e a suíte `tests/contract/**` (sem config).

### Pendências da onda 3 (situação depois da onda 4)

- Entre lotes: `/vincular` em `decide.visible-routes.test.ts` e o caso de
  `compare.test.ts` com `approved-changes.json` foram resolvidos antes do commit
  `be859915`; o erro de lint da fixture não aparece mais (`pnpm lint` exit 0); o
  bloco de exceção de `usePathname` saiu do `eslint.config.js` na onda 4.
- Identidade (known-issues 180): resolvida na onda 4.
- Suítes e scripts: `test:contract` e o passo no CI entraram na onda 4; os
  scripts `visual:capture`, `visual:compare` e `test:visual-tools` existem desde
  o commit. Continua pendente: `tests/visual/baseline/` no `.prettierignore`.
- `.env.example`: o comentário de `PLATFORM_RATE_LIMIT_SECRET` foi atualizado na
  onda 4 (obrigatória em produção, igual em todas as instâncias) e
  `TRUSTED_PROXY_HOPS` entrou na onda 5. Continua ausente a nota de
  `BETTER_AUTH_TRUSTED_ORIGINS` recusada; `PLATFORM_NAME` não é mais lido pelo
  código e pode sair.
- CSS: resolvido na onda 4 (filtros e campos nos componentes de `packages/ui`,
  `FOCUS_RING` exportado, tokens `:root`/`.dark` no design-tokens).
- Referências a nomes antigos de teste:
  `docs/architecture/adr-web-route-groups.md` e os registros históricos de
  `docs/migration/` (pendente).

### Decisões pendentes do usuário (onda 3)

1. Resolvida na onda 5 (lote A1): anel de 2px só por teclado, no laranja da
   marca (token `--focus-ring`, `#ea580c` nos dois temas); linha de base
   regravada e `approved-changes.json` vazio.
2. Resolvida na onda 4: o `ScrollRevealInit` não grava mais estilo inline nos
   elementos com transição do CSS nem na página Sobre (known-issues 194).
3. Resolvida na onda 4: o Mapa não usa mais `!important` (folha adotada no fim
   do Shadow DOM). A prova foi em Chromium contra o `gmpx-store-locator` real
   sem chave; a validação com chave do Maps não foi feita.
4. Sem o `!important` em `html`/`body`, travas de rolagem inline de bibliotecas
   voltam a valer (sem diferença nas capturas): confirmar.
5. Produção sem `PLATFORM_RATE_LIMIT_SECRET`: decidido recusar, aplicado na onda
   4 (known-issues 191). Continuam abertos o balde `unknown` sem IP confiável e
   o limite de 30 buscas por minuto.
6. Identidade: tela de vínculo e texto LGPD (U3); política do
   `PROFILE_CONFLICT`; rate limit do Better Auth pelo IP real antes do Lote 8;
   aceitar o fim das sessões com a troca do cookie.
7. ADR SaaS: prazos da régua (B.5, B.6 e B.18), saltos de estado fora do
   diagrama, regra `ROOT-KEY-ISOLATION` e dependência `undici` (lista completa
   na seção B.16 da ADR).
8. Nomes de teste: manter testes de vários componentes irmãos sob o componente
   principal (em vez de dividir), `HybridTooltip.web.test.tsx` em `packages/ui`
   e o aspecto `index.contract` em inglês.
9. IP da auditoria: IPv6 agrupado por /64 e `unknown` sem fonte confiável, ou
   variante sem agrupamento.

## Onda 4 (commit `4b02f52f`)

Lotes executados em paralelo em 2026-09-26 sobre `be859915`, com escopos
disjuntos: a correção dos 28 achados da revisão da onda 3 (seção "Revisão
adversarial da onda 3") e três lotes de CSS. Cada teste novo falha com a
correção revertida (mutação e restauração conferida por sha256).

| Lote                     | Entrega                                                                                                                              | Provas relatadas                                                                                                              | Registro                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Borda e contrato de host | Achados 1 a 4 e 24: `resolveWebPlatformEnv` só no web; guard de mesma origem em 16 handlers; `/current` 409 fora de host de locadora | Os 16 handlers reproduzidos com dublês e 2 no banco real; 22 testes caem com o guard sempre aceitando                         | known-issues 188 e 190                    |
| Entrada da equipe        | Achados 25 a 28 e pendências do H6: `app.<raiz>/login`, API de conta mínima no host de locadora, proxy testado                       | 22 mutações; E2E em Chromium 10 de 10 nos modos legacy e better-auth; `list-sessions` 404 no host de locadora pelo proxy real | known-issues 180 e 189                    |
| Dinheiro                 | Achados 7 a 9: saldo em centavos, reemissão de boleto só com prova, multas e taxas em centavos                                       | Mutação por arquivo e de semântica (sem arredondar, `ROUND_DOWN`, modo global); dublê de contrato do Asaas                    | known-issues 186 e 187                    |
| Gates                    | Achados 5, 6 e 10 a 16; `test:contract`; `ci.yml` válido                                                                             | Repositórios git descartáveis; cluster PostgreSQL com SCRAM; `prisma migrate deploy` real com leitor concorrente              | known-issues 192; `ratchet-gates.md`      |
| Limitadores              | Achados 17 a 20 e decisão H7a                                                                                                        | 400 tentativas paralelas de 80 IPs; duas instâncias no PostgreSQL; 7 mutações                                                 | known-issues 191                          |
| Frontend                 | Achados 21 a 23; regra de `usePathname` como erro em todo o `packages/frontend`                                                      | Layout real do expo-router com 5 mutações detectadas                                                                          | known-issues 161, 162 e 193               |
| C1                       | `!important` zerado; `css-important` de tolerância zero                                                                              | Sondas em Chromium (rolagem suave, revelação, Mapa, primeiro modelo 3D sem zoom com controle positivo)                        | known-issues 194                          |
| C2                       | Formulários, botões e gatilhos com estilo no componente; camadas `overrides` apagadas                                                | Comparação visual: 30 arquivos, 476 capturas, só as 30 aprovações antigas do anel de foco                                     | known-issues 195; `design-system.md`      |
| C3                       | Tokens CSS no design-tokens, 13 arquivos de CSS com uma responsabilidade, `lint:css` e trava de estrutura                            | Mesma comparação visual; 13 mutações; `lint:css` com 0 erros                                                                  | `design-system.md` ("Arquitetura do CSS") |

Execução na árvore da onda 4 em 2026-09-26 (lote de documentação), com
PostgreSQL descartável e as 19 migrations aplicadas:

| Comando                                        | Resultado                                                                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm arch`                                    | exit 0; 1108 ocorrências em 91 arquivos, 0 acima da baseline                                                                                    |
| `pnpm tokens`                                  | exit 1; 5 `tailwind-palette-class` no arquivo novo `apps/clients/web/src/app/(auth)/login/page.tsx` (fallback do `Suspense`); `css-important` 0 |
| `pnpm lint:css`                                | exit 0                                                                                                                                          |
| `pnpm check:tokens`                            | exit 0; 3 níveis não provados, todos listados com motivo                                                                                        |
| `pnpm check:test-names`                        | exit 0; 406 testes colocados, 4 órfãos na allowlist                                                                                             |
| `RATCHET_BASE_REF=be859915 pnpm ratchet:guard` | exit 0; as 3 transferências da onda 2 aparecem como `stale` (já aplicadas na base e ignoradas)                                                  |
| `pnpm test:gates`                              | 90 de 90                                                                                                                                        |
| `pnpm test:visual-tools`                       | 10 de 10                                                                                                                                        |
| `pnpm test:contract`                           | 73 de 73                                                                                                                                        |
| `pnpm test:unit`                               | 539 de 539                                                                                                                                      |
| `pnpm test:security`                           | 549 passaram, 18 pulados                                                                                                                        |
| `pnpm test:identity`                           | 90 de 90                                                                                                                                        |
| `pnpm test:platform`                           | 1810 passaram, 2 pulados                                                                                                                        |
| `pnpm test:mobile`                             | 42 de 42                                                                                                                                        |
| `pnpm test:web`                                | 145 passaram, 7 pulados (e2e desligado sem `TENANT_HOSTS_E2E=1`)                                                                                |
| `pnpm typecheck`                               | exit 0                                                                                                                                          |
| `pnpm lint`                                    | exit 0                                                                                                                                          |

Não repetidos nesta consolidação: `test:integration` (sobe servidor Next),
`type-check` da raiz, `build:web` (verde nos relatórios dos lotes da entrada da
equipe e C3), `docker build`, a captura visual (cerca de 30 min; os lotes C1 a
C3 relataram comparação sem diferença não aprovada) e o e2e dos hosts.

### Pendências da onda 4 (situação depois da onda 5)

- Resolvida antes do commit `4b02f52f`: o `pnpm tokens` vermelho pelo fallback
  do `Suspense` do login da equipe (a rota passou a usar o `LoginPageFallback`
  da página compartilhada, sem classes de paleta).
- Resolvida na onda 5: o leitor do provedor está ligado em `lib/quote-boleto.ts`
  e também em `lib/payment-request.ts` (known-issues 199).
- Resolvida na onda 5: as migrations `202609260001` a `0003` ganharam
  `lock_timeout` e `statement_timeout`; a `0001` segue o padrão da `0004`, e a
  `0002`/`0003` mantêm o `NO FORCE` (known-issues 192).
- `ratchet-guard`: o fallback `KNOWN_BASELINES` não tem teste ponta a ponta, e o
  guard ainda confia no código das ferramentas da árvore (risco residual:
  mudança nas regras de contagem é revisão de código).
- Resolvida na onda 5 (lote A2): as 19 variáveis de `legacy.css` viraram tokens
  nomeados no `tokens.css` ou tokens que já existiam, e o arquivo foi apagado; o
  `ScrollRevealInit` não cita mais classes sem elemento (known-issues 201).
- Carrossel 3D: Teste 1 em GPU real e Slow 3G; `pageerror` de `removeChild` com
  SwiftShader (known-issues 167).
- Documentação fora do escopo do lote de documentação:
  - `docs/architecture/adr-tenant-hosts.md`: contrato de `resolvePlatformEnv` e
    `resolveWebPlatformEnv`, árvore do host `app` com `(auth)/login/`, allowlist
    mínima do host de locadora e linha H6 do estado da implementação
    (atualizados na onda 5);
  - `docs/architecture/multiempresa.md`: IP do limitador atrás do proxy;
  - `docs/ai/boot.md`: regra de `!important` ainda fala em "22 restantes" e o
    estado das ondas parou na onda 3;
  - `docs/COMPONENT_INVENTORY.md`: exportações novas de `@gb-locacoes/ui` e a
    prop `allowSignUp` do `LoginPage`;
  - `tools/test-colocation-allowlist.json`: o motivo de `routes.test.ts` diz que
    testes em `src/app` viram tela, o que deixou de valer com a `blockList` do
    Metro;
  - `docs/issues/modernization-identity-tenancy.md` e `.env.example`:
    `PLATFORM_NAME` aposentada.

### Decisões pendentes do usuário (onda 4, situação depois da onda 5)

1. Resolvida na onda 5 (lote A1): opção (a), restaurar a produção. As regras de
   elemento voltaram para `@layer base`, a barra de rolagem padrão para
   `components`, e a camada `legacy` e os marcadores `data-own-*` saíram
   (known-issues 195).
2. Resolvida na onda 5 (lote A2): o primeiro quadro usa variantes `motion-safe`
   no JSX e a exceção de movimento reduzido saiu do `token-check` (known-issues
   201).
3. Aberta: `css-important` fica em `rules` da `tools/token-baseline.json` com
   cota zero, ou o `ratchet-guard` aprende a aceitar regra promovida a absoluta?
   Confirmar como correção o fim do `overflow` inline ao sair da página Sobre.
4. Resolvida na onda 5 (lote security): guard central em
   `resolveTenantPrincipal` (o que cobre `/api/admin/**` e `requireAdmin`) e,
   sem borda, `WEB_PUBLIC_ORIGIN` ou a origem da própria requisição
   (known-issues 196).
5. Resolvida: `allowSignUp={false}` e a retirada das três entradas sem chamador
   entraram na onda 4; a casca da plataforma nas páginas de conta do host `app`
   (lote D2) e o rate limit do ramo better-auth de `forgot-password` e
   `register` (lote security) entraram na onda 5. Detalhes de marca e rodapé
   continuam na lista da onda 5.
6. Resolvida na onda 5 (lote dinheiro): leitor ligado em `lib/quote-boleto.ts` e
   em `lib/payment-request.ts`, com a reconciliação e o arredondamento aceitos
   na onda 4 (known-issues 199).
7. Em parte: os timeouts da `0004` (5 s e 60 s) foram estendidos às `0001` a
   `0003` na onda 5. Continuam abertos o dono `CLIENT` só pelo parâmetro de rota
   amarrado ao acesso a dados, `CREATE INDEX CONCURRENTLY` para tabela grande e
   "estreitar" medido por arquivo, não por par arquivo/regra.
8. Em parte: o segredo segue `PLATFORM_ENV`/`VERCEL_ENV` desde a onda 5
   (`isPlatformProduction`; preview da Vercel usa chave local). Continua aberto
   o teto de 100 por conta a cada 15 min (aviso ao titular ou desafio extra?).
9. Aberta: `blockList` do Metro para testes em `src/app` e `tsconfig.test.json`
   com DOM (o teste do `_layout` roda em jsdom e não é prova de aparelho).

## Onda 5 (árvore de trabalho, sem commit)

Lotes executados em paralelo em 2026-09-29 sobre `4b02f52f`, com escopos
disjuntos: o endurecimento de segurança pendente da onda 4, a conciliação de
cobranças com o provedor, dois defeitos do frontend sem mudança visual, a
cascata da produção com o anel de foco laranja, a higiene final do estilo e a
casca do host `app`. Cada teste novo falha com a correção revertida (mutação e
restauração byte a byte conferida por sha256). Outros lotes da onda 5 (por
exemplo, a revisão do domínio da assinatura e a identidade do app mobile)
registram as próprias mudanças nos documentos do escopo deles, como
`adr-saas-subscription.md` e a seção de identidade de `adr-tenant-hosts.md`;
esta seção cobre os seis lotes abaixo.

| Lote                        | Entrega                                                                                                                                                                                                                                                                                                       | Provas relatadas                                                                                                                                                                                                                              | Registro                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| security                    | Guard de mesma origem central (`resolveTenantPrincipal`, `requireAdmin` só com cabeçalhos, fluxos anônimos de conta, `WEB_PUBLIC_ORIGIN` sem borda); limitador no ramo better-auth; log `[identity]`; segredo por `isPlatformProduction`; `TRUSTED_PROXY_HOPS`; `createLoginRole`; timeouts das `0001`–`0003` | 19 mutações no código e as das migrations numa cópia no scratchpad; `admin-same-origin` chama as mutações reais de `/api/admin/**`; `account-flows-guard` (29 casos); passagem CSRF do inventário; `migrate deploy` do zero com 19 migrations | known-issues 191, 192 e 196; `security.md`                           |
| dinheiro                    | Critério único de prova no billing (`cancelled-charges.ts`) para PIX e BOLETO; leitor por locadora (`readTenantProviderCharge`) ligado no boleto e no pedido de pagamento; 502 para chave recusada; relatório somente leitura de centavos e runbook                                                           | 17 testes em banco real com a composição real contra o dublê do Asaas; 8 do relatório; 10 mutações de semântica                                                                                                                               | known-issues 187 e 199; `modernization-billing.md`                   |
| frontend sem mudança visual | Carrinho salvo preservado na troca de escopo; "Entrar" da área privada com `callbackUrl`                                                                                                                                                                                                                      | jsdom com visitante → login e vitrine A → área de B; `_layout` real do app                                                                                                                                                                    | known-issues 197 e 198                                               |
| A1                          | Cascata da produção restaurada (`base`/`components`, sem `legacy` nem `data-own-*`); anel de foco laranja (`--focus-ring`); linha de base regravada                                                                                                                                                           | Duas capturas com 0 diferenças; CSS da `main` aplicado ao mesmo DOM: 29.587 de 29.625 bordas e 6.221 de 6.288 tipografias iguais à produção                                                                                                   | known-issues 195; `design-system.md`; `tests/visual/README.md`       |
| A2                          | X do diálogo sem anel no clique; `Drawer` com a trava solta; `slide-in-up` de 60 px; primeiro quadro `motion-safe`; `token-check` lendo o config JS e `jsx-text-escape`; testes fora do Tailwind; fim do `legacy.css`; 161 classes sem efeito removidas                                                       | Comparação visual com 0 diferença não aprovada (4 arquivos regravados de propósito); 14 mutações                                                                                                                                              | known-issues 198 e 200 a 203; `design-system.md`; `ratchet-gates.md` |
| D2                          | Casca da plataforma nas páginas de conta do host `app` (`chrome="platform"`, `widgets/casca-plataforma`, prop `shell`); seletor de locadora do painel como barra de 53 px no web                                                                                                                              | 24 mutações; interação em `app.localhost` (26 de 26); só os 16 arquivos `painel/*` regravados                                                                                                                                                 | known-issues 189 e 204; `tenant-hosts-web.md`                        |

### Decisões aplicadas na onda 5

- **Cascata da produção restaurada**: a identidade é a da `main` (Tailwind 3); o
  resíduo medido vem do Tailwind 4 em si (paleta OKLCH, `text-base` como cor),
  não da cascata (known-issues 169, 170 e 195).
- **Foco laranja**: anel de 2px só por teclado, no laranja da marca
  (`--focus-ring`, `#ea580c` nos dois temas), também no X do `Dialog` e do
  `Sheet` pela modalidade de entrada (known-issues 200).
- **Casca do host `app`**: `/login`, `/recuperar-senha`, `/reset-password`,
  `/auth/callback` e `/admin/login` usam a casca da plataforma (barra com
  `PLATFORM.displayName`, sem cabeçalho, rodapé e WhatsApp da vitrine); o host
  de locadora continua na vitrine. Não há segunda cópia das telas: `LoginPage`,
  `RecuperarSenhaPage` e `ResetPasswordPage` recebem `shell`.
- **CSRF central**: uma regra só em `same-origin-mutation.ts`, aplicada na
  autorização por cookie e nos fluxos anônimos de conta, com a passagem CSRF do
  inventário de rotas; `CSRF_PENDING` está vazia (known-issues 196).
- **Conciliação com o provedor**: cobrança PIX ou boleto `CANCELLED` sem prova é
  lida no Asaas pela integração da locadora antes de qualquer cobrança nova;
  divergência é 409, indisponibilidade 503 e chave recusada 502, nunca uma
  segunda cobrança (known-issues 199; runbook
  `docs/guides/legacy-cents-reconciliation.md`).

### Execução

Esta consolidação não repetiu as suítes: outros lotes da onda 5 ainda editavam a
árvore. Os resultados são os relatados por cada lote, cada um sobre o próprio
escopo e com o PostgreSQL descartável. Fica pendente, antes do commit da onda 5,
a rodada completa (`arch`, `tokens`, `lint:css`, `check:test-names`,
`ratchet:guard`, `test:gates`, `test:unit`, `test:security`, `test:identity`,
`test:platform`, `test:mobile`, `test:web`, `test:contract`, `typecheck`,
`lint`, `build:web`) e o `test:integration` com servidor (o lote dinheiro não
rodou `quote-flow.test.ts`).

### Pendências da onda 5 (situação depois da onda 9)

- `pnpm test:integration` completo com o `next dev` (lote dinheiro): continua
  pendente; nas ondas 6 a 9, um `next dev` de outra sessão segurava a porta e a
  trava do `.next`.
- Resolvida nas ondas 8 e 9: a catraca de tokens foi baixada com
  `node tools/token-check.mjs --update-baseline` (que só aceita reduções),
  inclusive as 6 contagens que os arquivos do lote D2 tinham baixado.
- Resolvida na onda 8: `line-height` sem unidade no `Text` do design system
  (known-issues 204 e 219).
- Resolvida na onda 8: `text-base`/`text-small` gerando cor (known-issues 170 e
  219).
- Documentação fora do escopo do lote de documentação da onda 5 (continua
  pendente; lista das ondas 6 a 9 na seção "Ondas 6 a 9"):
  - `AGENTS.md`, seção 6: as camadas passaram a
    `theme, base, components, utilities` (sem `legacy`);
  - `docs/ai/boot.md`: regra de `!important` ainda fala em "22 restantes" e o
    estado das ondas parou na onda 3;
  - `docs/architecture/adr-tenant-hosts.md`, tabela de variáveis:
    `PLATFORM_RATE_LIMIT_SECRET` obrigatória pelo critério da plataforma
    (`PLATFORM_ENV`/`VERCEL_ENV`, não `NODE_ENV`), `TRUSTED_PROXY_HOPS` e a
    origem esperada sem borda (`WEB_PUBLIC_ORIGIN` ou a da própria requisição);
  - `.env.example`: o comentário de `PLATFORM_RATE_LIMIT_SECRET` pode dizer que
    "produção" é `PLATFORM_ENV`/`VERCEL_ENV`;
  - `docs/README.md` ou um índice de `docs/guides`: o runbook
    `docs/guides/legacy-cents-reconciliation.md` só está ligado por
    `docs/ai/context-map.md` e `modernization-billing.md`.

### Decisões pendentes do usuário (onda 5, situação depois da onda 9)

Os itens de dinheiro, do carrinho e da casca do host `app` estão também na lista
consolidada "Decisões aplicadas por padrão, aguardando aprovação do dono", na
seção "Ondas 6 a 9".

1. Segurança:
   - sem borda validada, toda mutação de navegador com cookie precisa vir de
     `WEB_PUBLIC_ORIGIN` ou da própria origem; um `next start` atrás de proxy
     reverso sem borda e sem `WEB_PUBLIC_ORIGIN` passa a responder 403 às
     mutações do painel (pelo host web isso não acontece). Confirmar;
   - nos middlewares só com cabeçalhos, requisição sem `Origin` é tratada como
     leitura (especificação Fetch; mantém o callback OAuth do Zoho). Aceitar;
   - preview da Vercel sem `PLATFORM_RATE_LIMIT_SECRET` usa chave por instância.
     Confirmar, ou exigir o segredo fora de development.
2. Dinheiro:
   - 503 para integração ausente ou sem chave e 502 só para chave recusada ou
     resposta fora do contrato. Confirmar;
   - critério conservador: um PIX `CANCELLED` ainda aberto volta a ser o vigente
     e o boleto responde 409 "outro meio"; obrigação parcialmente paga com
     cobrança legada aberta responde 409 sem reativar. Confirmar;
   - mensagens "Cobrança anterior…" compartilhadas entre PIX e boleto (a UI
     mostra o texto).
3. Frontend:
   - sair da conta não apaga mais o carrinho salvo do usuário (fica no escopo
     dele); apagar ao sair é uma mudança pequena no `signOut` do
     `RuntimeBootstrap` (known-issues 197);
   - aprovar a edição de uma linha em `decide.visible-routes.test.ts`, feita
     fora do escopo do lote frontend;
   - no app, a query não volta no `callbackUrl` (não há URL; nenhuma tela
     privada do app usa outros parâmetros hoje).
4. Estilo:
   - anéis de foco próprios em `orange-500` (painel das `Tabs`,
     `HoverActionMenu`, `CategoriaDialog`, `email-layout-container`, `Bloco` de
     `personalizar-icone`) contra o `--focus-ring` (`#ea580c`): aplicado na onda
     8, todos passaram a `FOCUS_RING` (known-issues 221);
   - paleta hex do Tailwind 3 no `@theme` (`orange-600` renderizava cerca de
     `rgb(245,74,0)`, não `#ea580c`; known-issues 169): aplicada por padrão na
     onda 8, com a prova contra a `main` (known-issues 219); aguarda aval;
   - `text-base`: o `...designTokens` saiu do config na onda 8, restaurando a
     produção (known-issues 170 e 219); aguarda aval;
   - molduras dos campos anulam intenções dos consumidores: aplicado na onda 8 o
     estado por `aria-invalid` (borda vermelha de erro no `QuoteForm` e no
     `Bloco`; known-issues 220). Continua aberto: foco verde do WhatsApp e caixa
     marcada em ardósia no Rejeitar, que nunca valeram na produção;
   - elementos fora da lista de parados do `ScrollRevealInit` continuam animando
     com movimento reduzido, como na produção.
5. Casca do host `app`: rodapé do login "Locadora - Sistema de Acesso" (sem "©"
   nem ano) e selo com o nome inteiro da plataforma no cartão, até existir logo
   (aguarda aval). A correção do `lineHeight` no `Text.web.tsx` foi aplicada na
   onda 8 (known-issues 204 e 219).

## Ondas 6 a 9 (árvore de trabalho, commit local de 2026-09-30)

Lotes executados em paralelo em 2026-09-29 e 2026-09-30 sobre a árvore da onda
5, com escopos disjuntos e um PostgreSQL descartável por lote. Cada lote
reproduziu o achado contra o código atual, escreveu primeiro o teste que falha e
corrigiu na causa; cada teste novo falha com a correção revertida (mutação e
restauração byte a byte conferida por sha256). Nas ondas 6 a 8, dois
verificadores independentes (reprodução e mutação) conferiram cada lote; o que
eles reabriram voltou numa segunda rodada do mesmo lote ou virou achado da onda
seguinte (seções "Revisão adversarial da onda 4" e "Revisões dos resíduos"). Na
onda 9, o lote css-paridade teve segunda rodada depois dos verificadores, e o
reparo da faxina fechou os 16 problemas que os verificadores dela apontaram. Os
resultados são os relatados pelos lotes; esta consolidação não repetiu as
suítes.

### Onda 6 (revisão da onda 4)

| Lote            | Entrega                                                                                                                                                                                                                                                                                                                   | Provas relatadas                                                                                                                    | Registro                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| dinheiro        | Achados 11 a 17, 20 e 21: regra única da obrigação (`quoteObligation`), cobranças base sob a trava `:issue:` (409 se emitida), valor final manual como reajuste `OTHER`, centavos na entrada; falha sem efeito volta à fila; preço exato numa função só; `paidAt` na data de São Paulo; dublê sem `DELETE /subscriptions` | Duas rodadas; banco real com o dublê do Asaas; 2.508.300 combinações de preço sem divergência entre tela, servidor e Decimal        | known-issues 205 a 207 e 209 |
| identidade      | Achados 5 a 8: respostas neutras no better-auth, conclusão do `oauth-proxy` presa ao navegador e à origem, `AuthUnavailable` e 503 com `Retry-After`, origem dos links de e-mail pela conta; e-mail de verificação depois do commit                                                                                       | Duas rodadas; rota real de cadastro com o pool de produção (`max 1`); mutações em memória                                           | known-issues 210 a 212       |
| rotas-diretorio | Achados 9, 10, 25 e 32: API de conta por modo de autenticação, `enroll` com 409 `TENANT_REQUIRED` pela borda, `q` com caractere de controle recusado, sugestão `?locadora=` guardada e query preservada no `/admin`; segredo do diretório pelo critério da plataforma                                                     | Mutações com sha256; índice `/admin` real dentro do portão                                                                          | known-issues 213 a 215       |
| travas-banco    | Achados 22 a 24 e 26 a 30: inventário de rotas (parâmetro, objeto, classe, callback, carga dinâmica, dono `CLIENT`), `ratchet-guard` com política de configuração e `css-important` sem isenção, `DROP INDEX IF EXISTS` e recuperação do `P3009`; guard de mesma origem sem condição em `/api/quotes`; testes sem rede    | Duas rodadas; `prisma migrate deploy` real com a tabela travada; cluster PostgreSQL 18 com SCRAM; mutações do analisador e do guard | known-issues 192 e 216 a 218 |

### Onda 7 (resíduos 101 a 110)

| Lote               | Entrega                                                                                                                                                                                                                                            | Provas relatadas                                                                                        | Registro                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| residuo-dinheiro   | 101 a 103: teste de concorrência da trava `:issue:` (`pg_locks`), `maybeApplied` do `create` pela cobrança, conciliação de `UNKNOWN` em rodadas pelo cron da outbox, total do carrinho pela regra da linha                                         | Duas rodadas; 11 mutações por troca de módulo, sem mutar o repositório; rota real do cron               | known-issues 205 a 207                            |
| residuo-identidade | 104 a 106: `withSignInAvailability` na rota real, plugin `appAuthorization` contra o login CSRF do `expo-authorization-proxy`, falha de e-mail depois do commit sem derrubar o cadastro e reenvio pelo cadastro repetido; 107 ficou para a onda 8  | Duas rodadas; sonda do verificador (plantio 400, `state_mismatch`); login do app no teste de integração | known-issues 210 a 212; ADR de hosts (identidade) |
| residuo-travas     | 108 a 110: regra estrutural do inventário (`PROLOGUE`, INERT em gramática fechada), duas rotas normalizadas com o contrato caracterizado antes, `tenant-request.test.ts` com a ordem nova do guard, preflights com `migrate resolve --rolled-back` | Duas rodadas; 41 mutações do motor; `prisma migrate deploy` real para `0001`, `0002`, `0003` e `0005`   | known-issues 196, 217 e 218                       |

### Onda 8 (resíduos 111 a 122)

| Lote                  | Entrega                                                                                                                                                                                    | Provas relatadas                                                                                                                                 | Registro               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| fech-travas           | 111 e 112: `instanceof` antes do guard só com classes seladas, zod na carga só com construtores, um id por módulo                                                                          | Duas rodadas; veredito, INERT e CSRF dos 193 endpoints iguais antes e depois (168 ok); corpus diferencial contra o zod 4.6.5 instalado           | known-issues 218       |
| fech-identidade-front | 113 a 115: regra única de modo e `basePath` em `@gb-locacoes/contracts/platform`, `signInHref` único, painel sem sessão direto ao login só depois de a leitura da sessão da rota responder | Duas rodadas; Playwright em `app.localhost` com só a leitura da sessão interceptada; mutações no `RuntimeBootstrap`                              | known-issues 213 e 215 |
| fech-dinheiro         | 116: religação de `QUEUED`, `PROCESSING` e `UNKNOWN` pelo cron, com espera de 15 min a 6 h; pedido recusado encerra a tentativa em `FAILED`                                                | Duas rodadas; banco real e rota do cron; o cenário do verificador foi de 256 POSTs recusados em 7 dias para 1                                    | known-issues 208       |
| fech-css              | 117 a 122: paleta do Tailwind 3 em hex, `text-base` fluido, `Text` em px, erro por `aria-invalid`, anéis só `FOCUS_RING`, CSS da raiz sem ler `docs/`                                      | Duas rodadas; prova por classe contra a `main` compilada (476 cores, 30 tamanhos, 6 degradês); linha de base regravada, 2 capturas sem diferença | known-issues 219 a 222 |

### Onda 9 (resíduos 123 a 127 e faxina)

| Lote                                  | Entrega                                                                                                                                                                                                                                                                                                          | Provas relatadas                                                                                                                                                                         | Registro                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| travas-final                          | 123 e 124: contrato em camadas (regra de lint `runtime/no-runtime-rewrite`, carga com gramática fechada, resolução ambígua reprovada, autoverificação da regra) e modelo de ameaça em `security.md`                                                                                                              | 1751 arquivos de servidor medidos antes de ligar a regra; 28 mutações                                                                                                                    | known-issues 218; `security.md`            |
| dinheiro-final                        | 125 e 126: recusa definitiva só por `ChargeRequestRejected`, 400 em leitura como falha passageira, religação da cobrança aberta sem tentativa (`payment.issue:open`)                                                                                                                                             | Prova do verificador falhava 3 de 3 e passa 3 de 3; 13 mutações                                                                                                                          | known-issues 208                           |
| css-paridade                          | 127: semântica da produção em todas as categorias de classe (escalas, contorno, breakpoints, `hover:`, `space-*`, preflight), classes inertes na produção removidas, teste de paridade versionado                                                                                                                | Duas rodadas; 3697 strings de classes em 5 estados sem diferença de contorno; 18 mutações; Chromium, Firefox e WebKit aceitam o `revert-layer` no fallback; 0 diferenças em 478 capturas | known-issues 223; `tests/visual/README.md` |
| faxina (código, configuração, reparo) | 75 arquivos e 30 símbolos mortos, 630 linhas comentadas, logs sem dado pessoal, dependências declaradas por pacote, configs e scripts mortos, documentos do usuário em `docs/archive/`, gate `pnpm hygiene`, regra 8 do `AGENTS.md`                                                                              | Arquivo morto sintético reprova o gate; 16 mutações no reparo; `build:web`, build da raiz, Storybook e `expo export` verdes                                                              | known-issues 224 a 226; `ratchet-gates.md` |
| higiene-final                         | 129 e 131: aprovação dos exports CSS no `ratchet:guard`, gates no `test:gates` (com teste que deriva a lista), pre-commit sem `git add .`, docs sem API apagada nem remoção recursiva, ponteiro do Cursor, `CLAUDE.md`/`AGENTS.md` com o stack real, gerador zod fora do schema e regra de manutenção registrada | Mutações no hook, no `test:gates` e no schema; lockfile só com remoções                                                                                                                  | known-issues 227 e 228                     |

### Execução

Rodada histórica relatada pelo reparo da faxina, sobre a árvore com as ondas 5 a
9 e o banco descartável: passaram `pnpm hygiene`, `typecheck`, `type-check`,
`lint`, `arch` (1050 ocorrências), `tokens`, `check:test-names` (429 testes
colocados, 3 órfãos permitidos), `docs:validate`, `test:gates`, `test:unit`,
`test:security`, `test:platform`, `test:web` e `test:mobile`, além do
`build:web` e do build da raiz (na 1ª rodada da faxina, `test:unit` 699,
`test:security` 657 e `test:gates` 127). O lote css-paridade relatou `lint:css`,
`tokens`, `check:tokens`, `test:visual-tools` e o `build:web` com um único
`!important` (o `[hidden]` do preflight) e nenhum `oklch`; o fech-dinheiro,
`test:contract` 103 de 103; o fech-identidade-front, `test:identity` 134 de 134
e `test:mobile` 43 de 43.

Resolvido depois, no lote higiene-final: o `pnpm ratchet:guard` ficava vermelho
pelos exports `./palette.css` e `./scales.css` do `@gb-locacoes/design-tokens`,
pontos de entrada que a base não tem; agora cada um tem aprovação
`package.exports` com motivo em `tools/ratchet-transfers.json`, e o guard passa
contra a base `4b02f52f` (known-issues 227). `./theme.css` e `./tokens.css` já
existem nessa base (onda 4).

No fechamento do Claude, `gates/out6/summary.txt` registra cinco suítes com exit
1 (`unit`, `identity`, `security`, `platform` e `gates`) e integração pulada; o
script externo terminou com exit 0 porque não agregava os resultados. Os bancos
`gate_*` tinham nomes recusados pela proteção de testes; também houve timeouts
durante nove suítes simultâneas. Essa execução não aprovou a suíte completa,
mesmo com a notificação de término (known-issues 230).

Retomada do Codex em 2026-09-30, no checkpoint `55763c1e`: plataforma 1.978
testes aprovados (2 pulados), identidade 134, segurança 657 (18 pulados),
unitários 779 e os quatro casos restantes do hook aprovados em repetição focada
com Git Bash no PATH. Integração HTTP: 81 testes aprovados na porta 3191, com
banco descartável dedicado e teardown confirmado. Nenhuma asserção, proteção de
banco ou timeout foi alterado. Fontes e limites no
[registro do handoff](../ai/claude-codex-handoff-2026-09-30.md).

`docker build`, CI remoto, publicação e validação em dispositivos continuam
pendentes. Os builds web/raiz e os outros checks aprovados no `out6` são
evidência histórica; não foram repetidos apenas para reconstruir a sessão.

### Pendências das ondas 6 a 9

- Resolvida no handoff de 2026-09-30: integração HTTP com servidor local e banco
  descartável, 81 testes aprovados; isto ainda exercita o runtime legado, não
  prova a extração futura para `apps/services/api`.
- Resolvidas no lote higiene-final (known-issues 227): aprovação dos exports CSS
  no `ratchet:guard` e `tests/unit/eslint-runtime-rewrite.test.ts` (e
  `stylelint-css-structure.test.ts`) no `test:gates`.
- Dinheiro:
  - lacuna de produto: tentativa `FAILED` (ou recusa antes da reserva) sem fluxo
    de reemissão pelo lojista, que mostre a recusa com os códigos, deixe
    corrigir vencimento e dados do cliente e crie uma tentativa com referência
    nova, conciliando antes pela anterior;
  - o cliente HTTP de produção (`asaas-http.ts`) ainda aceita
    `DELETE /subscriptions/**` (só o dublê recusa);
  - vencimento do boleto depende do fuso do servidor (`getBoletoDueDate` usa o
    fim do dia local e a emissão manda a data em UTC);
  - orçamento convertido não recusa `lateFee`/`lateFeeApproved` no `PATCH`;
  - `buildQuotePricing` ignora os períodos desligados que a tela respeita;
    `HistoricoDetalhePage`, o cartão de `widgets/itens-orcamento` e
    `whatsapp-data.ts` ainda somam em float; o carrinho vindo do servidor
    (`mapServerCartItem`) descarta desconto e valor direto.
- Identidade: a tela de login mostra "Credenciais inválidas" também para
  `AuthUnavailable` e `RateLimited`; `tests/security/auth-unavailable.test.ts`
  monta o próprio wrapper (a rota real já tem `nextauth-route.test.ts`);
  `tests/identity/legacy-credential-session.test.ts` é intermitente na suíte
  inteira.
- Gates: o `ratchet-guard` mede com as ferramentas da própria mudança; o
  `ignoreDirs` do `token-check` compara o nome em qualquer profundidade (o
  `$comment` de `tools/ratchet-transfers.json` passou a descrever aprovações e
  transferências de configuração no lote higiene-final).
- Documentação fora do escopo deste lote:
  - `AGENTS.md`, seção 6: resolvido no lote higiene-final (camadas sem `legacy`,
    seção 7 com o stack real);
  - `docs/ai/boot.md` ("22 restantes"; estado das ondas) e
    `docs/ai/context-map.md` (estado da modernização até a onda 5; mudança de
    classe CSS deve apontar para a seção "Paridade com a produção" de
    `tests/visual/README.md`);
  - `docs/architecture/security.md`: a seção "Gates de segurança" ainda descreve
    o inventário pela análise de fluxo (dono `CLIENT` pelo parâmetro,
    `import()`/`require()` como acesso), e
    `docs/features/admin-permissions-and-roles.md`, seção 13, também;
  - `docs/features/tenant-hosts-web.md` (ainda cita "os dois basePath"; painel
    sem sessão direto ao login), `tenant-client-enrollment.md` (decisão pela
    borda antes do corpo), `tenant-directory-search.md` (caractere de controle;
    segredo por `isPlatformProduction`), `organization-selection.md` e a D8 da
    ADR de hosts (sugestão guardada até ser tratada; query preservada no
    `/admin`) e `modernization-frontend.md` (regra única dos modos);
  - `docs/features/ratchet-gates.md`: `CONFIG_POLICY`, `css-important` medido
    sem isenção, transferência de configuração obsoleta e a mensagem nova do
    guard;
  - ADR SaaS (lote da outbox e do Asaas): rodadas de religação (`reconcile`,
    `resume`, `open`) e a tentativa `FAILED` com `response.rejection`;
  - `docs/features/notification-system.md` e `analytics-dashboard.md`:
    resolvidos no lote higiene-final (API atual e aviso histórico).

### Decisões aplicadas por padrão, aguardando aprovação do dono

1. Regras de assinatura da ADR SaaS, B.5 (achados 18 e 19, onda 5): o dia
   seguinte ao fim da cortesia é o piso de toda contagem; a cortesia não apaga
   dívida; a saída da cortesia só fica `ACTIVE` com ciclo pago que cubra os dias
   seguintes; `cancelAtPeriodEnd` na cortesia sai no fim do maior período; a
   dívida de chargeback ou de estorno involuntário se quita por ajuste vinculado
   ou perdão da equipe; a tabela de transições aceita toda transição que o
   domínio produz a partir de fatos legítimos. Detalhe em
   `docs/architecture/adr-saas-subscription.md`, bloco "Decisões padrão,
   aguardam aval do dono".
2. Casca do host `app` (onda 5): rodapé do login "Locadora - Sistema de Acesso"
   (sem "©" nem ano) e selo com o nome inteiro da plataforma no cartão, até
   existir logo.
3. Carrinho mantido por usuário ao sair: sair da conta não apaga o carrinho
   salvo, que fica no escopo do usuário (locadora e id) e volta quando ele entra
   de novo; outra pessoa no mesmo aparelho não o vê. Apagar ao sair é uma
   mudança pequena no `signOut` do `RuntimeBootstrap` (known-issues 197).
4. Política de conciliação conservadora: cobrança anterior `CANCELLED` sem prova
   de fim nunca libera uma segunda cobrança; anomalia (outro valor ou meio,
   `REFUNDED`, mais de uma aberta, PIX `CANCELLED` ainda aberto contra o boleto,
   obrigação parcialmente paga com cobrança legada aberta) responde 409; chave
   da locadora recusada ou resposta fora do contrato, 502; integração ausente ou
   provedor fora, 503 (known-issues 199).
5. Arredondamento da linha: total do item = round(preço unitário exato ×
   quantidade), uma vez, `ROUND_HALF_UP`, no servidor, no subtotal das páginas e
   no total do carrinho. A unidade exibida × quantidade pode diferir 1 centavo
   do subtotal (45,05 × 3 = 135,14); a alternativa, arredondar a unidade e
   multiplicar (135,15), muda o valor gravado e cobrado (known-issues 206).
6. Restauração da paleta, da tipografia e das escalas da produção: paleta do
   Tailwind 3.4.17 em hex (`orange-600` volta a `#ea580c`), `text-base` e
   `text-small` fluidos e `Text` com altura de linha em px (onda 8); sombras,
   raios, blur, `drop-shadow`, altura de linha de `text-*`, contorno, `ring`,
   breakpoints em px, `hover:` sem `(hover: hover)`, `transform`, `space-*` e o
   preflight do Tailwind 3 (onda 9). Efeitos a confirmar: estados de `hover:`
   voltam a valer no toque (grudam no celular); o brilho decorativo do
   `ModelViewer` sai do centro durante o pulso, como na produção (a lógica do
   carrossel 3D não mudou); o título do hero vai de 75 para 60 px e os títulos
   dos cartões da home de 36 para 18 px (known-issues 219 e 223).
7. Remoção das classes que a produção ignorava: opacidade fora da escala do
   Tailwind 3 (`/6`, `/8`, `/12`, `/98`), `border-l-3`, `duration-160`, `flex-2`
   e afins saíram do código, entre elas o degradê laranja sutil dos cabeçalhos
   de 11 páginas e o fundo amarelo do `ScrollStackBenefitCard`, que na produção
   não apareciam (known-issues 223).
8. Itens "decidir" da faxina, cada um com motivo em
   `tools/hygiene-baseline.json` (recomendação do lote entre parênteses):
   - `lib/validations`, 2.799 arquivos gerados e 2 usados, escritos à mão:
     aplicado (no lote higiene-final saíram o bloco `generator zod`, o
     `prisma-zod-generator` e o override, e a regra 4 do `CLAUDE.md` foi
     atualizada; em 2026-09-30 o dono apagou os 2.797 arquivos gerados e
     `scripts/post-prisma-generate.js`, e o lote fechamento-final tirou as
     configurações e exceções que os citavam). Ficam só os dois arquivos à mão
     (known-issues 227);
   - pipeline do Style Dictionary sem consumidor: aplicado em 2026-09-30 (saíram
     config, scripts `design-system:*-tokens`, `design-tokens/output` e a
     dependência, com lockfile só de remoções; `base.json` fica, lido por
     `primitives.test.ts` e `web-sources.ts`; known-issues 227);
   - Google Merchant, integração global em quarentena (aposentar
     `lib/google-merchant`, as 4 rotas 503, o cron da Vercel, os scripts e
     `googleapis`, salvo se o adaptador por locadora estiver próximo);
   - grafo react-native 0.86/0.87 (colapsar e só depois mover `three` e
     `@react-three/*` para `packages/frontend`; known-issues 226);
   - scripts avulsos e família RLS do Supabase (o que ainda roda vai para
     `scripts/ops` com runbook; o resto sai com os scripts `check:supabase`,
     `fix:rls` e afins);
   - `pnpm test` roda só a suíte de integração (apontar para `test:all` ou
     renomear);
   - `git add .` no pre-commit do husky: aplicado no lote higiene-final (formata
     só o Markdown preparado e re-adiciona só o que formatou);
   - arquivos de editor e ferramenta: `components.json` (remover: um
     `shadcn add` criaria `components/` na raiz), `cspell.config.js` (renomear
     para `.cjs` ou apagar), `.hintrc` e `_config.yml` (remover);
   - `.context-window/backups/*.bak` e `.claude/settings.local.json` fora do
     índice do git; `.cursor/rules/gb-locacoes.mdc` como ponteiro para o
     `AGENTS.md` (ponteiro aplicado no lote higiene-final);
   - junção `apps/clients/web/public`, que contraria a regra 7 do `AGENTS.md`:
     aplicado na onda 9b (achado 130) com a cópia gerada por
     `tools/sync-web-public.mjs` no predev/prebuild do host web; a junção e
     `pnpm link:web-public` não existem mais. O trinco da cópia não depende de
     rename atômico desde o achado 134;
   - imagens duplicadas ou de exemplo em `public/` (remover e regenerar
     `public-entries.generated.ts`);
   - overrides de segurança de pacotes fora do grafo (manter);
   - `@types/node` em `^24`, como `engines` e `.node-version`;
   - exports sem consumidor e duplicação estrutural entre pacotes (cada dono de
     fatia enxuga o `index.ts` com o teste de contrato);
   - slug e esquema `acme` do `app.json` (trocar exige registrar a origem nova
     no backend de autenticação);
   - `test:storybook` citado nas docs sem script (recriar com o addon-vitest ou
     tirar das docs);
   - auxiliar de auditoria duplicado (escolher um), `reconcileContractSignature`
     sem ponto de entrada (ligar num cron ou ação, ou apagar), cálculo de frete
     da Melhor Envio sem tela, rotas lápide 410 (definir prazo), raiz legada com
     substituto (aposentar é decisão de produto e de infraestrutura),
     `/api/cart/sync` e `/api/cart/merge` sem chamador na tela, e o
     `describe.skipIf` de modo duplo em `tests/security/tenant-request.test.ts`.

### Outras decisões abertas (ondas 6 a 9)

1. Dinheiro:
   - valor final manual vira reajuste `OTHER` da diferença (aparece na lista de
     reajustes, no portal e no PDF); alternativa: recusar `finalTotal` no
     `PATCH` e exigir a API de reajustes;
   - valor final legado que a regra não explica é preservado na próxima edição
     como reajuste "Ajuste anterior do valor final"; não há relatório desses
     orçamentos (um script poderia migrar a diferença antes do deploy);
   - mudanças aceitas: remover item ou mudar datas mantém o frete no `total`;
     valor inválido dá 400; `adjustments.ts` só bloqueia por cobrança
     `RENTAL`/`DEPOSIT`; o dublê recusa `DELETE /subscriptions` por padrão;
   - janela de 15 min e espera dobrando até 6 h na conciliação e na religação;
     `PROCESSING` com mais de 15 min tratada como abandonada (premissa escrita
     no código);
   - todo 400 do Asaas na emissão encerra a tentativa, inclusive no cadastro do
     cliente, com dado que o lojista poderia corrigir; `AMBIGUOUS` (cobranças ou
     clientes duplicados no Asaas) continua passageiro, com uma rodada a cada 6
     h, e não se resolve sozinho;
   - a religação de cobrança aberta só age quando houve pedido de emissão; o PIX
     da taxa de extensão (`rentals/lifecycle.ts`) não é emitido pelo Asaas, e
     mudar isso é um fluxo à parte;
   - `QUEUED` presa por causa de ambiente (integração desativada, cadastro
     incompleto) ganha rodadas só de banco a cada 6 h e emite sozinha quando a
     causa some.
2. Identidade e frontend:
   - `reset-password` não consulta o limitador (token de 256 bits); aplicar o
     503 também nele exige janela própria;
   - link de verificação de cadastro novo feito em host de locadora vai para o
     `app` (a conta ainda não tem vínculo): confirmar a experiência;
   - reenvio de verificação só pelo cadastro repetido; um botão ou rota própria
     envolve inventário, allowlist do host de locadora e interface; o modo
     legado não reenvia;
   - trocar o esquema `locadora://` por App Links/Universal Links quando
     existirem os identificadores do app;
   - painel sem sessão vai ao login por `location.replace` (navegação completa);
     o `router.replace` da SPA exigiria que o host o repassasse;
   - o índice `/admin` preserva a query inteira, não só `locadora`;
   - a edição de uma linha em `decide.visible-routes.test.ts` feita pelo lote
     fech-identidade-front, fora do escopo dele.
3. Gates:
   - a regra estrutural do inventário é mais estrita que as rotas de hoje
     (aceita recusa inerte e funções INERT do próprio arquivo antes do guard;
     não segue wrapper local de guard nem helper local de dono);
   - `transform`, `refine` e `pipe` continuam aceitos na carga do módulo (não
     rodam nada na construção com o zod 4.6.5); `INERT_CLASSES` tem só as
     classes que as rotas usam;
   - confirmar os riscos deixados para revisão humana e as três exceções da
     regra `runtime/no-runtime-rewrite` (`docs/architecture/security.md`);
   - o `ratchet-guard` comparar também os padrões das ferramentas da base, e o
     `token-check` deixar de isentar `css-important` por `ignoreFiles` (o guard
     já mede sem isenção).
4. Estilo:
   - foco nas cores forçadas (alto contraste do Windows): a caixa de seleção do
     Radix e as abas mostram contorno no foco, e a produção não mostrava; para
     igualar a caixa de seleção basta `focus:outline-0` no `Checkbox` (manter é
     mais acessível);
   - WhatsApp (`focus:border-green-500`) e Rejeitar
     (`data-[state=checked]:bg-slate-700`) nunca valeram na produção: criar
     variantes nomeadas, remover as classes mortas ou deixar como está;
   - o seletor de período perdeu o anel laranja 500 no clique, que a produção
     mostrava (mudança intencional, pela decisão do foco da onda 5);
   - exceções aceitas com motivo, sem ação: `sr-only` com `clip-path`,
     especificidade menor de `group-*`/`peer-*` e os valores do `WhatsAppFab`,
     iguais aos da regra global da produção.

## Lista administrativa e limitador compartilhado (2026-10-01, sem commit)

O corte 17 instala `GET /api/admin/equipments` e extrai a implementação genérica
de limitação em memória para backend/http. Os hosts fornecem o leitor real de IP
e mantêm stores independentes por processo; a identidade persistente não foi
alterada. Ordem limite → EQUIPMENTS/READ → consulta, filtros, paginação, DTO e
erros permanecem como no legado. O inventário segue a factory e rejeita wiring
ou efeitos diferentes antes da identidade, sem ampliar baselines.

Serviço parcial com dezenove GETs; 149 rotas/193 métodos legados preservados.
Clientes, writes, cookies, jobs e cutover continuam legados. Paridade em
produção local com RLS, NextAuth e Better Auth, incluindo contagem de GET/POST
legados no mesmo balde: corte 17 de
[API compartilhada](../features/shared-api-host.md).

## Leitura de permissões administrativas (2026-10-02, sem commit)

O corte 18 instala GET /api/admin/permissions e move seu SELECT para identidade
em packages/backend. Os dois adapters exigem ADMIN da membership atual antes de
entrar na transação da locadora. Preservam matriz completa, ordenação, filtro
tenantId e falhas do framework. Serviço parcial com vinte GETs; PUT e a origem
dos clientes permanecem legados. Evidências e limites: corte 18 de
[API compartilhada](../features/shared-api-host.md).

## Leitura do perfil comercial (2026-10-02, sem commit)

O corte 19 instala GET /api/user/profile reutilizando CustomerProfileService e
withTenantTransaction. Dados comerciais pertencem ao usuário/locadora atual;
nenhum cadastro global ou perfil de outro tenant entra como fallback. DTO,
documento por comprimento bruto, nulidade, recusas e erros permanecem iguais.
Serviço parcial com 21 GETs; GET/PUT, clientes e scheduler legados preservados.
Caracterização e provas locais:
[perfil comercial](../features/customer-profile.md) e corte 19 de
[API compartilhada](../features/shared-api-host.md).

## Leitura das notificações do cliente (2026-10-02, sem commit)

O corte 20 monta GET /api/client/notifications e inicia communications, módulo
de backend previsto na ADR. SELECTs e montagem da página saem do adapter legado
para a implementação compartilhada; query/schema ficam em contracts. Principal,
transação RLS, ownership por destinatário/locadora, parsing/erros, ordenação e
estatísticas observados são mantidos. Serviço parcial com 22 GETs; o legado
continua configurado e conserva stats, mutações e sync. Sem framework/pacote
novo, alteração de schema, cutover ou baseline ampliada. Evidências: corte 20 de
[API compartilhada](../features/shared-api-host.md).

## Estatísticas das notificações do cliente (2026-10-02, sem commit)

O corte 21 acrescenta GET /api/client/notifications/stats ao serviço parcial e
move seus quatro SELECTs/DTO para communications. Os dois hosts preservam
principal, transação RLS, ownership, total da caixa, mapas de não lidas por
tipo/prioridade, ausência de filtros de query e erros observados. Nenhuma
consulta de negócio foi copiada para o host. Serviço com 23 GETs; as 149
rotas/193 métodos legados seguem configurados, incluindo todas as mutações.
Caracterização e paridade HTTP em NextAuth e Better Auth: corte 21 de
[API compartilhada](../features/shared-api-host.md).

## Marcação/exclusão das notificações do cliente (2026-10-02, sem commit)

O corte 22 instala PATCH/DELETE de [id] e POST mark-all-read no serviço parcial.
Queries e efeitos ficam em communications; guards, transporte e transação
conservam a política original. Caracterização e HTTP real protegem ownership,
CSRF antes da identidade, DTOs/datas, repetição e rollback por falha SQL após o
write. Serviço com 25 rotas/26 métodos: 23 GETs e três mutações. Os handlers
legados permanecem ativos e os clientes continuam na origem configurada.
Fan-out, sync, jobs e demais escritas não foram migrados neste corte.
Evidências: corte 22 de [API compartilhada](../features/shared-api-host.md).

## Escritas de endereços do cliente (2026-10-02, sem commit)

O corte 23 monta POST /api/addresses e PATCH/DELETE por id no serviço. Reutiliza
customers e contracts existentes; backend e handlers legados não mudaram.
Caracterização protege parsing, ownership, CSRF, mensagens e efeitos de
principal. HTTP real nos dois modos confirma lock entre hosts, rollback e RLS
sem bypass. São 26 rotas/29 métodos (23 GETs e seis mutações). Clientes, login,
jobs e as 149 rotas/193 métodos legados continuam configurados; sem cutover,
produção ou relaxamento de baseline. Evidências: corte 23 de
[API compartilhada](../features/shared-api-host.md).

## Carrinho no host compartilhado (2026-10-02, sem commit)

O corte 24 monta GET/POST de /api/cart/sync e POST de /api/cart/merge no
serviço, compondo customers/cart existente. Parser, papel CLIENT, RLS,
ownership, preço autoritativo, lock e semântica replace/merge permanecem no
backend; handlers legados não mudam. Serviço parcial com 28 rotas/32 métodos (24
GETs e oito mutações), legado com 149/193 ativo. HTTP real nos dois modos
protege preços, rollback, concorrência entre hosts, espera em pg_locks e FKs. A
incompatibilidade do payload do hook consumidor foi registrada como dívida
(known-issues 233), preservando o contrato durante a extração. Evidências: corte
24 de [API compartilhada](../features/shared-api-host.md).

## Atualização do perfil no host compartilhado (2026-10-02, sem commit)

O corte 25 monta PUT /api/user/profile, reutilizando customers/profile sem mudar
seus cálculos, DTO ou transação. O schema estrito do adapter legado passa para
contracts/customer-profile e é consumido pelos dois hosts. Caracterização
anterior e HTTP real nos dois modos protegem efeitos, ownership, CSRF, RLS,
unicidade e rollback. São 28 rotas/33 métodos no serviço parcial (24 GETs e nove
mutações); as 149 rotas/193 métodos legados continuam ativos. Não há troca dos
clientes, scheduler ou configuração de produção. Evidências: corte 25 de
[API compartilhada](../features/shared-api-host.md).

## Vínculo explícito no host compartilhado (2026-10-02, sem commit)

O corte 26 monta POST /api/client/enroll com customers/enroll existente e schema
estrito comum em contracts. Caracterização anterior e HTTP real nos dois modos
protegem consentimento, host/origem/sessão, criação atômica
CLIENT/perfil/auditoria, documento alheio, idempotência, concorrência e
rollback. Inventário de segurança exige a sessão além do host público. Serviço
parcial com 29 rotas/34 métodos (24 GETs e dez mutações); 149/193 e 46 páginas
permanecem no legado. Sem troca dos clientes ou jobs. Evidências: corte 26 de
[API compartilhada](../features/shared-api-host.md).

## Criação administrativa de motoristas no serviço (2026-10-02, sem commit)

O corte 27 monta POST /api/admin/drivers sobre operations/drivers existente. O
schema legado foi movido para contracts e atende os dois adapters. ADMIN do
vínculo atual, CSRF central, DTO, descarte de campos extras, status padrão e
erros foram caracterizados antes; HTTP compilado nos dois modos prova RLS,
recusas sem efeitos, concorrência e rollback após INSERT. Serviço parcial com 29
rotas/35 métodos, 24 GETs e onze mutações. Legado conserva 149/193 e 46 páginas;
clientes, jobs e implantação permanecem na configuração anterior. Evidências no
corte 27 de [API compartilhada](../features/shared-api-host.md).

## Criação administrativa de categorias no serviço (2026-10-02, sem commit)

O corte 28 monta POST /api/admin/categories sobre catalog/createCategory
existente. Schema estrito comum em contracts/categories; os adapters mantêm
EQUIPMENTS/WRITE, CSRF, parsing e envelopes observados. Normalização, unicidade
e lock continuam no backend. Caracterização anterior e HTTP compilado nos dois
modos protegem isolamento, permissões vivas, concorrência e rollback após
INSERT. Serviço parcial: 29 rotas/36 métodos, 24 GETs e doze mutações. Legado
conserva 149/193 e 46 páginas; sem cutover, mudança de cliente ou deploy.
Evidências no corte 28 de [API compartilhada](../features/shared-api-host.md).

## Edição/exclusão de categorias no serviço (2026-10-02, sem commit)

O corte 29 monta PUT/DELETE de /api/admin/categories/[id] sobre os casos de uso
existentes em catalog. WRITE e DELETE permanecem ações distintas; ownership é
verificado antes do corpo. DTO, campos ignorados, erros, FK com equipamento,
lock e transação permanecem iguais. Caracterização anterior e paridade HTTP nos
dois modos protegem permissões vivas, RLS, concorrência e rollback após
UPDATE/DELETE. Serviço parcial com 30 rotas/38 métodos, 24 GETs e catorze
mutações; raiz com 149/193 e 46 páginas, sem cutover ou deploy. Evidências no
corte 29 de [API compartilhada](../features/shared-api-host.md).

## Criação de unidades físicas no serviço (2026-10-02, sem commit)

O corte 30 monta POST /api/admin/equipment-units sobre createUnit do catálogo
existente. Apenas o schema legado saiu do adapter para
contracts/equipment-units, consumido pelos dois hosts. EQUIPMENTS/WRITE, CSRF,
unicidade por locadora, AVAILABLE, medidores e DTO mantêm o comportamento
observado; não há alteração de estoque. Caracterização anterior e HTTP compilado
nos dois modos protegem permissões vivas, RLS, FK de tenant, concorrência e
rollback após INSERT. Serviço parcial com 30 rotas/39 métodos, 24 GETs e quinze
mutações; raiz com 149/193 e 46 páginas, sem cutover ou deploy. Evidências no
corte 30 de [API compartilhada](../features/shared-api-host.md).

## Edição/exclusão de unidades físicas no serviço (2026-10-02, sem commit)

O corte 31 monta PATCH/DELETE de /api/admin/equipment-units/[id] sobre
updateUnit/deleteUnit do catálogo existente. Apenas o schema de atualização
legado foi compartilhado em contracts/equipment-units, sem novo export de
pacote. WRITE/DELETE, posse antes do corpo, DTO, medidores zero, textos vazios e
recusa de exclusão de unidade RENTED/RESERVED permanecem iguais. Caracterização
anterior e HTTP compilado nos dois modos cobrem concessões vivas, RLS,
unicidade, corridas e rollback após UPDATE/DELETE. Serviço parcial com 30
rotas/41 métodos, 24 GETs e dezessete mutações; raiz com 149/193 e 46 páginas,
sem cutover ou deploy. Evidências no corte 31 de
[API compartilhada](../features/shared-api-host.md).

## Criação de equipamentos no serviço (2026-10-02, sem commit)

O corte 32 monta POST /api/admin/equipments sobre createEquipment do catálogo
existente. Adaptação restrita ao transporte e à composição, sem alterar o
handler legado, domínio, schema ou dependências. Preserva limiter antes de
WRITE, CSRF, categoria da locadora, normalização e DTO; o GET compartilha a
janela por processo. Caracterização anterior e HTTP compilado nos dois modos
cobrem permissões vivas, RLS, FK, concorrência e rollback após INSERT. Serviço
parcial com 30 rotas/42 métodos, 24 GETs e dezoito mutações; raiz com 149/193 e
46 páginas, sem cutover ou deploy. Evidências no corte 32 de
[API compartilhada](../features/shared-api-host.md).

## Onda de catálogo e operações no serviço (2026-10-02, sem commit)

A onda 33 implementa sete operações em bloco: PUT/DELETE de equipamentos,
GET/POST de veículos e GET/POST/PATCH de logística. Regras de veículos e
entregas saem dos handlers para factories em backend/operations; schemas
existentes em contracts/operations. Os adapters dos dois hosts conservam os
contratos, guards, contexto tenant, tipos de transação e DTOs. Erros inesperados
de edição de equipamento passam a ser genéricos em produção (entrada 234). A
cadência humana implementa a onda inteira antes de consolidar testes, com
rechecagem focada apenas para falhas encontradas. Serviço parcial: 33 rotas/49
métodos, 26 GETs e 23 mutações; legado 149/193 e 46 páginas. Provas e limites na
onda 33 de [API compartilhada](../features/shared-api-host.md). Sem cutover ou
deploy.

## Onda do portal e consultas de orçamentos (2026-10-02, sem commit)

A onda 34 implementa nove operações antes da validação consolidada: portal de
locações do cliente, ocultação do histórico, pedidos de coleta/prorrogação,
detalhe/ocultação do orçamento do cliente e consultas administrativas. Compõe as
factories existentes de rentals/quotations, sem regras no host ou emissão de
pagamento/documento. Schema estrito de prazo comum aos adapters. Sessão real,
membership vigente, ownership, RLS, concorrência e rollback do pedido foram
provados por HTTP nos dois modos. Serviço parcial: 40 rotas/58 métodos, 31 GETs
e 27 mutações; legado 149/193 e 46 páginas. Dez exceções obsoletas de tipos na
higiene foram retiradas após consumo real no host; nenhuma tolerância ampliada.
Resultados e limites na onda 34 de
[API compartilhada](../features/shared-api-host.md). Sem cutover ou deploy.

## Onda do ciclo de locação e atividades (2026-10-02, sem commit)

A onda 35 implementa doze operações em bloco: administração de locações,
checkout/checkin, prorrogação administrativa e do cliente, multa, lista de
orçamentos e atividades. Composição real sobre rentals e consulta de documentos
em customers; queries de listas pertencem a quotations/customers. Cinco schemas
existentes em contracts/rentals, com a mesma biblioteca Decimal. Nenhuma regra
copiada ao host. Lock, RLS, centavos, documentos, cobrança/outbox, posse,
revogação e CSRF preservados por HTTP nos dois modos. Emissão externa e consumo
da outbox permanecem legados.

Serviço parcial: 49 rotas/70 métodos, 35 GETs e 35 mutações; legado 149/193 e 46
páginas. Duas exceções obsoletas de tipos retiradas após consumo real; nenhuma
baseline ou proteção ampliada. Tipos, builds, testes consolidados e gates
aprovados, com rechecagens focadas registradas na onda 35 de
[API compartilhada](../features/shared-api-host.md). Sem cutover ou deploy.

## Onda 36: orçamentos no host compartilhado

Nove métodos montados sobre as factories existentes de quotations/rentals.
Criação pública usa preço do catálogo; reajustes, quitação e conversão mantêm
lock, RLS, dinheiro e outbox. Quatro schemas legados comuns em contracts; erro
interno de exclusão agora genérico nos dois hosts. O inventário reconhece os
adapters reais com recusas sintéticas; nenhuma proteção ou baseline ampliada.

Serviço parcial: 54 rotas/79 métodos, 36 GETs e 43 mutações; legado 149/193 e 46
páginas ativo. Oito exceções de tipos agora usados foram removidas da higiene.
Testes consolidados e rechecagens focadas, sem repetição por handler, na onda 36
de [API compartilhada](../features/shared-api-host.md). Documentos de orçamento
são o próximo bloco; emissão externa, jobs, webhooks e cutover permanecem
pendentes.

## Onda 37: documentos no host compartilhado

Cinco GETs de PDF compostos nos dois hosts, com snapshot, queries, branding,
mapper e renderer no backend; tokens A4 canônicos com os valores anteriores.
Quatro exceções de higiene e 22 literais resolvidos retirados. Serviço 59
rotas/84 métodos, 41 GETs/43 mutações; legado 149/193 e 46 páginas ativo. Restam
109 métodos por contagem (43,5% montados, sem conclusão geral). Evidências
consolidadas e rechecagens na onda 37 de
[API compartilhada](../features/shared-api-host.md). Sem cutover, produção,
commit ou push. Próximo bloco: consultas financeiras, sem emissão externa.

## Regras de execução

Migrar por fluxo, com uma implementação autoritativa de escrita. As correções
conhecidas ganham testes de comportamento correto; não caracterizar
vulnerabilidades como requisitos. Nunca inferir sucesso de dispositivo a partir
de export Metro. Banco real, backfills, secrets, deploy e lojas exigem
autorização específica; preparar e testar localmente tudo que independe dela.

Cada entrega atualiza suas especificações, known issues e changelog Unreleased.
A data de um commit só é registrada quando esse commit existir.

Agentes em paralelo no mesmo checkout: nunca criar junção NTFS ou symlink para
dentro do repositório nem apagar recursivamente pasta que possa conter links
(entrada 171 de `docs/issues/known-issues.md`).

## Onda 38 — leituras financeiras (2026-10-02, sem commit)

Seis GETs financeiros extraídos para billing/documents e compostos nos dois
hosts; consultas e renderers únicos. Serviço parcial 65 rotas/90 métodos, legado
149/193 e 46 páginas preservado. Provas HTTP dos dois motores reais, RLS,
documentos e contratos; dívidas anteriores de agregação/CSV explicitadas, sem
cutover. Relatório completo na onda 38 de
[API compartilhada](../features/shared-api-host.md).

## Onda 39 — mutações financeiras (2026-10-02, sem commit)

Quatro métodos sobre backend/billing: settings, baixa, pedido de vencimento e
preservação do histórico. Schemas comuns, confirmação e reemissão únicas,
transações e outbox preservadas. Serviço parcial 68 rotas/94 métodos; legado
149/193 ativo, 99 métodos declarados pendentes. Validação consolidada no fim do
bloco e rechecagens afetadas, sem repetir todos os testes por handler.
Evidências, dívida 238 e próximo bloco na onda 39 de
[API compartilhada](../features/shared-api-host.md). Emissão externa e execução
de jobs ainda legadas; sem cutover, publicação ou produção.

## Onda 40 — pedidos de cobrança e PDF do provedor (2026-10-02, sem commit)

Cinco métodos nos dois hosts: pedido PIX, geração/regeneração de boleto, geração
administrativa e leitura privada do PDF. Obrigação, pedido, consulta ao
provedor, emissão e reconciliação em billing; credenciais env em runtime e
schema existente em contracts/payments. lib conserva composição; execução dos
jobs permanece legada. Serviço parcial 73 rotas/99 métodos, legado 149/193 e 46
páginas ativo; 94 métodos declarados pendentes, sem método extra ou handler
backend nos clientes.

Provas consolidadas de sessão nos dois modos, CSRF, ownership, FORCE RLS,
concorrência e rollback; builds e gates passaram. Relatório completo na onda 40
de [API compartilhada](../features/shared-api-host.md). Nenhuma baseline
ampliada, origem alterada, emissão real ou operação em produção. A contagem de
rotas não mede conclusão geral; verificação, webhooks e execução de jobs exigem
seus próprios blocos de extração antes de retirar app/.

## Onda 41 — verificação e webhooks de pagamento (2026-10-02, sem commit)

Cinco POSTs novos no serviço, com os dois caminhos obsoletos conservando 410.
Autenticação, inbox, consumidores e verificação em backend; schemas existentes
em contracts/payments, composição nos hosts. Scheduler continua legado; nenhuma
origem foi trocada. Paridade local: 65 HTTP por motor de identidade, 36 backend,
150 unidade/banco/cron, 106 contrato fake; segurança 673 passaram e 18 skips
anteriores, gates 183. Relatório e limites na onda 41 de
[API compartilhada](../features/shared-api-host.md). Serviço 78 rotas/104
métodos, legado 149/193 ativo e 89 métodos declarados restantes. Higiene reduziu
duas tolerâncias de exports sem uso; nenhuma proteção ampliada. Não equivale a
paridade geral, migração operacional, publicação ou validação no Asaas real.

## Onda 42 — contratos e callback ZapSign (2026-10-02, sem commit)

Sete métodos acrescentados ao serviço, com geração/leitura/pedido/renderer e
consumidor em backend/documents, download em backend/http, storage em
backend/runtime e schemas em contracts/rental-contracts. Regras, locks,
ownership, FORCE RLS e outbox preservados. Efeitos de assinatura e arquivo
continuam legados, com um único scheduler. HTTP real local 53/53 por motor de
identidade, banco 10/10, backend 30/30, cron 6/6 e gates 183/183; relatório e
limites na onda 42 de [API compartilhada](../features/shared-api-host.md).
Serviço parcial 84 rotas/111 métodos, legado 149/193 e 46 páginas ativo; 82
métodos declarados pendentes. Baseline de tokens apenas encolheu uma ocorrência
resolvida. Entrada 238 e lotes SaaS/mobile continuam pendentes; contagem de
métodos não mede conclusão geral. Nenhum cutover, publicação ou produção.

## Onda 43 — efeitos de assinatura e documentos privados (2026-10-02, sem commit)

Efeitos de emissão, reconciliação e arquivamento e adapter ZapSign agora em
backend/documents, mantendo fachadas e executor cron legados. Upload privado em
backend/http, enum em contracts/client-documents, listagem no customers
existente. GET da lista de documentos e POST do upload montados no serviço.
Transações, ownership, FORCE RLS, assinatura privada e compensação preservados.

HTTP novo 44/44 por motor real, regressão de contratos 53/53 por motor, backend
48/48, banco 10/10, cron 6/6, segurança 674 passaram e 18 skips anteriores,
gates 183/183. Relatório e limites na onda 43 de
[API compartilhada](../features/shared-api-host.md). Serviço parcial 86
rotas/113 métodos, legado 149/193 e 46 páginas ativo; 80 métodos declarados
restantes. Higiene 903 aceitos/257 itens: dois símbolos antes tolerados saíram;
nenhum baseline ampliado. Integrações/jobs restantes, paridade operacional,
SaaS/mobile e entrada 238 continuam pendentes. Nenhum cutover, publicação ou
produção.

## Onda 44 — imagens e settings administrativos (2026-10-02, sem commit)

Três métodos compostos sobre factories catalog/http, storage lazy em runtime e
schema settings puro, unificando duas cópias idênticas. ADMIN, permissão
granular, CSRF, quota SQL, segredos, transações e envelopes preservados.
Retirada inclusão TypeScript sem uso no mobile que carregava o backend (entrada
239).

HTTP 58/58 por motor; regressão documentos 44/44 em NextAuth, unidade 12/12,
cache 7/7, frontend 5/5, segurança afetada 152/152 e gates 183/183. Serviço
parcial 88 rotas/116 métodos; legado 149/193 e 46 páginas ativo, 77 métodos
restantes. Higiene 896/256, color-literal 156: proteções apenas encolheram.
Relatório na onda 44 de [API compartilhada](../features/shared-api-host.md).
Cache entre hosts, integrações/jobs, paridade operacional, SaaS/mobile e entrada
238 pendentes. Nenhum cutover, publicação ou produção.

## Onda 45 — comunicações administrativas (2026-10-02, sem commit)

Dois métodos montados; badges, alertas, fanout e Zoho compartilhados em
backend/communications, preservando fachadas, role por vínculo, CSRF, RLS e
dedupe consultivo por locadora. HTTP 19/19 por motor, regressão cliente 196/196
NextAuth, unidade 36/36, OAuth/banco 12/12, inventário 73/73 e gates 183/183.
Serviço parcial 90 rotas/118 métodos; legado 149/193 e 46 páginas ativo, 75
métodos restantes. Higiene 894/256: apenas duas tolerâncias de tipos removidas.
Relatório na onda 45 de [API compartilhada](../features/shared-api-host.md).
Zoho configurado caracterizado com dublê, sem operação real; scheduler legado.
Paridade operacional, entrada 238 e SaaS/mobile pendentes. Sem publicação.

## Onda 46 — leitura de e-mail (2026-10-02, sem commit)

Contas/pastas/mensagens/detalhe/download/inline Zoho delegam a uma implementação
única no backend nos dois hosts. Unidade 52/52 antes e 88/88 depois; HTTP 32/32
por motor, regressão alertas 19/19 NextAuth, OAuth 6/6, inventário 73/73 e gates
183/183. Provedor local somente, sem caixa real. Serviço parcial 96/124, legado
149/193 e 46 páginas ativo, 69 métodos restantes. Sem novas dependências ou
tolerâncias. Relatório na onda 46 de
[API compartilhada](../features/shared-api-host.md). OAuth/mutações/jobs,
paridade operacional, entrada 238 e SaaS/mobile continuam pendentes.

## Onda 47 — mutações de e-mail (2026-10-02, sem commit)

Seis operações Zoho compartilhadas: send, reply, draft, update, delete e upload.
Transporte/token/HTML permanecem em backend, schemas em contracts, composição
nos hosts. Cache e sequência envio → cache → auditoria preservados e limitados
por processo; não há deduplicação distribuída ou garantia de entrega. Serviço
parcial 102 rotas/130 métodos, 63 restantes; legado 149/193 ativo.
Caracterização 59, unidade 149, HTTP 50 escritas + 32 leituras por motor, OAuth
6, inventário 73 e gates 183; higiene reduzida para 891/253. Nenhuma baseline
ampliada ou mudança de cliente/scheduler. Relatório:
[onda 47 da API compartilhada](../features/shared-api-host.md).

## Onda 48 — OAuth de e-mail (2026-10-02, sem commit)

Authorize/callback/disconnect passam à composição compartilhada, com política
única em backend/http e integração Next nos hosts. Callback fixo, precedência de
erros, cookie, escopo tenant/user, SHA256 e consumo único antes da troca foram
preservados. Unidade 254, HTTP OAuth 27 por motor nos dois hosts, regressão
NextAuth 82, identidade 6, inventário 73 e gates 183 passaram.

Serviço parcial 105/133, 60 métodos restantes; legado 149/193 ativo. Sem
baseline ampliada, dependência nova, alteração de origem/scheduler ou cutover.
Provedor só local; desconexão sem revogação/state cancelado permanece dívida na
entrada 240. Relatório e próximo corte WhatsApp:
[onda 48 da API compartilhada](../features/shared-api-host.md).

## Onda 49 — consultas WhatsApp (2026-10-02, sem commit)

Conversas/detalhe/thread passam à implementação única em backend/communications,
com HTTP em backend/http e composição nos dois hosts. Busca, paginação, cursor,
DTO, identidade e RLS preservados. Caracterização 30 antes, unidade 44 depois,
HTTP 54 por motor, regressão alertas 19 NextAuth, inventário 73 e gates 183
passaram. Serviço parcial 108/136, 57 métodos restantes; legado 149/193 ativo.
Sem baseline ampliada, nova dependência, cutover ou Meta real. Envio/webhooks e
scheduler continuam legados. Relatório e próximos limites na
[onda 49 da API compartilhada](../features/shared-api-host.md).

## Onda 50 — envio e webhooks WhatsApp (2026-10-02, sem commit)

Seis métodos HTTP adicionais no serviço sobre backend/communications e
backend/http, com schemas existentes em contracts. ADMIN/OPERATOR por vínculo,
ownership, conta/token por locadora, persistência processing/sent/unknown,
verificação GET, HMAC e inbox/outbox preservados. Nenhuma chamada Meta real.

Caracterização 22 antes/52 depois, 19 provas AST, segurança 233, gates 183,
escrita HTTP 84 por motor e leitura HTTP 54 por motor; tipos e ambos os builds
passaram. Baselines e dependências intactas. Serviço parcial 111/142, 51 métodos
restantes; legado 149/193 ativo. Risco concorrente da inbox registrado na
entrada 241. Clientes, proxy, webhook público e scheduler permanecem legados.
Relatório e limites da paridade:
[onda 50 da API compartilhada](../features/shared-api-host.md).

## Onda 51 — manutenção e auditoria (2026-10-02, sem commit)

Sete métodos operacionais montados no serviço e mantidos no legado. Lifecycle,
automação preventiva e consulta/contagem de auditoria únicos em
backend/operations; schemas existentes em contracts/operations e adapters em
backend/http. Membership ADMIN, ownership, CSRF central, RLS, lock de locação,
rollback, DTOs e diferenças anteriores de custo zero preservados. O escritor de
auditoria e os jobs não foram modificados.

Serviço parcial: 117 rotas/149 métodos (69 GETs, 80 mutações), 44 métodos
restantes. Legado: 149 rotas/193 métodos e 46 páginas ativo. A contagem mede
cobertura HTTP, não conclusão geral nem permissão para remover app/. Sem
publicação, produção ou cutover. Evidências e limites na
[onda 51 da API compartilhada](../features/shared-api-host.md).

## Onda 52 — frete e quarentena Merchant (2026-10-02, sem commit)

Cinco métodos montados nos dois hosts. Cálculo e transporte Melhor Envio únicos
em backend/operations; schema em contracts/operations e parsing/respostas em
backend/http. Merchant compartilha o 503 existente, com membership ADMIN;
feature comercial continua bloqueada. Legado, cliente global desativado e cron
preservados, sem cutover ou chamadas reais a provedores.

Serviço parcial 121 rotas/154 métodos (70 GETs/84 mutações), 39 métodos
restantes, zero página ou método extra. Legado 149/193/90 GETs e 46 páginas
continua ativo. Isso mede cobertura HTTP, não conclusão geral. Evidências: 65
caracterizações antes/depois, 132 testes de segurança, nove PG, 48 comparações
AST e 43 casos HTTP por motor de identidade, nos dois builds de produção locais.
Gates, tipos, builds, higiene e ratchets aprovados sem ampliar baselines. O
registro global de integrações usa filtros de tenant explícitos; equipamentos
têm FORCE RLS.

Relatório e limites: [onda 52](../features/shared-api-host.md). Próximo bloco:
leituras administrativas analytics/dashboard/kpis, preservando agregações e
isolamento. Identidade, scheduler, SaaS/mobile e retirada autorizada da raiz
continuam pendentes. Sem commit, push, deploy ou produção.

## Onda 53 — dashboard, KPIs e endpoints aposentados (2026-10-02, sem commit)

Quatro GETs adicionais no serviço: dashboard/KPIs com FINANCIAL/READ e cálculo
único em backend/billing; analytics/security preservados como 410 inerte. Rotas
legadas continuam ativas. Os dois hosts usam o mesmo adapter HTTP para as
consultas; fórmulas, datas, escopo financeiro e tipos anteriores preservados.
Fachadas sem consumidores retiradas sem duplicar implementação ou ampliar
baselines. Proteção RETIRED estendida aos dois handlers estáticos de serviço,
com os mesmos limites e prova adversarial.

Serviço parcial 125 rotas/158 métodos (74 GETs/84 mutações), 35 métodos
restantes, zero páginas ou método extra. Legado 149/193/90 GETs e 46 páginas
ativo. Provas: 20 caracterizações antes/depois, 115 de segurança, 39 comparações
AST e 18 HTTP por motor de identidade, em ambos os builds locais de produção.
Tipos, builds, lint e higiene aprovados; SQL sem BYPASSRLS, sete tabelas com
FORCE RLS, falha SQL genérica e leituras sem efeitos comprovadas.

A contagem não mede conclusão geral ou autoriza remover app/. Sem commit, push,
deploy ou mudança de produção. Gates finais e 183 testes das proteções
aprovados, com baseline 1050 intacta e zero important. Teardown limpo, processos
próprios encerrados e handoff canônico inalterado. Limitações dos indicadores,
identidade/jobs, SaaS/mobile e cutover permanecem pendentes. Relatório e
próximos cortes: [onda 53 da API compartilhada](../features/shared-api-host.md).

### Onda 54 — permissões e respostas inertes (2026-10-02, sem commit)

PUT administrativo usa schema anterior em contracts, transação/lock únicos em
backend/identity e parsing em backend/http, compostos nos dois hosts. Seis
métodos operacionais 410 e cinco métodos do catch-all 404 mantêm respostas
inertes, sem reativar provisionamento ou ampliar acesso. Guards ADMIN/CSRF,
isolamento, rollback e DTOs preservados.

Serviço parcial 130 rotas/170 métodos (77 GETs/93 mutações), 23 métodos
restantes; legado 149/193/90 GETs e 46 páginas ativo. Catch-all não certifica
paridade das URLs concretas ainda ausentes. Cobertura HTTP não mede conclusão
geral ou autoriza remover app/. Provas: 41 caracterizações antes, 112 após com
regressões, segurança 167, 24 comparações AST e 28 casos HTTP por motor nos dois
builds locais de produção. Gates 183, tipos, builds, lint e ratchets aprovados
sem ampliar baselines. Pool de conexão única conservado e limitação registrada
na entrada 242. Relatório: [onda 54](../features/shared-api-host.md).

### Onda 57 — montagem dos jobs concluída (2026-10-02, sem commit)

Nove GETs de cron no serviço sobre regras e efeitos únicos do backend. Bearer,
RLS, fairness, checkpoints, budgets, reconciliação, lease, dedupe e configuração
conservados. Os quatro efeitos de e-mail da outbox e os cinco templates passam a
communications, com fachadas legadas e HTML preservados. A agenda da raiz segue
idêntica, sem scheduler adicional.

149 rotas/193 métodos em ambos os hosts, incluindo respostas inertes. Serviço
sem páginas; raiz mantém 46 páginas. Montagem dos métodos em 100% não é
conclusão geral ou autorização para apagar app/. HTTP local: 18 casos por motor
com ambos os hosts; segurança 170, gates 183 e 41 provas estruturais. Tipos,
builds, lint, higiene e ratchets aprovados. Provas e limites na
[onda 57](../features/shared-api-host.md). Próximo corte: consumidores e proxies
com troca reversível local, seguido de aceite operacional e rollback.

### Onda 58 — consumidores e rollback local (2026-10-02, sem commit)

Arquivos públicos pertencem ao web, independente do destino da API. Expo pode
separar a origem das imagens relativas, com fallback preservado. Exemplos de
ambiente dos clientes permitem ensaio da API compartilhada e volta ao legado.
Nenhum ambiente existente ou scheduler foi trocado.

Web real, TLS loopback verificado e mesmos contratos nos dois destinos: onze
casos por motor, incluindo cliente HTTP mobile, login/cookies, isolamento, CSRF,
arquivos byte-idênticos e sessão conservada após rollback. Testes web 182/mobile
52, build web, bundles Android/iOS, tipos e gates passaram. A prova nativa
continua parcial: bundle não certifica execução em aparelho. API 149/193 nos
dois hosts, raiz com 46 páginas ativa. Relatório e próximos critérios de aceite
na [onda 58](../features/shared-api-host.md).

### Onda 59 — aceite operacional local (2026-10-02, sem commit)

Multipart, documentos privados, PDF, OAuth e cache por Host exercitados pelo web
real em direção aos dois backends. Dados e state pendente sobrevivem ao retorno
ao legado; HTML do equipamento vem do gateway HTTP, sem banco no web. Jobs ficam
fora do proxy dos clientes; a única agenda configurada segue na raiz. Fixture
usa localhost para evitar normalização divergente do NextURL.

43 casos HTTP/SSR por motor, tipos/lint e gates aprovados; 183 testes de gates,
sem ampliar baselines. Não houve mudança funcional, deploy ou operação real.
Legado 149/193 e 46 páginas ativo. Provas e limites na
[onda 59](../features/shared-api-host.md); critérios para corte/rollback e
retirada da raiz no [roteiro operacional](../guides/shared-api-acceptance.md).
Pendências SaaS/mobile, recuperação/capacidade e aceite externo continuam
abertas.

### Onda 60 — recuperação da inbox e formato de OAuth (2026-10-03, sem commit)

Corrida de recepção inicial reproduzida com barreira SQL nos quatro provedores:
o upsert vazio fazia leitura/INSERT separados e gerava P2002. A inbox usa agora
inserção atômica e leitura na mesma transação; conflito de hash, RLS, lease,
outbox, rollback e retry conservados. Callback Zoho exige objeto JSON não nulo
antes de ler state, recusando formatos inválidos sem acessar SQL/provedor.

Provas: 40 testes de unidade/banco, 177 de segurança, 252 HTTP por motor de
identidade em ambos os hosts de produção locais e 183 de gates. Builds, tipos,
lint e ratchets aprovados, sem ampliar baselines. Inventário 149/193 em ambos;
raiz com 46 páginas e scheduler ativo. Limitação do pool (242), revogação Zoho,
aceite dos clientes/dispositivos e SaaS/mobile permanecem pendentes. Ver
[relatório da onda 60](../features/shared-api-host.md). Sem publicação ou
produção.

### Onda 61 — carrinho dos consumidores (2026-10-03, sem commit)

Hook universal composto no bootstrap compartilhado, com CLIENT e escopo local
confirmados. Mesclagem/restauração usam os contratos existentes; edições e
remoções têm debounce e escrita serial. Marcas por escopo conservam intenção
após falha, reload e resposta perdida, e respostas antigas não atravessam
locadoras/usuários. Carrinho anônimo continua separado. Preço base e regras do
catálogo alimentam o mesmo motor do domínio, sem desconto duplicado.

154 testes de carrinho/providers e 112 HTTP por motor contra ambos os hosts
locais de produção aprovados, com cookies/RLS e consumidor real. Tipos, lint,
build web e bundles Android/iOS aprovados; bundle não certifica aparelho.
Higiene perdeu as exceções do hook agora consumido, sem ampliar baselines.
Contrato/backend/agenda/legado intactos: 149/193 e 46 páginas da raiz ainda
ativos. Issue 233 corrigida. Provas e limites na
[onda 61](../features/shared-api-host.md); aceite visual/dispositivos,
recuperação/capacidade, etapas SaaS/mobile e retirada da raiz ainda pendentes.

### Onda 62 — consumidor do orçamento (2026-10-03, sem commit)

Página/formulário do orçamento usam transporte universal no segmento api da
própria página, com HttpClient do bootstrap, locadora pública explícita e
seleção privada capturada. Ciclo de requisições e remount por usuário/locadora
protegem respostas antigas; salvamentos parciais e falhas conservam estado.
Contratos, layout e cálculos preservados. Nenhuma regra nova no host ou em
shared/api.

173 casos do orçamento/providers e fluxo HTTP real nos dois motores/hosts
aprovados; 12 projetos TS, lint, build web, gates e host web verdes. Higiene
reduzida para 886/251, sem ampliar tolerâncias. Legado 149/193 e 46 páginas
ativo, agenda/handoff intactos. Próximo: perfil/área do cliente, consumidores de
locações/endereço, paridade mobile e SaaS. Aceite interativo/operacional e
retirada da raiz ainda pendentes. Relatório:
[onda 62](../features/shared-api-host.md).

### Onda 63 — perfil e endereços dos consumidores (2026-10-03, sem commit)

Transporte privado único em entities/cliente atende orçamento, perfil e
endereços. Shared/api recebe somente ciclo genérico de cancelamento/descarte; as
páginas reiniciam dados e formulário por locadora/usuário. Backend, DTOs,
payloads, identidade visual e agenda preservados. Nenhum baseline foi alterado.

197 casos focados, quatro HTTP por motor nos dois hosts locais de produção, 12
projetos TS, lint, arch/tokens/nomes/hygiene/ratchet, testes dos hosts e builds
web/Android/iOS aprovados. Banco descartável limpo e cluster próprio encerrado.
Legado 149/193 e 46 páginas ainda ativos. Status/senha, telas nativas, aceite
interativo/operacional, SaaS e retirada da raiz continuam pendentes. Próximo:
visão geral e histórico da área do cliente. Relatório:
[onda 63](../features/shared-api-host.md).

### Onda 64 — visão geral e histórico (2026-10-03, sem commit)

Consumidores usam transporte configurado nas entidades
locação/orçamento/cliente, sem regra de backend nos hosts ou em shared. Escopo
reinicia dados/filtros e descarta leituras/exclusões antigas; polling,
visibilidade, deduplicação, busca, valores e soft delete conservam os contratos.

261 casos focados, seis HTTP por motor nos dois hosts locais de produção, tipos
dos 12 projetos, lint, guards e builds web/Android/iOS aprovados. Banco limpo e
cluster próprio encerrado; nenhuma baseline alterada. Legado 149/193 e 46
páginas ativo, agenda e handoff intactos. Próximo: detalhe, ações e downloads do
histórico, depois paridade nativa e SaaS. Aceite operacional e retirada da raiz
continuam pendentes. Relatório: [onda 64](../features/shared-api-host.md).

### Onda 65 — detalhe, pedidos e download (2026-10-03, sem commit)

Consumidores do histórico usam transporte das entidades locação/orçamento pelo
HttpClient capturado. JSON padrão e modo binário com corpo completamente
consumido; resposta antiga não libera arquivo ou efeito local. Composição dos
diálogos das ações corrigida com Portal/Trigger renderizando Button, sem alterar
classes/estilos. Extensão direta e pedido à equipe continuam distintos.

211 casos focados, seis HTTP por motor nos dois hosts locais, tipos, lint,
guards e builds web/Android/iOS aprovados. Banco limpo e cluster encerrado.
149/193 e 46 páginas legadas ativos, agenda/handoff intactos. Próximo:
pagamentos/documentos restantes, paridade nativa e SaaS. Aceite operacional e
retirada da raiz continuam pendentes. Ver onda 65 de
[API compartilhada](../features/shared-api-host.md).

### Onda 66 — pagamentos/documentos administrativos (2026-10-03, sem commit)

Orçamento, financeiro e locações usam transporte configurado para boleto,
vencimento, contrato, upload e PDFs. Boleto compartilhado na entidade; adapters
exclusivos nas páginas donas. Multipart, 202 pendente e escopo preservados;
regras permanecem no backend.

93 casos focados, oito HTTP por motor nos dois hosts locais, tipos/lint/gates e
builds web/Android/iOS aprovados. Banco limpo e cluster encerrado. 149/193 nos
dois hosts e 46 páginas legadas ativos; agenda/handoff/produção intactos. Outros
consumidores administrativos, aparelhos, SaaS e operação pendentes. Próximo:
restante de financeiro/orçamentos. Resultados e limites na onda 66 de
[API compartilhada](../features/shared-api-host.md).

## Onda 67 — financeiro/orçamentos administrativos (2026-10-03, sem commit)

Adapters finos nas páginas donas conectam carga/detalhe/ações e exportação ao
HttpClient configurado. Filtros, valores, payloads, status 202/409, histórico e
estilos preservados; regras permanecem no backend. Escopo impede dados, feedback
e continuação de ação antigos após rede/callback.

82 casos focados, seis HTTP por motor nos dois hosts locais, tipos/lint/gates e
builds web/Android/iOS aprovados. Banco limpo, cluster e HTTP encerrados. Legado
149/193 e 46 páginas ativos; agenda/handoff/produção intactos. Próximo: catálogo
administrativo (locações já conectado na onda 66). Demais consumidores,
aparelhos, SaaS e operação pendentes. Resultados e limites: onda 67 de
[API compartilhada](../features/shared-api-host.md).

### Onda 68 — catálogo administrativo (2026-10-03, sem commit)

Categorias, equipamentos (lista/criação/edição/detalhe) e unidades físicas usam
HttpClient configurado e adapters exclusivos das páginas. Payloads, filtros,
preços, histórico, links e estilos preservados; backend único intacto. Escopo
encerra leituras/efeitos antigos e o formulário tem ciclo próprio. Texto não
JSON/statusText da edição continua disponível no transporte.

43 casos focados, três HTTP por motor nos dois hosts locais, tipos/lint/gates e
builds web/Android/iOS aprovados. Banco limpo e processos próprios encerrados.
Legado 149/193 e 46 páginas ativo, agenda/handoff/produção intactos. Locações já
estava conectada na onda 66: próximo é representação textual de medidores,
dashboard/manutenção/logística, depois comunicações, nativo/SaaS/operação.
Progresso geral continua ~60%, estimativa de esforço. Provas e limitações: onda
68 de [API compartilhada](../features/shared-api-host.md).

### Onda 69 — operações administrativas e medidores (2026-10-03, sem commit)

Dashboard, manutenção e logística usam adapters nas páginas donas e transporte
configurado. Filtros, paralelismo, falha parcial, payloads e estilos permanecem;
ciclos descartam efeitos antigos. Medidores Decimal textuais são apresentados
sem mudar o DTO. Regras e ACL/RLS continuam no backend único.

54 casos focados únicos, tipos/lint/gates e builds web/Android/iOS aprovados.
Nenhum servidor/banco iniciado; HTTP anterior não repetido porque os handlers
não mudaram. Legado e agenda ativos. Próximo: comunicações/configuração,
paridade nativa, SaaS e operação; geral ~60% é estimativa de esforço. Ver
[onda 69](../features/shared-api-host.md).

### Onda 70 — comunicações/configurações/permissões (2026-10-03, sem commit)

Os consumidores usam adapters privados e HttpClient, incluindo multipart e
binário. Páginas reiniciam por identidade/transporte; conversa, compositor,
perfil, pasta e seleção descartam continuação antiga. OAuth continua pelo host
web. Contratos, estilos e backend único preservados; sem alteração de handlers.

49 casos focados únicos, tipos/lint/gates/builds aprovados. Nenhum banco ou
servidor iniciado; legado e agenda ativos. Ponte de DTOs do correio permanece
dívida incremental. Próximo: consumidores residuais/paridade nativa, SaaS e
operação. Geral ~60% é estimativa de esforço. Ver
[onda 70](../features/shared-api-host.md).

### Onda 71 — entradas pós-login nativas (2026-10-03, sem commit)

Dashboard e visão geral do cliente deixam UnavailableArea nas duas rotas Expo.
Hosts fornecem voltar/sair; páginas nativas e modelos ficam nas slices do
frontend. A área do cliente compartilha o modelo anterior com o web, incluindo
carrinho/preços/datas e atividades. DTOs puros do dashboard separados dos ícones
web; API e regras de negócio permanecem únicas.

58 casos focados únicos, 12 projetos de tipos, lint/gates, testes dos hosts e
builds web/Android/iOS aprovados. Source maps confirmam variantes nativas nas
duas plataformas. Estilos/helpers web preservados por AST; aparelho/fidelidade
visual não certificados. Destinos nativos ausentes, imagens do carrinho,
gráficos, SaaS e operação permanecem pendentes. Legado/agenda ativos; geral ~60%
continua estimativa de esforço. Próximo: orçamento/catálogo e histórico nativos.
Provas e limites na [onda 71](../features/shared-api-host.md).

### Onda 72 — histórico e detalhes nativos (2026-10-03, sem commit)

Duas rotas Expo finas usam variantes das slices historico/historico-detalhe.
Modelos, preços, timeline e transportes compartilhados com o web. Lista/filtros,
soft delete, reajustes, ações e binário preservam contratos; atividade native
usa AppState. Integração de cache/compartilhamento fica no host; negócio no
backend único. Três exceções de higiene resolvidas por consumo real removidas,
sem ampliação de baseline.

153 casos focados únicos, hosts (57 mobile/182 web), 12 projetos de tipos,
lint/gates/builds web/Android/iOS aprovados. 521 atributos, 47 inicializadores e
duas timelines web iguais por AST. Aceite em aparelho/compartilhamento real
pendente. Legado/agenda ativos; geral ~60% continua estimativa de esforço.
Próximo: orçamento/detalhe de catálogo nativos, depois demais destinos,
SaaS/operação. Provas/limites: [onda 72](../features/shared-api-host.md).

### Onda 73 — detalhe de catálogo e preços nativos (2026-10-03, sem commit)

Expo monta /equipamentos/[id]. Produto, calendário e galeria permanecem na slice
equipamento-detalhe; host integra imagem/deep link/Share. Modelos dos três
componentes de preço/confirmação são comuns ao web/native. Parser público único
em contracts, sem ampliar entradas/configuração dos gates.

45 casos focados únicos, 57 do host mobile, oito do gateway web, doze projetos
de tipos, lint/gates/builds aprovados. AST confirma 355 atributos e 13
inicializadores preservados; source maps comprovam seis variantes nativas.
Aparelho/gestos/recebimento e orçamento nativo ainda pendentes. Botão conserva
/orcamento, cujo destino Expo precisa ser implementado na próxima onda.
Legado/scheduler ativos; geral ~60% estimativa de esforço. Ver
[onda 73](../features/shared-api-host.md).

### Onda 74 — orçamento Expo (2026-10-03, sem commit)

A rota /orcamento do Expo monta a slice com modelo de página comum ao web;
AsyncStorage, parâmetros e imagens ficam no host. Formulário alternativo de três
passos também tem modelo comum/variante native. Termos, centavos,
disponibilidade, dados/endereço e decisões conservam entidades e contratos.
Continuação de fins de semana corrigida para o estado atual; Button preserva
rótulo explícito. Proxy alinhado ao consumidor existente do detalhe público.

124 casos focados únicos, 57 mobile/183 web, 12 projetos de tipos, lint/gates e
builds web/Android/iOS aprovados. AST: 529 atributos web preservados; source
maps confirmam resolução nativa. Nenhuma tolerância ampliada. Aparelhos, frete
externo, demais destinos, SaaS e operação pendentes. Legado/scheduler ativos;
~60% geral continua estimativa de esforço. Próximo: perfil/endereço/
notificações nativos. Provas/limites: [onda 74](../features/shared-api-host.md).

## Onda 75 — perfil, endereços e notificações Expo (2026-10-03, sem commit)

Três destinos nativos montam slices com modelos comuns; host só roteia.
Notificações passam ao transporte configurado, com adapter DOM exclusivo no web
e snapshots por locadora/usuário/transporte. CEP atrasado não repõe formulário
cancelado/anterior; contadores de leitura são idempotentes. 490 atributos web
preservados por AST, sem mudança visual autorizada.

64 casos focados, 183 host web/57 mobile, doze projetos TS, lint/gates/builds
locais aprovados. Duas exceções de higiene retiradas junto do stub sem
consumidores createNotificationHelpers; nenhuma tolerância ampliada.
Exports/source maps provam resolução native, sem certificar aparelhos. Perfil
ainda tem verificação/senha/aparelhos pendentes. Próximo: destinos
administrativos, SaaS e aceite operacional; legado/scheduler ativos. Geral
continua ~60%, estimativa de esforço. [Onda 75](../features/shared-api-host.md).

## Onda 76 — catálogo administrativo Expo (2026-10-03, sem commit)

Lista e detalhe montam modelos comuns com o web, incluindo filtros/paginação,
galeria/preview, confirmação de exclusão e CRUD de unidades. Hosts integram
rotas/imagens; listeners DOM permanecem web. A condição de pacote específica
expõe somente os dois destinos nativos implementados e conserva o default web.
GerenciadorUnidades passa à variante .web por renomeação real, com transferência
das mesmas contagens de ratchet, sem tolerância nova.

46 casos focados, 183 host web/57 mobile, doze projetos TS e lint/gates/builds
aprovados. AST: 357 atributos web preservados; source maps confirmam seis
variantes/helpers e três modelos, sem apresentações DOM da slice. Aparelhos,
criação/edição/categorias, demais destinos, SaaS e operação pendentes. Legado e
scheduler ativos; geral ~60% estimativa de esforço. Próximo: formulários ricos
do catálogo. Ver [onda 76](../features/shared-api-host.md).

## Onda 77 — formulários administrativos Expo (2026-10-03, sem commit)

Cadastro/edição de equipamento passam a modelos comuns, consumidos pelo web e
pelo Expo. Hosts finos integram picker e imagem; upload segue transporte
configurado, sem regra duplicada no host. Perdas conservam DTO/fotos separadas/
contador e PUT imediato; snapshot explícito substitui dependência de setters e
timer. Confirmação/seleção antiga não envia após encerrar o ciclo.

60 casos focados/19 arquivos, 58 mobile e 183 web com sete skips prévios,
TypeScript/gates/builds aprovados. AST conserva 293 atributos; source maps
mostram modelos/nativo sem formulários DOM. Não se ampliaram proteções ou
baselines. Paridade em aparelhos/visual, categorias/demais destinos, SaaS e
aceite operacional seguem pendentes. Geral ~60% continua estimativa de esforço.
Legado/scheduler ativos. Ver [onda 77](../features/shared-api-host.md).

## Onda 78 — categorias administrativas Expo (2026-10-03, sem commit)

Lista/CRUD/detalhe e editor de ícones usam modelos comuns; host integra
DocumentPicker/FileSystem e nativo reutiliza Bloco.native. Página nove,
busca/ordenação/payload/409 e autoridade do servidor preservados. Ciclos
descartam seleção/resposta antiga; DOM permanece web. Default/condição nativa
expõem destinos reais. Sem dependência/regra duplicada ou proteção ampliada;
higiene reduz um export/uma tolerância.

25 casos focados, 59 mobile, 183 web (sete skips prévios), tipos/gates/builds
aprovados. AST conserva 143 atributos; source maps confirmam nativo sem
apresentações DOM da slice. Aparelho/visual, demais destinos, SaaS e operação
pendentes; geral ~60% estimativa de esforço. Legado/scheduler ativos. Ver
[onda 78](../features/shared-api-host.md).

## Locações administrativas Expo — onda 79 (2026-10-03, sem commit)

A rota /admin/rentals usa modelos/DTOs/transportes da slice locacoes para
lista/filtros/paginação, detalhe, contrato, check-in/out e documentos. Host só
seleciona arquivo/abre URL recebida. Seleção cancelada ou de contexto encerrado
não envia; wrappers capturam sessão/revisão. Regras permanecem no backend, sem
alteração HTTP/banco.

Agenda nativa navega dia/semana/mês e abre detalhes; grade/colunas visuais do
AdvancedCalendar web e aparelho exigem aceite. Tipos/gates/builds/exports locais
aprovados; API legada/scheduler ativos. ~60% continua estimativa de esforço.
[Resultados e próximos cortes](../features/shared-api-host.md), onda 79.

## Orçamentos administrativos Expo — onda 80 (2026-10-03, sem commit)

Dois hosts de rota consomem a mesma slice e modelos administrativos de quotes;
Next/animação/badges são adapters web, arquivo/abertura/compartilhamento são
integrações do host Expo. Aprovação, rejeição, boleto, reajustes, multa e
edições não foram reimplementados no host. API/ACL/RLS e legado seguem ativos.

47 focados/62 mobile/183 web (sete skips anteriores), doze TS, gates/builds/
exports locais aprovados; AST preserva 136 atributos e 21 ações. Agenda/pipeline
funcionais e datas AAAA-MM-DD ainda exigem fidelidade/aceite em aparelhos.
Financeiro/demais admins/SaaS/operação pendentes; ~60% estimativa de esforço.
[Resultados e próximos cortes](../features/shared-api-host.md), onda 80.

## Financeiro administrativo Expo — onda 81 (2026-10-03, sem commit)

A slice financeiro tem apresentação nativa e modelos comuns; host só parâmetros,
Alert/navegação/compartilhamento. Modelo não importa tipo pelo barrel de
calendário DOM. Facades web preservam popup/Next; ações HTTP, flags e recusas
ficam iguais. Dashboard e orçamento ligam o destino financeiro implementado.

122 casos do bloco, hosts e gates locais aprovados; AST conserva 530 atributos
web e vinte ações. Aparelho/visual/SaaS/demais admins/operação pendentes. Legado
ativo; ~60% é estimativa de esforço.
[Provas e próximos cortes](../features/shared-api-host.md), onda 81.

## Operações administrativas Expo — onda 82 (2026-10-03, sem commit)

Logística/manutenção têm destinos nativos reais sobre modelos/API comuns.
DTOs/checklist/formatadores/calendário foram separados de ícones/DOM; host só
picker/imagem/rota. Fotos multipart autenticadas e continuidade de escopo
preservadas. Manutenção segue leitura; criação dos dois fluxos ainda pendente
como no web.

76 focados, 62 Expo/183 web, doze projetos TS e gates/builds/exports aprovados.
AST conserva 215 atributos/63 callbacks e dois mapeadores; nove badges têm
cores/pixels iguais. 27 ocorrências de paleta eliminadas sem ampliar baseline.
Visual/aparelho/grade/Gantt, demais admins, SaaS e operação permanecem
pendentes; legado/scheduler ativos. ~60% geral é estimativa de esforço.
[Provas e próximos cortes](../features/shared-api-host.md), onda 82.

## Configurações/permissões Expo — onda 83 (2026-10-03, sem commit)

Configurações nativas das seis seções compartilham carga/formulário/reset/API;
DOM, mensagens JSX e arquivos são adapters. Upload autenticado protege seleção
por revisão, inclusive saída/retorno à seção. Permissões nativas existentes
caracterizadas, wrappers por status e atalhos reais de dashboard.

50 focados/64 mobile/183 web, doze TS, gates/builds/exports passaram. AST mantém
137 atributos/40 callbacks, seis previews e defaults web; três mensagens com
HTML igual. Previews funcionais não certificam visual/SVG/gestos/teclado/
aparelho. Comunicações/SaaS/operação pendentes, legado/scheduler ativos. ~60%
geral é estimativa de esforço. [Onda 83](../features/shared-api-host.md).

## Comunicações Expo — onda 84 (2026-10-03, sem commit)

WhatsApp e e-mail administrativos têm consumidores native das slices existentes,
sobre modelos/API comuns. JSX web preservado; Next/DOM ficam nas fachadas. Host
Expo só rotas, arquivos, UUID, storage, HTML isolado e abertura do painel web
para OAuth Zoho existente. Nenhuma regra de negócio duplicada ou handler movido.
Provas locais, limites e próximos cortes em
[onda 84](../features/shared-api-host.md). Aparelho, fidelidade, provedor, SaaS
e aceite operacional continuam pendentes; legado/scheduler ativos. Geral ~60% é
estimativa de esforço.

### Onda 85 — fundação de dados SaaS (2026-10-03)

Schema de 17 modelos PLATFORM, sete migrations e scripts DBA/RLS/preflight
instalados e provados em PostgreSQL descartável. Backfill gratuito interno
preserva locadoras existentes; dados de negócio continuam inacessíveis ao papel
platform_runtime. S2 ainda não terminou: faltam pool/transação, outbox e cron
próprios na composição compartilhada. S3/S5–S17 e aceite em
aparelhos/provedores/ operação seguem pendentes. Nenhum
cutover/produção/retirada do legado. Provas na onda 85 de
[API compartilhada](../features/shared-api-host.md).

### Onda 86 — composição do runtime SaaS (2026-10-03, sem commit)

Pool separado/lazy, platform-scope com verificação do papel conectado e GUCs
locais, outbox de plataforma e runner/cron compartilhados em packages/backend.
Os hosts apenas autorizam e montam GET /api/cron/platform. A regra
PLATFORM-PRISMA limita o acesso ao pool à composição; banco de negócio não é
fallback. Não há nova agenda. O primeiro consumidor usa a limpeza existente de
janelas vencidas de rate limit, com dedupe e preservação da margem/contagens
vigentes. Eventos comerciais futuros ficam pendentes. Inbox/consumidores,
S3/S5–S17, aparelhos/provedores/operação e retirada do legado permanecem
pendentes. Provas e limites na onda 86 de
[API compartilhada](../features/shared-api-host.md).

### Ondas 87–92 — cofre, entrada Asaas e primeiras projeções SaaS (2026-10-03)

Cofre/rotação/importação assistida e recepção durável já têm composição
compartilhada. O consumidor de saúde reconsulta a conta pela chave da locadora;
o de faturas reconsulta cobranças pela chave raiz. Billing, secrets e
subscriptions mantêm responsabilidades separadas; hosts só montam adapters.
Faturas/histórico/acesso são atualizados na mesma transação de plataforma.

S6/S9 permanecem parciais: criação/reconciliação periódica, provisionamento,
notificações e desativação externa ainda faltam; S8/onboarding e operação real
também. Os tópicos sem consumidor ficam PENDING. API legada e scheduler não
foram retirados ou reconfigurados. Provas e pendências estão nas ondas 87–92 de
[API compartilhada](../features/shared-api-host.md). Progresso geral ~60% é
estimativa de esforço, sem denominador medido ou aceite final.

### Onda 93 — reconciliação e cancelamento comercial (2026-10-03, sem commit)

Jobs por portas recuperam fatos e UNKNOWN por referência, avançam relógio local
e confirmam INACTIVE no provedor. Cancelamento futuro elegível persiste intenção
antes da escrita externa; dívida/pagamentos são conservados. O webhook e a
reconciliação compartilham a aplicação/projeção. 53 testes de banco e 40
HTTP/retry, tipos, gates e builds API/legado passaram localmente.

Emissão, SUBSCRIPTION, régua/notificações, saúde diária,
S8/onboarding/backoffice e aceite real seguem pendentes. Nenhuma
agenda/produção/retirada do legado.
[Provas e limites](../features/shared-api-host.md); geral ~60% continua
estimativa de esforço, sem denominador medido.

### Onda 94 — eventos e recuperação comercial (2026-10-03, sem commit)

SUBSCRIPTION ganhou handoff durável para os jobs de reconciliação/desativação,
com revalidação do recibo antes dos efeitos. UNROUTED comercial é recuperado em
lotes somente com ambiente original comprovado; o campo novo é imutável e não
supõe valores históricos. Cancelamento UNKNOWN recupera vínculo sem novo POST.
94 casos de banco, tipos/lint/gates passaram; o checkpoint detalha os builds.
Emissão, notificações/régua, saúde diária, S8/onboarding/backoffice e aceite
real ainda faltam. API legada/scheduler preservados; nenhum cutover.
[Provas e limites](../features/shared-api-host.md). Geral ~60% é estimativa de
esforço, sem denominador medido.

### Onda 95 — avisos comerciais S6 (2026-10-03, sem commit)

Outbox e cron existentes compõem avisos com a configuração Resend da plataforma.
Domínio seleciona dias/fatos; backend revalida contatos, persiste envelope e
primeira tentativa e envia um job privado por destinatário. Retry incerto após
23h exige conciliação. Não altera lifecycle, contratos, scheduler, produção ou
legado. 316 casos distintos locais, tipos/lint/gates e builds API/legado
passaram; nenhuma tolerância foi ampliada. S6/S8, emissão, saúde diária, tela,
onboarding/backoffice e aceite operacional continuam parciais. Geral ~60% é
estimativa de esforço. Provas: onda 95 de
[API compartilhada](../features/shared-api-host.md).

### Onda 96 — admissão e cota de equipamentos S8 (2026-10-04, sem commit)

Primeiro corte S8 na transação de criação, com guard único nos dois hosts:
acesso projetado, plano atual, exceções válidas e cota de modelos sob RLS. Off
conserva legado; shadow observa com savepoint; on aplica os envelopes. 296 casos
distintos (51 novos), tipos/lint/gates e builds API/legado passaram. Sete nomes
obsoletos de funções/tipo saíram da higiene porque ganharam uso real; nenhuma
tolerância foi acrescentada. Fiscalização e scheduler atuais mantidos.

S8 geral, equipe, módulos, exceções financeiras, site S13, onboarding/backoffice
e operação externa continuam pendentes. Sem produção ou retirada do legado.
Geral ~60% é estimativa de esforço. Detalhes e próximo corte na onda 96 de
[API compartilhada](../features/shared-api-host.md).

### Onda 97 — admissão HTTP da assinatura (2026-10-04, sem commit)

Factory única de principal aplica acesso/dono atuais e módulos após CSRF e
vínculo. Off/shadow preservam compatibilidade; on tem exceções estritas por
operação existente. 20 pares de adapters preservam a requisição real e recusas
comerciais; regras não foram duplicadas nos hosts. 337 casos distintos (110
novos), incluindo RLS, troca de dono, paridade HTTP e mutações do inventário,
passaram. Tipos/lint/gates aprovados; higiene perdeu somente três tolerâncias
obsoletas com consumidor real.

S8 permanece parcial: falta revalidar os demais comandos na transação da
escrita, cota de equipe, jobs promocionais e site, além de onboarding/backoffice
e operação externa. Enforcement real permanece off; legado/scheduler ativos.
Geral ~60% continua estimativa de esforço. Provas e próximo corte na onda 97 de
[API compartilhada](../features/shared-api-host.md).

## Onda 98 — admissão transacional (2026-10-04, sem commit)

Logística/manutenção e PIX/boleto revalidam acesso/módulo na mutação. Lock da
organização dura até commit; direitos/exceções são comuns ao gate HTTP. 422
casos distintos, 93 novos, incluem corrida, RLS, envelopes e jobs aceitos.
Fiscalização real off, legado/scheduler ativos. Boleto manual de orçamento,
demais comandos e restante S8/SaaS/operação pendentes. Geral ~60% é estimativa
de esforço. Provas/próximo corte na onda 98 de
`docs/features/shared-api-host.md`.

## Onda 99 — admissão de obrigações e boleto manual (2026-10-04, sem commit)

O boleto de orçamento ganhou entrada manual que revalida em cada transação,
separada da entrada de jobs aceitos sobre o mesmo núcleo. Envio, reemissão,
retorno/fechamento e baixa financeira conservam obrigações RESTRICTED e recusam
operações novas ou misturadas. Doze adapters mantêm os contratos; 587 casos
distintos, 80 novos, tipos/gates e builds passaram. Fiscalização real off,
legado/scheduler ativos. Demais comandos/equipe/SaaS e aceites externos seguem
pendentes; [provas e próximo bloco](../features/shared-api-host.md).

## Onda 100 — orçamento, locação e perfil (2026-10-04, sem commit)

Comandos manuais desses módulos revalidam acesso dentro da transação; conversão
paga aceita continua pelo mesmo núcleo e perfil próprio conserva
SETUP/RESTRICTED com ownership scoped. 28 adapters, 760 casos distintos (116
novos), tipos/lint/gates e builds do serviço e legado aprovados.
S8/equipe/comunicação/site, onboarding/backoffice e aceites externos continuam
parciais. Fiscalização real off, legado/proxy/scheduler ativos. Geral ~60% é
estimativa de esforço, não percentual de rotas ou testes.
[Provas e próximo corte](../features/shared-api-host.md).

## Onda 101 — comunicação e documentos (2026-10-04, sem commit)

Admissão transacional alcança mensagem manual, geração/assinatura de contrato e
envio ajustado. Efeitos aceitos continuam nos workers/atualizações existentes;
não há nova cópia de regra nos hosts. 437 casos distintos (46 novos), tipos,
lint e gates aprovados. Mutações externas Zoho precisam de intenção durável e
reconciliação próprias; Merchant continua em quarentena. S8/equipe/site/UI SaaS,
onboarding/backoffice e aceites externos permanecem parciais. Fiscalização real
off e API legada/proxy/scheduler ativos. Geral permanece estimativa de esforço.
[Provas e próximo corte](../features/shared-api-host.md).

## Onda 102 — admissão externa Zoho (2026-10-04, sem commit)

Seis mutações usam um executor compartilhado de aceitação, efeito e conclusão,
com registro FORCE RLS e replay scoped. UNKNOWN continua sem reenvio automático.
358 casos passaram, 55 novos. Gates e dois builds passaram; 50 casos HTTP de
mutação aprovados. A ampliação para leituras/OAuth encontrou oito falhas de
origem, preservadas para resolução; o conjunto não é considerado plenamente
validado. Fiscalização real off, legado/proxy/scheduler ativos; geral ~60% é
estimativa de esforço. S8, equipe, site, UI SaaS/onboarding/backoffice e aceites
externos continuam parciais. [Provas e fronteira](zoho-command-admission.md).

## Onda 103 — origem Zoho e catálogo de planos (2026-10-04, sem commit)

Leituras privadas e OAuth verificam Origin explícito antes de acessar a caixa
postal ou consumir state; a navegação OAuth sem Origin permanece aceita. A regra
geral de GET/HEAD não foi alterada. Os dois hosts acrescentam GET
/api/public/plans com um único catálogo no backend, contrato estrito, dinheiro
decimal e transação READ ONLY com papel de plataforma separado. Planos internos,
arquivados e versões fora da janela de venda não aparecem; ofertas mensais e
anuais permanecem distintas. Nenhum preço comercial foi inventado ou cadastrado.
502 casos distintos passaram, 27 novos; tipos dos 12 projetos e legado, gates,
dois builds e 116 casos HTTP nos dois hosts aprovados. As oito falhas de origem
da onda 102 foram resolvidas. Legado ativo, fiscalização off, sem produção ou
troca de tráfego. Geral ~60% continua estimativa de esforço.
[Estado e limites](../features/shared-api-host.md).

## Onda 104 — consultas do dono (2026-10-04, sem commit)

Assinatura e faturas são lidas por ambos os hosts a partir de subscriptions, sem
duplicar regras. OwnerUserId e vínculo ADMIN ativo são revalidados em snapshot
READ ONLY com RLS; flags antigas da sessão não concedem propriedade. A consulta
exata do dono também funciona em SETUP/RESTRICTED/ARCHIVED, sem abrir escritas
ou subrotas. Dinheiro/datas/DTOs existentes preservados; histórico cancelado
permanece. 185 unitários, 126 de banco e 78 estruturais passaram, mais 24
cenários HTTP em cada modo NextAuth/Better Auth nos dois builds. Não foram
somadas reexecuções. Tipos e gates aprovados; duas exceções de tipos obsoletas
removidas da higiene por consumo real, sem mudar o checker estrutural. S6 e
interface continuam parciais; próximos consumidores são a tela de
assinatura/faturas compartilhada. Legado/scheduler ativos, fiscalização off; sem
tráfego, produção, commit, push ou deploy. Geral ~60% permanece estimativa.
[Provas e limites](../features/shared-api-host.md#onda-104--assinatura-e-faturas-do-dono-2026-10-04-sem-commit).

## Onda 105 — tela de assinatura (2026-10-04, sem commit)

A consulta do dono passou a ter consumidor em packages/frontend: web mostra
plano/uso/faturas; Expo mostra estado e abre o painel autenticado no navegador,
conforme a ADR. Hosts e raiz montam adapters finos. Mudança de identidade,
locadora, vínculo ou transporte descarta respostas antigas; ADMIN não implica
propriedade. Não há ações comerciais, novos preços ou ativação de fiscalização.

94 focados, 95 mobile e 184 web passaram, além de 16 cenários Chromium. As duas
capturas do dashboard conservam a baseline sem diferenças. Tipos, lint,
arch/tokens/higiene/nomes/ratchet/CSS, builds e exports aprovados; aparelho e
provedor real não certificados. A paridade global Tailwind continua pendente: 12
classes de logística/manutenção anteriores não têm referência na fixture (10/11
testes passaram), sem alteração do checker/baseline para aprová-la.
Legado/scheduler ativos e fiscalização off. Geral ~60% é estimativa de esforço.
[Provas, limites e próximo corte](../features/shared-api-host.md#onda-105--consulta-da-assinatura-nos-clientes-2026-10-04-sem-commit).

## Onda 106 — cancelamento e desfazimento do dono (2026-10-04, sem commit)

Dois POSTs em ambos os hosts compartilham serviço/handler: autenticação real
recente, ownerUserId/vínculo revalidados sob row locks e recibo imutável scoped.
Projeção protege período pago/cortesia, encerra teste e enfileira o worker
existente; pedido não executa efeito externo. UI destes comandos ainda pendente.

341 casos distintos, tipos dos 12 projetos/raiz, lint/gates e builds API/legado
aprovados. Só uma exceção obsoleta de higiene foi removida por consumo real. Sem
mudar tráfego, enforcement off, produção, scheduler ou legado.
SaaS/onboarding/backoffice/aceites externos continuam parciais; geral ~60% é
estimativa de esforço.
[Estado e próximos consumidores](../features/shared-api-host.md#onda-106--cancelamento-pelo-dono-2026-10-04-sem-commit).

## Onda 107 — consumidor de cancelamento no web (2026-10-04, sem commit)

Confirmação na slice da assinatura usa os comandos existentes, chave efêmera
reutilizada no retry manual e releitura após o recibo local. Escopo/resumo
capturados impedem pedido antigo; UI não calcula regra comercial. Login tem modo
explícito de reautenticação sem reaplicar a ação. Hosts continuam finos, mobile
só estado/link. Nenhuma alteração funcional de outro domínio ou CSS.

179 focados, 185 web, 95 mobile e 16 Chromium, tipos/gates e builds web/legado
passaram; nenhum baseline/gate foi relaxado. Provedor/aparelho/operação,
ativação/troca/reativação/onboarding/backoffice e referência Tailwind 287
continuam pendentes. Legado/scheduler ativos, enforcement off, sem
commit/push/deploy/produção. Geral ~60% é estimativa de esforço.
[Contratos, provas e próximo corte](../features/shared-api-host.md#onda-107--confirmacao-e-reautenticacao-no-web-2026-10-04-sem-commit).

## Onda 108 — ativação e emissão durável (2026-10-04, sem commit)

Os dois hosts montam activate sobre subscriptions e compartilham a
infraestrutura de comando com cancel/undo. Perfil, plano mensal e quatro aceites
persistidos protegem a intenção; sessão recente, dono/vínculo e replay continuam
sob trava. O worker de mensalidade entra no cron existente, com composição
exclusiva da raiz e duas fases duráveis (cliente antes da recorrência). UNKNOWN
só concilia, queda/concorrência não duplicam POST e cancelamento durante I/O não
reabre acesso.

515 casos distintos, tipos, gates e builds locais passaram; seis verificações
HTTP anônimas em ambos os builds confirmam recusa/método. Nenhum efeito Asaas
real ou homologação operacional foi feito. Uma exceção de higiene obsoleta saiu
porque a normalização ganhou consumidor real; nenhuma proteção ampliada.
Legado/scheduler ativos, fiscalização off. Consumidor web de activate,
troca/reativação/onboarding/backoffice e aceites externos ainda pendentes.
[Contratos, provas e limites](../features/shared-api-host.md#onda-108--ativacao-e-emissao-da-mensalidade-2026-10-04-sem-commit).

## Onda 109 — consumidor web de activate (2026-10-04, sem commit)

assinatura-admin compartilha transporte, intenção scoped e confirmação de
activate/cancel/undo. Plano/mensalidade vêm do resumo; ação incerta mantém a
mesma chave/ação e não permite trocar de comando. accepted relê resumo/faturas,
sem presumir pagamento; cadastro/aceites e sessão recente têm tratamento público
sem detalhes privados. O foco retorna ao gatilho correto. Expo conserva só
estado/link, e nenhuma regra comercial saiu do backend.

180 focados, 18 Chromium, tipos/gates e builds web/legado passaram. Capturas
inspecionadas em 390/1440 px; identidade/API são simuladas, sem homologação de
provedor/aparelho/login real. Sem CSS novo, baselines, fiscalização, env real,
cutover, commit/push/deploy/produção ou retirada do legado. Troca/reativação,
onboarding/backoffice e demais aceites continuam pendentes.
[Contratos, provas e próximo corte](../features/shared-api-host.md#onda-109--ativacao-confirmada-no-web-2026-10-04-sem-commit).

## Onda 110 — reativação com histórico preservado (2026-10-04, sem commit)

Os dois hosts oferecem reactivate sobre o mesmo caso de uso/handler. Plano
mensal público/vendável, dono/vínculo e autenticação recente protegem a
assinatura nova sem teste. Recibo scoped vincula plano e assinatura; período
pago e recurso da anterior não são reutilizados. Perdão, acesso SETUP e outbox
são atômicos.

O worker confirma inativação e exclusão de vencidas antes de liberar emissão.
PROCESSING/UNKNOWN/404 só conciliam; pagamentos antigos permanecem e geram
auditoria manual. A barreira é transitiva entre reativações e também protege
activate/cron. Legado/scheduler ativos, fiscalização real off.

480 casos distintos, tipos/gates e builds locais, mais dez verificações HTTP,
passaram. Duas exceções de higiene removidas por consumo real, nenhuma
tolerância ampliada. Interface de reativação, troca, onboarding/backoffice e
aceites externos seguem pendentes. A hierarquia comercial dos planos foi
solicitada ao dono; preço/sortOrder não foram usados para inventar essa regra.
[Provas e próximo corte](../features/shared-api-host.md#onda-110--reativacao-duravel-pelo-dono-2026-10-04-sem-commit).

## Onda 111 — consumidor web de reativação (2026-10-04, sem commit)

A fatia existente de assinatura consulta catálogo publicado somente para resumo
autorizado CANCELED. Seleção explícita/confirmada manda a versão, sem cálculo
comercial; emissão e perdão ficam no backend da onda 110. Transporte, diálogo e
estado de activate/cancel/undo/reactivate são comuns. Retry incerto conserva
versão/ação/chave e impede trocar oferta; identidade/locadora/resumo e oferta
ainda não enviada invalidam confirmação anterior. Mobile mantém estado/link.

226 casos focados e 20 Chromium, tipos/gates e builds web/legado passaram.
Capturas 390/1440 inspecionadas; APIs/identidade sintéticas não homologam
provedor ou aparelho. Dois tipos agora usados pelo produto saíram da baseline de
higiene, sem tolerância nova. Legado/enforcement off preservados. Troca de plano
depende da hierarquia comercial ainda pendente; onboarding/backoffice,
referência Tailwind 287 e aceite operacional continuam necessários.
[Provas e limites](../features/shared-api-host.md#onda-111--reativacao-confirmada-no-web-2026-10-04-sem-commit).

## Onda 112 — núcleo assistido de onboarding (2026-10-04, sem commit)

S10 parcial: modules/onboarding cria o agregado e as sementes de locadora numa
transação restrita; a CLI prevista em B.8 usa a composição única existente.
Contratos/CNPJ, oferta publicada, identidade, limites, locks, trial HMAC e
recibo imutável são reutilizados/revalidados. Entrada/publicação jurídica são
arquivos externos limitados; só metadados de textos aprovados, sem inventar
aceites ou planos. A prévia padrão não acessa banco; --apply é explícito.
Site/conta Asaas não são publicados/provisionados no cadastro.

196 provas focadas, tipos/lint/gates e builds API/legado passaram localmente.
Concorrência, 12 falhas após gravações, papéis sem BYPASSRLS e CLI em
subprocesso constituem as provas deste corte. Nove achados de higiene deixaram
de ser exceções por uso real; nenhuma tolerância nova.
HTTP/UI/checklist/publicação e consumidor onboarding.welcome seguem pendentes.
Legado/enforcement off, decisões comerciais e homologação externa permanecem.
[Provas e limites](../features/shared-api-host.md#onda-112--provisionamento-assistido-atomico-2026-10-04-sem-commit).

## Onda 113 — HTTP de onboarding e status do dono (2026-10-04, sem commit)

Os três adaptadores de B.13 estão nos dois hosts, sobre o núcleo da onda 112.
Criação/disponibilidade usam sessão e borda app; status revalida o dono dentro
do snapshot READ ONLY da própria locadora. Limites persistidos, recibo HMAC,
captcha de pedidos novos e corpo limitado protegem criação; a consulta de slug
tem orçamento próprio. Nenhuma regra foi copiada para os hosts nem se duplicou a
composição de plataforma. Cadastro público permanece off.

234 provas distintas locais, incluindo HTTP até o agregado PostgreSQL e
checklist sob papel restrito, passaram. As guardas de sessão do inventário só
reconhecem os dois novos caminhos exatos; rotas arbitrárias continuam recusadas.
Uma exceção de higiene saiu por consumo real. Dublês de provedor/configuração
não homologam AWS/Cloudflare. S10 continua parcial: faltam UI, publicação e
consumidor de boas-vindas; operação/backoffice/SaaS e retirada do legado seguem
pendentes. ~60% geral permanece estimativa de esforço.
[Provas e limites](../features/shared-api-host.md#onda-113--http-autenticado-e-checklist-de-onboarding-2026-10-04-sem-commit).

## Onda 114 — boas-vindas do cadastro assistido (2026-10-04, sem commit)

Consumidor onboarding.welcome no backend e composição de jobs existentes.
Envelope/destinatário congelados, dono revalidado, chave estável, quarentena de
retry incerto e recibo de aceite durável. Renderer/envelope/transportes são
compartilhados com as notificações da plataforma. Configuração incompleta
conserva PENDING sem tentativa; nenhuma flag real foi ativada.

162 casos distintos locais, tipos, lint, gates e builds API/legado passaram. O
envio foi simulado: não certifica provedor nem entrega. UI guiada, publicação,
backoffice/SaaS e homologação externa continuam pendentes. Legado, proxy e
scheduler real continuam ativos; ~60% geral é estimativa de esforço.
[Provas e limites](../features/shared-api-host.md#onda-114--consumidor-duravel-de-boas-vindas-2026-10-04-sem-commit).

## Onda 115 — comando de publicação pelo dono (2026-10-04, sem commit)

POST /api/admin/site/publish disponível em paralelo nos dois hosts; regras e
composição permanecem no backend. Dono atual, e-mail, FULL e inventário da
própria locadora revalidados. Lock comum de catálogo/locação, contagem no papel
de aplicação READ ONLY e data/auditoria atômicas protegem o primeiro recibo.
Repetição não publica novamente nem ativa indexação/diretório.

277 casos distintos, tipos, lint e gates locais passaram. UI guiada,
despublicação, modos públicos S13, backoffice/SaaS e homologação externa
continuam pendentes. Legado, proxy, scheduler e flags reais preservados. ~60%
geral continua estimativa de esforço, sem denominador certificado; o número de
rotas/testes não mede o que falta para concluir o produto ou retirar app/ com
segurança.
[Provas e limites](../features/shared-api-host.md#onda-115--comando-de-publicacao-pelo-dono-2026-10-04-sem-commit).

## Onda 116 — checklist compartilhado e confirmação web (2026-10-04, sem commit)

S11b parcial: dashboard web/Expo monta os primeiros passos com fatos do
servidor. Entidade de leitura, feature de publicação e widget de composição
respeitam FSD; o host mobile só abre o painel configurado. Confirmação web,
retry manual do mesmo pedido e releitura impedem publicação automática ou estado
otimista. Troca de sessão/vínculo/locadora/transporte invalida dados e
intenções.

Consulta privada direta de aparelho reutiliza ownership/RLS; metadados de
navegador ou borda fornecida ainda exigem contexto app genuíno. 273 casos
distintos, tipos/gates, 30 verificações Chrome com fixtures, builds web/API/
legado e bundles Android/iOS passaram. Uma exceção de higiene saiu por consumo
real do tipo de checklist; nenhuma tolerância nova. Não houve login/provedor/
aparelho homologado. S11a, recebimentos, S13, backoffice/operação e retirada
segura do legado seguem pendentes. ~60% permanece estimativa de esforço.
[Provas e limites](../features/shared-api-host.md#onda-116--primeiros-passos-no-dashboard-webexpo-2026-10-04-sem-commit).

## Onda 117 — leitura aprovada para S11a (2026-10-04, sem commit)

Os dois hosts montam GET /api/onboarding/options sobre um único runtime no
backend. Consulta anônima restrita ao contexto do painel entrega somente opções
públicas e textos externos cujo hash confere com a publicação aprovada. Signup
off devolve somente esse estado e não lê os arquivos. Nenhuma regra fica no
host; criação, aceites, identidade, proxy, scheduler e flags reais preservados.

235 casos distintos, tipos/gates/builds API e legado e 90 verificações HTTP
locais passaram. Configuração on e textos são sintéticos; não homologam
parceiros ou operação. /comecar, recebimentos, S13, backoffice e retirada segura
do legado seguem pendentes. Geral ~60% continua estimativa de esforço, sem
denominador medido.
[Provas e limites](../features/shared-api-host.md#onda-117--opcoes-aprovadas-de-onboarding-2026-10-04-sem-commit).

## Onda 118 — conta mínima anterior à empresa (2026-10-04, sem commit)

Os hosts montam registro mínimo, leitura autenticada de confirmação e reenvio
sobre uma única composição de identidade. O contexto interno permite o passo
nome/e-mail/senha do dono sem remover telefone/documento do cadastro de
clientes. Registro conserva admissão app/origem/configuração/publicação,
orçamento persistente, captcha e verificação limitada de senha comprometida.
Leitura usa o fato do banco; reenvio somente para a própria conta, limitado e
neutro.

298 casos distintos passaram, quatro skips preexistentes de limitadores ficam
sem certificação. O motor real no banco descartável cria conta sem empresa,
reenvia/consome token e confirma o fato; e-mail é simulado. Tipos, gates, builds
API/legado e 84 verificações HTTP com cadastro off passaram. Inventário 167/211
por host não mede conclusão geral. Flags reais, legado, proxy e scheduler
preservados; /comecar, recebimentos, S13, backoffice e homologação/operação
continuam pendentes. Geral ~60% permanece estimativa de esforço.
[Provas e limites](../features/shared-api-host.md#onda-118--conta-minima-e-confirmacao-de-e-mail-2026-10-04-sem-commit).

## Onda 119 — jornada web /comecar (2026-10-04, sem commit)

S11a possui agora a jornada FSD sobre APIs/identidade existentes, com
confirmação de e-mail, empresa/endereço, oferta vigente, textos aprovados e
criação explícita. Rascunhos pertencem ao usuário atual; senha/captcha não
persistem. Pedido incerto conserva corpo/chave após reload e exige retry manual
com novo desafio. Catálogo mensal comum também serve a reativação. Host
limita-se a rota, login e captcha; Expo conserva a exceção documentada de
estados/link do painel.

117 casos distintos, tipos/gates, três builds, 84 verificações HTTP off e 40
verificações Chrome com fluxo on simulado passaram. Capturas desktop foram
inspecionadas; parceiros, sessão real de navegador e aparelhos não homologados.
Uma exceção obsoleta de tipo foi removida por consumo no produto, sem ampliar
baselines. Recebimentos, S13, backoffice/operação e retirada segura do legado
continuam pendentes. Flags reais off, legado/proxy/scheduler ativos; geral ~60%
permanece estimativa de esforço.
[Provas e limites](../features/shared-api-host.md#onda-119--assistente-web-de-cadastro-2026-10-04-sem-commit).

## Onda 128 — nova fotografia financeira confirmada (2026-10-05, sem commit)

Após uma conferência completa, o pedido confirmado do dono cria um incidente
novo com vínculo ao anterior. Incompletos continuam o cursor; PENDING conserva a
agenda e PROCESSING/lease bloqueiam troca. Incidente, pedido auditado e fila têm
commit conjunto; recibo tardio substituído é recusado. A lógica segue única em
packages/backend e o painel permanece em FSD, sem novos handlers, grants, flags
ou baselines. O legado e o scheduler continuam ativos.

Provas locais e limites em [shared-api-host.md](../features/shared-api-host.md),
onda 128; procedimento de referência em
[runbook de entregas](../operations/runbook-asaas-webhooks.md). Nova fotografia
não autoriza reativação ou aprovação. Retomada/liberação, BaaS, operações
restantes e homologação continuam pendentes.
