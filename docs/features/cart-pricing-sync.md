# Sincronizacao automatica de precos do carrinho

## Resumo

- Evita que carrinhos persistidos usem descontos percentuais quando o admin
  definiu valor direto para um periodo (ex.: semanal).
- A pagina `/orcamento` agora reidrata os itens com os dados mais recentes de
  `/api/equipments`, incluindo flags `*UseDirectValue` e valores diretos por
  periodo.
- A UI do `/orcamento` recalcula imediatamente os valores ao alterar dias e
  exibe o metodo correto (valor direto x desconto) sem mensagens conflitantes.

## Problema

- Carrinhos salvos no localStorage antes da configuracao de valor direto nao
  tinham `weeklyDirectValue`/`weeklyUseDirectValue`.
- Resultado: o calculo inteligente caia para o desconto percentual e exibia
  totais incorretos (ex.: 7 dias = R$ 630,00 em vez de R$ 400,00).

## Solucao implementada

- Novo metodo `hydrateItems` no `useCartStore` permite substituir o estado
  persistido por itens atualizados.
- Efeito em `/orcamento` faz uma sincronizacao unica quando ha itens no
  carrinho:
  - Busca o catalogo em `/api/equipments`.
  - Monta um mapa por `equipmentId`.
  - Atualiza preco base, descontos e valores/flags diretos
    (daily/weekly/biweekly/monthly) preservando `quantity` e `days`.
- O calculo inteligente aceita `directValue` igual a zero sem cair para o modo
  de desconto (apoia cenarios promocionais/gratuitos) e zera o desconto quando
  `*UseDirectValue` esta ativo para evitar mensagens incorretas.
- Motor de pricing centralizado em
  `packages/frontend/src/entities/equipamento/model/preco.ts` com funcoes puras
  (`getPricingConfig`, `calculateIntelligentPrice`, `sanitizeCartItemPricing`) e
  testes unitarios cobrindo valor direto, desconto e saneamento de dados.
- Regra de valor direto: aplica por periodo completo e dias excedentes usam
  valor proporcional ao proprio periodo (ex.: semanal R$ 400 -> dia 8 cobra
  400 + 1/7 desse valor). Ao cruzar para o proximo limiar (15 dias, 30 dias), a
  logica muda automaticamente para o novo periodo configurado (desconto ou valor
  direto), atualizando badges e resumo em tempo real.

## Fluxo

1. Usuario abre `/orcamento` com itens persistidos.
2. Efeito dispara GET `/api/equipments`.
3. `hydrateItems` aplica valores diretos e descontos atuais aos itens.
4. Totais, badges e emails passam a refletir o valor direto configurado no
   admin.

## Como validar

- Configure um equipamento com `weeklyUseDirectValue=true` e
  `weeklyDirectValue=400` no admin.
- Adicione o item ao carrinho e recarregue `/orcamento`.
- Espere a sincronizacao (1 chamada a `/api/equipments`) e confirme:
  - Resumo mostra total de 7 dias = R$ 400,00.
  - Badge/descricao exibem "Valor direto" em vez de desconto percentual.
- Opcional: use um carrinho salvo antes da mudanca e verifique que o total
  corrige apos o carregamento da pagina.

## Observacoes

- Se a chamada a `/api/equipments` falhar, o carrinho permanece com os valores
  atuais (nenhum item e perdido).
- Novos itens adicionados ja chegam com os campos diretos preenchidos; o sync
  cobre somente carrinhos antigos/persistidos.
- UI do `/orcamento` nao depende mais de `finalPrice` inicial: todos os valores
  exibidos e enviados (resumo, WhatsApp, badges) usam o resultado atual do motor
  inteligente conforme o numero de dias.
- Desde as ondas 6 e 7, o motor calcula em Decimal a partir do texto exato
  (`exactIntelligentPrice` em `packages/domain/src/equipamento/preco.ts`, que
  `entities/equipamento/model/preco.ts` reexporta); `calculateIntelligentPrice`
  devolve a unidade arredondada em centavos (`ROUND_HALF_UP`). O subtotal de
  cada item e o "Total Estimado" (`getTotalPrice`, soma em Decimal) usam
  `buildQuotePricing(...).total`: preco exato × quantidade, arredondado uma vez,
  igual ao servidor. `finalPrice` nao entra em nenhum total
  (`docs/features/quote-system.md`, secao 4.4).
- Descontos so aparecem quando realmente aplicados; configuracoes de valor
  direto exibem mensagem e montante correspondentes.

## API do carrinho por locadora (corte 24, 2026-10-02)

Naquele corte, o adapter antigo (`app/api/cart`, retirado em F) e o serviço
parcial (`apps/services/api/src/app/api/cart`) compunham a mesma factory
`createCustomerCartService` de backend/customers. Clientes, origem e scheduler
ainda eram legados naquele registro; não havia cutover.

Hoje o dono HTTP é `apps/services/api/src/app/api/cart`; a composição está em
`apps/services/api/src/host/customers.ts` e a implementação em
`packages/backend/src/modules/customers/cart.ts`. Os consumidores FSD usam o
HttpClient configurado nos hosts web/Expo; não há encaminhamento à raiz
retirada.

### Contratos observados e preservados

- GET `/api/cart/sync`: devolve o carrinho completo com
  items/equipment/category, ou `{ items: [] }` sem criar carrinho. A leitura não
  recalcula preços antigos.
- POST `/api/cart/sync`: recebe `{ items }`, substitui os itens e responde
  `{ message: 'Carrinho sincronizado com sucesso' }` (200).
- POST `/api/cart/merge`: recebe `{ localCartItems }`, mantém os demais itens,
  atualiza quantidade/dias dos repetidos e devolve o carrinho completo. Não soma
  a quantidade local à persistida.
- Apenas o papel CLIENT do vínculo pode usar o carrinho; ADMIN global não
  substitui membership. Sessão, organização, seleção, vínculo e CSRF são
  revalidados pelo principal existente; nenhuma locadora é escolhida por padrão.
- Até 200 itens distintos; quantidade inteira de 1 a 10000 e dias inteiros de 1
  a 3650. Array vazio é aceito, com semântica distinta em replace e merge.
- Campos extras, preços, tenantId, userId e cartId enviados pelo cliente não
  determinam preço, identidade ou relação. O catálogo da locadora e
  `buildQuotePricing` fornecem os preços, com arredondamento da linha em
  Decimal.
- Escrita em transação RLS com trava PostgreSQL por locadora/usuário. Falha após
  apagar ou atualizar itens desfaz o conjunto; registros estrangeiros e sem
  tenantId continuam isolados. FKs compostas impedem relações cruzadas.
- Erros de domínio preservam 400/403/404; erros genéricos são 500 com mensagens
  próprias de sync/merge. JSON malformado ou `null` permanece 500, como
  observado no legado, sem alteração funcional durante a extração.
- GET/POST de sync mantêm HEAD/OPTIONS automáticos; merge mantém somente POST e
  OPTIONS. Métodos não implementados continuam 405.

### Caracterização e evidências

Na caracterização do corte24, `tests/unit/cart-api.test.ts` exercitava ambos os
adapters sobre o serviço real, com transação simulada. Após F, o teste consome o
adapter canônico da API; o arquivo da raiz antiga não é pré-requisito.
`tests/api-host/cart.http.test.ts` compara HTTP com cookies reais, PostgreSQL
RLS FORCE e papel temporário sem ownership/bypass, incluindo concorrência,
espera real em pg_locks, rollback, preços e FKs. Relatório, comandos e
resultados: corte 24 de `shared-api-host.md`.

### Integração dos consumidores (onda 61, 2026-10-03, sem commit)

O hook antigo não tinha consumidor e enviava a chave errada para merge. Agora
`features/carrinho/model/sincronizar.ts` é universal e é composto pelo
`RuntimeBootstrap`, pelos índices públicos web/native da feature. A lógica de
negócio e a validação continuam no backend/domínio; o frontend coordena HTTP e
persistência, sem copiar regras de preço.

- Só sincroniza CLIENT confirmado quando o carrinho local está aberto para a
  locadora/usuário corretos e o vínculo corresponde à locadora da rota. No host
  usa sua origem, sem header de seleção; no cliente Expo captura x-tenant-id da
  seleção validada. Visitante, papéis administrativos e seleção divergente da
  vitrine não iniciam chamadas de carrinho.
- Primeira mesclagem usa `{ localCartItems }`, só com equipmentId/quantity/days,
  e aplica a resposta inteira. Aparelho vazio usa GET. Carrinho já sincronizado
  e sem edição usa GET, respeitando mudanças feitas em outro aparelho.
- Depois da carga, edições e remoções usam `{ items }` em POST sync, com espera
  de 300 ms e uma escrita por vez. Mudança só de preço/metadata não regrava o
  servidor. Não há mesclagem automática do carrinho anônimo após login: a
  separação locadora/usuário existente foi preservada.
- O store persiste remoteReady/remotePending e intenções de remoção/limpeza
  anteriores à primeira resposta. Retry ou reabertura respeitam a intenção
  local, inclusive quando a primeira mesclagem foi gravada e a resposta se
  perdeu. Na recuperação, itens somente remotos continuam preservados. Carrinhos
  antigos sem essas marcas continuam legíveis.
- O token de abertura do escopo e AbortController invalidam respostas antigas,
  inclusive numa ida e volta à mesma locadora. Adições, mudanças e remoções
  feitas durante a leitura são conciliadas sem perder itens somente remotos.
- A rota com awaitSession aguarda a carga inicial. Falha abre o conteúdo com o
  estado local e mostra aviso/tentativa explícita; falha sozinha não dispara
  retries ilimitados. Os filhos do navegador não são substituídos.
- O mapper recebe o preço base do equipment, descontos e valores/flags diretos,
  incluindo strings decimais e zero. A taxa pricePerDay da linha já foi ajustada
  no servidor e não deve receber desconto novamente. Datas e escolha de fim de
  semana que pertencem ao aparelho são conservadas. Totais seguem
  buildQuotePricing, sem fórmula duplicada.

Provas: 154 testes focados do carrinho/providers; 112 HTTP com legacy e outros
112 com Better Auth, contra ambos os hosts de produção locais. O consumidor real
usa HttpClient, cookies e PostgreSQL com RLS; uma prova descarta a resposta de
uma mesclagem já gravada antes de remover/recarregar/reconciliar. Build web,
bundles Android/iOS e tipos aprovados. Renderização automatizada usa jsdom;
bundle não certifica execução em aparelho ou aceite visual. Relatório completo
na onda 61 de `shared-api-host.md`. O restante SaaS/mobile e as dívidas de
pricing já registradas continuam no escopo geral.
