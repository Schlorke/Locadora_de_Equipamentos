# Admin Orçamentos Page - Documentação

## 1. Propósito

Página administrativa para gerenciamento de orçamentos do sistema GB Locações.
Permite visualizar, aprovar, rejeitar e gerenciar todos os orçamentos enviados
pelos clientes.

**Localização**: `packages/frontend/src/pages/orcamentos-admin`; hosts web/Expo
em `/admin/orcamentos`.

## 2. Lógica de Funcionamento

### 2.1 Visão Geral

A página oferece três modos de visualização:

- **Kanban**: Pipeline visual com colunas por status
- **Tabela**: Lista tradicional com filtros
- **Calendário**: Visualização temporal web; agenda adaptada no Expo.

Campo de busca unificado (Tabela/Kanban):

- Nome do cliente
- Email/telefone
- `quoteCode` (ex.: `Q-2026-0001`)
- `legacyExternalCode` (quando existir)
- A rota aceita `?search=...` para abrir a tela ja filtrada por link externo
  (ex.: vindo de `/admin/financeiro`).

### 2.2 Estados Principais

```typescript
// Estados de dados
const [quotes, setQuotes] = useState<Quote[]>([])
const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)

// Estados de filtro
const [statusFilter, setStatusFilter] = useState<string>("PENDING")
const [periodFilter, setPeriodFilter] = useState<string>("all")
const [valueFilter, setValueFilter] = useState<string>("all")

// Estados de ação
const [isUpdating, setIsUpdating] = useState(false)
const [updatingAction, setUpdatingAction] = useState<
  "approved" | "rejected" | null
>(null)
const [isDeleting, setIsDeleting] = useState(false)
const [isGeneratingBoleto, setIsGeneratingBoleto] = useState(false)
const [isSendingBoleto, setIsSendingBoleto] = useState(false)
const [isSendingAdjustedQuote, setIsSendingAdjustedQuote] = useState(false)

// Estados de dialogs aninhadas
const [showDeleteDialog, setShowDeleteDialog] = useState(false)
const [showPriceAdjustmentDialog, setShowPriceAdjustmentDialog] =
  useState(false)
const [showLateFeeDialog, setShowLateFeeDialog] = useState(false)
const [nestedDialogOpen, setNestedDialogOpen] = useState(false)
```

### 2.3 Fluxo de Aprovação/Rejeição

1. Admin abre modal de detalhes do orçamento
2. Admin clica em "Aprovar Orçamento" ou "Rejeitar Orçamento"
3. Sistema mostra loading **apenas no botão clicado**
4. Ambos os botões ficam desabilitados durante a operação
5. API registra aprovacao (approvedAt/approvedBy):
   - `UPFRONT/ON_DELIVERY`: mantem status `PENDING` ate confirmacao do pagamento
   - `AT_END`: aprova operacionalmente e pode converter em locacao sem pagamento
     inicial
6. Toast de sucesso/erro é exibido
7. Lista de orçamentos é atualizada

> **Quando há ajuste de valor**: o botão "Aprovar Orçamento" é substituído por
> "Enviar Orçamento Ajustado", que envia o orçamento ajustado com justificativa
> ao cliente e mantém o status PENDING.

### 2.4 Sistema de Loading de Botões

**Padrão Implementado (Dez 2025):**

- `isUpdating`: Controla se alguma operação está em andamento (desabilita
  botões)
- `updatingAction`: Identifica QUAL ação está em andamento
  (`'approved' | 'rejected' | null`)
- `isSendingAdjustedQuote`: Controla o loading do botão "Enviar Orçamento
  Ajustado"

```tsx
// Botão Rejeitar - mostra loading apenas quando updatingAction === 'rejected'
<Button disabled={isUpdating}>
  {updatingAction === 'rejected' ? 'Rejeitando...' : 'Rejeitar Orçamento'}
</Button>

// Botão Aprovar - mostra loading apenas quando updatingAction === 'approved'
<Button disabled={isUpdating}>
  {updatingAction === 'approved' ? 'Aprovando...' : 'Aprovar Orçamento'}
</Button>
```

### 2.5 Fluxo de Boleto

1. Orcamento criado -> sistema tenta gerar boleto automaticamente (status
   PENDING) se CPF/CNPJ e total > 0
2. Admin abre o modal e visualiza dados do boleto (linha digitavel, PDF)
3. Se nao houver boleto (ex.: sem CPF/CNPJ), admin aprova e pode clicar em
   "Gerar boleto"
4. Admin revisa dados (valor, vencimento, linha digitavel)
5. Admin envia o boleto para o cliente
6. Cliente recebe email e ve o boleto na area do cliente
7. Pagamento confirmado (Asaas) muda status para APPROVED

**Protecao de duplicidade**:

- Frontend aplica lock por `quoteId` durante clique em "Gerar boleto".
- Backend executa geracao transacional e idempotente para evitar duplicidade em
  cliques rapidos/concorrentes.
- Quando houver substituicao de cobranca (novo valor), o backend tenta cancelar
  a cobranca anterior no gateway antes de vincular a nova transacao.

**Acoes no modal**:

- **Abrir boleto**: Abre o PDF em nova aba quando existir
- **Gerar boleto**: Cria ou reutiliza o boleto no gateway
- **Enviar boleto**: Dispara email + notifica o cliente
- **Alterar vencimento**: Atualiza a data de vencimento do boleto no gateway e
  no banco, direto no modal do orcamento

### 2.6 Altura e scroll do Kanban

- Colunas do Kanban usam `max-height` com `min()` para respeitar viewport e
  limitar o bloco a **no maximo 4 cards**, com `overflow-hidden` no wrapper.
- O corpo da coluna mantem `flex-1/min-h-0` e o container de cards aplica
  `max-height` para 4 cards + `overflow-y-auto` condicional (apenas quando
  houver 5+ cards) e `scrollbar-gutter: stable`, concentrando o scroll interno
  sem piscar na montagem.
- Ao ajustar layout/estilo, preserve os limites de altura e o
  `scrollbar-gutter stable`; remover `max-height`/`overflow-hidden` ou aplicar
  scroll sempre ligado reintroduz piscadas de scrollbar global.
- Em busca ativa no Kanban, o ajuste automático de mês deve ocorrer no mesmo
  ciclo de atualização dos dados da busca para evitar estado transitório com
  colunas vazias.
- O wrapper de altura animada do Kanban deve consolidar a medição inicial no
  mount para permitir animação já na primeira busca digitada.

### 2.7 Exclusao de orcamento aprovado

- O botao de acao extra (outline, texto vermelho) abre a confirmacao de exclusao
  permanente para orcamentos com aprovacao registrada (`approvedAt`) ou status
  `APPROVED`.
- O clique dispara o dialog de confirmacao padrao e chama
  `DELETE /api/admin/quotes/[id]`, removendo o registro e seus itens associados.
- O estado de loading usa `isDeleting` para desabilitar botoes e exibir
  `Excluindo...` no rotulo.

### 2.8 Condicao de Pagamento (`paymentTerms`)

- O modal de detalhes expõe a seleção:
  - `UPFRONT` (antecipado)
  - `ON_DELIVERY` (na entrega)
  - `AT_END` (no fim da locação)
- Ao aprovar com `AT_END`, o backend pode converter o orçamento sem pagamento
  inicial e sem autogerar boleto nessa etapa.
- `UPFRONT` continua sendo o padrão de novos orçamentos.

## 3. Arquitetura e Dependências

### Arquivos Relacionados

- `packages/frontend/src/pages/orcamentos-admin/ui/Lista.web.tsx` e variante
  native - apresentação compartilhada da página
- `apps/clients/web/src/app/(admin)/admin/orcamentos/page.tsx` - host fino
- `apps/services/api/src/app/api/admin/quotes/route.ts` - API de listagem
- `apps/services/api/src/app/api/admin/quotes/[id]/route.ts` - API de ações
  individuais
- `apps/services/api/src/app/api/admin/quotes/[id]/send-adjusted-quote/route.ts` -
  Envio de orçamento ajustado
- `apps/services/api/src/host/quotations.ts` e
  `packages/backend/src/modules/quotations` - composição HTTP e comandos por
  tenant
- `packages/frontend/src/widgets/quadro-kanban/ui/Quadro.web.tsx` - Componente
  Kanban

### Componentes Utilizados

- `Dialog` (Base UI) - Modal de detalhes
- `Button` - Ações
- `Badge` - Status
- `Card` - Containers

### APIs Consumidas

- `GET /api/admin/quotes` - Lista orçamentos
- `PATCH /api/admin/quotes/[id]` - Atualiza status/valores
- `POST /api/admin/quotes/[id]/send-adjusted-quote` - Envia orçamento ajustado
  por email
- `PATCH /api/admin/financial/entries/[paymentId]/due-date` - Atualiza
  vencimento do boleto vinculado ao orçamento
- `DELETE /api/admin/quotes/[id]` - Exclui orçamento

## 4. Como Usar

### Aprovar/Rejeitar Orçamento

1. Clique no card do orçamento no Kanban ou na linha da tabela
2. Modal de detalhes abre com todas as informações
3. Use os botões no footer para aprovar ou rejeitar
4. Defina a condição de pagamento no seletor (`UPFRONT`, `ON_DELIVERY`,
   `AT_END`) antes de aprovar.
5. `UPFRONT/ON_DELIVERY`: aprovacao registra approvedAt/approvedBy e status
   permanece `PENDING` ate pagamento. Se ainda nao houver boleto, a aprovacao
   libera geracao manual.
6. `AT_END`: aprovacao operacional pode converter para locacao sem pagamento
   inicial.

### Ajustar Valor Final

1. Abra o modal de detalhes
2. Clique em "Ajustar Valor Final"
3. No bloco de reajuste (borda tracejada): para cada item escolha a categoria no
   dropdown, valor adicional e justificativa; use "Adicionar reajuste" para
   incluir mais itens; remova itens com o ícone de lixeira (se houver mais de
   um)
4. Confirme o ajuste (Registrar Reajuste).
5. Se houver boleto pendente, ele e regenerado (o admin deve reenviar).
6. Clique em "Enviar Orçamento Ajustado" para notificar o cliente.

### Gerar/Enviar Boleto

1. Abra o modal de detalhes do orcamento (boleto pode ja estar disponivel em
   PENDING)
2. Se existir boleto, use "Abrir boleto" para ver o PDF
3. Se nao existir boleto, aprove o orcamento e clique em "Gerar boleto"
4. Revise linha digitavel e valor
5. Clique em "Enviar boleto" para notificar o cliente

### Alterar Vencimento do Boleto

1. Abra o modal do orcamento que ja possui boleto.
2. Na secao "Boleto", ajuste a data em "Alterar vencimento".
3. Clique em "Salvar novo vencimento".
4. O sistema sincroniza o vencimento no gateway e atualiza os dados do
   orcamento.

### Navegacao para Financeiro

1. No modo tabela, abra o menu de acoes da linha do orcamento
2. Clique em "Ver no Financeiro"
3. O sistema abre `/admin/financeiro?search=<quoteCode|legacyExternalCode>`
4. O financeiro carrega ja filtrado para o mesmo contexto operacional

### Aplicar Multa por Atraso

1. Abra o modal de detalhes de orçamento aprovado
2. Clique em "Calcular Multa"
3. Sistema calcula automaticamente baseado nos dias de atraso
4. Confirme aplicação da multa

## 5. Armadilhas a Evitar

- ❌ **NUNCA** use um único estado booleano para controlar loading de múltiplas
  ações distintas (ex: aprovar e rejeitar)
- ❌ **NUNCA** renderize dialogs aninhadas fora do `Dialog.BodyContent`
- ❌ **NUNCA** esqueça de sincronizar `nestedDialogOpen` com as dialogs filhas
- ❌ **NUNCA** omita informações de entrega/retirada no modal de detalhes
- ❌ **NÃO** sobrescreva hovers de `admin-action-button`: manter fundo branco e
  permitir `scale` suave para feedback visual
- ❌ **NUNCA** assumir que toda aprovação vira `APPROVED` apenas por pagamento:
  no fluxo `AT_END`, a aprovação operacional pode converter sem pagamento
  inicial
- ❌ **NUNCA** enviar orçamento ajustado sem justificativa ou sem valor final
  definido
- ❌ **NUNCA** tratar o envio do ajuste como aprovação (status permanece
  PENDING)
- ? **NÃO** remover `max-height`/`overflow-hidden` das colunas do Kanban; isso
  faz a barra de scroll global piscar na montagem/filtragem

## 6. Lições Aprendidas

### Loading de Múltiplos Botões (Dez 2025)

**Problema**: Botões Aprovar/Rejeitar mostravam loading simultâneo.

**Solução**: Usar estado `updatingAction` para identificar qual ação está em
andamento, além de `isUpdating` para desabilitar botões.

### Dialogs Aninhadas (Dez 2025)

**Problema**: Dialog de exclusão travava a página.

**Solução**: Migrar para dialogs aninhadas Base UI dentro de
`Dialog.BodyContent` com `data-nested-parent`.

### Scroll do Kanban (Jan 2026)

**Problema**: Barra de scroll global piscava ao montar/filtrar o Kanban.

**Solução**: Limitar altura das colunas com `max-height` responsivo e scroll
interno (`overflow-hidden` no wrapper + `overflow-y-auto` no corpo), mantendo o
scroll dentro da coluna durante as animações de entrada/saída.

### Busca e renderização do Kanban (Fev 2026)

**Problema**: Em busca ativa, o Kanban podia mostrar contagem no badge da coluna
mas sem renderizar os cards; além disso, o input de busca causava loading global
da página a cada refresh de dados.

**Solução**:

- O `KanbanPipeline` passou a animar/renderizar cards diretamente por item
  (`AnimatePresence` por card), sem buffer intermediário dependente de
  `onExitComplete`.
- O loading global foi limitado à carga inicial da página; buscas/filtros
  subsequentes atualizam em background sem “recarregar” a tela inteira.
- A filtragem mensal do Kanban foi preservada e, com busca ativa, há
  auto-navegação para o primeiro mês com resultados quando o mês atual não
  contém itens.
- Em modo Kanban, filtros ocultos de período/valor não são enviados para API.

### Animação de altura do Kanban na busca (Fev 2026)

**Problema**: A animação de altura podia falhar na primeira busca e em busca
cross-mês (coluna colapsava para altura mínima e depois expandia).

**Solução**:

- O mês-alvo da busca passou a ser resolvido no `fetchQuotes` antes do
  `setQuotes`, evitando render intermediário com `kanbanFilteredQuotes = []`.
- O `AnimatedHeight` passou a fazer medição inicial no mount
  (`useLayoutEffect` + commit inicial) para garantir baseline de animação já na
  primeira interação.
- O wrapper de transição do Kanban deixou de usar chave por mês para não
  remontar o `KanbanPipeline` durante busca cross-mês.
- O `useEffect` de auto-navegação de mês foi mantido como fallback defensivo.

## 7. Histórico de Alterações

| Data       | Descrição                                                                       | Autor |
| ---------- | ------------------------------------------------------------------------------- | ----- |
| 2026-02-19 | Kanban: animação de altura estável na 1ª busca e sem colapso na busca cross-mês | IA    |
| 2026-02-19 | Busca no Kanban: fix de cards invisíveis + loading sem recarregar tela          | IA    |
| 2026-02-14 | Acao "Alterar vencimento" do boleto no modal de orcamentos (sync gateway)       | IA    |
| 2026-02-14 | Seletor `paymentTerms` + aprovacao com fluxo `AT_END` sem pagamento inicial     | IA    |
| 2026-02-14 | Link direto "Ver no Financeiro" + suporte a filtro inicial via query            | IA    |
| 2026-01-10 | Envio de orçamento ajustado no modal de detalhes                                | IA    |
| 2026-02-11 | Busca por codigo de orcamento + reajuste categorizado + lock de boleto          | IA    |
| 2026-01-03 | Altura do Kanban limitada com scroll interno para evitar flick                  | IA    |
| 2026-01-02 | Fluxo de aprovacao mantem status PENDING ate pagamento                          | IA    |
| 2025-12-17 | Corrigido loading simultâneo de botões aprovar/rejeitar                         | IA    |
| 2025-12-17 | Corrigido dialog de exclusão travando página                                    | IA    |
| 2025-01    | Sistema de ajuste de valor com justificativa                                    | IA    |
| 2025-01    | Sistema de multa por atraso                                                     | IA    |
| 2025-01    | Informações de entrega/retirada no modal                                        | IA    |

---

_Última atualização: 2026-02-19_

## 8. Consumidor de boleto/reajustes (onda 66, 2026-10-03)

Geração/vencimento usam entidade pagamento; PDF de reajustes usa api da página,
pelo transporte configurado. POST sem corpo/PATCH com dueDate e 202 pendente
preservados. Locks/mensagens/filtros/nome do PDF intactos. Página reinicia por
locadora/papel/usuário; ciclo conferido após callback antes de toast/seleção.
Outros carregamentos/mutações fora do corte. Provas renderizadas/HTTP local nos
dois hosts/motores na onda 66 de [API compartilhada](shared-api-host.md).

## 9. Listagem, detalhe e ações no transporte configurado (onda 67, 2026-10-03)

api/admin-quotes permanece na página dona. Tabela 20 e Kanban 500/page 1,
filtros ocultos, meses, busca e atualização do item conservados. Detalhe
autônomo reinicia por usuário/locadora/registro. Aprovação AT_END, período,
cliente, itens, entrega, multa e envio preservam métodos e corpos.

POST de reajuste conserva 202 e DELETE conserva 409 de histórico imutável. A
sequência de vários reajustes para na recusa; não desfaz os já aceitos.
Respostas antigas após rede/callback não atualizam seleção/toast nem iniciam o
próximo POST; locks de boleto sempre são liberados. UI/estilos intactos. Provas
do bloco aprovadas localmente nos dois motores; aparelhos/operacional ainda
pendentes. Legado ativo. Ver [onda 67](shared-api-host.md).

## Consumidor Expo e modelos compartilhados — onda 80 (2026-10-03, sem commit)

Entrada default conserva o web; condição react-native monta lista/painel/forms/
agenda. Modelos dados.ts e detalhe.ts são comuns; adapters web mantêm Next,
animação e evento DOM de badges. Query/payloads, boleto/202, recusa 409, locks,
multas e reajustes sequenciais permanecem. Nenhuma duplicação no host HTTP.

Routes Expo /admin/orcamentos e /admin/orcamentos/[id] recebem
search/quoteId/ID. Compartilhamento nativo usa bytes autenticados, nome e guarda
de ciclo; arquivo próprio é limpo. Lista/detalhe reiniciam por
sessão/locadora/revisão; resposta antiga não reabre o painel nem emite feedback.

47 casos focados, 62 mobile e 183 web (sete skips prévios), tipos/gates/builds/
exports aprovados. AST conserva 136 atributos visuais web e 21 ações.
Apresentações nativas adaptam agenda/pipeline; campos de datas usam AAAA-MM-DD.
Visual, gestos, teclado, PDFs/URLs/aparelhos reais e operação continuam
pendentes. Detalhe por ID reutiliza o painel; link Financeiro aguarda destino
nativo real. [Implementação e limites](shared-api-host.md), onda 80; entrada 263
de issues.
