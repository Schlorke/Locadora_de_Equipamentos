# ADR: extração incremental do backend e composição HTTP

Onda 129 (2026-10-05, sem commit): billing implementa o transporte de subcontas
e payment-accounts inspeciona somente criação UNKNOWN por consulta. O mesmo
runtime registra o consumidor nos dois hosts, condicionado à configuração da
conta raiz, usando o scheduler/outbox existente. Nenhuma rota nova, regra
duplicada, grant ampliado ou retirada do legado. Criação completa/selagem e
dados de faturamento aguardam o corte seguinte e a decisão humana pertinente.
Provas/limites em shared-api-host.md e conta-recebimentos.md.

Atualização da onda 127 (2026-10-05, sem commit): consulta e pedido de
recuperação de recebimentos compartilham payment-accounts e runtime entre os
dois hosts. Contratos puros e interface FSD não carregam servidor. Consulta de
recibos usa o papel de plataforma isolado em READ ONLY; comando confirmado usa a
outbox existente, sem I/O de provedor ou nova regra no host. Nenhum grant mudou.
Inventário: 170 rotas/215 métodos por host. Recuperação final, subcontas,
homologação/cutover e retirada da API legada continuam pendentes.

Status: decisão de arquitetura em execução. Implementados: piloto
customers/addresses, drivers (operations), catálogo e clientes (commit
`0cff7b65`), cotação e locação e o módulo directory (ondas 2 e 3, `da19f601` e
`be859915`). A transferência completa de APIs para `apps/services/api` permanece
parcial: nove leituras públicas/health instaladas localmente em 2026-09-30,
incluindo disponibilidade, detalhe, cartão e busca do diretório. A política de
sessão e os adapters de identidade também foram extraídos para factories,
consumidas pela composição legada e pelo serviço. Em 2026-10-01 foi montada a
primeira leitura autenticada, `GET /api/auth/organizations`, seguida da leitura
da preferência `GET /api/auth/organizations/selection` e do vínculo no host
`GET /api/auth/organizations/current`. O corte 12 compartilhou o principal
privado e instalou `GET /api/admin/drivers`. O corte 13 instalou a leitura de
endereços `GET /api/addresses`, reutilizando customers e o principal, com
ownership por usuário e locadora. O corte 14 compartilhou a política de
permissões por locadora e instalou `GET /api/admin/categories`. O corte 15 monta
`GET /api/admin/equipment-units` e `/[id]`, usando a composição catalog e a
política granular existentes. O corte 16 instala o detalhe administrativo de
equipamento (`GET /api/admin/equipments/[id]`), também usando catalog e
EQUIPMENTS/READ. O corte 17 compartilha o limitador genérico em memória e
instala GET /api/admin/equipments. O corte 18 compartilha a consulta e instala
GET /api/admin/permissions, restrito ao ADMIN do vínculo atual. O corte 19
instala GET /api/user/profile usando o serviço de clientes existente, com
ownership de usuário/locadora e sem fallback global. O corte 20 inicia o módulo
communications com a listagem de notificações do destinatário, montando GET
/api/client/notifications e compartilhando seu contrato de query. O corte 21
monta GET /api/client/notifications/stats e compartilha seus quatro agregados
por destinatário. O corte 22 compartilha PATCH/DELETE de notificações por id e
POST mark-all-read. O corte 23 monta POST de endereços e PATCH/DELETE por id,
compondo o serviço customers já compartilhado, sem mudar regras ou handlers
legados. O corte 24 compõe o serviço de carrinho existente em customers e monta
GET/POST de /api/cart/sync e POST de /api/cart/merge. São 28 rotas/32 métodos no
estado do corte 24. O corte 25 acrescenta PUT /api/user/profile, compondo o
serviço de customers existente e extraindo seu schema de entrada para contracts,
consumido pelos dois adapters. O serviço parcial passa a 28 rotas/33 métodos: 24
GETs e nove mutações. O corte 26 monta POST /api/client/enroll, usando o caso de
uso existente e seu consentimento estrito comum em contracts. Serviço parcial:
29 rotas/34 métodos, 24 GETs e dez mutações; host, sessão, origem, atomicidade,
idempotência e recusas preservados. O corte 27 monta POST /api/admin/drivers,
com ADMIN da locadora atual e CSRF central, usando o serviço operations
existente e compartilhando o schema de entrada. Serviço parcial com 29 rotas/35
métodos (24 GETs e onze mutações). O corte 28 monta POST /api/admin/categories
sobre catalog/createCategory existente, com EQUIPMENTS/WRITE e o schema estrito
legado compartilhado em contracts/categories. Serviço parcial: 29 rotas/36
métodos (24 GETs e doze mutações). O corte 29 monta PUT/DELETE de categorias por
id sobre os casos de uso existentes, com WRITE ou DELETE, ownership antes do
corpo e os mesmos efeitos/erros. O corte 30 monta POST de unidades físicas sobre
catalog/createUnit, compartilhando somente o schema legado em
contracts/equipment-units. Permissão, unicidade por locadora, DTO, medidores,
lock e transação permanecem no catálogo existente. O corte 31 monta PATCH/DELETE
de unidades por id, sobre updateUnit/deleteUnit, com schema de atualização
legado comum, ações distintas e posse antes do corpo. O corte 32 monta POST de
equipamentos sobre createEquipment existente, com WRITE, limitador anterior à
autorização, normalização e categoria da locadora preservados. A onda 33 monta
PUT/DELETE de equipamentos, GET/POST de veículos e GET/POST/PATCH de logística,
extraindo as regras de veículos/entregas para backend/operations e seus schemas
para contracts. Implementação em bloco e validação consolidada ao final, por
decisão humana. A onda 34 compõe nove operações do portal de locações, pedidos
de coleta/prorrogação e consultas de orçamentos sobre rentals/quotations
existentes. O schema de prazo é comum aos dois adapters; posse, soft delete,
pedidos duráveis e transação permanecem no backend. A onda 35 acrescenta doze
operações: ciclo administrativo de locação, prorrogação do cliente, listagem de
orçamentos e atividades. Schemas existentes em contracts/rentals; consultas em
quotations/customers e lifecycle, disponibilidade, documentos e conversão
compostos com dependências reais. Gravação de cobranças/outbox permanece no
backend; emissão externa e consumidores seguem legados. Serviço parcial: 49
rotas/70 métodos, 35 GETs e 35 mutações. Os handlers legados permanecem ativos;
demais operações continuam no legado. Não houve alteração de URLs, ativação do
Better Auth, publicação ou migração de dados nesses lotes. Estado por módulo na
seção "Estado dos módulos".

Onda 36 (2026-10-02, sem commit): nove métodos de orçamento montados sobre
quotations/rentals, incluindo criação pública, reajustes, simulação, aprovação,
conversão e envio pela outbox. Quatro schemas existentes comuns em contracts;
nenhuma regra duplicada. Serviço parcial com 54 rotas/79 métodos, legado com
149/193 e 46 páginas preservados. Sem cutover de clientes, scheduler ou
produção. Validação consolidada e limites: onda 36 de
[API compartilhada](../features/shared-api-host.md).

Onda 37 (2026-10-02, sem commit): cinco GETs de documentos compostos; snapshot,
branding, queries, mapper e renderer no backend compartilhado. Tokens impressos
canônicos com valores anteriores. Serviço 59 rotas/84 métodos; legado 149/193 e
46 páginas ativo. Paridade PDF real nos dois modos, falhas, RLS e permissões
comprovadas localmente. Sem cutover; evidências na onda 37 de
[API compartilhada](../features/shared-api-host.md).

Onda 38 (2026-10-02, sem commit): seis GETs financeiros montados sobre queries
únicas em backend/billing; renderer PDF/XLSX/CSV em backend/documents. Serviço
65 rotas/90 métodos, legado 149/193 e 46 páginas ativo; PATCH de settings
preservado no legado. Paridade HTTP nos dois modos e fidelidade impressa
comprovadas; invariantes e dívida anterior documentadas na onda 38 de
[API compartilhada](../features/shared-api-host.md).

## Decisão

Onda 51 (2026-10-02, sem commit): sete métodos de manutenção e auditoria
compostos nos dois hosts. Lifecycle, helpers preventivos e queries ficam em
backend/operations; validação comum em contracts/operations e transporte em
backend/http. A facade interna de automação sem consumidores foi retirada depois
da movimentação, mantendo todas as rotas legadas. Membership ADMIN,
transação/lock, isolamento e contratos anteriores preservados; nenhum scheduler
novo. Serviço parcial 117/149, 44 métodos restantes; legado 149/193 ativo.
Relatório e limites na [onda 51](../features/shared-api-host.md).

Onda 52 (2026-10-02, sem commit): cálculo de frete em backend/operations, schema
anterior em contracts/operations e adapter em backend/http, compostos nos dois
hosts. Quatro métodos Merchant preservam o 503 explícito por uma resposta HTTP
comum; a integração comercial permanece bloqueada. Não foi reutilizado o cliente
global histórico. Serviço parcial 121 rotas/154 métodos, 39 métodos restantes;
legado 149/193 ativo, sem cutover. Evidências e limites na
[onda 52](../features/shared-api-host.md).

Onda 53 (2026-10-02, sem commit): dashboard/KPIs sobre cálculos únicos em
backend/billing e adaptação em backend/http, com FINANCIAL/READ e transação
tenant. Analytics/security preservam 410 inerte nos dois hosts; a mesma proteção
RETIRED foi aplicada ao serviço sem permissões de acesso a módulos.
Helpers/fachada interna sem consumidores foram retirados após a movimentação;
rotas legadas continuam ativas. Serviço parcial 125/158, 35 métodos restantes.
Evidências e limitações econômicas anteriores na
[onda 53](../features/shared-api-host.md).

Preservar o runtime Next.js para HTTP e executar um monólito modular em
`packages/backend`. Os hosts compõem dependências e adaptam o framework; regras,
transações e integrações pertencem aos módulos de servidor. `packages/domain`
mantém cálculos e tipos puros e `packages/contracts` mantém contratos públicos
sem Prisma.

**Atualização aprovada pelo usuário em 2026-09-30:** o host HTTP de destino é
`apps/services/api`, compartilhado por web e mobile. A organização anterior, que
colocava os handlers no cliente web, foi substituída por essa decisão. Na
topologia de destino, o web encaminha `/api` ao serviço e o mobile consome o
mesmo serviço diretamente. Os módulos de negócio permanecem em
`packages/backend`, com uma implementação por responsabilidade. A divisão é de
hosts; não cria microsserviços nem copia os módulos do backend para dentro do
serviço. O Next.js pode continuar sendo o adaptador HTTP durante a extração,
preservando contratos e URLs existentes.

Fonte da decisão: sessão Claude `4ad21d5f-c5f8-406a-a9ff-f4292e9d1296`,
mensagens de 2026-09-30T14:14:12Z a 14:17:36Z. A retirada de `app/` ocorre
depois da caracterização e da validação do serviço substituto; publicação e
troca de configuração de produção são etapas próprias.

A pasta `app/` da raiz é transitória e ainda hospeda a API legada ativa. A
árvore final mantém `apps/` na raiz. As pastas `src/app/` dentro dos hosts
Next.js são convenção do framework e permanecem; `packages/frontend/src/app` é a
camada de composição do produto em FSD. A retirada da raiz exige paridade dos
handlers e da operação, incluindo identidade, efeitos e scheduler, antes de
desativá-la.

O código de implementação deve existir em um lugar. Fachadas antigas podem ligar
dependências e reexportar nomes explícitos durante a migração, mas não duplicam
regras nem funcionam como uma segunda implementação. Um módulo backend nunca
importa `@/lib`, `app/api` ou um host. A composição fornece o Prisma e outras
dependências; criar factories específicas é suficiente para CRUD simples, sem
introduzir camadas genéricas desnecessárias.

### Organização final pretendida

Árvore de destino resumida; a raiz legada continua necessária durante a
migração. Essa organização mantém as decisões aprovadas, sem introduzir novos
hosts ou pacotes apenas para preencher um padrão.

```text
Locadora_Equipamentos/
├── apps/
│   ├── clients/
│   │   ├── web/src/               # Next: rotas, bootstrap e integração web
│   │   └── mobile/src/            # Expo: rotas, bootstrap e integração nativa
│   └── services/
│       └── api/src/
│           ├── app/api/           # Rotas HTTP finas
│           ├── host/              # Composição de dependências
│           └── proxy.ts           # Integração HTTP do host
├── packages/
│   ├── frontend/src/
│   │   ├── app/
│   │   ├── pages/
│   │   ├── widgets/
│   │   ├── features/
│   │   ├── entities/
│   │   └── shared/
│   ├── backend/src/
│   │   ├── modules/               # Identidade, catálogo, locação, cobrança...
│   │   ├── http/                  # Adapters Request/Response
│   │   └── runtime/               # Infraestrutura de servidor
│   ├── domain/src/                # Regras puras, sem Next/Prisma
│   ├── contracts/src/             # Contratos compartilhados de rede
│   ├── ui/src/                    # Contratos e renderizadores web/native
│   └── design-tokens/src/         # Tokens e temas canônicos
├── prisma/                       # Schema e migrations
├── tests/                        # Contratos, integrações e verificadores
├── tools/                        # Gates e ferramentas
└── docs/
```

O alvo é um monólito modular de negócio servido por um host HTTP compartilhado,
com uma árvore de produto frontend e dois hosts clientes. FSD organiza apenas o
frontend; o backend se organiza por responsabilidade de negócio. Regras puras
não conhecem transporte, persistência ou hosts. UI genérica não conhece o
produto.

Essa escolha se apoia em princípios reconhecidos: dependências em direção às
regras de negócio
([Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)),
fronteiras explícitas e APIs públicas de slices
([FSD](https://feature-sliced.design/)), e modularidade antes de decompor
serviços ([Monolith First](https://martinfowler.com/bliki/MonolithFirst.html)).
As referências não definem uma árvore universalmente superior nem certificam
este checkout. A implementação atual é um monólito modular pragmático: vários
serviços de backend ainda conhecem tipos/consultas Prisma. Ports específicos são
extraídos quando existe necessidade real de isolamento ou substituição; não se
afirma adoção integral de Clean Architecture só pelo nome das pastas.

A qualidade exige limites de imports, ownership por módulo, contratos testados,
RLS/identidade e operação previsível. Dívida registrada em baseline continua
sendo dívida; um gate verde só atesta o critério que aquele gate mede.

## Primeiro incremento do host compartilhado (2026-09-30)

`apps/services/api` atende `GET /api/categories` e `GET /api/health`, com Next
16.3.6, config standalone, runtime server-only, proxy próprio e nenhum cron. O
legado conserva 149 rotas/193 métodos e os clientes seguem apontando para ele; o
serviço tem 2 rotas/2 métodos declarados. Não existe fallback nem cutover.

A resolução pública de tenant foi transplantada para uma factory de identity,
com lookup injetado. Prisma/pg por processo foi transplantado para
`backend/runtime`; `lib/tenant.ts` e `lib/prisma.ts` mantêm fachadas de
composição. Catálogo e RLS continuam nos módulos existentes. Os adapters legados
de categories e health foram preservados para manter seus guards visíveis ao
inventário. O serviço usa os adapters Request/Response de `backend/http` e não
importa a raiz.

Caracterização anterior: 112 testes (catálogo e matriz pública) passaram antes
da alteração. Depois: 128 testes nos dois adapters/catálogo; 20 testes HTTP
reais compararam legado em dev e artefato standalone do serviço, com PostgreSQL
e papel sem SUPERUSER/BYPASSRLS/ownership. A suíte também consultou categorias
sem WHERE para provar que RLS impõe o tenant, além do filtro da aplicação.

Regressão local: 819 unitários, 134 de identidade e 660 de segurança aprovados
(18 casos condicionais anteriores pulados). Builds API/legado/web e os gates de
tipos, lint, arquitetura, ratchet e higiene passaram; baselines intactas. O
build legado com conexão fictícia registrou o fallback esperado do sitemap; não
é validação de SEO ou conectividade em produção.

Não houve mudança de schema nem execução de provedor real. Docker e deploy
remoto ainda exigem validação própria. Composição, env, testes, arquivos e
riscos estão em [API compartilhada](../features/shared-api-host.md).

Neste primeiro checkpoint, o próximo corte eram as demais leituras do catálogo
público, implementadas abaixo. Sessões, callbacks, mutações, pagamentos,
documentos e scheduler aguardam cortes próprios; o serviço parcial não pode
assumir `WEB_API_ORIGIN` por inteiro.

## Segundo incremento do host compartilhado (2026-09-30)

Acrescentados GET `/api/equipments`, `/api/equipamentos/search` e
`/api/settings/public`: serviço com cinco rotas/cinco métodos declarados; legado
conserva 149/193. Os hosts clientes, proxies, crons, env e origens não foram
redirecionados. O código do catálogo público permanece em backend, sem
alteração; o serviço apenas compõe os novos adapters HTTP do mesmo pacote.

Caracterização anterior: 128 unitários e 73 testes HTTP aprovados. O substituto
preserva seleção/erro de tenant, DTOs, Decimal numérico na lista e textual na
busca, ordenação, disponibilidade, limite oito, configuração ausente e métodos
automáticos do Next. As fixtures exercitam dados internos e públicos separados,
e RLS FORCE sem SUPERUSER/BYPASSRLS/ownership em equipments e settings.

Validação final local: 178 testes HTTP, 137 focados, 828 unitários completos e
660 de segurança aprovados (os mesmos 18 condicionais pulados). Build API, tipos
de pacotes/hosts e raiz, lint, arch, ratchet, higiene e documentação passaram;
baselines e handlers legados intactos. Docker/CI remotos, deploy e cutover não
foram executados.

Arquivos, validação e limitações:
[API compartilhada](../features/shared-api-host.md). Próximo corte:
disponibilidade e suas dependências de reservas, após caracterização. A retirada
de `app/` da raiz continua pendente.

## Disponibilidade, detalhe e cartão no host (2026-09-30)

Serviço com oito rotas/GETs declarados; raiz permanece com 149/193. A
disponibilidade reutiliza `createRentalAvailability` com runner tenant injetado.
A consulta e o DTO do detalhe público foram transplantados para
`createPublicCatalog.getPublicEquipment`; a rota legada mantém guard, validação,
cache e erros e chama a fachada. O cartão reutiliza `readPublicTenantCard`; sua
rota legada permanece intacta. Não foram alterados domínio, schema, jobs,
identidade privada ou origens dos clientes.

Caracterização anterior e comparação entre hosts: 341 HTTP aprovados com banco
descartável e RLS FORCE sem bypass/ownership. A comparação primeiro protegeu o
contrato original usando o build legado anterior; depois foi repetida com os
dois builds atuais. O novo adapter legado também foi validado diretamente em
testes unitários e de segurança (876 e 660 aprovados nas suítes completas).
Limitações e resultados completos em
[API compartilhada](../features/shared-api-host.md).

Próximo corte público: diretório por busca e rate limit compartilhado. Depois,
identidade/guard privado e efeitos exigem cortes próprios; este serviço ainda
não pode assumir `/api` por inteiro. A raiz `app/` permanece operacional.

## Busca do diretório no host (2026-09-30)

O serviço agora tem nove rotas/GETs declarados; o legado mantém 149/193. A rota
`GET /api/public/tenants?q=` usa os serviços de busca e contador persistente
existentes. `clientIpFromHeaders` saiu para identity/client-ip;
`isPlatformProduction` e `identityRateLimitSecret` para directory/security-env,
preservando as implementações e os imports/reexports usados de
`lib/rate-limit.ts`. O adapter HTTP fica em backend/http e o host contém somente
a composição.

O legado não foi removido nem redirecionado. Caracterização anterior, comparação
dos dois artefatos e prova de orçamento compartilhado em PostgreSQL descartável:
[API compartilhada](../features/shared-api-host.md). Próximo corte é a
composição de identidade e uma leitura privada, com extensão do inventário de
autorização aos dois hosts. Cookies, CSRF, OAuth, efeitos e scheduler continuam
exigindo provas próprias antes da troca de tráfego. A raiz `app/` ainda é
operacional; somente suas substituições validadas poderão ser retiradas.

## Composição de identidade compartilhada (2026-09-30)

Preparação para a leitura privada, sem instalar endpoints de autenticação no
serviço. `createApplicationSessionReader` contém a política de coexistência e
corte: Better Auth não reativa JWTs legados quando sessão, configuração,
cabeçalhos ou projeção falham. A fachada `lib/application-session.ts` mantém o
leitor de cabeçalhos do Next, os leitores reais e a projeção existente.

`createLegacyAuthentication` recebe banco, guard de tentativas, ambiente e
campos de log redigidos. Conserva os providers/options/callbacks existentes,
HMAC da credencial, releitura da senha a cada sessão e recusa do JWT revogado.
`createIdentityRuntime` recebe as dependências reais do Better Auth e conserva
lazy load, cache, flag de habilitação, marca da plataforma, origem da borda e
503/logs. As fachadas legadas fornecem Prisma, Resend e limitadores existentes;
nenhum desses adapters foi substituído por no-op.

As declarações de sessão NextAuth ficam junto do adapter no backend. A mesma
versão `next-auth` 4.24.15 passou a ser dependência declarada desse pacote.
Factories/configuração internas sem consumidores de produção deixaram de ser
reexportadas pelo entrypoint; testes continuam exercitando os módulos donos. O
`export default NextAuth(authOptions)` sem consumidor foi removido da fachada; a
rota real continua criando seu handler com `withSignInAvailability`. Somente o
registro dessa sobra resolvida saiu da baseline de higiene, sem nova exceção.

Não foram transferidos cookies, callbacks, seleção privada de locadora, guard
central, crons ou autoridade de execução. Legado continua com 149 rotas/193
métodos, serviço com nove GETs. Provas e riscos em
[API compartilhada](../features/shared-api-host.md). As dependências
persistentes e de e-mail foram compartilhadas no passo abaixo. A primeira
leitura autenticada continua exigindo paridade HTTP nos dois modos e inventário
de autorização abrangendo o serviço.

## Dependências compartilhadas de identidade (2026-09-30)

As políticas persistentes saíram de `lib/rate-limit.ts` para
`identity/rate-limit.ts`, por `createIdentityLimiters`. O host fornece o
contador Prisma real, o leitor de segredo e o IP confiável. O segredo continua
validado antes de carregar o contador; o carregamento é compartilhado entre
chamadas e uma falha permite nova tentativa. Janelas, HMAC, teto, atraso, reset
e respostas 429/503 permanecem iguais. `createLegacySignInGuard` compõe os
mesmos métodos para NextAuth e Better Auth, sem uma segunda política de
tentativas. Os limitadores genéricos em memória continuam legados neste corte.

O transporte Resend limitado a 15 segundos passou a `runtime/mail.ts`; a
montagem do payload e dos erros de identidade ficou em `identity/mail.ts`.
`lib/resend.ts` e `lib/identity.ts` fornecem configuração real por chamada,
preservando a chave de idempotência, cancelamento, remetente e falhas. Resend
6.30.0 foi declarado no backend, na versão já instalada, sem atualização.

Reexports internos que perderam consumidores foram retirados; testes dessas
primitivas importam os módulos donos com as mesmas asserções. O gate de higiene
passou sem alterar sua baseline neste passo. O serviço continua com nove GETs
públicos/health e o legado continua com suas rotas privadas e jobs. Próxima
etapa: resolução privada de principal, inventário abrangendo o serviço e
paridade HTTP da primeira leitura autenticada, incluindo cookies reais nos dois
modos.

## Primeira leitura autenticada (2026-10-01)

`GET /api/auth/organizations` usa a mesma leitura de sessão nos dois modos e
`listActiveOrganizationMemberships` em backend/identity. A consulta e a projeção
saíram da rota legada, que conserva o guard e o transporte originais. O serviço
compõe os engines, cabeçalhos Next, Prisma, limitadores e e-mail reais; não cria
outro login, cookie, regra de negócio ou fallback entre modos.

O inventário estrutural agora cobre os três hosts. Só as nove leituras públicas
conhecidas estão na allowlist, com referências explícitas; a nova rota privada
exige o guard, cujo resultado deve ser conferido antes de consultar dados.
Factories públicas são verificadas contra suas fontes para não executar I/O
durante a carga. Casos adversariais protegem guard ausente, efeito anterior,
recusa sem retorno e uso do leitor de identidade fora do namespace auth.

Não houve troca de tráfego, callbacks, guard central de principal, scheduler,
schema ou autoridade de escrita. Sessões emitidas pelo legado são consumidas
pelo serviço na prova HTTP local; isto não configura o navegador para enviar
cookies host-only a outra origem. O corte operacional continua pendente, com
origens/edge já definidos pelas ADRs. A pasta `app/` da raiz permanece
necessária para o host legado; apenas essa pasta externa sai ao fim da migração.
Os `src/app` internos dos hosts Next/Expo e a camada FSD `frontend/src/app`
permanecem no desenho final.

Provas, arquivos, limitações e próximo corte: seção "Corte 9" da
[API compartilhada](../features/shared-api-host.md).

## Leitura compartilhada da seleção (2026-10-01, sem commit)

O parser/formatter da preferência e a política de leitura foram movidos ao
módulo identity do backend; os adapters exigem sessão antes de qualquer
consulta. A consulta compartilhada conserva os filtros de identidade, locadora,
membership ACTIVE e organização ACTIVE. Contratos, cache, Vary, limpeza do
cookie e precedência dos erros são os do legado caracterizado.

O serviço instala somente GET (com HEAD/OPTIONS implícitos). POST/DELETE e seus
guards de origem/JSON continuam no legado, que mantém autoridade de escrita e
todos os entrypoints. Não houve alteração do proxy, URLs dos clientes, scheduler
ou schema. O inventário conserva a gramática INERT e confere as fontes dos
helpers de resposta/cookie, inclusive mutações adversariais de I/O, callbacks e
import de constante não literal. Provas e riscos no corte 10 de
[API compartilhada](../features/shared-api-host.md).

## Vínculo da locadora do host compartilhado (2026-10-01, sem commit)

`GET /api/auth/organizations/current` reutiliza a preparação do host de
`createPublicTenantResolver` e a consulta `readCurrentOrganizationMembership` do
backend. O host não contém uma segunda política: exige sessão após as recusas de
contexto, passa tenant e identidade à transação compartilhada e adapta a
resposta privada. O GET legado delega às mesmas implementações.

O inventário de autorização trata essa preparação como PROLOGUE, restrito aos
dois adapters de `/current`, nunca como guard. A análise continua até a
identidade; a rota saiu da lista de superfície autorizada por locadora pública.
As fachadas e seu resultado também são conferidos pela fonte. Casos adversariais
rejeitam sessão removida, consulta privada antecipada, `.ok` ignorado e uso em
outro namespace. Isto corrige uma lacuna da verificação estrutural, sem mudar o
comportamento autorizado da rota.

Sem mudança de proxy, login, cookies, scheduler, dados ou autoridade de escrita.
As doze leituras instaladas ainda são parte do substituto, não uma API completa.
Provas, riscos e próximo corte na seção "Corte 11" de
[API compartilhada](../features/shared-api-host.md).

## Principal privado e primeira operação de negócio (2026-10-01, sem commit)

`createTenantPrincipalResolver`, em backend/identity, recebe a sessão real, um
leitor lazy de Prisma e a resolução pública de locadora. A closure preserva a
ordem observada: recusa de mesma origem antes da sessão; parser da preferência;
borda e candidatos; conflitos; vínculo atual sob `withTenantTransaction`. Não
escolhe tenant padrão nem usa o papel global do usuário como autoridade de
locadora. As fachadas da raiz e do serviço delegam a mesma requisição.

O inventário segue essa delegação, confere a factory e as dependências reais,
verifica a recusa como primeiro passo da closure e mantém o teste discriminante
e a verificação de papel no adapter. A factory não faz I/O ao ser criada.
Nenhuma entrada pública, baseline ou proteção de teste foi ampliada para essa
operação privada.

O primeiro GET de negócio é `/api/admin/drivers`: papel ADMIN do vínculo,
consulta em `operations/createDriverService`, filtro de status original,
ordenação por nome, DTO e erros preservados. O serviço não instala o POST. A
implementação de consulta permanece única no backend; callbacks de sessão,
permissões granulares, mutações, jobs e composição operacional continuam sendo
cortes separados. Provas e riscos na seção "Corte 12" de
[API compartilhada](../features/shared-api-host.md).

## Permissão granular e categorias administrativas (2026-10-01, sem commit)

`createTenantPermissionResolver`, em backend/identity, recebe o principal real e
um leitor lazy de banco. Preserva a política observada: principal atual por
requisição; CLIENT recusado; ADMIN do vínculo passa sem consulta de permissão;
FINANCIAL/OPERATOR precisam de uma Permission com tenantId, role, module e
action exatos sob a transação da locadora. Não usa papel global, cache de
concessão, tenant padrão ou linha histórica sem tenant. A fachada legada e a
composição do serviço delegam ao mesmo código.

`GET /api/admin/categories` exige EQUIPMENTS/READ e delega à consulta existente
de catalog, inclusive o lock da transação de locação. Preserva array sem
envelope, campos completos, contagem de equipamentos, ordem, erros, HEAD e
OPTIONS. POST continua somente no legado. O inventário segue a factory de
permissão até o principal e os leitores reais; recusa uma fachada que forge
sucesso ou altere dependências/argumentos. Não houve ampliação de allowlist,
baseline ou defesa de teste. Dois achados de export sem consumidor de
CatalogService saíram da baseline porque a composição nova consome esse tipo.

Provas, limitações e próximos cortes: seção "Corte 14" de
[API compartilhada](../features/shared-api-host.md).

## Unidades físicas administrativas (2026-10-01, sem commit)

O serviço instala somente as leituras de lista e detalhe. A composição
`src/host/catalog.ts` liga o banco e a transação de locação ao mesmo
`createCatalogService` usado pelo legado; filtros, ordenação, DTO e regras
continuam em `packages/backend`. Os adapters exigem EQUIPMENTS/READ antes de ler
dados ou aguardar params. POST/PATCH/DELETE e os clientes continuam usando o
legado, sem cutover.

`CatalogError` vem do entrypoint público do backend. O inventário resolve esse
export e a fachada legada até a mesma classe, verificando sua definição e os
usos que poderiam alterar `instanceof`. Não foi criada uma segunda classe ou
ampliada a gramática para aceitar efeitos antes da guarda. Provas e limites:
seção "Corte 15" de [API compartilhada](../features/shared-api-host.md).

## Detalhe administrativo de equipamento (2026-10-01, sem commit)

O corte 16 acrescenta somente `GET /api/admin/equipments/[id]`. O host delega
`readEquipment` ao `createCatalogService` já composto, sem importar a fachada
legada ou copiar a consulta. Preserva params depois da autorização, transação e
lock da locadora, DTO administrativo completo, pricePerDay numérico, demais
decimais textuais, isAvailable e a contagem quoteItems/reviews legada.
CatalogError, erros genéricos, HEAD e OPTIONS mantêm o contrato observado.

PUT/DELETE, clientes, cookies e autoridade configurada continuam legados. A
lista administrativa ainda depende da extração do limitador em memória, com
caracterização da ordem limite → autorização → consulta. Não houve alteração da
política de identidade/permissões, de baselines ou do inventário estrutural para
aceitar o novo adapter. Provas: corte 16 de
[API compartilhada](../features/shared-api-host.md).

## Limitador em memória e lista de equipamentos (2026-10-01, sem commit)

O corte 17 move o store limitado, factories, janelas e resposta 429 para
`packages/backend/src/http/memory-rate-limit.ts`. `createMemoryRateLimiters`
recebe o leitor confiável de IP; cada composição/processo mantém seus próprios
contadores. `lib/rate-limit.ts` conserva as assinaturas NextRequest dos
limitadores administrativo/estrito e do check, além dos limitadores persistentes
de identidade. Seis exports internos sem consumidores de produção foram
retirados da fachada; a implementação e seus testes permanecem no backend. A
baseline de higiene perde a entrada obsoleta de consumeRateLimit, sem exceção
nova. O serviço liga a mesma factory ao mesmo leitor, sem importar o legado e
sem trocar o armazenamento por Redis/banco.

`GET /api/admin/equipments` reutiliza listEquipments, catalog/transação e
EQUIPMENTS/READ. Preserva filtros, paginação, DTO privado, contagens e erros. O
inventário verifica a factory, exports, wiring de IP e recusa imediata, e
rejeita I/O adicional antes da autorização. Não foi ampliada a allowlist pública
nem qualquer baseline. POST/PUT/DELETE, configuração dos clientes e scheduler
continuam legados. Provas e limitações: corte 17 de
[API compartilhada](../features/shared-api-host.md).

## Leitura de permissões administrativas (2026-10-02, sem commit)

O corte 18 move somente o SELECT para
`packages/backend/src/modules/identity/tenant-permissions-read.ts`. Os adapters
recusam imediatamente a falha do principal e papéis diferentes de ADMIN antes da
transação. O serviço compõe withTenantTransaction e a consulta compartilhada; o
GET legado chama a mesma consulta na transação existente. A lista mantém o
filtro tenantId, a ordenação role/module/action, o DTO completo e o tratamento
original de erro pelo framework, sem envelope novo.

PUT, lock consultivo e escrita das concessões permanecem intactos no legado.
Nenhum consumidor mudou de origem e nenhuma allowlist/baseline de segurança foi
alterada para admitir o novo adapter. Estado e provas: corte 18 de
[API compartilhada](../features/shared-api-host.md).

## Leitura do perfil comercial (2026-10-02, sem commit)

O corte 19 monta somente GET /api/user/profile. A implementação autoritativa
continua em customers/profile.ts: consulta por tenantId/userId na transação RLS,
DTO comercial, 404 sem perfil e tratamento de CustomerError. O serviço compõe a
factory com o banco do processo. Query não substitui identidade, locadora ou
projeção. O GET/PUT legado não foi alterado.

A classificação histórica de documento pelo comprimento bruto permanece;
normalização e suporte de escrita a documentos alfanuméricos são assuntos de
outro corte. O runtime dos testes recebe SELECT em client_profiles, sem
permissão de escrita nessa tabela. Cookies continuam emitidos pelo login legado
nos dois modos de auth; o helper de login da paridade foi extraído sem retirar
asserções. Contratos e provas:
[perfil comercial](../features/customer-profile.md) e corte 19 de
[API compartilhada](../features/shared-api-host.md).

## Leitura da caixa de notificações (2026-10-02, sem commit)

O corte 20 move os quatro SELECTs e a resposta paginada para
communications/client-notifications.ts, módulo de comunicações previsto nesta
ADR. O parser/schema existente de query é movido para contracts/notifications,
sem dependência de servidor. Ambos têm entrypoints públicos nomeados; sua adição
está registrada em ratchet-transfers como parte da extração autorizada, sem
ampliar baseline/allowlist ou tolerância. Não foi criado pacote novo.

O GET legado conserva principal, transação, validação dentro da transação,
status/headers e tratamento de erro; delega a consulta ao módulo. O serviço
declara o mesmo adapter fino e liga withTenantTransaction ao banco do processo
em host/tenant-transaction.ts. Nenhuma consulta ou regra vai para o host.

Filtros da página/total e estatísticas de todas as não lidas continuam
distintos. parseInt, valores vazios, issues zod, DTO integral e ordenação
observados são preservados. A caixa exige usuário/locadora atuais em todos os
SELECTs, além de RLS FORCE; query não substitui principal. Leitura não cria nem
marca registros. O serviço ainda não monta stats, marcação/exclusão ou
sincronização; o legado continua sendo a origem configurada. Ver
[sistema de notificações](../features/notification-system.md) e corte 20 de
[API compartilhada](../features/shared-api-host.md).

## Estatísticas da caixa de notificações (2026-10-02, sem commit)

O corte 21 instala GET /api/client/notifications/stats usando
communications/client-notification-stats.ts. A implementação dos quatro
agregados sai do adapter legado; os dois hosts passam a delegar ao mesmo módulo
e à transação RLS existente. Total da caixa, não lidas por tipo/prioridade,
queries ignoradas e chaves em minúsculas continuam distintos das estatísticas da
listagem filtrada. Não se unificaram contratos de respostas diferentes.

Serviço parcial com 23 GETs; raiz com 149 rotas/193 métodos ainda configurada.
Caracterização anterior, mutações e HTTP real nos dois modos de identidade
protegem recusas, ownership, RLS, erros, estado lido e métodos automáticos.
Mutações, sync, fan-out, clientes e scheduler continuam legados. Sem novo
entrypoint de pacote, dependency, migration ou baseline. Resultados: corte 21 de
[API compartilhada](../features/shared-api-host.md).

## Marcação/exclusão de notificações (2026-10-02, sem commit)

O corte 22 monta PATCH/DELETE de /api/client/notifications/[id] e POST de
mark-all-read usando communications/client-notification-mutations.ts. FindFirst,
UPDATE/DELETE e updateMany saem dos adapters legados e permanecem na mesma
transação de tenant. O host conserva transporte, params assíncronos, principal e
guard explícito, além da proteção central que precede identidade. Não se
copiaram queries ou regras para apps/services/api.

FindFirst e efeito usam id/tenantId/userId; falta de registro acessível dá o
mesmo 404. PATCH conserva readAt atual em toda chamada; DELETE repetido dá 404;
POST altera apenas não lidas e repetições conservam registros já lidos. DTO,
mensagens, bodies/queries ignorados, erros e OPTIONS seguem os contratos
caracterizados. O timestamp variável de PATCH é conferido contra o valor
persistido e o relógio real na paridade HTTP.

Serviço parcial com 25 rotas/26 métodos (23 GETs, três mutações), legado com
149/193 ainda configurado. Provas de efeitos, CSRF, ownership e rollback usam
apenas PostgreSQL descartável: o runtime tem SELECT/UPDATE/DELETE em
notifications, sem INSERT ou bypass; triggers de falha pós-write são removidas
após cada caso. Sem novo entrypoint, dependência, migration ou baseline. Ver
corte 22 de [API compartilhada](../features/shared-api-host.md).

## Inventário observado antes do piloto

A análise estática contou exports declarados
GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS, incluindo aliases, respostas 410 e o
catch-all JSON. Não conta HEAD/OPTIONS implícitos do framework e não certifica
autorização pela presença de uma rota.

| Superfície                 | Arquivos de rota | Métodos declarados |
| -------------------------- | ---------------: | -----------------: |
| `app/api` raiz             |              144 |                188 |
| `apps/clients/web/src/app` |                0 |                  0 |
| Subconjunto admin          |               77 |                102 |
| Subconjunto auth           |                8 |                 12 |
| Subconjunto client         |               10 |                 12 |
| Subconjunto cron           |                9 |                  9 |
| Subconjunto payments       |                9 |                  9 |

Os subconjuntos são parte da raiz, não linhas adicionais ao total. O pacote
backend tinha 18 arquivos TypeScript e quatro APIs públicas: identity, outbox,
billing e documents. O piloto adicionou dois arquivos e a API customers.

O fechamento de imports locais estáticos e `import()` com literal, a partir das
rotas e de `proxy.ts`, alcançou 233 arquivos locais: 85 arquivos de `lib`,
aproximadamente 14.496 linhas, mais rotas, `middlewares/require-admin.ts` e
`schemas/settings.schema.ts`. `app/api/admin/settings/actions.ts` é código
adicional ao conjunto de route.ts. Esse fechamento não segue dependências
externas/workspace nem imports computados. A contagem física de 2.914 arquivos
de `lib` contém 2.798 sob `lib/validations`, majoritariamente gerados; não
representa milhares de módulos de negócio a transferir.

Há 22 arquivos de teste com imports de handlers antigos e 34 com imports de
libs, com sobreposição. Reexportar nomes preserva caminhos, mas não garante que
um `vi.mock('@/lib/...')` intercepte um import novo dentro do pacote. Os testes
de integração devem continuar injetando as mesmas dependências pelo ponto de
composição ou ser movidos explicitamente para o contrato público correspondente.

Reprodução do inventário de rotas, sem escrever arquivo:

```powershell
$inventoryText = node tools/modernization-inventory.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$inventory = $inventoryText | ConvertFrom-Json
@('legacy', 'web') | ForEach-Object {
  $surface = $inventory.surfaces.$_
  [pscustomobject]@{
    Surface = $_
    Routes = $surface.endpoints.Count
    Methods = ($surface.endpoints | ForEach-Object { $_.methods.Count } | Measure-Object -Sum).Sum
  }
}
```

## Piloto implementado: customers/addresses

- `packages/backend/src/modules/customers/addresses.ts`:
  `createAddressService(prisma)` contém listagem, criação, edição e exclusão.
  Usa a API pública interna de identity para a transação com `app.tenant_id`
  local.
- `packages/backend/src/modules/customers/index.ts`: exports explícitos da
  factory, do erro `AddressNotFound` e do tipo `AddressService`.
- `lib/customer-addresses.ts`: liga o Prisma da composição atual à factory e
  preserva os imports antigos.
- `app/api/addresses/route.ts` e `app/api/addresses/[id]/route.ts`: continuam
  adaptadores HTTP, resolvendo o principal e validando entrada pelos contratos
  públicos.

Tenant e usuário continuam vindo do principal. O lock por locadora/usuário, a
promoção do endereço mais antigo, a proteção do índice parcial e os
códigos/envelopes HTTP foram preservados. Não há Prisma singleton, leitura de
ambiente, dependência Next ou import da raiz dentro do novo módulo.

## Sequência executável para os próximos lotes

1. Manter o piloto como padrão de composição: factory com dependências
   explícitas, transação tenant, facade sem regras e handlers HTTP com contratos
   preservados. Migrar clientes e catálogo por fluxo com testes de ownership e
   isolamento já existentes.
2. Extrair cotação/locação e operações como módulos de aplicação, mantendo
   locks, ordem de transações e contexto explícito. Não separar uma transação
   atômica apenas para respeitar diretórios. Chamadas entre módulos passam por
   APIs públicas explícitas.
3. Expandir billing e documents existentes com os adapters Prisma/gateway hoje
   em `lib`, preservando PaymentAttempt, registry, reconciliação e
   imutabilidade. A extração é estrutural; não altera semântica financeira nem
   faz chamadas reais.
4. Transferir notificações, WhatsApp e Zoho por responsabilidade de comunicação;
   transferir autenticação de webhook, inbox e composição dos handlers da
   outbox. Efeitos externos continuam fora das transações SQL, limitados por
   timeout e deduplicação persistida.
5. Consolidar composição de runtime: um Prisma por processo, secrets por
   referência explícita, email da plataforma e da locadora separados, sessão
   recebida como dependência e cache invalidado pelo adapter do framework. Só
   então montar handlers finos em `apps/services/api` pelas APIs públicas do
   backend.
6. Migrar a autoridade de execução por rota ou grupo coeso: mesmo URL, um
   destino ativo, sem shadow writes. Root e host destino podem importar a mesma
   implementação durante compatibilidade, mas schedulers e callbacks só devem
   apontar para a autoridade escolhida. Mover proxy, configuração de deploy e
   testes de HTTP com a transferência de runtime.
7. Remover wrappers e o servidor raiz apenas depois de paridade de
   rotas/métodos/configuração, importadores migrados, build do destino e testes
   HTTP reais pelo destino. O cutover de autenticação é uma operação separada,
   mantendo as flags atuais até sua validação própria.

Fronteiras propostas aproveitam módulos existentes: identity
(sessão/seleção/ACL), customers (cadastro comercial e endereços), catalog,
quotations, rentals, operations (logística/manutenção), billing, documents,
communications e entrega durável (outbox/inbox). Settings e auditoria mantêm
APIs estreitas; evitar um novo diretório genérico que acumule todo `lib`.

## Dependências que impedem apenas mover os arquivos

- `lib/application-session.ts` lê `next/headers` e carrega opções NextAuth;
  `lib/tenant.ts` depende dessa sessão implícita. O domínio recebe um principal
  validado, e a composição HTTP fornece o leitor de sessão. O modo Better Auth
  nunca pode fazer fallback para JWT legado.
- `lib/prisma.ts` inicializa pool/singleton a partir do ambiente ao importar.
  Não copiar esse módulo para cada serviço; injetar uma única instância pela
  composição do runtime e impedir leituras de ambiente em contratos/universal.
- `app/api/admin/settings/actions.ts` chama `revalidatePath`. O resultado da
  aplicação deve informar sucesso para o adapter invalidar cache; invalidar o
  cache do runtime raiz não invalida automaticamente outro host.
- O callback Zoho é fixo no host app com a plataforma configurada; o fallback
  legado usa ZOHO_REDIRECT_URI ou NEXTAUTH_URL. Better Auth usa BETTER_AUTH_URL
  e origens confiáveis; configurações públicas de cliente têm modo próprio. A
  mudança de host precisa comprovar cookies, URL canônica, CSRF/origin, callback
  OAuth e native. Não desligar essas verificações para acomodar proxy.
- No inventário, o host web não declarava backend nem next-auth diretamente
  apesar de importar next-auth no adapter cliente. Dependências utilizadas devem
  constar no pacote responsável; `transpilePackages`/tracing e
  `serverExternalPackages` precisam contemplar os pacotes de servidor, PDF,
  Prisma e binários efetivamente utilizados.
- `proxy.ts`, `vercel.json` e `tests/global-setup.ts` ainda selecionam o runtime
  raiz. A suite HTTP iniciar a raiz não demonstra que o host destino atende
  APIs. A migração do scheduler deve preservar exclusividade e os limites de
  execução, incluindo `maxDuration = 300` dos jobs longos; a plataforma precisa
  suportá-los.
- As libs de resposta HTTP e consumidores de webhook ainda usam `NextResponse`.
  Trocar por Request/Response padrão ou resultado de aplicação é uma extração
  separada, preservando corpo, status, headers e tratamento de falhas pelo
  worker.

## Rewrite transitório e precedência

Enquanto não houver composição completa no destino, `WEB_API_ORIGIN` pode
encaminhar APIs ao servidor atual. É transporte temporário; não transfere
implementação nem prova paridade.

Ao adicionar rotas dinâmicas locais, usar rewrite de **fallback** para as rotas
restantes. Conforme os guias locais desta versão Next, arrays simples/afterFiles
são avaliados antes de rotas dinâmicas e podem encaminhar uma rota já migrada ao
legado. Não adicionar o catch-all `app/api/[...rest]` no destino antes do fim:
ele captura a requisição e impede o fallback. Preservar a resposta JSON 404 ao
aposentar o transporte.

Validar origem de destino explícita, sem usuário/senha/query e sem apontar para
o próprio host. Exercitar através do proxy: cookie HttpOnly de
login/seleção/logout, header nativo de tenant, conflito header/cookie, corpo raw
de assinatura, upload privado, PDF binário e erros. A comparação
Origin/request.url de settings é um caso concreto que precisa passar sem relaxar
CSRF. Não publicar respostas tenant em cache compartilhado.

## Gates e evidência

Piloto: 4 testes PostgreSQL existentes e 13 testes HTTP novos passaram (17/17,
exit 0). O banco utilizado foi somente o PostgreSQL local descartável
autorizado; o teste recusa URL remota ou compartilhada com
DATABASE_URL/DIRECT_URL. Não houve alteração de schema.

```text
pnpm exec vitest run --config vitest.unit.config.ts tests/unit/addresses-database.test.ts tests/unit/addresses-http.test.ts
pnpm arch
pnpm exec tsc -p packages/backend/tsconfig.json
pnpm type-check
```

Os testes PostgreSQL exigem `TEST_DATABASE_URL` e
`TEST_DATABASE_DISPOSABLE=true`; sem a URL, o arquivo de banco é pulado e não
prova isolamento. Os testes HTTP exercitam handlers reais e factory extraída com
Prisma mockado. A conclusão do piloto também depende de lint, arquitetura e
tipos com exit 0 registrados na entrega. Não houve ensaio de deploy, cutover,
tráfego externo ou execução no host destino neste lote.

## Segundo lote: drivers

`@gb-locacoes/backend/operations` publica `createDriverService(prisma)`,
`DriverService` e `DriverInput`. O módulo usa a API identity para transações
RLS; `lib/drivers.ts` liga a instância Prisma existente. GET/POST admin/drivers
mantêm resolução de principal, membership ADMIN, validação e envelope no adapter
HTTP. Não foram criados métodos novos, alteradas regras de domínio ou instaladas
APIs no host destino. A rodada passou 58 testes HTTP mockados e 9 testes
PostgreSQL reais do conjunto operacional. O bloqueio real Merchant está
registrado separadamente, sem ampliar o negócio para vendas.

## Lote da onda 1: catálogo e clientes (commit `0cff7b65`)

- Fábricas: `createCatalogService(prisma, { withRentalTransaction })`,
  `createCustomerCartService(prisma)`,
  `createCustomerProfileService({ withTenantTransaction })`,
  `createClientDocumentService({ withTenantTransaction, storage })` e
  `loadFinancialCustomers(context, tx)`.
- Leituras públicas (categorias, equipamentos, busca, settings) usam
  `withTenantTransaction` de identity; a administração de categorias,
  equipamentos e unidades usa o lock injetado de `lib/rental-transaction`, com a
  ordem de locks inalterada.
- Perfil e documentos recebem o executor de `lib/tenant` pela composição, para
  que os testes que simulam `@/lib/tenant` continuem valendo.
- Padrão `DeferredInput`: o serviço lê o corpo depois da checagem de posse,
  mantendo 404 antes de 400/500 em `PUT` de categoria e `PATCH` de unidade.
- Erros de regra viraram exceções dentro da transação (rollback) em vez de
  respostas devolvidas com commit; `CatalogError` e `CustomerError` são mapeados
  como `{ error }` com status.
- O backend não declara `zod`: a validação do carrinho virou função escrita à
  mão em `customers/cart.ts`, com equivalência ao schema antigo provada por
  tabela. Limites (200 itens, quantidade até 10000, dias até 3650) iguais.
- 17 rotas viraram adaptadores; 155 testes de caracterização HTTP
  (`tests/unit/catalog-http.test.ts` com 96 e
  `tests/unit/customers-http.test.ts` com 59) passaram antes e depois; 21
  mutações dirigidas detectadas.
- Pendente: a regra "ADMIN/OPERATOR veem qualquer cliente; CLIENT só os próprios
  documentos" está no adaptador e no serviço (defesa em profundidade, decisão
  pendente); schemas zod de categoria, unidade e perfil continuam nos
  adaptadores.

## Terceiro lote: cotação e locação (onda 2, sem commit)

- Módulos `@gb-locacoes/backend/rentals` (10 arquivos: `errors`, `types`,
  `transaction`, `availability`, `lifecycle`, `conversion`, `client-requests`,
  `client-portal`, `administration`, `index`) e
  `@gb-locacoes/backend/quotations` (13 arquivos: `quote-code`, `quote-request`,
  `expiration`, `late-fees`, `taxes`, `adjusted-quote`, `boleto`,
  `client-portal`, `administration`, `admin-list`, `adjustments`, `update`,
  `index`).
- Factories com dependências explícitas: a transação tenant chega como runner
  (`TenantTransactionRunner`, `RentalTransaction`) ligado pela composição à API
  de identity, no padrão de customers. Nenhum módulo importa Prisma singleton,
  `process.env`, `next/*`, `@/lib`, `decimal.js` ou `date-fns`.
- Dinheiro com `Prisma.Decimal` (o decimal.js embutido, com a mesma
  configuração), porque `decimal.js` não está declarado em
  `packages/backend/package.json`.
- Ordem de locks e atomicidade preservadas, com o código transplantado:
  transação tenant → organização ativa → advisory lock da locadora; `FOR UPDATE`
  do orçamento; savepoint na conversão; lock por orçamento no boleto; locks por
  cobrança no reajuste.
- `QuoteUpdateRejected` no lugar de `throw NextResponse`;
  `autoGenerateBoletoOnApproval` injetado; `getCurrentTaxSettings(db, tenantId)`
  e `loadReservations(db, context, …)` exigem `db` e `tenantId`.
- `lib/quote-request.ts` concentra a composição de quotations; os demais
  arquivos de `lib` do lote viraram fachadas sem regra.
- Rotas adaptadoras: `admin/quotes` (lista, `[id]` GET/PATCH/DELETE,
  `convert-to-rental`, `send-adjusted-quote`, `send-boleto`,
  `calculate-late-fee`, `adjustments` e `adjustments/[adjustmentId]`),
  `admin/rentals` (lista, criação, `[id]`, `checkin`, `checkout`, `extend`,
  `calculate-late-fee`), `client/rentals` (lista, `[id]`, `extend`),
  `quotes/[id]` e `cron/auto-convert-quotes`. O PATCH de orçamento (cerca de 780
  linhas) foi transplantado com as mensagens conferidas byte a byte.
- Testes de caracterização HTTP sobre o banco real, escritos antes da mudança e
  verdes no código antigo: `tests/unit/rentals-http.test.ts` (27) e
  `tests/unit/quotes-http.test.ts` (27).
- Mudanças deliberadas: `checkAndExpireQuotes` e o auto-convert filtram
  `tenantId` explicitamente; a quitação passou a ser `isObligationSettled` (ver
  `docs/features/quote-system.md`, 7.4.1).
- Atualização onda 37: ofícios e downloads de orçamento extraídos para
  backend/documents; lib/pdf conserva fachadas. Continua pendente
  `admin/rentals/[id]/client-documents` (documentos privados e storage) ainda
  leem o banco direto e devem ir com o lote de documents. Na onda 39,
  `PaymentRequestError` passou para billing/payment-errors, com a mesma classe
  reexportada por `lib/payment-obligation` e injetada como `obligationError`;
  remover as fachadas depende dos passos 6 e 7. Decisões abertas: declarar
  `decimal.js` no backend, corrigir o 500 do `extend` administrativo e a
  acentuação corrompida de mensagens do PATCH (mudam o contrato HTTP) e passar a
  Decimal os valores monetários ainda em float.

## Borda de host e diretório (onda 2, sem commit)

- `@gb-locacoes/backend/identity` ganhou `readPlatformEdgeContext`
  (`platform-edge.ts`) e `resolvePrincipal` com candidatas host/header/cookie.
- `@gb-locacoes/backend/directory` (`card.ts`, `index.ts`) publica
  `readPublicTenantCard`; a saída passa pelo schema estrito de
  `@gb-locacoes/contracts/directory`.
- `resolvePublicTenant`/`resolvePublicRequestTenant` continuam em
  `lib/tenant.ts`. Detalhes: `docs/features/tenant-request-resolution.md`.

## Estado dos módulos (2026-09-26)

Contagem de arquivos `.ts` em `packages/backend/src/modules/<módulo>`. Os
exports de `packages/backend/package.json` no commit `0cff7b65` eram `identity`,
`outbox`, `billing`, `documents`, `customers`, `catalog` e `operations`; a
árvore acrescenta `directory`, `quotations` e `rentals`.

| Módulo       | Arquivos | Conteúdo                                                                                                            | Pendências                                                                                          |
| ------------ | -------: | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `identity`   |        8 | Configuração/factory Better Auth, credenciais legadas, migração e preflight de identidade, principal, borda de host | Identidade multi-host (Lote 6); sessão ainda lida por `lib/application-session`                     |
| `outbox`     |        4 | Contratos, dispatch e adapters                                                                                      | Composição dos handlers, autenticação de webhook e inbox (passo 4)                                  |
| `billing`    |        5 | Emissão, cancelamento de tentativa e eventos Asaas                                                                  | Adapters Prisma/gateway ainda em `lib`; `PaymentRequestError` em `lib/payment-obligation` (passo 3) |
| `documents`  |        3 | PDFs de orçamento e de reajuste                                                                                     | Documentos privados do cliente, storage e contratos (passo 3)                                       |
| `customers`  |        8 | Endereços, carrinho, perfil comercial, documentos do cliente, clientes financeiros                                  | Schemas zod nos adaptadores; fachada de perfil ainda na rota                                        |
| `operations` |        2 | Motoristas                                                                                                          | Logística e manutenção                                                                              |
| `catalog`    |        9 | Categorias, equipamentos, unidades, busca e settings públicos                                                       | Resolução pública por slug ainda em `lib/tenant.ts`                                                 |
| `quotations` |       13 | Código, pedido, expiração, multa, impostos, reajuste, boleto, portal do cliente, administração, listagem e update   | Ver "Terceiro lote"                                                                                 |
| `rentals`    |       10 | Transação, disponibilidade, ciclo de vida, conversão, pedidos e portal do cliente, administração                    | Ver "Terceiro lote"                                                                                 |
| `directory`  |        2 | Cartão público da locadora                                                                                          | Busca e rate limit persistente (Lote 7a da ADR de hosts)                                            |

Ainda sem módulo: comunicações (notificações, WhatsApp, Zoho), settings e
auditoria. Nenhuma rota foi instalada em `apps/clients/web/src/app/api`; o host
web continua encaminhando `/api/*` ao legado pelo proxy com contexto de borda.

## Atualização da extração — onda 40 (2026-10-02, sem commit)

O estado datado dos módulos acima é histórico. O serviço parcial agora possui 73
rotas/99 métodos (48 GETs e 51 mutações), zero páginas e zero métodos extras.
Legado 149 rotas/193 métodos/46 páginas preservado; restam 94 métodos
declarados.

Quatro mutações financeiras compostas sobre factories de backend/billing:
settings/status/vencimento e recusa de exclusão para preservar histórico.
Schemas existentes em contracts/financial; confirmação e pedido/worker de
reemissão compartilhados, com transações, locks e dependências injetadas. O
worker permanece na execução legada; o serviço só instala seu pedido durável.
Não há regra de negócio duplicada no host nem mudança da origem dos clientes.

A onda 40 acrescenta pedido PIX, geração/regeneração de boleto, geração
administrativa e leitura do PDF do provedor. Obrigação, pedido, consulta
externa, emissão e reconciliação usam factories de billing; referência env
pertence ao runtime compartilhado. Schema existente em contracts/payments.
Emissão e reconciliação continuam executadas pelos jobs legados; o serviço não
agenda workers nem assume callbacks/webhooks.

Paridade nos dois motores reais, SQL/RLS, concorrência e rollback local;
evidências e riscos na onda 40 de
[API compartilhada](../features/shared-api-host.md). API legada, webhooks,
consumidores e scheduler permanecem operacionais; não remover app/ ou efetuar
cutover antes das provas e migração operacional necessárias.

A onda 41 monta verificação de boleto e webhooks PIX/Asaas sobre identidade,
inbox/outbox e billing compartilhados. Os cinco POSTs mantêm os contratos,
inclusive 410 nas URLs antigas sem integrationId; o scheduler permanece apenas
no legado. Schemas existentes em contracts/payments; hosts compõem Prisma,
credenciais e consumidores. Paridade HTTP dos dois motores e SQL/RLS em
[API compartilhada](../features/shared-api-host.md), onda 41. Serviço parcial 78
rotas/104 métodos, legado 149/193 ativo e 89 métodos declarados restantes. Asaas
real, migração operacional dos crons e retirada de app/ não concluídos.

A onda 42 monta sete métodos de contratos e callback ZapSign. Geração, leitura,
ownership, pedido durável, renderer e consumidor ficam em backend/documents;
download em backend/http, storage em backend/runtime e schemas em
contracts/rental-contracts. Hosts recebem factories e adapters, sem duplicar
regras. Fachadas legadas preservam a composição e suas rotas. Efeitos de
assinatura/arquivo e adapter ZapSign ainda legados, sem segundo scheduler.
Paridade HTTP local 53 casos por motor de identidade, invariantes SQL/RLS e
gates na onda 42 de [API compartilhada](../features/shared-api-host.md). Serviço
parcial 84 rotas/111 métodos; legado 149/193 ativo, 82 métodos declarados
restantes. Prova local não substitui execução no provedor e cutover.

A onda 43 move efeitos de assinatura/reconciliação/arquivo e adapter ZapSign
para backend/documents. Fachadas legadas compõem dependências; execução continua
no único cron legado. O upload privado usa factory em backend/http com
transação/storage injetados; enum em contracts/client-documents. Listagem usa o
serviço customers existente. Dois métodos adicionais montados em
apps/services/api, sem banco/regras duplicados no host e sem retirar rotas
anteriores.

HTTP local: 44 casos novos por motor, com os 53 de contratos novamente verdes;
backend 48, banco 10 e cron 6. Evidências e limites na onda 43 de
[API compartilhada](../features/shared-api-host.md). Serviço parcial 86
rotas/113 métodos; legado 149/193 ativo e 80 métodos declarados restantes.
Reconciliação UNKNOWN segue sem consumidor operacional; não ativar repetição
automática de emissão. Provedor real, migração operacional e retirada do app/
ainda pendentes.

A onda 44 move imagens/settings para backend/catalog, upload para backend/http e
storage para runtime; schemas idênticos unificados em contracts/settings. POST
upload e GET/PUT admin/settings nos dois hosts, com fachadas legadas, quota SQL,
segredos e locks preservados. Serviço parcial: 88 rotas/116 métodos; legado
149/193 ativo e 77 métodos declarados restantes. HTTP 58/58 por motor, regressão
privada 44/44, gates 183/183. Provas e riscos na onda 44 de
[API compartilhada](../features/shared-api-host.md). Cache entre hosts continua
requisito de cutover; scheduler/origem continuam legados. Mobile sem inclusão
TypeScript que carregava o backend, mantendo sessão e tipos servidores.

## Incremento 45 — comunicações administrativas

Em 2026-10-02, sem commit, badges e sync administrativo estão compostos no
serviço. Regras e adapter Zoho em backend/communications, com factories e
fachadas legadas; host apenas adapta HTTP, identidade e dependências. Serviço
parcial 90 rotas/118 métodos (53 GETs e 65 mutações), legado 149/193 e 46
páginas ativo. Clientes/jobs inalterados; sem cutover. Provas e limites na onda
45 de [API compartilhada](../features/shared-api-host.md).

## Incremento 46 — leituras Zoho (2026-10-02, sem commit)

Seis GETs montados no serviço. Factories de adaptação em backend/http;
normalização, transporte e token em backend/communications. Guard e composição
pertencem aos hosts; corpos anteriores preservados e implementação única.
Serviço parcial 96 rotas/124 métodos (59 GETs/65 mutações), 69 restantes. Legado
149/193 e 46 páginas ativo. HTTP 32/32 por motor com provedor local, RLS e
refresh real no banco; limites e evidências na onda 46 de
[API compartilhada](../features/shared-api-host.md). Nenhum cutover ou produção.

## Incremento 47 — mutações Zoho (2026-10-02, sem commit)

Seis operações de envio/resposta/rascunho/ação/exclusão/anexo instaladas no
serviço e preservadas no legado. Adapters Request/Response em backend/http,
integração em communications, schemas universais em contracts e logger em
runtime. Hosts montam guard e dependências, sem copiar regra. Cache por processo
permanece limitação explícita; sem troca de clientes, callback ou scheduler.
Serviço parcial 102 rotas/130 métodos (59 GETs/71 mutações), 63 restantes;
legado 149/193 e 46 páginas ativo. Provas e limites no relatório da
[onda 47 da API compartilhada](../features/shared-api-host.md).

## Incremento 48 — OAuth Zoho (2026-10-02, sem commit)

Autorizar/callback/desconectar estão montados nos dois hosts. Factories em
backend/http preservam state, redirects, SQL e token; communications conserva o
cliente existente. Hosts fazem composição e integração de cookies. A recusa do
principal inclui metadado interno com o mesmo texto do corpo, sem mudar a
resposta ou política, para suportar o redirect OAuth sem leitura da Response.

Serviço parcial 105 rotas/133 métodos (61 GETs/72 mutações), 60 restantes;
legado 149/193 e 46 páginas ativo. HTTP OAuth 27/27 por motor nos dois hosts,
concorrência de state provada em PostgreSQL, sem Zoho real ou cutover.
Scheduler, clientes e callback público permanecem na origem legada.
Riscos/evidências e próximo corte de leitura WhatsApp na
[onda 48 da API compartilhada](../features/shared-api-host.md).

## Incremento 49 — leituras WhatsApp (2026-10-02, sem commit)

Três GETs de conversas/detalhe/mensagens montados nos dois hosts sobre
communications/whatsapp-read e o adapter backend/http. Consultas e DTOs únicos,
ADMIN/OPERATOR por vínculo, guard de origem, filtros e RLS preservados. POST de
envio e webhooks ainda legados; clientes e scheduler mantêm a origem atual.

Serviço parcial 108 rotas/136 métodos (64 GETs/72 mutações), 57 restantes;
legado 149/193 e 46 páginas ativo. Caracterização 30 antes, unidade 44 depois,
HTTP WhatsApp 54 por motor nos dois hosts e regressão alertas 19 NextAuth.
Provas/limitações e próximo bloco de envio/webhooks na
[onda 49 da API compartilhada](../features/shared-api-host.md).

## Incremento 50 — envio e webhooks WhatsApp (2026-10-02, sem commit)

POST de mensagens e de integração, GET/POST do webhook por integração e os dois
stubs 410 da URL antiga foram montados no serviço. Sender, parsers e consumidor
únicos em backend/communications; adapter em backend/http; schemas existentes em
contracts/whatsapp. Hosts compõem guard, runtime e protocolo HTTP. Legado
conserva suas rotas sobre a mesma implementação; nenhuma troca de origem.

Serviço parcial 111 rotas/142 métodos (66 GETs/76 mutações), 51 restantes;
legado 149/193 e 46 páginas ativo. Caracterização 22 antes/52 depois, 19 provas
AST, segurança 233, HTTP de escrita 84 com NextAuth e 84 com Better Auth, além
de 54 leituras por motor. Concorrência pode produzir 503 transitório com retry
idempotente (entrada 241), sem alteração do motor de inbox. Provedor só local,
FORCE RLS, sem baseline ampliada, cutover ou scheduler novo. Detalhes:
[onda 50 da API compartilhada](../features/shared-api-host.md).

## Incremento da onda 54 (2026-10-02, sem commit)

Atualização de permissões compartilha o schema universal anterior e o serviço
transacional de identidade. Os hosts autenticam/autorizam e compõem a mesma
factory HTTP; o lock, delete/create/read e a fronteira tenant permanecem em
packages/backend. Seis respostas operacionais 410 e o catch-all 404 preservam a
política inerte em cada adaptador, sob as mesmas invariantes de segurança. Essa
resposta estática não contém regra de negócio duplicada.

Serviço parcial 130/170, 23 métodos restantes; legado 149/193 ativo e clientes
inalterados. Catch-all não representa implementação dos endpoints concretos
ausentes. O runtime mantém o pool anterior; limitação concorrente na entrada 242
de known-issues. Paridade local em ambos os motores e resultados na
[onda 54](../features/shared-api-host.md). Nenhum cutover ou scheduler novo.

## Incremento da onda 55 (2026-10-02, sem commit)

Os hosts compõem os mesmos motores de identidade e a mesma política de seleção
GET/POST/DELETE. O wrapper que traduz indisponibilidade de credenciais para 503
foi movido ao transporte compartilhado. Cookie continua sendo preferência:
sessão, organização e vínculo atuais decidem cada autorização. As funções
internas que perderam consumidores públicos deixaram de ser reexportadas; as
implementações usadas pelo produto continuam intactas.

ContactSchema fica no contrato universal; a criação transacional do contato e
seu evento ficam em backend/quotations. O alias de orçamento delega ao handler
existente, e send-boleto usa o serviço enfileirado anterior. A resolução HDR
restrita e seu transporte binário ficam em backend/http com fetch injetado; os
adaptadores não duplicam a allowlist nem fixam uma origem comercial.

Serviço parcial 136 rotas/180 métodos, 13 restantes: quatro endpoints auxiliares
de credenciais e nove jobs. Legado 149/193 ativo. Paridade local dos dois
motores inclui login pelo serviço, cookies reais, isolamento SQL e rollback.
Nenhuma URL de cliente, callback externo, scheduler ou flag de identidade foi
trocada. Contagem de métodos, incluindo respostas inertes, não mede conclusão
geral. Provas e limitações na [onda 55](../features/shared-api-host.md).

## Incremento da onda 56 (2026-10-02, sem commit)

Cadastro, solicitação e uso do token de recuperação e verificação de e-mail
passam a usar factories únicas em backend/identity e backend/http. Os três
schemas anteriores ficam em contracts/credentials; os hosts compõem banco, motor
configurado, limitadores, remetente e execução após a resposta. O guard de
origem e a pausa de escritas permanecem explícitos nos adapters. Não se cria
membership ou ClientProfile no cadastro da conta global.

Respostas neutras, normalização exata de e-mail, bcrypt 12, TTLs, consumo
condicional de tokens, atomicidade do legado e revogação de sessões conservam o
comportamento observado. Better Auth continua sendo o único responsável pelas
suas próprias credenciais e tokens. Não há fallback entre motores.

Serviço parcial com 140 rotas/184 métodos (81 GETs/103 mutações), nove crons
restantes. Legado 149/193 e 46 páginas ativo; clientes, proxy e scheduler não
mudaram. Contagem de métodos (95,3%) não certifica conclusão geral, cutover ou
paridade mobile. Provas e limites na [onda 56](../features/shared-api-host.md).

## Incremento da onda 57 (2026-10-02, sem commit)

Nove endpoints de jobs compostos nos dois hosts, usando autenticação e runner
únicos em backend/http. Os tipos de orçamento/transação/resultado ficam no
runtime; regras concretas pertencem a billing, operations, communications e
outbox. Os hosts ligam banco, RLS, serviços e efeitos existentes sem duplicar
regras. Efeitos de e-mail e renderizadores HTML passam a ser compartilhados, com
fachadas compatíveis no legado e transporte injetado.

Serviço e legado têm 149 rotas/193 métodos, com 90 GETs/103 mutações; legado
conserva 46 páginas e o serviço não tem páginas. HTTP real dos nove jobs passou
nos dois hosts, nos dois modos de identidade. Autorização, fairness, budgets,
checkpoints, queries, estados, dedupe, templates e configuração foram comparados
contra o código anterior. Provas e limites na
[onda 57](../features/shared-api-host.md).

A agenda da raiz permanece idêntica. Nenhum cliente, callback, destino de proxy
ou scheduler foi trocado. Igualdade de inventário não significa cutover nem
certifica SaaS ou mobile. A retirada do legado depende de validação dos
consumidores e operação, uma única autoridade de jobs e rollback exercitado.

## Incremento da onda 58 (2026-10-02, sem commit)

Arquivos públicos passam a ser servidos pelo host web a partir da cópia real
sincronizada. Trocar WEB_API_ORIGIN afeta somente a API protegida pelo proxy.
Expo separa arquivos e API em configuração do host, com fallback compatível.
Exemplos próprios permitem ensaio local do destino compartilhado e rollback, sem
mudar configuração real. Backend/domínio/contratos permanecem nos pacotes.

Next start real, TLS verificado no loopback, login/cookies, isolamento, CSRF,
arquivos idênticos e rollback de sessão aprovados nos dois motores. Cliente HTTP
mobile lê ambos os destinos; bundles Android/iOS foram gerados, sem afirmar
validação em dispositivo. A raiz continua 149/193 com suas 46 páginas;
jobs/callbacks e autoridade de tráfego existentes não mudam. Não houve deploy.
Provas, arquivos e pendências na [onda 58](../features/shared-api-host.md).

## Incremento da onda 59 (2026-10-02, sem commit)

Aceite HTTP/SSR integrado usa o mesmo backend e contratos através do cliente
web: multipart, storage privado, PDFs, OAuth, cache e jobs, incluindo retorno ao
legado com registro de documento e state pendente. Web renderiza o equipamento
por locadora pelo gateway; a fixture mantém sua conexão de banco inutilizável.
Nenhum handler, regra, visual ou configuração de produção foi alterado.

43 casos aprovados em cada motor de identidade, tipos/lint/gates verdes e 183
testes de gates. A normalização de loopback do NextURL foi resolvida no hostname
da fixture, sem tocar a classificação ou segurança do produto. Ver a
[onda 59](../features/shared-api-host.md) e o
[roteiro de aceite](../guides/shared-api-acceptance.md).

O legado permanece 149/193 com 46 páginas e a única agenda configurada. Ainda
faltam dispositivos, fluxos interativos, callbacks externos e operação no
ambiente, além do restante SaaS/mobile. As provas locais não autorizam retirar
app/, transferir o scheduler ou publicar.

## Incremento da onda 60 (2026-10-03, sem commit)

Recepção inicial de webhook corrigida na inbox compartilhada: inserção atômica e
leitura na mesma transação substituem o upsert vazio que gerava P2002 sob
concorrência. Hash, RLS, chave por integração, lease, outbox e retry
conservados. Callback Zoho valida objeto JSON antes de ler state, sem consumir
autorização ou acessar o provedor para cookie inválido. Não há regras novas nos
hosts.

Provas locais: 40 casos de unidade/banco, 177 de segurança, 252 HTTP por motor
com os dois builds de produção, 183 de gates, tipos e lint. Papéis sem BYPASSRLS
e barreira SQL nos quatro provedores. Sem mudança de schema, pool ou scheduler;
legado 149/193 e 46 páginas permanece ativo. Issues 240/241 atualizadas; 242 e
restante SaaS/mobile/aceite operacional continuam pendentes. Relatório na
[onda 60](../features/shared-api-host.md).

## Incremento da onda 61 (2026-10-03, sem commit)

O consumidor do carrinho é universal e composto no bootstrap do frontend
compartilhado. Usa HttpClient com a locadora fixada e os mesmos contratos
sync/merge nos dois hosts. CLIENT confirmado, escopo local, invalidação de
respostas antigas e marcas persistidas protegem identidade e recuperação; o
carrinho anônimo permanece separado. Pricing segue o domínio, com base/regras do
catálogo no mapper, sem duplicação de negócio nos hosts.

Provas: 154 casos do carrinho/providers, 112 HTTP por motor com ambos os hosts
de produção locais, tipos, lint, build web e bundles Android/iOS. O HTTP usa
cookies/RLS e inclui resposta descartada após gravação real. As APIs e a agenda
legadas continuam ativas; nenhuma configuração real foi trocada. Aparelhos,
aceite visual/operacional e demais etapas continuam pendentes. Ver
[onda 61](../features/shared-api-host.md).

## Consumidor do orçamento (onda 62, 2026-10-03)

Transporte universal da página usa o HttpClient configurado; endpoints públicos
identificam a locadora e privados usam o contexto capturado pelo bootstrap. O
ciclo descarta respostas antigas antes de hidratar/limpar carrinho ou continuar
escritas. Nenhuma regra de domínio foi copiada para apps/services/api; seus
handlers e os legados não mudaram. Ambos os hosts/motores passaram no fluxo real
com cookies/RLS. Página nativa e aceite interativo continuam pendentes; não há
cutover, retirada do legado, publicação ou alteração de agenda. Ver
[onda 62](../features/shared-api-host.md).

## Consumidores de perfil/endereços (onda 63, 2026-10-03)

A entidade cliente em packages/frontend centraliza transporte privado de
perfil/endereços para orçamento e páginas da área do cliente. A fundação de
ciclo HTTP é genérica e recebe chave opaca; não contém resolução de identidade,
tenant, ownership ou regras. DTO e writes privados conservam os contratos dos
handlers compartilhados. Os hosts continuam finos e não receberam lógica nova.

Leitura/escrita renderizadas e cookies/RLS reais nos dois hosts/motores
passaram, com dados globais e de terceiros preservados. Consumidores do
histórico, telas nativas, SaaS e aceite operacional ainda pendentes; nenhuma
origem, agenda, configuração de produção ou API legada foi desativada. Ver
[onda 63](../features/shared-api-host.md).

## Consumidores de visão geral/histórico (onda 64, 2026-10-03)

Transportes universais em entities/locacao e entities/orcamento e atividades em
entities/cliente consomem os contratos existentes da API. As páginas usam o
HttpClient configurado e o ciclo opaco de cancelamento; seleção, posse, RLS,
soft delete e regras permanecem no backend único. Nenhuma duplicação de regra,
adaptação de handler ou mudança de scheduler foi necessária.

Listas, remoção, polling e respostas antigas passaram em renderização e HTTP
real nos dois hosts/motores. Builds dos clientes e guards aprovados; detalhes,
documentos/pagamentos, telas nativas e aceite operacional ainda pendentes.
Legado permanece ativo e não houve publicação/cutover. Ver
[onda 64](../features/shared-api-host.md).

## Consumidores de detalhe/ações/download (onda 65, 2026-10-03)

DTOs e transporte do detalhe ficam em entities/locacao e entities/orcamento.
shared/api só acrescenta modo binário opcional e resultado com corpo consumido;
não resolve seleção, autorização, posse ou regras de contrato. Os mesmos
handlers/backend atendem os dois hosts, sem nova implementação de negócio.

Página e bloco de ações capturam locadora/usuário/registro e descartam respostas
antigas. Extensão direta e pedido durável permanecem separados. Paridade
renderizada e HTTP com cookies/RLS/HTML/PDF aprovada nos dois motores; builds e
guards aprovados. Pagamentos, aparelhos, SaaS e operação ainda pendentes.
Legado/agenda intactos, sem publicação/cutover. Ver onda 65 de
[API compartilhada](../features/shared-api-host.md).

## Consumidores de pagamentos/documentos administrativos (onda 66, 2026-10-03)

HttpClient configurado atende os fluxos existentes de boleto, vencimento,
contrato, upload e PDFs. Adapter usado por financeiro/orçamento na entidade
pagamento; uso exclusivo no api da página dona. Shared/api só transporta
multipart/status/corpo e controla ciclo opaco; emissão, autorização, tenant e
documentos continuam no backend único.

202 pendente, FormData sem cabeçalho manual e PDF/negativas preservados em
renderização e HTTP local nos dois hosts/motores. Outros consumidores, nativo,
SaaS e aceite externo/operacional pendentes; nenhuma origem, agenda ou
implementação legada retirada. Ver onda 66 de
[API compartilhada](../features/shared-api-host.md).

## Financeiro e orçamentos consumidores (onda 67, 2026-10-03)

O transporte dos consumidores fica em api das páginas donas, sem chamadas
administrativas nos barrels públicos. Shared/api só transporta JSON com status
ou corpo binário e controla ciclo; regras/identidade/RLS continuam no backend
compartilhado. App hosts e scheduler permanecem compatíveis.

Carga, ações e exportação aprovadas em hooks e HTTP local nos dois motores.
Status 202 e recusas 409 preservam processamento/histórico. Layout e payloads
conferidos por AST. Não há cutover/retirada do legado, aceite externo ou
paridade nativa certificada. Próximo: catálogo administrativo (locações já
conectado na onda 66); provas/limites na
[onda 67](../features/shared-api-host.md).

## Consumidores do catálogo administrativo (onda 68, 2026-10-03)

Adapters exclusivos em api das páginas categorias/equipamentos-admin usam o
HttpClient, sem cópia de regras ou nova dependência de host no backend.
Shared/api acrescenta text-response opcional: corpo completo/status/statusText,
sem alterar JSON/binary. Formulários e páginas capturam identidade/registro e
recusam continuação de um ciclo encerrado; autorização/RLS continuam no
servidor.

Paridade de contratos e HTTP local nos dois motores aprovada. Provedores reais,
aparelhos, SaaS e operação ainda exigem aceite. Medidores Decimal textuais
precisam de ajuste no renderizador legado; raiz e scheduler permanecem ativos.
Locações já estava conectada na onda 66. Próximo: medidores e consumidores de
operações; relatório da [onda 68](../features/shared-api-host.md).

### Consumidores de operações (onda 69, 2026-10-03, sem commit)

Dashboard/manutenção/logística usam adapters privados das páginas e HttpClient,
conservando URLs, filtros, respostas e PATCHs. Backend/composição HTTP intactos;
não há regra copiada para apps/services/api nem para o frontend. Medidores
textuais ajustados somente na apresentação. Falha parcial e ciclos possuem
provas executadas; estilos/payloads comparados à árvore anterior.

Comunicações/configuração são o próximo bloco. Nativo, SaaS, operação, cutover e
retirada segura da raiz seguem pendentes. Resultados/limites na
[onda 69](../features/shared-api-host.md).

### Consumidores de comunicações e configuração (onda 70, 2026-10-03)

WhatsApp/Zoho, upload de settings e permissões usam HttpClient e adapters
privados das páginas, preservando contratos e ciclos. O backend e os dois hosts
HTTP permanecem intactos; OAuth é navegação pelo host web/proxy. Ponte
temporária do correio preserva parsing/status, multipart e binário. Não implica
retirada da raiz nem paridade nativa completa. Resultados e limites:
[onda 70](../features/shared-api-host.md).

### Consumidores nativos de entrada (onda 71, 2026-10-03, sem commit)

As duas entradas pós-login Expo renderizam dashboard e visão geral do cliente de
packages/frontend. O host conserva apenas callbacks de navegação/sessão. Modelos
e transportes compartilhados consultam os contratos existentes; não copiam
regras de backend para o mobile ou apps/services/api. Tipos universais do
dashboard não carregam a configuração web de ícones.

Testes renderizados e source maps Android/iOS confirmam os módulos nativos, sem
afirmar execução em aparelho. Destinos mobile ausentes, paridade visual, SaaS e
operação seguem pendentes. Dois hosts HTTP, scheduler e legado ativos; nenhuma
troca de tráfego. Provas e limitações:
[onda 71](../features/shared-api-host.md).

### Histórico nativo compartilhado (onda 72, 2026-10-03, sem commit)

Hosts Expo acrescentam somente duas rotas e o adapter de compartilhamento de
bytes já autenticados. Produto/models, preços e timeline ficam nas slices
existentes; atualização em atividade é integração web/native atrás de contrato
comum. Regras de domínio, ownership/RLS e handlers HTTP não mudaram nem foram
duplicados. Legado e scheduler ativos, sem cutover/produção. Provas locais e
limites de aparelho/recebimento: [onda 72](../features/shared-api-host.md).

### Detalhe público nativo (onda 73, 2026-10-03, sem commit)

A rota Expo apenas fornece parâmetros e integra imagem/compartilhamento. Estado
e UI ficam no frontend; cálculo e submissão continuam nas entidades/backend
existentes. O parser de resposta pública sai do host web para contracts,
consumido pelos dois clientes. Sem nova implementação de regras em hosts.
Legado/scheduler e produção intactos. Orçamento Expo/aparelho/cutover continuam
pendentes; [onda 73](../features/shared-api-host.md).

### Consumidor de orçamento nativo (onda 74, 2026-10-03, sem commit)

OrcamentoPage e QuoteForm compartilham modelos/transportes na slice FSD; host
Expo fornece somente imagem, parâmetros e armazenamento. Domain/backend e os
dois adapters HTTP continuam autoritativos e intactos. O proxy web encaminha o
detalhe público já consumido usando o contexto de borda/slug existente; subrotas
privadas/admin continuam bloqueadas. Nenhuma cópia de regra para host nem
retirada do legado. Provas locais e limites de aparelhos/frete:
[onda 74](../features/shared-api-host.md).

### Perfil, endereços e notificações Expo (onda 75, 2026-10-03, sem commit)

As rotas nativas somente montam os três entrypoints FSD existentes.
Modelos/transporte permanecem no frontend; domínio/backend e os adapters HTTP
existentes continuam autoritativos. A integração do contador DOM fica no web,
com snapshot universal protegido contra troca de contexto. Nenhuma regra
duplicada em apps/services/api ou no host Expo. API legada/scheduler ativos; não
houve cutover ou operação em produção.
[Provas e limites](../features/shared-api-host.md).

### Consumidor administrativo Expo — onda 76 (2026-10-03, sem commit)

Lista/detalhe de equipamento e unidades consomem os mesmos adapters/modelos de
frontend em web/native; não acrescentam hosts HTTP ou regras ao cliente. Duas
rotas finas e porta de imagem pertencem ao Expo. Backend, contratos, origens e
scheduler continuam intactos. Testes/gates/exports locais aprovados; criação/
edição/categorias nativas, aparelhos e aceite operacional permanecem pendentes.
[Provas e limites](../features/shared-api-host.md). Sem cutover ou retirada da
raiz app/.

### Composição SaaS compartilhada — onda 86 (2026-10-03, sem commit)

O pool de plataforma e seus módulos de transação/jobs/outbox ficam no backend
compartilhado. Ambos os hosts autorizam e montam GET /api/cron/platform, sem
regras comerciais ou scheduler próprios. O primeiro consumidor reutiliza a
limpeza de janelas vencidas do rate limit, via dispatcher/outbox existentes.
Consumidores comerciais/inbox/cofre e aceite operacional continuam pendentes.
API legada e agenda atual permanecem ativas; nenhum cutover ou produção.
[Provas e limites da onda 86](../features/shared-api-host.md).

### Cofre compartilhado — onda 87 (2026-10-03, sem commit)

Criptografia, lifecycle e rewrap ficam no módulo secrets do backend; ambiente,
KMS/OIDC, conexão e registry de jobs ficam na composição runtime. Os dois hosts
consomem o mesmo resolvedor/handlers, sem regras de cofre em apps/services/api.
ENV_REF permanece compatível; VAULT falha fechado e empresta transações já
abertas. Hash de webhook Asaas independe da chave de saída. O legado não foi
retirado, redirecionado ou desativado; nenhum scheduler ou deploy mudou.
Importador S7, operação KMS/provedor e consumidores comerciais continuam
pendentes.
[Implementação/provas/limites da onda 87](../features/shared-api-host.md).

### Importação assistida — onda 88 (2026-10-03, sem commit)

O caso de uso permanece em modules/secrets; a composição usa o runtime de
plataforma já protegido pelo gate. A CLI em tools só lê o arquivo explicitamente
informado e invoca backend/runtime, sem regra de negócio nos hosts HTTP.
Simulação usa transação READ ONLY e não chama KMS. Aplicação exige plano atual,
lock, conferência da decifragem e auditoria atômica. O SQL concede somente a
execução de um evento fixo da auditoria, sem acesso geral a audit_logs. Os
ids/FKs e os dois hosts legados permanecem; nenhuma credencial real ou produção
foi migrada. S7, contas/assinaturas e aceite externo seguem pendentes.
[Provas e operação da onda 88](../features/shared-api-host.md).

### Provider e recibos bloqueados — onda 89 (2026-10-03, sem commit)

Importador/cofre preservam userAgent de Melhor Envio cifrado e isolam grace de
assinatura HMAC da leitura de API key. Runtime retorna accessors redigidos;
ambos os hosts mantêm a mesma composição, sem regra duplicada de criptografia ou
negócio. A inbox persiste eventos autenticados durante bloqueio administrativo e
adia seus efeitos até Organization.status ACTIVE. Principal, transação manual,
locks e enumeração do scheduler continuam guardados. Não confundir bloqueio
administrativo com projeção comercial da assinatura. S5/S8/S9 e operação externa
seguem pendentes; nenhuma retirada ou produção.
[Provas e limites da onda 89](../features/shared-api-host.md).

### Entrada Asaas durável — onda 90 (2026-10-03, sem commit)

Dois novos adapters POST em cada host chamam o mesmo backend: autenticação em
identity, classificação HTTP única e persistência em outbox/platform-webhooks.
Os hosts não duplicam regra de assinatura, pagamento ou saúde de conta. O pool
de plataforma continua pertencendo à composição runtime/platform-jobs, e o
módulo recebe PlatformTransaction. Inbox, auditoria e despacho são atômicos; o
200 exige commit. Não há migração SQL nova ou scheduler novo.

Eventos de clientes vão para a fila da locadora; eventos comerciais/conta vão
para a plataforma, cujo consumidor S6/S9 ainda precisa ser instalado. Filas de
tópicos futuros continuam PENDING. As URLs antigas mantêm o comportamento,
nenhum provedor foi reconfigurado e a retirada da raiz continua pendente.
[Provas e pendências da onda 90](../features/shared-api-host.md).

### Saúde de contas — onda 91 (2026-10-03, sem commit)

O módulo payment-accounts recebe transação de plataforma e leitor de saúde;
billing mantém o adapter HTTP do Asaas e secrets mantém a correlação da chave,
sem revelar material. Runtime resolve credencial da locadora e compõe o tópico
payment-accounts.webhook nos dois hosts através do cron existente. Nenhuma regra
foi acrescentada aos hosts, nem migration ou agenda nova.

Mensalidades continuam pendentes para S6. URLs e contratos antigos permanecem,
sem retirada da raiz ou mudança em produção. S9 é parcial, com provas locais de
banco/papéis e chamadas HTTP ao provedor simuladas.
[Provas e limites da onda 91](../features/shared-api-host.md).

### Faturas comerciais — onda 92 (2026-10-03, sem commit)

modules/subscriptions recebe portas de plataforma/leitura; billing contém o
adapter HTTP exclusivo da conta raiz e o domínio conserva ciclo civil e
derivação de estado. runtime/platform-jobs compõe o consumidor para os dois
hosts através do cron existente. Não há regra comercial nova nos hosts,
duplicação de negócio, migration ou scheduler adicional.

Fatura/histórico/acesso/outbox têm commit conjunto; binding e recibo são
revalidados após a consulta ao provedor. Sem configuração explícita da raiz,
PAYMENT fica PENDING. SUBSCRIPTION, emissão, reconciliação periódica e
consumidores de notificação/desativação ainda faltam. Legado continua ativo; S6
e retirada da raiz permanecem incompletos.
[Provas e limites da onda 92](../features/shared-api-host.md).

## Onda 93 — execução comercial por portas (2026-10-03, sem commit)

subscriptions coordena reconciliação/cancelamento; billing transporta HTTP;
domínio deriva estado e calendário. invoice.ts é a aplicação única de fatos para
webhook/job. runtime compõe ambos os hosts pelo cron existente, sem nova agenda.
Intenção de cancelamento e projeção persistem no banco de plataforma, sem
misturar pagamentos de locadora. S6 continua parcial; URLs, API legada e
scheduler seguem ativos. Provas e riscos:
[onda 93](../features/shared-api-host.md).

## Onda 94 — handoff de eventos e recuperação (2026-10-03, sem commit)

subscriptions coordena o handoff comercial para os jobs existentes;
platform-webhooks compartilha roteamento e recuperação; billing conserva HTTP e
domínio conserva as regras financeiras. runtime injeta ambiente/chave da raiz e
compõe o mesmo cron nos dois hosts. sourceEnvironment é metadado interno
imutável de autenticação, acrescentado por migration aditiva; não altera DTOs
consumidos pelos clientes. 94 casos de banco, tipos/lint/gates passaram.
PROCESSED encerra o handoff, não a confirmação dos fatos. S6 e o aceite externo
permanecem parciais; legado e scheduler ativos.
[Provas e riscos da onda 94](../features/shared-api-host.md).

## Onda 95 — avisos comerciais compartilhados (2026-10-03, sem commit)

Seleção de régua fica no domínio; subscriptions coordena fatos, contatos e fila;
communications renderiza; runtime compõe o Resend existente nos dois hosts. Não
há lógica de negócio no serviço, scheduler novo, tabela ou rota pública. Jobs
privados revalidam destinatário/fatos e persistem envelope/primeira tentativa,
com chave estável e teto conservador para retry incerto. Configuração ausente
mantém avisos PENDING. Legado/contratos/produção preservados.

316 casos distintos locais, tipos/lint/gates e builds passaram. Uma tolerância
obsoleta ganhou consumidor real e saiu da higiene; nenhuma foi acrescentada. S6
ainda parcial; S8, emissão, saúde diária, UI e aceite operacional pendentes.
[Provas e limites da onda 95](../features/shared-api-host.md).

## Onda 96 — admissão transacional de equipamentos (2026-10-04, sem commit)

S8 começou em `backend/modules/entitlements/equipment-admission.ts`, consumido
por `catalog/equipments.ts` antes do INSERT. Acesso e cota usam o mesmo contexto
RLS/locks/conexão da mutação. Os dois adaptadores apenas conservam o envelope de
erro; nenhuma regra foi duplicada nos hosts. Off conserva o legado; shadow usa
savepoint; fiscalização real continua off. Downgrade conserva registros.

296 casos distintos, tipos/lint/gates e builds passaram. Só tolerâncias
obsoletas que ganharam uso real foram retiradas. S8 completo, módulos/equipe,
exceções financeiras, site, onboarding/backoffice e aceite operacional ainda
faltam; API legada/scheduler não foram retirados.
[Provas e limites da onda 96](../features/shared-api-host.md).

## Onda 97 — admissão HTTP comum (2026-10-04, sem commit)

A factory de principal dos dois hosts consome backend/entitlements depois de
CSRF/vínculo. Acesso/dono/módulos são lidos por locadora; adapters legados e do
serviço encaminham a requisição real e conservam as recusas. Não há regra de
assinatura nos hosts, endpoint novo, scheduler novo ou cutover.

337 casos distintos (110 novos), incluindo adapters reais, RLS e mutações dos
guards, passaram. S8 continua parcial: além do catálogo da onda 96, a decisão
deve ser revalidada na transação da mutação para fechar a corrida com plano ou
acesso. Flag real off; equipe/jobs/site e restante comercial/operacional ainda
pendentes. API legada continua configurada e ativa.
[Provas e limites da onda 97](../features/shared-api-host.md).

## Onda 98 — admissão na transação (2026-10-04, sem commit)

Logística/manutenção e PIX/boleto revalidam dentro do comando, conservando o
lock da organização até commit. Políticas HTTP e transacionais compartilham
direitos/exceções; hosts transportam recusas. Jobs aceitos e conciliação
separados. Sem regra duplicada, migration, scheduler novo, ativação comercial ou
retirada da API legada. S8/aceite operacional continuam parciais.
[Provas e limites da onda 98](../features/shared-api-host.md).

## Onda 99 — comandos manuais e jobs (2026-10-04, sem commit)

Generate/send de boleto, reemissão, retorno/fechamento e baixa dos dois hosts
consomem a mesma admissão transacional no backend. A composição distingue o
pedido manual requestQuoteBoletoPayment da entrada de job
ensureQuoteBoletoPayment, mantendo um núcleo financeiro único. Não há regra de
negócio duplicada no host, remoção do legado ou troca de scheduler/proxy. 587
casos distintos e builds dos dois runtimes passaram; S8/aceite operacional
seguem parciais. [Provas e limites](../features/shared-api-host.md).

## Onda 100 — comandos e conversão aceita (2026-10-04, sem commit)

Orçamento, locação e perfil recebem admissão na transação do backend; os 28
adapters dos hosts apenas preservam contratos/cache. Conversão manual e efeito
aceito de pagamento usam um único núcleo, com entradas distintas; nenhum gate
manual foi instalado nos jobs já aceitos. Perfil próprio preserva sua exceção
HTTP de SETUP/RESTRICTED. 760 casos distintos, 116 novos, tipos/lint/gates e
builds do serviço e legado passaram. S8/equipe/comunicação/site/SaaS/operação
continuam parciais; legado/proxy/scheduler ativos e fiscalização real off.
[Provas e próximos consumidores](../features/shared-api-host.md).

## Onda 101 — pedidos duráveis de comunicação/documentos (2026-10-04, sem commit)

WhatsApp, rascunho/assinatura de contrato e envio ajustado recebem admissão na
transação do backend. Os hosts transportam erros/cache; efeitos aceitos não
repetem o gate comercial. 437 casos distintos (46 novos), tipos/lint/gates
aprovados, sem baselines novos. A migração continua incremental, com os dois
hosts preservados; S8/Zoho/site/equipe/SaaS e aceites externos seguem parciais.
Fiscalização real off, legado/proxy/scheduler ativos.
[Provas e próximo corte](../features/shared-api-host.md).

## Onda 102 — efeitos externos Zoho (2026-10-04, sem commit)

Executor e registro durável permanecem em packages/backend; hosts apenas
fornecem composição HTTP/transação. As seis mutações preservam o fluxo off e
contratos existentes. UNKNOWN não repete efeito; reconciliação verificada
continua pendente. Legado ativo, fiscalização off e sem troca de tráfego.
[Implementação incremental](zoho-command-admission.md).

## Onda 103 — leitura comercial compartilhada (2026-10-04, sem commit)

GET /api/public/plans acrescenta um corte vertical nos dois hosts. A consulta
permanece no módulo subscriptions; projeção HTTP e composição de escopo SQL
permanecem em packages/backend. Os adapters GET só delegam. Não há cópia de
regras, leitura de dados de negócio pelo papel de plataforma ou redirecionamento
do legado. A origem explícita das leituras/OAuth de Zoho também é verificada no
backend comum. 502 casos distintos, tipos/gates e builds dos dois hosts
passaram; aceite externo e retirada da raiz continuam pendentes.
[Detalhes e limites](../features/shared-api-host.md).

## Onda 104 — leitura comercial do dono (2026-10-04, sem commit)

GET /api/admin/subscription e /invoices montados no legado e serviço. Os hosts
compõem o runner existente e delegam para o backend; identidade/ADMIN ficam
explícitos nos adapters, e ownership/direitos/projeção pertencem ao módulo
subscriptions. Não há import do host dentro do pacote nem outro pool de negócio.
Revalidação e dados compartilham snapshot RLS READ ONLY; contratos de rede
continuam em contracts. Tipos/gates, builds e cenários HTTP dos dois modos de
identidade passaram. Cutover e retirada do legado continuam não autorizados.
[Validação e pendências](../features/shared-api-host.md#onda-104--assinatura-e-faturas-do-dono-2026-10-04-sem-commit).

## Onda 110 — reativação compartilhada (2026-10-04, sem commit)

POST reactivate no legado e serviço delega ao mesmo módulo subscriptions.
Catálogo/recibos, isolamento, perdão e barreira transitiva de conciliação ficam
no backend; domínio puro continua em packages/domain. Handler e composição
existentes foram estendidos, sem negócio nos hosts ou scheduler paralelo. 480
casos, dez verificações HTTP e builds locais passaram; interface e homologação
externa permanecem pendentes. Sem cutover ou retirada da raiz.
[Provas e limites](../features/shared-api-host.md#onda-110--reativacao-duravel-pelo-dono-2026-10-04-sem-commit).

## Onda 114 — consumidor de plataforma compartilhado (2026-10-04, sem commit)

Os jobs dos dois hosts instalam onboarding.welcome pela composição única do
backend, com o módulo onboarding responsável por elegibilidade/recibos e
communications por renderer/envelope. Runtime injeta o transporte existente. Não
há negócio nos hosts, pool paralelo, novo scheduler ou leitura empresarial pelo
papel de plataforma. A interface subscriptionEmail permanece compatível. 162
casos, tipos/gates e builds locais passaram; envio externo foi simulado. Legado
e cutover permanecem no estado anterior.
[Provas e limites](../features/shared-api-host.md#onda-114--consumidor-duravel-de-boas-vindas-2026-10-04-sem-commit).

## Onda 115 — comando de publicação compartilhado (2026-10-04, sem commit)

POST /api/admin/site/publish tem adaptadores finos nos dois hosts. Identidade
fica explícita nos adaptadores; ownership, elegibilidade, data e auditoria ficam
em modules/onboarding. runtime/platform-jobs compõe as conexões existentes, sem
segundo pool ou regra no host. O lock consultivo das mutações de catálogo foi
extraído para uma função comum, preservando SQL e ordem do fluxo anterior.
Plataforma mantém o lock até o commit; aplicação só conta equipamentos sob RLS
READ ONLY. 277 casos, tipos, lint e gates passaram, sem ampliar tolerâncias.
Publicação de produto continua parcial: faltam UI, despublicação e S13 público.
Legado, proxy, agenda e flags reais preservados; nenhum cutover.
[Provas e limites](../features/shared-api-host.md#onda-115--comando-de-publicacao-pelo-dono-2026-10-04-sem-commit).

## Onda 116 — leitura privada de onboarding para aparelho (2026-10-04, sem commit)

O handler compartilhado de status aceita GET/HEAD autenticado direto sem
metadados de navegador ou borda. Origem ou qualquer x-platform-* fornecido
conserva a validação do app host genuíno. Os dois adaptadores existentes
continuam resolvendo a identidade; o leitor comum revalida dono e RLS em READ
ONLY. Não há regra no host nem mudança de proxy/scheduler. Unitários e
PostgreSQL restrito protegem o corte; ambos os hosts compilam. Legado permanece
ativo.
[Provas e limites](../features/shared-api-host.md#onda-116--primeiros-passos-no-dashboard-webexpo-2026-10-04-sem-commit).

## Onda 117 — leitura única de opções de cadastro (2026-10-04, sem commit)

GET /api/onboarding/options é montado em paralelo no legado e no serviço. Ambos
delegam para runtime/onboarding-options; modules/onboarding valida a publicação
e os textos, http conserva origem/cache/erros e runtime limita a leitura de
arquivos externos. Não existe pool novo, consulta de banco ou implementação de
regra nos hosts. Contratos de criação e aceites permanecem intactos.

235 casos e HTTP local dos dois builds passaram, incluindo signup off e
configuração on sintética. O fluxo público guiado ainda não foi instalado. API
legada, proxy e scheduler continuam ativos; não houve cutover ou alteração de
produção.
[Provas e limites](../features/shared-api-host.md#onda-117--opcoes-aprovadas-de-onboarding-2026-10-04-sem-commit).

## Onda 118 — composição única da conta mínima (2026-10-04, sem commit)

Register, owner-account e owner-verification são adapters finos paralelos no
legado e no serviço. Runtime compõe os limitadores, publicação, captcha,
consulta de senha e motor atuais; HTTP conserva contratos/cache/admissão e a
identidade usa contexto interno para o registro mínimo. Não há novo motor, pool
ou regra nos hosts. Contratos puros ficam no entrypoint credentials já
existente; nenhuma exceção ou baseline foi ampliado para publicar outro.

Provas locais incluem a confirmação de token real no banco descartável e HTTP
dos dois builds com cadastro off. Cadastro de clientes e legado ativos,
proxy/scheduler/flags reais preservados. /comecar e validação externa continuam
pendentes; não houve cutover ou produção.
[Provas e limites](../features/shared-api-host.md#onda-118--conta-minima-e-confirmacao-de-e-mail-2026-10-04-sem-commit).

## Onda 119 — consumidor web do cadastro (2026-10-04, sem commit)

O assistente /comecar consome as capacidades atuais dos dois hosts HTTP; não
acrescenta negócio, pool, rota de API ou composição paralela ao serviço. Produto
e estado da jornada vivem em packages/frontend/pages/onboarding; rota, login e
captcha ficam no host web. Cadastro e reenvio do dono recebem callback interno
fixo /comecar no motor de identidade compartilhado; cadastro comum é preservado.
Não há migração de tráfego ou retirada do legado. Provas locais incluem os três
builds, HTTP com signup off e navegador com APIs/SDK simulados; não certificam
parceiros ou cutover operacional.
[Provas e limites](../features/shared-api-host.md#onda-119--assistente-web-de-cadastro-2026-10-04-sem-commit).

## Onda 121 — conexão inicial de recebimentos (2026-10-04, sem commit)

POST /api/admin/payment-account/connect tem adapters finos no legado e serviço.
Ambos resolvem identidade/ADMIN e delegam para a mesma composição do runtime. O
caso de uso fica em modules/payment-accounts; billing só lê os dados comerciais
e a situação da conta pelo transporte Asaas existente. Contrato estrito fica em
contracts, criptografia e ativação ficam no cofre existente. Não há regra de
negócio, novo pool ou scheduler nos hosts.

A autorização do dono, e-mail confirmado, sessão recente e CNPJ é repetida
depois do I/O externo, sob o lock da organização. Conta, integração, segredo e
auditoria são gravados na mesma transação de plataforma. Nenhuma mutação ocorre
no Asaas neste corte. A conta continua RESTRICTED/WEBHOOK_MISSING e a integração
PROVISIONING; o recibo não significa habilitação de pagamentos.

312 casos distintos, tipagem de 12 projetos e raiz, gates afetados, builds e dez
requisições HTTP locais passaram. Inventário de fontes confirmado em 169
rotas/213 métodos explícitos por host. Provedor real, interface de conexão,
webhooks e conclusão de S9 continuam pendentes. API legada, proxy, scheduler e
flags reais preservados; nenhum cutover ou produção.
[Provas e limites](../features/shared-api-host.md#onda-121--conexao-inicial-de-conta-propria-2026-10-04-sem-commit).

## Onda 122 — configuração da conta conectada (2026-10-04, sem commit)

Configuração inicial e inspeção diária ficam em backend/payment-accounts;
billing adapta o HTTP Asaas e secrets fornece a autenticação recuperável. O
runtime instala o tópico existente payment-accounts.health nos mesmos crons
legado e serviço. Nenhuma rota, pool, scheduler ou regra foi duplicada nos
hosts; inventário permanece em 169 rotas/213 métodos explícitos por host.

SQL guarda intenção antes do I/O e revalida o vínculo antes do resultado.
Criação incerta, bloqueio, rotação e reconciliação pendente são preservados,
inclusive pelo consumidor de saúde por eventos. Só fatos atuais coerentes e
configuração confirmada permitem aprovação. Não houve chamada real de escrita,
homologação externa, cutover ou retirada do legado. Reconciliação, interface e
subcontas permanecem pendentes.

[Provas e limites](../features/shared-api-host.md#onda-122--configuracao-e-inspecao-da-conta-conectada-2026-10-04-sem-commit).

## Onda 123 — recuperação financeira de conta própria (2026-10-05, sem commit)

Configuração guarda o incidente no papel de plataforma e chama billing por uma
porta explícita. Billing trabalha com a conexão de negócio existente, RLS e
processador/outbox compartilhados; avanço de cursor e efeito financeiro têm
commit conjunto. Cinco consultas por entrega, fora de SQL, preservam orçamento e
retomada. Chave/vínculo e obrigação são revalidados depois da leitura. Nenhuma
regra ou runtime foi duplicado nos hosts, nem grant ou migration acrescentado.

251 provas distintas e builds API/legado passaram localmente. Banco com papéis
restritos e composição dos crons foram exercitados; provedor real não foi
acionado. A fotografia não libera a fila nem certifica entrega; revisão final,
recuperação guiada e aceite externo continuam pendentes. API legada e agenda
permanecem ativas. Ver [provas e limites](../features/shared-api-host.md).

## Onda 124 — cliente da conexão própria (2026-10-05, sem commit)

Formulário e modelo de ação pertencem à página FSD recebimentos-admin. Ambos os
hosts conservam o mesmo POST e o caso de uso payment-accounts, sem novas regras
ou cópia nos clientes. Chave efêmera não vira URL/storage/intenção de retry;
aceite estrito apenas relê a projeção.

228 testes locais, tipos/gates, builds web/legado e interface Chromium com
fixtures passaram. A sonda HTTP do proxy recebe 403 de origem, esperado 401 por
falta de sessão; integração completa segue não certificada (entrada 300). Nenhum
guard foi relaxado e a causa ainda não foi comprovada. API legada, scheduler,
flags e produção permanecem; ver
[provas e limites](../features/shared-api-host.md).

## Onda 125 — validação do transporte de recebimentos (2026-10-05, sem commit)

A sonda da onda 124 usava fetch, que substituía Host pelo endereço loopback e
conservava Origin. A prova usa agora o helper HTTP existente e confirma o proxy
real para a API legada e o serviço compilados nos dois motores de identidade.
Origem exata, cache privado, sessão real local e papel da locadora continuam
verificados, sem nova regra/adaptação nos hosts. Vinte casos HTTP passaram por
motor, mais dezessete unitários. Entrada 300 esclarece o resultado anterior.

O fluxo ainda não certifica aceite 202 do dono pelo proxy nem operação Asaas.
Nenhuma implementação legada, scheduler ou flag foi removida/ligada. Não há
mudança de arquitetura: só caracterização do transporte. Ver
[provas e limites](../features/shared-api-host.md).

## Onda 126 — prova integrada do aceite do dono (2026-10-05, sem commit)

Proxy real, sessões dos dois motores, hosts compilados e banco descartável com
os scripts canônicos dos papéis comprovam o aceite 202, segredo cifrado,
restrição, repetição e isolamento. O serviço usa o entrypoint standalone; o
provedor é sintético loopback e outras chamadas externas são bloqueadas. São 38
casos HTTP por motor e 32 unitários associados, com tipos dos testes novos
verificados explicitamente. Nenhum código de produção mudou e a lógica continua
única em packages/backend. Legado e scheduler permanecem ativos.

Este aceite local não homologa Asaas/KMS/IP, não libera recebimentos nem
autoriza cutover ou retirada da raiz. Próxima etapa de recebimentos: recuperação
guiada com conciliação final e prova de entrega. Ver
[provas e limites](../features/shared-api-host.md).

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
