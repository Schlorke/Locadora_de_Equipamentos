# Criação da conta de recebimentos (subconta Asaas)

Estado em 2026-10-07, onda 134, sem commit. Procedimento de referência, não uma
autorização para executar operações reais. A criação está instalada nos dois
hosts atrás de `PLATFORM_SUBACCOUNT_CREATION`, desligada por padrão; ligá-la é
ato do lote S16. A ferramenta assistida de recuperação de chave e a liberação de
`BLOCKED` pelo backoffice (S12) ainda não existem.

Regras gerais, válidas em todos os casos:

- nunca colar chave, token de webhook, faturamento declarado ou celular em log,
  ticket ou documento; use só os ids internos da conta e da integração;
- nunca repetir `POST /accounts` à mão: um resultado incerto pode ter criado a
  conta, e a plataforma nunca repete o envio;
- o faturamento e o celular existem só enquanto o pedido ainda pode ser enviado
  (tabela `payment_account_provisioning_requests`, papel de plataforma) e são
  apagados em seguida; nenhum procedimento depende deles;
- a aprovação da conta vem só da verificação de saúde
  (`payment-accounts.health`) com os quatro estados `APPROVED`; antes disso,
  cobrança nova recebe 409 `PAYMENT_ACCOUNT_NOT_READY`.

## Estados de criação e quem age

| Estado (`lastErrorCode`)                                                             | Quem age                         | O que acontece                                                                                         |
| ------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `PROVISIONING` (nulo, `SUBACCOUNT_LOOKUP_UNAVAILABLE`, `SUBACCOUNT_CREATE_NOT_SENT`) | Worker de criação                | Pedido aceito ou ainda não enviado; nova tentativa com chave de entrega nova quando vence a espera     |
| `PROVISIONING` (`ROOT_CREDENTIAL_REJECTED`)                                          | Operação da plataforma           | A chave raiz foi recusada; o pedido espera 1 h e tenta de novo, sem bloqueio nem purga                 |
| `UNKNOWN` (`SUBACCOUNT_CREATE_PENDING`)                                              | Worker, depois inspeção          | Intenção gravada antes do POST; se o processo morreu, a inspeção GET-only assume depois de 5 min       |
| `UNKNOWN` (`SUBACCOUNT_CREATE_UNKNOWN`, `SUBACCOUNT_NOT_OBSERVED`)                   | Inspeção da onda 129             | Só consultas GET por CNPJ; nunca um POST novo                                                          |
| `KEY_RECOVERY_REQUIRED`                                                              | Operação assistida               | A conta existe no Asaas e a chave não está no cofre                                                    |
| `AWAITING_OWNER` (`WEBHOOK_UPDATE_PENDING`)                                          | Verificação de saúde             | Chave selada; a saúde troca o token do webhook embutido por PUT e projeta os estados                   |
| `AWAITING_OWNER`, `UNDER_REVIEW`, `REJECTED`, `RESTRICTED`                           | Dono e instituição de pagamentos | Envio de documentos e análise; a integração só fica `ACTIVE` na primeira aprovação completa            |
| `BLOCKED`                                                                            | Revisão (S12)                    | Só com conta remota envolvida ou falha de integridade (ver abaixo)                                     |
| `DISCONNECTED`                                                                       | Dono                             | Pedido cancelado sem conta criada; a oferta volta a ficar disponível com o desfecho do pedido anterior |

## `KEY_RECOVERY_REQUIRED`

1. Confirmar pelo painel de operação do Asaas (conta raiz) que a subconta com o
   CNPJ da locadora existe e que a referência gravada é a mesma.
2. Pedir ao suporte do Asaas a janela de gestão de chaves de subconta
   (`/accessTokens`, liberação temporária com IP fixo) para emitir uma chave
   nova.
3. A chave nova só pode ser selada pela ferramenta assistida futura (S12). Até
   lá, a conta permanece em revisão; não grave a chave em nenhum outro lugar.

## `UNKNOWN` prolongado

A inspeção consulta por CNPJ a cada 5 minutos e nunca cria conta. Se o estado
persistir, confirmar com o suporte do Asaas se a conta existe:

- existe: a inspeção a encontra e leva a `KEY_RECOVERY_REQUIRED` (seção acima);
- não existe, com confirmação escrita do suporte: a liberação para um novo
  pedido do dono depende da ferramenta do S12. Nunca repetir o POST à mão.

## `ROOT_CREDENTIAL_REJECTED`

Recusa da chave raiz (401/404 no POST, qualquer 4xx na busca) não é culpa da
locadora: nada é bloqueado nem apagado. Conferir `PLATFORM_ASAAS_ROOT_API_KEY` e
o ambiente no deploy; depois da correção, os pedidos seguem sozinhos na próxima
espera. A auditoria de plataforma `payment-account.provisioning.root-rejected`
registra cada ocorrência.

## Pedido devolvido ao dono (decisão D-3)

Recusa definitiva do Asaas sem conta criada (400, 403 ou outro 4xx no POST)
cancela o pedido: conta `DISCONNECTED` com `SUBACCOUNT_CREATE_REJECTED` (dados)
ou `SUBACCOUNT_CREATE_FORBIDDEN` (instituição), integração desligada e valores
apagados. Os códigos do provedor ficam só na auditoria
`payment-account.provisioning.rejected`. O dono vê o desfecho em linguagem
simples e pode pedir de novo, sempre por ato próprio. Um 403 pode indicar o
limite de subcontas do período de avaliação: tratar com o Asaas antes de
orientar o dono.

## `DOCUMENT_IN_USE`

Uma conta de recebimentos por CNPJ entre locadoras (posse do CNPJ, ADR B.8). O
pedido é recusado (409) ou cancelado antes do POST quando outra organização tem
o mesmo CNPJ verificado ou outra locadora já tem conta atual com ele. Revisar no
backoffice qual organização é dona do CNPJ; nunca criar uma segunda conta no
Asaas para contornar.

Depois da aprovação: se outra locadora já tinha o mesmo CNPJ verificado, a saúde
aprova a conta sem verificar o CNPJ e grava uma vez a auditoria de plataforma
`payment-account.document.in-use` (`DOCUMENT_IN_USE`). Revisar no backoffice
qual organização é dona do CNPJ; a conta segue emitindo até a decisão (bloqueio
administrativo do S12). Se as duas aprovações chegam no mesmo instante, a
segunda fica `RESTRICTED` com `ACCOUNT_CONFIGURATION_UNAVAILABLE` e, na
tentativa seguinte (5 min), cai nesse mesmo caso, sem ação manual. As outras
tentativas não verificadas com o mesmo CNPJ, que já existiam quando a primeira
foi verificada, não ganham auditoria: achá-las pelas organizações com o mesmo
CNPJ faz parte da revisão do S12.

## Confirmação pela saúde

Códigos que a verificação de saúde (`payment-accounts.health`) grava em
`lastErrorCode` com a conta `RESTRICTED`; nenhum deles verifica o CNPJ nem ativa
a integração:

- `ACCOUNT_DOCUMENT_MISMATCH`: o CNPJ do provedor difere do cadastro, ou as
  colunas `document` e `documentNormalized` da organização discordam entre si.
  Corrigir o cadastro; até lá nenhum CNPJ é gravado nem verificado.
- `COMPANY_DATA_CHANGED`: o CNPJ mudou durante a configuração; a próxima
  tentativa compara de novo com o provedor.
- `ACCOUNT_CONFIGURATION_UNAVAILABLE`: falha passageira (leitura ou banco); nova
  tentativa em 5 min.
- `WEBHOOK_CREATE_UNKNOWN`: só quando a criação do webhook da conta não foi
  confirmada por uma nova leitura. A saúde nunca repete o POST; se o webhook não
  aparecer na lista da conta, investigar no Asaas antes de qualquer ação.

## `BLOCKED` com conta remota

- `OWNER_CHANGED_DURING_PROVISIONING`: o dono mudou durante o POST. A chave foi
  selada, mas o e-mail de acesso no Asaas é do dono anterior: trocar o e-mail de
  acesso no Asaas antes de qualquer liberação.
- `TENANT_ARCHIVED_DURING_PROVISIONING`: a locadora foi arquivada durante o
  POST; a conta existe e precisa de decisão de encerramento.
- `SUBACCOUNT_REFERENCE_CONFLICT`, `SUBACCOUNT_REFERENCE_MISMATCH`,
  `SUBACCOUNT_KEY_CONFLICT`: referências do Asaas já usadas por outra conta ou
  chave ativa diferente; investigar antes de qualquer ação. Em
  `SUBACCOUNT_KEY_CONFLICT`, a chave emitida pela criação fica no cofre como
  pendente, sem substituir a ativa.
- `SUBACCOUNT_LOOKUP_INVALID`: a busca por CNPJ voltou ambígua ou malformada.
- `PROVISIONING_REQUEST_MISSING`: falha de integridade do pedido.

A liberação depende da ferramenta do S12.

## Interruptores

- `PLATFORM_SUBACCOUNT_CREATION=off` (ou ausente): a oferta fica indisponível e
  a manutenção, que roda sempre nos dois crons, **cancela** os pedidos ainda em
  `PROVISIONING` (nunca enviados) e os devolve ao dono. Valor diferente de
  `on`/`off` deixa a criação indisponível sem cancelar nada.
- Para pausar sem cancelar, usar `PLATFORM_ASAAS_OUTBOUND_DISABLED=true`: o
  envio vira "não enviado" e o pedido espera com os mesmos dados.
- `PLATFORM_ASAAS_SUBACCOUNT_MODEL` diferente do modelo do pedido cancela os
  pedidos não enviados (`MODEL_CHANGED`); `BAAS` fica indisponível até o lote de
  documentos.
- `PLATFORM_SUBACCOUNT_REQUIRES_PAID`: ausente vale `true`.

## Verificação esperada no deploy

`tools/platform-preflight.mjs` acusa contas de criação sem chave ativa
(`PAYMENT_ACCOUNT_SECRET_REQUIRED`); é intencional: a fiscalização comercial não
deve ser ligada com criação pendente.
