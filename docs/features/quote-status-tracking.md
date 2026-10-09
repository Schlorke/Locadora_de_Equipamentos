# Acompanhamento de Status de Orçamento

> **⚠️ CRÍTICO**: Sistema que permite cliente e admin acompanharem o status dos
> orçamentos. Essencial para segurança do cliente e controle do admin.

## 1. Propósito

O sistema permite que clientes e administradores acompanhem o status dos
orçamentos em tempo real, com notificações automáticas de mudanças de status.

## 2. Lógica de Funcionamento

### 2.1. Status do Orçamento

- **PENDING**: Orcamento criado; inclui aprovados pelo admin aguardando
  pagamento
- **APPROVED**: Pagamento confirmado (Asaas) ou aprovacao operacional no fluxo
  `AT_END`
- **REJECTED**: Orcamento rejeitado pelo admin
- **COMPLETED**: Orcamento convertido em locacao

### 2.2. Fluxo de Acompanhamento

1. **Cliente cria orcamento**: Status `PENDING`
2. **Sistema envia confirmacao**: Email/notificacao de recebimento
3. **Admin analisa**: Visualiza orcamento na pagina admin
4. **Admin aprova/rejeita**:
   - Rejeicao muda status para `REJECTED`
   - Aprovacao `UPFRONT/ON_DELIVERY` registra approvedAt/approvedBy e mantem
     `PENDING` ate pagamento
   - Aprovacao `AT_END` pode registrar approvedAt/approvedBy e seguir para
     conversao operacional sem pagamento inicial
5. **Boleto enviado**: Cliente recebe boleto para pagamento
6. **Pagamento confirmado (Asaas)**: Status muda para `APPROVED` e email de
   confirmacao e enviado
7. **Conversao em locacao**: Status muda para `COMPLETED`
8. **Cliente visualiza**: Status atualizado na area do cliente

### 2.3. Notificações

- **Confirmação de recebimento**: Enviada quando orçamento é criado
- **Aprovacao/Rejeicao**: Enviada quando admin aprova (registro) ou rejeita
- **Boleto disponivel**: Enviada quando o boleto e enviado ao cliente
- **Pagamento confirmado**: Enviada automaticamente pelo webhook Asaas (email de
  confirmacao)
- **Lembrete de validade**: Enviada quando orçamento está próximo de vencer

## 2.4. Diagramas Relacionados

- `docs/architecture/diagrams/quote-status-flow.mermaid`

## 3. Arquitetura e Dependências

### 3.1. Schema Prisma

```prisma
model Quote {
  status              QuoteStatus   @default(PENDING)
  paymentTerms        QuotePaymentTerms @default(UPFRONT)
  approvedAt          DateTime?
  approvedBy          String?
  rejectedAt          DateTime?
  rejectedBy          String?
  validUntil          DateTime?
}
```

### 3.2. API Endpoints

- **GET `/api/admin/quotes`**: Lista orçamentos com status
- **PATCH `/api/admin/quotes/[id]`**: Atualiza status
- **GET `/api/quotes/[id]`**: Busca orçamento por ID (cliente)

### 3.3. Componentes Frontend

- **`app/admin/orcamentos/page.tsx`**: Visualização admin com status
- **`app/area-cliente/historico/page.tsx`**: Visualizacao cliente com refresh
  periodico (30s) quando a aba esta visivel
- **`app/area-cliente/historico/[id]/page.tsx`**: Detalhes do orcamento/locacao
  com refresh periodico (30s) quando a aba esta visivel

## 4. Como Usar

### 4.1. Cliente - Acompanhar Orçamento

1. Acesse a area do cliente
2. Visualize a lista de orcamentos
3. A lista e os detalhes atualizam automaticamente (30s) quando a aba esta
   visivel
4. Veja o status atual de cada orcamento
5. Receba notificacoes de mudancas

### 4.2. Admin - Gerenciar Status

1. Acesse `/admin/orcamentos`
2. Visualize orçamentos por status (Kanban ou Tabela)
3. Clique em orçamento para ver detalhes
4. Aprove ou rejeite orçamento
5. Escolha a condicao de pagamento:
   - `UPFRONT/ON_DELIVERY`: aprovacao registra approvedAt/approvedBy e status
     permanece `PENDING` ate pagamento
   - `AT_END`: aprovacao operacional pode converter sem pagamento inicial
6. Sistema notifica cliente automaticamente

## 5. Armadilhas a Evitar

- ❌ **NUNCA** perca histórico de mudanças de status
- ❌ **NUNCA** permita mudança de status sem autenticação
- ❌ **NUNCA** esqueça de notificar cliente
- ❌ **NUNCA** exiba informações sensíveis para clientes

## 6. Lições Aprendidas

- Notificações automáticas melhoram experiência
- Status claro previne confusão
- Histórico completo é essencial

## 7. Histórico de Alterações

| Data       | Descrição                                                    | Autor   |
| ---------- | ------------------------------------------------------------ | ------- |
| 2026-02-14 | Fluxo AT_END com aprovacao operacional sem pagamento inicial | IA      |
| 2026-01-09 | Atualizacao automatica do historico do cliente (polling 30s) | IA      |
| 2026-01-02 | Status APPROVED apenas apos pagamento confirmado             | IA      |
| 2025-01-XX | Implementação inicial                                        | Sistema |
