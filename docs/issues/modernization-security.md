# Segurança: operações, webhooks e crons por locadora

## Causa e correção

A superfície HTTP antiga permitia bootstrap administrativo e manutenção de
storage sem autorização. Crons aceitavam configurações ausentes ou padrões de
desenvolvimento. PIX/ZapSign liam o corpo duas vezes; eventos atrasados podiam
rebaixar pagamentos PAID. A evolução para várias locadoras também exige resolver
a integração e o recurso pelo vínculo persistido, sem confiar no tenant enviado
pelo chamador.

Os métodos existentes de `/api/admin/seed-admin`, `/api/test-login`,
`/api/fix-storage` e `/api/supabase-setup` agora retornam 410 sem carregar banco
ou storage. Os oito crons exigem `Authorization: Bearer <CRON_SECRET>`: ausência
de configuração retorna 503 e autenticação incorreta retorna 401.

Sete crons enumeram somente organizações ACTIVE e passam contexto explícito para
as operações. Cada acesso de negócio usa transação com `app.tenant_id` LOCAL.
`sync-google-merchant` fica em quarentena (503 mesmo autenticado): o serviço
antigo usa credenciais globais e ainda precisa de integração específica por
locadora.

## Webhooks

As URLs anteriores, sem vínculo de integração, retornam 410. Configure:

- `/api/payments/pix/webhook/<integrationId>`
- `/api/payments/boleto/webhook/<integrationId>`
- `/api/contracts/zapsign-webhook/<integrationId>`
- `/api/webhooks/whatsapp/<integrationId>` (POST e GET de verificação Meta)

`TenantIntegration` deve estar ACTIVE, com organização ACTIVE e provedor correto
(PIX, ASAAS, ZAPSIGN ou WHATSAPP). Seu `credentialsRef` aponta explicitamente
para `env:LOCADORA_INTEGRATION_<NOME>`. O adaptador atual lê somente variáveis
desse vínculo: sufixos `_SECRET`, `_VERIFY_TOKEN`, `_API_KEY` e `_ENVIRONMENT`
conforme a operação. Não há fallback aos antigos segredos globais. Referência
desconhecida ou segredo ausente falha fechado. Outro secret store pode
substituir esse port. Provisionar os valores reais continua uma tarefa
operacional externa.

PIX usa HMAC SHA-256 hexadecimal em `x-webhook-signature`; ZapSign usa
`x-zapsign-signature`. WhatsApp exige `x-hub-signature-256` com prefixo
`sha256=`. Boleto aceita o mesmo HMAC ou token exato nos headers
`asaas-access-token`, `access_token` ou `x-hook-token`. Tokens em URL não são
aceitos. O corpo bruto é consumido uma vez; JSON/payload inválidos retornam 400.

Somente após autenticar o evento o handler consulta `ExternalResourceTenant`:
PAYMENT por referência externa PIX/Asaas; CONTRACT por `doc_token`. A consulta
inclui integração, provedor e tenant persistidos. `resourceId` do registro é o
único alvo permitido, e as operações subsequentes usam contexto dessa locadora.
O campo `tenantId` de um payload não autoriza acesso. WhatsApp compara o número
`metadata.phone_number_id` com `TenantIntegration.externalAccountId`, e persiste
conversas/mensagens com chaves compostas por tenant.

Eventos de atraso/cancelamento usam UPDATE condicionado ao estado atual; não
rebaixam PAID, inclusive sob concorrência. Somente estorno confirmado produz
REFUNDED; pedido/processamento/recusa de estorno Asaas preservam PAID. O cron
não marca OVERDUE depois de confirmar o mesmo boleto. Verificação de boleto usa
a integração registrada e suas credenciais, com ambiente Asaas explícito.
Assinatura confirma contratos DRAFT/SENT, sem alterar contratos já assinados.
Pagamento ou assinatura não ativam locações; ACTIVE depende do checkout.

## CLI de manutenção

`scripts/security/maintenance.mjs` não carrega `.env` automaticamente. Recebe
credenciais exclusivamente do ambiente, sem imprimi-las. O modo padrão é dry-run
sem conectar a serviços.

- `node scripts/security/maintenance.mjs provision-admin` valida DATABASE_URL,
  BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD (mínimo 12 caracteres).
  Aplicado, cria apenas conta global nova com bcrypt 12. Não promove conta
  existente nem concede membership em locadora; User.role global não autoriza
  recursos tenant.
- `node scripts/security/maintenance.mjs setup-storage` valida
  NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. Aplicado, cria somente o
  bucket de imagens ausente, sem alterar políticas RLS/buckets existentes. Não
  oferece reset destrutivo ou teste público de upload.

Aplicar exige `--apply --confirm=<operacao>` e, fora de loopback,
`--allow-remote`. Nenhuma dessas operações foi aplicada nesta implementação.

## Validação

```sh
node node_modules/vitest/vitest.mjs run --config vitest.security.config.ts
```

A configuração isolada não carrega o global setup legado. Os testes importam os
handlers e parsers reais; substituem banco, gateway, e-mail e serviços de
domínio. Fetch externo é bloqueado. Cobrem autenticação, efeitos após
autenticação, leitura única, handshake, transições, seleção explícita de tenant,
membership revogada, registry de integração e impossibilidade de usar segredo de
outra locadora. Resultado deste bloco: 104 testes passaram em 4 arquivos (exit
0).

Arquivos principais: handlers listados, `lib/security/*`, `lib/tenant.ts`,
`lib/quote-validity.ts`, `lib/late-fee-calculator.ts`,
`lib/payment-gateways/asaas.ts`, CLI e `tests/security/*`. As rotas legadas
ainda não migradas para tenancy bloqueiam a publicação multiempresa. Quarentena
nessa orientação é restrição de rollout; não existe bloqueio global de rotas
legadas em runtime. Este bloco não autoriza ativar a plataforma multiempresa.
Não houve deploy, escrita em banco remoto ou chamada real a provedores.

## Verificação periódica de boletos

O cron exige autorização, enumera organizações ativas e mantém contexto RLS por
locadora. PAID exige valor confirmado igual à obrigação e externalId ainda
vigente dentro da transação. Cancelamento do provedor altera apenas a tentativa;
não elimina a obrigação. OVERDUE/REFUNDED condicionam tenantId e transactionId
no UPDATE. Conversão após pagamento segue o outbox de domínio.

A rota declara maxDuration300, orçamento180s e reserva60s antes de iniciar uma
consulta. HTTP Asaas usa timeout12s e não segue redirects. Um checkpoint
append-only no AuditLog registra o último Payment.id tentado; a próxima chamada
retoma depois dele e volta ao início ao esgotar IDs pendentes. Outro marcador
por organização registra execução e ordena a próxima rodada por execução mais
antiga, incluindo organizações nunca executadas primeiro. Funciona mesmo com
cron diário no mesmo horário. Leitura dos marcadores passa pela transação RLS de
cada tenant, sem leitura global dos dados de negócio. Falhas também avançam o
marcador para que uma cobrança problemática não impeça progresso das demais.

O deploy deve oferecer maxDuration de pelo menos300s para essa configuração, ou
reduzir orçamento/reserva/lote de forma consistente. Checkpoints de execução são
metadados operacionais; retenção precisa preservar o mais recente de cada
locadora/cron. Não houve deploy nem medição de provedores reais.
