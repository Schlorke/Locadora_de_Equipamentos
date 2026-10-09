# Operações administrativas por locadora

## Propósito e escopo

Drivers, logística, manutenção e auditoria mantêm as URLs e DTOs do painel, com
seleção explícita de locadora e membership ADMIN ativa. Não usam User.role como
autorização. OPERATOR, FINANCIAL e CLIENT não ganham permissões novas neste
lote. A interface, cores, filtros visuais e nomes de rotas não foram alterados.

## Fluxo e dados

- Drivers: GET/POST em admin/drivers leem e criam apenas na locadora
  selecionada.
- Logística: listagem/criação/PATCH em admin/logistics exigem rentalId, driverId
  e vehicleId da mesma locadora. A validação precede a escrita; ID externo
  retorna 404. O DTO rental.users é projetado do ClientProfile local, sem
  fallback aos contatos globais da identidade.
- Manutenção: consultas, agendamento, PATCH e conclusão usam tenantId em todos
  os filtros. Helpers recebem contexto e transação explicitamente. Alterações de
  manutenção e disponibilidade/horímetro do equipamento usam a mesma transação e
  o mesmo lock das mutações de locação. Reservas/locações em PENDING, ACTIVE,
  OVERDUE e PENDING_RETURN impedem início da manutenção.
- Conclusão libera disponibilidade apenas sem outras manutenções ativas,
  preservando a regra anterior. As regras preventivas por horas ainda usam o
  cálculo simplificado legado; não se afirma haver histórico de horímetro por
  manutenção que o schema não possui.
- Auditoria: listagem e contagem usam tenantId. Os dois helpers de log exigem
  contexto; middleware resolve principal em vez de extrair User.role global.

## Fronteiras de integrações

WhatsApp/send usa o transport Meta tenant já implementado e só retorna sucesso
com providerMessageId confirmado. Ausência de configuração retorna503; timeout
ou erro mantém envio não confirmado. Templates requerem adapter/configuração
específicos e recebem503, sem ignorar silenciosamente templateId/variables.

Melhor Envio/calculate preserva o contrato de entrada e saída. Requer exatamente
uma TenantIntegration MELHOR_ENVIO ativa, credentialRef explícita e CEP da
Organization. IDs dos equipamentos devem existir na locadora. O CEP de origem
recebido precisa coincidir com o cadastro; destino e medidas são dados da
simulação, sem alterar o cadastro ou contratar transporte. A credencial usa
_API_KEY, _ENVIRONMENT (sandbox/production), _USER_AGENT e a referência _SECRET
requerida pelo resolver. USER_AGENT identifica aplicação e contato técnico;
nenhum valor real é documentado.

Chamadas usam URLs fixas do provedor, timeout12s e não seguem redirects.
Respostas respeitam custom_price/custom_delivery_time quando fornecidos. Não há
fallback a credencial global, transportadora fictícia ou valor estimado
apresentado como retorno bem-sucedido do provedor. Falha retorna502; falta de
configuração503.

Referência oficial verificada:
[cálculo de fretes do Melhor Envio](https://docs.melhorenvio.com.br/reference/calculo-de-fretes-por-produtos).

As quatro operações Merchant (status, sync, product POST/DELETE) mantêm as URLs
e exigem ADMIN da locadora. Retornam503 TENANT_MERCHANT_ADAPTER_UNAVAILABLE. O
adapter legado usa conta/catálogo globais e remove produtos ausentes; sua
factory foi desativada explicitamente. Além do isolamento técnico, a Content API
foi encerrada e a oferta de aluguel precisa de enquadramento fiel ao produto
Google antes de publicação. A feature continua não concluída; detalhes e fontes
estão no [bloqueio Merchant](../issues/modernization-merchant-blocker.md).

## Arquivos e erros

Entradas:
app/api/admin/{drivers,logistics,maintenance,audit-logs,google-merchant} e
app/api/integrations/{whatsapp,melhor-envio}. Serviços:
packages/backend/src/modules/operations/maintenance-automation.ts,
lib/maintenance-http.ts, lib/logistics.ts, lib/audit-log.ts,
lib/audit-logger.ts, lib/meta-whatsapp.ts. 401 sem sessão,409 sem seleção,403
sem membership/papel permitido e404 para recurso fora do escopo. Dados inválidos
retornam400. Nenhuma consulta de recurso precede a autorização.

## Validação e limites

58 testes isolados em tests/security/operations-tenancy.test.ts exercitam os 18
métodos deste bloco com mocks. Oito testes de handlers com Prisma/PostgreSQL em
tests/identity/operations-database.test.ts validam isolamento e transações. As
suites compartilhadas fecharam278 testes de segurança/10 arquivos e31 de
identidade+PG/4 arquivos com exit0. Banco descartável explícito, fixtures
próprias, sem provider real ou alteração de produção.

Ainda não foram validados OAuth real, configuração de conta Merchant/Melhor
Envio, envio real de WhatsApp, aparelho nativo ou rollout em produção.

## Frete e Merchant compartilhados (onda 52, 2026-10-02, sem commit)

POST integrations/melhor-envio/calculate compõe createShippingService de
backend/operations e createShippingCalculationHandler de backend/http nos dois
hosts. O schema original está em contracts/operations; SQL, credencial,
transporte, normalização de opções e peso faturável têm implementação única. Não
altera equipamentos, reserva transporte nem muda o fallback existente no
consumidor frontend. Não há migration, UI ou dependência nova.

Qualquer principal ativo da locadora continua podendo cotar; Merchant exige
ADMIN da membership. POST/DELETE Merchant e frete conservam o guard central de
mesma origem; frete também mantém a checagem explícita anterior. As quatro
operações Merchant compartilham merchantUnavailableResponse: 503 com
TENANT_MERCHANT_ADAPTER_UNAVAILABLE, sem ler corpo/id nem ativar provedor. O
cron e a factory histórica bloqueada não foram alterados.

Equipamentos têm FORCE RLS na conexão tenant. TenantIntegration é um registro de
servidor sem RLS no schema atual, também consultado antes de resolver tenant em
webhooks: o cálculo mantém filtros tenantId, provider, status e organização
ativa explícitos, take:2 e exigência de uma única integração. Não se afirma
isolamento por RLS desse registro. A escolha de credenciais A/B foi verificada
pelo payload recebido pelo provedor local.

Contratos, comandos, resultados e riscos estão na
[onda 52 do host compartilhado](shared-api-host.md). A API legada e o scheduler
continuam ativos. Paridade local não certifica conta Melhor Envio real, Merchant
funcional ou implantação.

## Extração de drivers

### Manutenção e auditoria compartilhadas (onda 51, 2026-10-02, sem commit)

GET/POST admin/maintenance, GET scheduled, POST preventive-schedule, PATCH por
id, POST complete e GET admin/audit-logs estão montados nos dois hosts. Os casos
de uso e as consultas vivem em backend/operations; schemas existentes em
contracts/operations e adapters Request/Response em backend/http. Hosts fazem
somente composição, autorização e tradução dos erros. O helper de automação foi
movido integralmente para o módulo; sua facade antiga sem consumidores saiu, sem
excluir qualquer rota legada. O escritor de auditoria não mudou.

Todas as sete operações conservam ADMIN da membership atual, sem ampliar para
OPERATOR, FINANCIAL ou CLIENT. Manutenção conserva a transação RLS e o lock das
mutações de locação; auditoria conserva a transação tenant e o mesmo filtro na
listagem/contagem. Parsing de manutenção permanece depois do lock. PATCH
verifica a posse antes do corpo; complete valida o corpo antes da consulta.

Custos zero mantêm as diferenças anteriores: criação converte zero em null ou
recalcula pelas parcelas; PATCH grava zero; complete com total zero não
sobrescreve o total existente. Campos opcionais e strings vazias permanecem
compatíveis. CANCELLED não libera disponibilidade; conclusão libera apenas sem
outra manutenção SCHEDULED/IN_PROGRESS. Regras preventivas por dias, horas e
número de locações não ganharam validação ou cálculo novo. O histórico
simplificado de horímetro continua sendo dívida legada.

Scheduled ordena ascendente, usa estados ativos como padrão e permite status
explícito substituí-los. includeOverdue=true busca alertas de toda a locadora,
mesmo com filtro de equipamento. Listagem comum ordena descendente. Filtros
inválidos de manutenção continuam passando ao Prisma e retornam 500 genérico;
auditoria conserva 400 para paginação/data inválidas, página 1/50 e limite 100.
DTOs e projeção original de user na auditoria permanecem iguais.

Provas e resultados consolidados na
[onda 51 da API compartilhada](shared-api-host.md). Clientes, proxy e scheduler
continuam no legado. Nenhum job ou dado de produção foi alterado.

### Onda de veículos e logística (2026-10-02, sem commit)

GET/POST admin/vehicles e GET/POST admin/logistics, mais PATCH por id, têm
adapters nos dois hosts. A lógica saiu dos handlers para createVehicleService e
createDeliveryService em backend/operations; schemas existentes em
contracts/operations. lib/vehicles e lib/logistics são facades de composição,
preservando consumidores antigos. Não há dependência de Next ou da raiz no
módulo compartilhado.

Veículos conservam LOGISTICS/READ ou WRITE, transação de locação com lock,
ordenação por placa, filtros, defaults, descarte de extras e placa única por
locadora. Logística conserva ADMIN do vínculo e transação tenant, sem
acrescentar o lock de veículos ao fluxo antigo. Parsing do corpo continua
diferido dentro da transação. Recursos alheios devolvem 404; cliente no DTO vem
do ClientProfile local. Distância zero vira null, conclusão sem data recebe a
hora atual e campos opcionais ausentes são preservados. Nenhuma regra de estado
nova.

As provas de toda a onda são executadas em conjunto ao final, conforme decisão
humana. Não há cutover ou mudança de origem dos clientes. Resultados finais em
[API compartilhada](shared-api-host.md).

GET/POST admin/drivers preservam ACL, URLs, DTOs e validação, mas delegam
leitura/criação ao módulo `@gb-locacoes/backend/operations`, com
`createDriverService(prisma)` e transação tenant da API identity.
`lib/drivers.ts` faz somente composição. O módulo não depende da raiz ou de
Next. A rodada após extração passou 58 testes HTTP com mocks e 9 testes
PostgreSQL de operações (um novo cenário de criação de motorista sem mass
assignment entre locadoras), ambos com exit 0. Os totais agregados acima
representam a rodada anterior.

### Host HTTP compartilhado (corte 27, 2026-10-02, sem commit)

GET e POST /api/admin/drivers também estão montados em apps/services/api; o
legado continua ativo e os clientes conservam a origem anterior. POST compõe o
createDriver existente, sem novo caso de uso ou concessão de papel.
CreateDriverSchema foi movido, sem mudança, para contracts/drivers e é usado
pelos dois adapters. Status ausente vira ACTIVE; os outros valores aceitos são
INACTIVE e ON_LEAVE. O schema descarta chaves extras, incluindo id/tenantId;
name/phone exigem comprimento mínimo um e preservam espaços. CNH e categoria são
strings opcionais sem nova normalização. Ausentes ficam null no banco.

Sucesso é 201 com `{ driver }` e o DTO completo; não há cookie ou cache
explicitamente introduzido. Repetir o POST cria outro registro. Validação Zod
mantém 400 com details; JSON malformado mantém 500 genérico. Recusas do
principal são encaminhadas sem mudança, antes do parsing e da escrita. Global
User.role ADMIN não autoriza criação sem membership ADMIN ativa na locadora
atual. O principal compartilhado exige mesma origem em mutações com borda
validada; chamada mobile direta conserva o comportamento anterior.

Caracterização anterior: 38 unitários e 35 HTTP no legado. Depois, 76 unitários
exercitam os dois adapters com o backend real e banco simulado. A matriz de 41
HTTP usa sessão real nos dois modos, PostgreSQL e papel temporário sem
BYPASSRLS: locadoras A/B, campos forjados, memberships revogadas, CSRF,
validação, POSTs repetidos/paralelos, INSERT sem contexto/alheio e erro após
INSERT com rollback. Fixtures, grants INSERT e trigger de falha são exclusivos
do banco descartável e removidos; nenhuma migration ou papel de produção foi
alterado. Evidências e limites em shared-api-host.md, corte 27.

## Consumidores administrativos (onda 69, 2026-10-03, sem commit)

Manutenção e logística consomem HttpClient configurado por adapters das próprias
páginas. Scheduled mantém includeOverdue=true; veículos e motoristas conservam
AVAILABLE/ACTIVE. Pesquisa, tipo/status, paginação e os corpos PATCH não
mudaram. Seleção e rascunho reiniciam por locadora/usuário/transporte, e
cancelar edição não permite que resposta antiga feche a próxima seleção.

ADMIN/permissões, ownership, CSRF, runner tenant/RLS e regras de manutenção/
entrega continuam nos mesmos handlers/casos de uso. Nenhuma nova autorização ou
validação de negócio no cliente. Provas focadas e resultados/limites na
[onda 69](shared-api-host.md); integrações reais e aceite em aparelhos
pendentes.

## Operações administrativas Expo — onda 82 (2026-10-03, sem commit)

Logística/manutenção compartilham DTOs, carga, filtros, paginação e mapeadores
de calendário. Ícones/badges ficam em tipos.web; checklist e formatação são
comuns. Native permite detalhe/edição/status/fotos de logística e leitura/
agenda de manutenção. Fotos multipart usam HttpClient autenticado, com picker no
host e escopo revalidado após cada etapa.

Veículos AVAILABLE, motoristas ACTIVE, scheduled/includeOverdue=true e PATCHs
existentes preservados; nenhuma autorização/regra de backend mudou. Nova Entrega
e Agendar Manutenção mantêm o aviso anterior de desenvolvimento. Calendário
native funcional por recurso/dia não certifica grade/Gantt/gestos.

76 focados/62 Expo/183 web e gates/builds/exports locais aprovados. Aparelho,
visual e operação pendentes; API legada/scheduler ativos.
[Provas e limites](shared-api-host.md), onda 82; entrada 265 de issues.
