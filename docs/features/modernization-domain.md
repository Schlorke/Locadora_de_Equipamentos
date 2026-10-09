# Domínio compartilhado, reserva e ciclo da locação

## 1. Purpose

Concentrar cálculos universais e impedir reserva excessiva ou duplicação de
locações sob chamadas simultâneas. O produto atende várias locadoras
independentes. Os serviços exigem `TenantContext { tenantId }` explícito,
conferem a organização ativa, filtram IDs pelo tenant e validam o vínculo CLIENT
ativo do cliente. Papéis administrativos vêm da Membership resolvida para a
organização selecionada. Cobrança de locações não equivale a billing SaaS.

## 2. Scope

`packages/domain` contém regras de preço, tributo, reajuste, vencimento, datas,
frete, multa, formatação monetária e reserva. Os exports existentes do frontend
delegam ao pacote, preservando importadores. Cálculo puro não importa Next,
React, Prisma, Node ou transportes. A função de frete que consulta API continua
no frontend.

A aplicação transacional permanece em `lib/rental-converter.ts`,
`lib/rental-lifecycle.ts`, `lib/payment-processor.ts` e
`lib/equipment-availability.ts`. As rotas conservam as URLs e delegam suas
mutações a esses serviços.

## 3. Entry Points

- Conversão explícita, conversão pós-pagamento e aprovação AT_END.
- Criação manual, edição administrativa, checkout, checkin e prorrogação
  administrativa/do cliente.
- Consultas de disponibilidade e confirmação de pagamento.

## 4. Core Flow

UPFRONT e ON_DELIVERY reservam depois da confirmação dos pagamentos base. AT_END
reserva durante aprovação/conversão, sem exigir pagamento antecipado. Uma
locação manual PENDING reserva ao ser criada. ACTIVE, OVERDUE e PENDING_RETURN
continuam ocupando estoque; CANCELLED e COMPLETED liberam.

Locação só passa de PENDING para ACTIVE por checkout (inclusive a
compatibilidade do PATCH que pede ACTIVE). Essa operação valida pagamento quando
aplicável, disponibilidade e os quatro tipos de documento: ID_DOCUMENT, SELFIE,
SIGNED_CONTRACT e CPF_CNPJ_PROOF. Pagamento e assinatura isolados não ativam
locação. AT_END dispensa pagamento antecipado, mas exige os documentos no
checkout.

Conversão repetida retorna a mesma locação e repara o vínculo dos pagamentos em
uma transação. Não reabre locação cancelada. A conversão preserva tipos de
pagamento: cobranças de orçamento historicamente usam DEPOSIT, portanto DEPOSIT
e RENTAL compõem os pagamentos base; multas e danos não comprovam quitação da
locação.

## 5. Components

Não altera identidade visual nem cria componentes. O frontend mantém APIs
públicas explícitas como delegadores, sem uma segunda implementação dos
cálculos.

## 6. Data Contracts

`withRentalTransaction` adquire
`pg_advisory_xact_lock(hashtext('gb-locacoes:rental-mutations'), hashtext(tenantId))`
antes de ler e escrever reservas. A chave já é particionada pelo identificador
validado da locadora e serializa suas mutações em todas as instâncias da
aplicação. Não usa mutex em memória. O lock é transacional e termina no
commit/rollback; transações têm limite de 15 segundos. Conversão também trava a
linha do orçamento.

Disponibilidade usa datas individuais dos itens, com fallback para as datas
globais em registros antigos. Calcula o pico de quantidade simultânea, incluindo
todos os itens repetidos do pedido. Datas mantêm a convenção inclusiva
existente. Checkout e prorrogação excluem a própria locação na comparação.
Estoque zero permanece zero.

Datas alteradas e prorrogações atualizam itens e envelope global juntos. Os
preços diferentes já existentes da prorrogação administrativa e do cliente foram
preservados; os acumulados de dias/taxa são somados e a divisão do cálculo do
cliente considera ao menos um dia.

### Contexto público

POST `/api/quotes` exige `tenantSlug` no corpo, e GET
`/api/equipments/[id]/availability` exige o mesmo campo na query. Slug ausente
retorna 409; organização inativa/inexistente ou equipamento de outra locadora
retorna 404. O calendário utiliza a política canônica e não publica
identificadores de locações.

Cliente autenticado só é vinculado com Membership CLIENT ativa nessa locadora.
Um visitante anônimo cria orçamento com `userId=null`. A criação não altera
automaticamente os dados da identidade global. O código `Q-YYYY-NNNN` é
sequencial e único por locadora, não por toda a plataforma.

Entrega sem `Organization.postalCode` explicitamente configurado retorna 409 com
`code=DELIVERY_ORIGIN_NOT_CONFIGURED`; não herda CEP de outra empresa. O cálculo
de frete continua sendo a fórmula local de estimativa já existente, sem consulta
a transportadora real.

O tópico `quote.created.notify` é gravado com o orçamento e notifica somente
Memberships ADMIN/OPERATOR ativas da locadora, além da confirmação ao cliente.
Os cinco templates HTML recebem `EmailBranding` obrigatório no primeiro
argumento, sem cópia de markup. `loadTenantBranding(context)` lê
`Organization.name` e `Setting.publicBaseUrl`, ícone e contatos no tenant. A URL
deve usar HTTPS, sem credenciais, query ou fragmento; HTTP local só é aceito em
desenvolvimento/teste. Sem configuração, o evento falha e permanece recuperável.
Não existe fallback de marca ou URL para a empresa do código legado. O remetente
é configuração do transporte da plataforma; destinatários vêm do tenant e do
orçamento.

`/api/orcamentos` delega ao mesmo POST de orçamento, preservando URL e envelope
legado de sucesso. `/api/contact` exige `tenantSlug`, persiste a solicitação e
`quote.created.notify` com `kind=contact` na mesma transação, devolvendo 202 com
`deliveryStatus=queued`. Esse evento envia apenas o template de contato aos
administradores/operadores da locadora. Não usa destinatário global.

Os endpoints de reajuste e envio de reajuste exigem principal do tenant e gravam
`quote.adjustment.notify`. A resposta 202 informa `emailStatus=queued`; não
afirma entrega. O handler descarta versões substituídas e orçamentos rejeitados,
usa ID determinístico de notificação e chave de idempotência do provedor.
WhatsApp global não é chamado; `whatsappStatus=unavailable` explicita a ausência
da integração isolada nesse fluxo.

Reajuste financeiro trava a mesma chave da preparação de emissão para cada
pagamento, em ordem estável. Qualquer tentativa de emissão, ID externo ou
pagamento quitado bloqueia sobrescrita do valor com 409. Locação já convertida
exige fluxo de aditivo e também retorna 409. Reajuste de frete substitui o valor
anterior, atualizando `deliveryFee`, para que reajustes sucessivos não dupliquem
frete. As obrigações base ainda não emitidas são atualizadas na mesma transação.

O script `scripts/backfill-quote-codes.ts` exige `--tenant-id`; não carrega
dotenv, não atribui tenant a registros legados e começa em dry-run. Aceita
somente PostgreSQL local chamado `test` ou `test_*`. Escrita exige `--apply`,
`--confirm=backfill-quote-codes`, `--confirm-database=<nome>` e
`TEST_DATABASE_DISPOSABLE=true`. Usa o mesmo lock por tenant e uma transação
para o lote; sua execução não faz parte desta alteração.

### Catálogo, carrinho e permissões

Catálogo público e configurações públicas exigem `tenantSlug` na query. O DTO de
categorias/equipamentos continua sendo um array. `settings/public` preserva os
campos existentes, devolve 409 `SETTINGS_NOT_CONFIGURED` se não houver cadastro
e não preenche contatos, logo ou endereço com dados da empresa anterior.

Categorias, equipamentos, unidades e veículos administrativos usam o principal
ativo e permissões da locadora. Referências de outra empresa retornam 404. Slug
de categoria, código de unidade e placa de veículo são únicos dentro da
locadora. Carrinho é único por `(tenantId,userId)`; só Membership CLIENT pode
sincronizá-lo. Itens são validados antes de substituição, preços são
recalculados no servidor e merge/sync concorrentes usam o mesmo lock
transacional por cliente/locadora.

`Permission` é específica de tenant/role/module/action. A fachada administrativa
legada preserva `user.id`, mas deriva o papel da Membership ativa. Identidade
`User.role` não concede acesso ao tenant. Escritas de permissão substituem
somente as regras do papel selecionado na locadora.

Os antigos efeitos de Merchant e remoção de Storage nas mutações de equipamentos
usavam credenciais globais e foram retirados desses handlers. O CRUD local está
isolado; integração Merchant e coleta de arquivos órfãos ainda exigem
adaptadores por locadora e não são funcionalidades concluídas por este bloco.

### Financeiro e documentos

Entries, calendário, aging, receita, exportação, configurações financeiras,
dashboard e KPIs exigem principal e permissão FINANCIAL na locadora. Consultas e
agregados têm filtro tenant explícito e transação com contexto RLS. O cliente
vem do ClientProfile daquela empresa; User permanece identidade global.
Cobranças base RENTAL e DEPOSIT aparecem no financeiro, inclusive após
transferência para rentalId. Exportação mantém formatos CSV/XLSX/PDF e usa
Organization.name.

Confirmação manual chama o mesmo processador dentro da transação que grava os
metadados financeiros. Concorrência/duplicatas de PAID criam uma intenção
`quote.payment.convert`; atraso não rebaixa PAID. Quando o provedor informa
externalId, a identidade é comparada com transactionId vigente antes de qualquer
retorno ou efeito, inclusive em replay PAID. Divergência retorna 409
`PAYMENT_RECONCILIATION_REQUIRED`. A tentativa vinculada também recebe PAID.

PATCH de vencimento solicita reemissão durável e retorna 202 com operationId. O
vencimento, identificador e código antigos são preservados até confirmação do
cancelamento; pedido repetido não cria outra operação. SETTLED marca tratamento
operacional e não afirma cancelamento no provedor. DELETE de lançamento retorna
409 `FINANCIAL_HISTORY_PRESERVED`; DELETE de reajuste retorna 409
`ADJUSTMENT_HISTORY_PRESERVED`. Cancelamento/revisão financeira completos ainda
precisam de uma operação explícita, sem apagar histórico. O fluxo de revisão de
reajuste emitido não está concluído.

Ofício usa Organization.name/document/city/state e contatos/URL configurados no
tenant. Sem identidade legal retorna 409 `COMPANY_PROFILE_REQUIRED`. Pagamentos
convertidos resolvem o orçamento por rental.quote. Não há identidade GB embutida
no mapper.

O transporte Resend cancela o fetch real do SDK após 15 segundos usando
AbortSignal; não deixa envio executando após um Promise.race. Chave de
idempotência por evento continua enviada ao provedor. Não existe retry local sem
controle; o outbox continua responsável por recuperação.

O seed de catálogo agora usa o mesmo parser de manutenção segura, exige
`--tenant-id` e começa em dry-run sem conexão. Escrita só aceita banco
PostgreSQL local `test`/`test_*`, `--apply`, `--confirm=seed-catalog`,
confirmação do nome do banco e TEST_DATABASE_DISPOSABLE=true. Não cria usuário
administrador nem senha. Seed e backfill não foram executados.

## 7. Constraints

Nenhuma migração ou escrita em produção é executada por esta implementação. A
proteção por lock cobre os escritores da aplicação; integradores externos
precisam aderir ao mesmo protocolo. A constraint única parcial por
`(tenantId, quoteId)` e as FKs compostas foram adicionadas ao ledger expansivo e
validadas apenas em banco descartável. Dados históricos sem tenant continuam em
quarentena; não apagar nem atribuir registros para satisfazer constraints.

Orçamento convertido não permite edição direta de preços, itens, datas ou termos
que divergiria da locação/contrato aceito. A API retorna 409 e orienta o fluxo
de aditivo. A exclusão de orçamento com cobrança ou locação também retorna 409,
preservando histórico. Cancelamento é a operação adequada.

## 8. Error Handling

`RentalMutationError` carrega status HTTP, código e documentos faltantes.
Estoque insuficiente retorna 409; datas/quantidade inválidas e documentos
pendentes retornam 400. A falha na reserva AT_END aborta a aprovação e
alterações de itens. Uma falha posterior no checkout reverte alterações de datas
feitas na mesma transação.

Transições de pagamento são condicionais: PAID só nasce de PENDING/OVERDUE;
repetição é idempotente; atraso/cancelamento não rebaixam PAID; REFUNDED não
volta a PAID. Operações externas não devem executar dentro da transação de
reserva; intenções duráveis são integradas ao outbox do backend.

## 9. Performance

O lock é particionado pelo tenant validado e prioriza consistência dentro da
locadora. Não particionar locks sem medir contenção e definir ordenação
determinística para pedidos com vários equipamentos. Não manter transação aberta
durante chamadas de gateway ou envio de e-mail.

## 10. Tests

- 45 testes de caracterização existentes dos cálculos continuam passando após a
  extração.
- `tests/unit/rental-reservation.test.ts`: políticas de reserva, pagamento base
  e pico de sobreposição.
- `tests/unit/rental-concurrency.test.ts`: PostgreSQL local com múltiplas
  conexões; conversão concorrente, disputa pela última unidade, criação manual,
  AT_END, checkout, prorrogação com rollback, datas individuais, itens
  duplicados, estoque zero, transições de pagamento, isolamento entre locadoras,
  formulários públicos, marca, reajustes e reexecução de notificações. São 26
  cenários de banco e seis testes puros de reserva, todos com exit 0.
- `tests/unit/email-branding.test.ts`: quatro casos de identidade, URLs, assets
  e parametrização dos cinco templates.
- `tests/unit/quote-code-backfill.test.ts`: quatro casos da proteção do CLI, sem
  executar conexão ou backfill. Esses oito testes também passaram com exit 0.
- `tests/unit/catalog-tenancy.test.ts`: sete casos de catálogo, carrinho e
  permissões com duas locadoras, com exit 0.
- `tests/unit/financial-tenancy.test.ts`: oito casos HTTP/PG de isolamento,
  agregados, perfis locais, confirmação concorrente, reemissão pendente,
  histórico, configuração e identidade de ofício, com exit 0. O gerador binário
  do PDF é simulado; os dados e o mapper são reais.
- `tests/unit/resend-timeout.test.ts`: comprova abort no fetch simulado do SDK e
  preservação da chave de idempotência, com exit 0. Não envia e-mail externo.
- O teste de banco exige TEST_DATABASE_URL local cujo nome identifica teste e
  TEST_DATABASE_DISPOSABLE=true. Sem URL explícita a suíte de integração é
  ignorada. Ele cria/remove apenas suas próprias fixtures. Não usa credenciais
  de produção nem chama gateways.

## 11. Related

- [Sistema de orçamentos](quote-system.md)
- [Documentos do cliente](client-documents-antifraud.md)
- [Bloqueio de estoque anterior](quote-stock-blocking.md): a regra anterior
  limitada a pagamento é substituída pela decisão AT_END/manual descrita aqui.
- [Arquitetura de modernização](../architecture/modernization.md)

## 12. Change Log

2026-09-25: extração do domínio universal e centralização transacional da
reserva, conversão e ciclo da locação. Evidência de testes de banco é local e
descartável; não representa implantação nem migração de produção.
