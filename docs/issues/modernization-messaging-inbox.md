# Inbox durável e mensageria por locadora

## Recibos autenticados

Cada endpoint externo é específico de integrationId. Depois de autenticar o
corpo bruto uma única vez, a API grava WebhookInbox e outbox `webhook.process`
na mesma transação. A chave é integrationId/eventKey; na ausência de ID de
evento há SHA256 do corpo. Reutilizar o ID com bytes diferentes retorna409. O
hash não contém o segredo de autenticação.

O consumo imediato preserva a resposta HTTP existente. Lease com token restringe
concorrência; processedAt evita repetir eventos concluídos. Falha mantém o job
persistido para retry do cron; recibo/outbox indisponíveis impedem efeitos.
`runWebhookInboxEffect` revalida a integração e a locadora ativa antes de usar
os mesmos consumidores. Payloads inválidos não geram retry infinito; referência
ainda não persistida pode ser repetida. Após os limites do dispatcher, a falha
fica para operação/reconciliação.

Os consumidores ficam em `lib/security/webhook-consumers/`. Não fazem envio
externo síncrono. Confirmação financeira/conversão gera seu outbox de domínio;
assinatura gera arquivamento privado. Corpo aceito é limitado a2MB. Payloads
persistidos podem conter dados pessoais e ficam sujeitos a RLS; política de
retenção ainda precisa de operação explícita.

## Tentativas financeiras

PAYMENT_DELETED confirma cancellationStatus da tentativa correspondente; não
cancela a obrigação Payment. Registry histórico é preservado. PAID de tentativa
antiga é registrado como reconciliação necessária sem quitar a tentativa
vigente. `processPayment` recebe externalId e verifica a referência dentro da
transação. Overdue/refund condicionam também transactionId no UPDATE, evitando
corrida com reemissão.

## WhatsApp

Painel, mensagens e badges usam membership ADMIN/OPERATOR e contexto tenant em
todas as queries. A integração WHATSAPP ativa resolve phone number ID e
credencial por referência da locadora. Não existe fallback às variáveis globais
antigas.

Mensagem de saída é persistida antes do envio. Resposta sem ID
confirmado/timeout mantém status unknown; não há ID fictício ou retry automático
do POST. A interface precisa apresentar esse estado para reconciliação humana
antes de reenviar. Status recebidos e mensagens de entrada ficam no mesmo
tenant/integration binding.

## Zoho Mail

Grant OAuth é único por tenantId/userId, inclusive para a mesma identidade
global em duas locadoras. State usa nonce em cookie HttpOnly e hash persistido
com userId/tenantId, validade10min e consumo único antes da troca de tokens.
Trocar a locadora selecionada invalida o callback anterior. Desconectar remove
somente o grant selecionado.

As rotas leem/renovam tokens no contexto tenant e rejeitam accountId diferente
do grant salvo. Data center usa allowlist e não muda implicitamente no refresh.
O client OAuth da plataforma continua configurado pelo ambiente; o grant de
acesso à caixa pertence à locadora/usuário. Não há fallback a grant global.

Requisições não seguem redirects com credenciais. Caminhos arbitrários/externos
no client são recusados. Downloads de anexos/inline recebem sandbox e nosniff;
respostas privadas não são cacheadas. Idempotency keys do composer incluem
locadora/usuário/operação. Auditoria de envio usa transação tenant sem conteúdo
do e-mail nos logs de sucesso.

## Verificação e limites

- Segurança isolada na rodada anterior:165 testes/8 arquivos PASS com providers,
  storage e banco mockados; sem setup global.
- Banco real:17 testes/2 arquivos PASS no PostgreSQL descartável local55437
  (BetterAuth, imutabilidade, FKs, dedupe por integração e grants Zoho
  separados). Fixtures deste bloco usam rollback.
- Lint deste bloco sem warnings; nenhum envio, OAuth real, gravação em storage
  real ou alteração de produção foi executado.
- APIs ainda não migradas impedem a publicação multiempresa. Essa quarentena é
  uma restrição de rollout; não há allowlist global bloqueando esses handlers em
  runtime. O checker de RLS/runtime não substitui ACL, filtros e migração dos
  serviços. Não há evidência de OAuth nativo/provedores reais ou tenant em
  produção.
