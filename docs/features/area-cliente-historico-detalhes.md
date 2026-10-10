# Area do Cliente - Historico de Locacao (Detalhes)

## 1. Proposito

Pagina `/area-cliente/historico/[id]` exibe o resumo completo de uma locacao:
status, periodo, itens, pagamentos, entregas e totais finais para o cliente.

## 2. Fonte de Dados

- Endpoint: `GET /api/client/rentals/[id]`
- Modelos: `rentals`, `rental_items`, `quote`, `payments`, `deliveries`
- Atualizacao automatica: polling a cada 30s e refresh ao voltar para a aba
  visivel

## 3. Calculo de Totais

- **Total base**: usa o total final do orcamento quando existir.
  - Prioridade: `quote.finalTotal` -> `quote.total`.
- **Fallback**: se nao houver quote, usa o total recalculado pelos itens ou o
  total salvo na locacao.
- **Total a Pagar**: `displayTotal + lateFee` (com coercao numerica).
- **Desconto aplicado**: o bloco "Total" lista o desconto de cada equipamento
  (prioriza `quote.items.appliedDiscount`).

## 4. Exibicao de Periodo

- Quando os itens do orcamento possuem periodos diferentes, o bloco "Periodo de
  Locacao" lista inicio e termino por equipamento.
- Quando todos os itens compartilham o mesmo periodo (ou nao ha dados de
  `quote.items`), o bloco exibe o intervalo global da locacao.

## 5. Armadilhas a Evitar

- Somar valores Decimal como string (gera concatenacao, ex.: "60" + 0 = "600").
- Ignorar `quote.finalTotal` quando o admin ajustou o valor.
- Exibir apenas o periodo global quando existem itens com datas diferentes.

## 6. Como Validar

1. Abrir `/area-cliente/historico/[id]` com uma locacao de 1 dia.
2. Confirmar que "Total" e "Total a Pagar" refletem o orcamento final.
3. Confirmar que o bloco "Total" lista o desconto aplicado por equipamento.
4. Criar locacao com 2 itens em periodos diferentes e validar a listagem por
   equipamento no bloco de periodo.
5. Se houver multa, confirmar que a soma esta correta.

## 7. Historico de Alteracoes

| Data       | Descricao                                                | Autor |
| ---------- | -------------------------------------------------------- | ----- |
| 2026-01-09 | Refresh automatico com polling em background             | IA    |
| 2025-12-26 | Total a pagar passa a usar o total do orcamento          | IA    |
| 2025-12-26 | Periodo passa a listar itens quando datas sao diferentes | IA    |
| 2025-12-26 | Total passa a listar desconto aplicado por equipamento   | IA    |

## Isolamento multiempresa

As APIs exigem locadora explicitamente selecionada, membership ativa e titular
da locação. Lista/atividades/detalhe/remoção usam tenantId e userid; soft delete
continua limitado ao histórico do cliente. Solicitações de coleta/prorrogação
geram registro e alerta duráveis para os administradores da mesma locadora. Não
alteram datas ou status automaticamente. Verificação e limites estão em
[modernização da área cliente](../issues/modernization-client-portal.md).

## Host compartilhado — onda 34 (2026-10-02)

Lista/detalhe/remoção do histórico e pedidos de coleta/prorrogação também têm
adapters em apps/services/api. A composição usa os mesmos
createClientRentalPortal e createClientRentalRequests de backend/rentals. A
origem dos clientes permanece legada. Remoção é soft delete; pedido é
atendimento durável e deduplicado, sem alterar datas, status ou cobranças. O
schema estrito existente de prazo foi compartilhado em
contracts/rental-requests. Provas consolidadas e estado da onda em
[API compartilhada](shared-api-host.md).

## Visão geral Expo (onda 71, 2026-10-03, sem commit)

/area-cliente renderiza AreaClientePage.native da slice existente. O modelo
use-area-cliente foi extraído do web e é compartilhado: leituras privadas,
carrinho, preço por período, datas, precedência das locações, orçamentos,
atividades e dispensa local. Zero em finalTotal continua válido. A fachada de
storage usa AsyncStorage no nativo e mantém a chave anterior.

Páginas reiniciam por locadora/papel/slug/usuário/transporte; resposta e
restauração local antigas não alteram a nova tela. O web preserva estilos e os
nove helpers extraídos. Voltar/sair fica no host Expo.

Testes renderizados e exports das duas plataformas passaram. Histórico/detalhe,
orçamento, perfil, endereços e notificações ainda precisam de destinos nativos;
imagens do carrinho e aceite em aparelho permanecem pendentes. Não representa
paridade completa da área do cliente. Ver [onda 71](shared-api-host.md).

## Host compartilhado — atividades e prorrogação direta (onda 35)

GET /api/client/activities usa customers/activities nos dois hosts: mesma
transação, eventos, valores BRL, limite 1–100, ordenação e filtros de posse,
tenant e histórico visível. A query saiu do adapter legado para seu módulo dono.

POST /api/client/rentals/[id]/extend também está composto. Preserva prazo 1–30,
titular vigente, locação ACTIVE, lock, datas e cobrança PIX existentes. Esse
endpoint já altera a locação; request-extension é o pedido de atendimento e
permanece sem alteração automática. O comportamento não foi unificado durante a
extração. Os clientes continuam usando a origem legada. Provas consolidadas e
limites em [API compartilhada](shared-api-host.md), onda 35.

## Consumidores de visão geral e histórico — onda 64 (2026-10-03)

As duas páginas usam HttpClient do bootstrap: transporte de locação e orçamento
nas entidades correspondentes, atividades em entities/cliente. Lista/remoção
conservam DTOs, valores, filtros e soft delete por usuário/locadora. Busca e
status são locais; orçamento já convertido não aparece duplicado. Releitura após
remover e retry de erro mantêm o comportamento anterior.

Polling de 30 segundos e visibilitychange continuam somente com aba visível;
desmontagem encerra ambos. Troca de locadora/usuário reinicia a página e
resposta antiga não aplica dados, mostra sucesso nem inicia outra chamada. Abort
não desfaz uma gravação aceita pelo servidor. Dispensa de atividades permanece
local, na chave anterior, sem uma nova operação remota.

261 provas focadas e HTTP com cookies/RLS nos dois hosts/motores passaram, além
de tipos/gates/builds. Detalhe, pedidos/downloads/pagamentos e telas nativas
continuam no próximo corte; aceite visual/aparelhos ainda pendente. API legada e
agenda ativas. Ver a onda 64 de [API compartilhada](shared-api-host.md).

## Detalhe, ações e download — onda 65 (2026-10-03)

Detalhe e RentalActions agora usam o HttpClient do bootstrap e transporte das
entidades locação/orçamento. Prefixo quote_, envelopes, 404, confirmação de
cancelamento, totais/frete/multa, polling e refresh conservam os contratos. A
página reinicia por locadora/usuário/rota; o bloco de ações, por
locadora/usuário/locação. Respostas antigas não aplicam dados nem efeitos
locais.

O pedido request-extension envia additionalDays e não altera datas; a ação
extend envia extensionDays e continua sendo prorrogação direta. Coleta permanece
sem corpo. Diálogos do bloco de ações receberam o Portal que faltava e Trigger
renderizando Button, com textos/classes/estilos preservados.

Download usa responseType binary: blob totalmente consumido dentro do ciclo
capturado. Negativas/redirects mantêm o tratamento anterior; o nome
contrato-[id].html permanece inclusive após redirect para PDF, como dívida
separada. Abort não desfaz escrita já recebida nem substitui ownership/RLS.

211 casos focados e seis HTTP por motor nos dois hosts locais passaram, com
HTML/PDF e cookies/RLS reais, além de tipos/gates/builds. Serviços externos são
dublês locais; não há novo aceite de navegador/aparelho. Pagamentos, telas
nativas, SaaS e operação completa continuam pendentes. Ver onda 65 de
[API compartilhada](shared-api-host.md).

## Histórico e detalhes Expo — onda 72 (2026-10-03, sem commit)

As rotas /area-cliente/historico e /area-cliente/historico/[id] usam páginas
nativas das slices existentes. Web e native compartilham modelos, preços e
timeline, com busca/status/deduplicação, confirmação de remoção e resposta
tardia descartada. Zero, Decimal, frete incluído, multa e código do orçamento
permanecem. Polling de 30 segundos só em primeiro plano; retorno à atividade
recarrega e desmontagem remove timer/listener.

Detalhe envia extensionDays à extensão direta (1–30); RentalActions envia
additionalDays ao pedido de atendimento. Coleta sem corpo. Download usa blob
autenticado da entidade e callback do host para cache/compartilhamento. Nenhum
endpoint/regra do backend mudou.

153 casos focados únicos, testes dos hosts, tipos/lint/gates e builds
web/Android/iOS aprovados. Source maps confirmam módulos nativos; atributos e
cálculos web preservados por AST. Recebimento real de contrato/aparelhos e
demais destinos nativos continuam pendentes. Ver [onda 72](shared-api-host.md).

## Moldura da área do cliente no host web — onda 135 (2026-10-08, sem commit)

Toda página de `/area-cliente/**` no host da locadora entra na moldura da área
do cliente: menu lateral (Dashboard, Notificações, Meu Perfil, Meus Orçamentos,
Endereços, Suporte e Sair), contador de notificações não lidas, diálogo de saída
e o atalho do painel para quem é da equipe da locadora (papel do vínculo). A
composição é o `AccountLayoutShell`
(`packages/frontend/src/app/providers/AccountLayoutShell.web.tsx`, camada app),
que monta o `AreaClienteLayout` preservado da raiz antiga
(`app/area-cliente/layout.tsx`, retirada em F). O owner atual que escolhe essa
moldura é `apps/clients/web/src/app/(public)/[locadora]/(account)/layout.tsx`:
em legacy responde `notFound()`, e no modo de área do cliente habilitada monta
`AccountLayoutShell`. Isso não transforma o wrapper retirado em fonte atual.
Antes dela, o host web só aplicava o `noindex` e o portão de modo, e as páginas
apareciam sem o menu. Sessão e vínculo continuam com o portão da área privada
(`PrivateAreaGate`). Provas: `AccountLayoutShell.web.test.tsx`,
`(account)/layout.test.tsx` e os cenários `conta/*` da linha de base visual.
