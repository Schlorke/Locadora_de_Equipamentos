# 🧪 Guia Completo de Testes - Boletos Asaas

> **Guia passo a passo para testar o fluxo completo de boletos Asaas no
> Postman/Insomnia**

## 📋 **Pré-requisitos**

- ✅ Domínio configurado: `https://locacoesgb.com.br`
- ✅ Variáveis de ambiente configuradas:
  - `ASAAS_API_KEY` (sandbox ou produção)
  - `ASAAS_WEBHOOK_SECRET` (token de validação do webhook)
  - `ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3`
  - `BOLETO_GATEWAY_TYPE=asaas`
- ✅ `rentalId` ou `quoteId` de teste válido
- ✅ Cookie de sessão ou Bearer token de usuário autenticado (para endpoints
  protegidos)
- ✅ Token de admin (para endpoint de verificação)

---

## 🎯 **Ordem de Execução Recomendada**

```
1. Gerar Boleto → 2. Simular Webhook Pago → 3. Verificar Efeitos
4. Simular Webhook Vencido → 5. Simular Webhook Cancelado/Refund
6. Conciliação Manual → 7. Verificar Painel Asaas
```

---

## 📝 **CASO 1: Gerar Boleto**

### **Endpoint**

```
POST https://locacoesgb.com.br/api/payments/boleto/generate
```

### **Headers**

```json
{
  "Content-Type": "application/json",
  "Cookie": "next-auth.session-token=SEU_COOKIE_AQUI"
}
```

**OU** (se usando Bearer token):

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer SEU_BEARER_TOKEN_AQUI"
}
```

### **Body (JSON)**

```json
{
  "rentalId": "SEU_RENTAL_ID_AQUI",
  "amount": 1500.0,
  "dueDate": "2025-02-15T00:00:00.000Z",
  "description": "Pagamento de locação de equipamentos",
  "customerName": "João da Silva",
  "customerDocument": "39053344705",
  "customerEmail": "joao@example.com"
}
```

**OU** (usando `quoteId`):

```json
{
  "quoteId": "SEU_QUOTE_ID_AQUI",
  "amount": 1500.0,
  "dueDate": "2025-02-15T00:00:00.000Z",
  "description": "Depósito de garantia",
  "customerName": "João da Silva",
  "customerDocument": "39053344705",
  "customerEmail": "joao@example.com"
}
```

### **✅ O que verificar na resposta (Status 200)**

```json
{
  "payment": {
    "id": "payment_abc123", // ⚠️ ANOTAR: payment.id
    "rentalId": "rental_xyz",
    "quoteId": null,
    "amount": "1500.00",
    "method": "BOLETO",
    "status": "PENDING",
    "type": "RENTAL",
    "dueDate": "2025-02-15T00:00:00.000Z",
    "transactionId": "pay_123456789", // ⚠️ ANOTAR: transactionId
    "metadata": {
      "barcode": "34191...",
      "digitableLine": "34191.09008...", // ⚠️ ANOTAR: digitableLine
      "pdfUrl": "https://sandbox.asaas.com/...", // ⚠️ ANOTAR: pdfUrl
      "instructions": []
    }
  },
  "boleto": {
    "barcode": "34191...",
    "digitableLine": "34191.09008...",
    "pdfUrl": "https://sandbox.asaas.com/...",
    "dueDate": "2025-02-15T00:00:00.000Z",
    "instructions": []
  }
}
```

### **📌 Campos para anotar:**

- ✅ `payment.id` → Usar no caso 5 (verificação manual)
- ✅ `payment.transactionId` → Usar nos webhooks (casos 2, 3, 4)
- ✅ `boleto.digitableLine` → Linha digitável do boleto
- ✅ `boleto.pdfUrl` → URL para download do PDF

### **❌ Possíveis erros:**

- `401 Unauthorized` → Cookie/token inválido ou expirado
- `400 Validation error` → Campos obrigatórios faltando ou inválidos
- `500 Internal server error` → Erro na comunicação com Asaas (verificar logs)

---

## 📝 **CASO 2: Simular Webhook - Pagamento Recebido**

### **Endpoint**

```
POST https://locacoesgb.com.br/api/payments/asaas/webhook
```

### **Headers**

```json
{
  "Content-Type": "application/json",
  "access_token": "SEU_ASAAS_WEBHOOK_SECRET_AQUI"
}
```

**OU** (via query parameter):

```
POST https://locacoesgb.com.br/api/payments/asaas/webhook?access_token=SEU_ASAAS_WEBHOOK_SECRET_AQUI
```

**OU** (via header alternativo):

```json
{
  "Content-Type": "application/json",
  "asaas-access-token": "SEU_ASAAS_WEBHOOK_SECRET_AQUI"
}
```

### **Body (JSON) - Evento PAYMENT_RECEIVED**

```json
{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_123456789",
    "customer": "cus_abc123",
    "subscription": null,
    "installment": null,
    "paymentLink": null,
    "value": 1500.0,
    "netValue": 1500.0,
    "originalValue": 1500.0,
    "interestValue": 0.0,
    "description": "Pagamento de locação de equipamentos",
    "billingType": "BOLETO",
    "status": "RECEIVED",
    "dueDate": "2025-02-15",
    "originalDueDate": "2025-02-15",
    "paymentDate": "2025-02-10",
    "clientPaymentDate": "2025-02-10",
    "invoiceUrl": "https://sandbox.asaas.com/...",
    "bankSlipUrl": "https://sandbox.asaas.com/...",
    "transactionReceiptUrl": null,
    "invoiceNumber": "001234",
    "externalReference": null,
    "deleted": false,
    "anticipated": false,
    "anticipable": false,
    "refund": null,
    "chargeback": null,
    "creditDate": "2025-02-10",
    "estimatedCreditDate": "2025-02-10",
    "nossoNumero": "123456789",
    "bankSlipBarcode": "34191...",
    "identificationField": "34191.09008..."
  }
}
```

**⚠️ IMPORTANTE:** Use o `transactionId` anotado no Caso 1 no campo `payment.id`
acima.

### **✅ O que verificar na resposta (Status 200)**

```json
{
  "success": true
}
```

### **🔍 Verificações no banco/app:**

1. **Status do Payment:**

   ```sql
   SELECT id, status, "paidAt", "transactionId"
   FROM "Payment"
   WHERE id = 'payment_abc123';
   ```

   - ✅ `status` deve ser `PAID`
   - ✅ `paidAt` deve estar preenchido com data/hora do pagamento

2. **Status da Locação (se aplicável):**

   ```sql
   SELECT id, status
   FROM "Rentals"
   WHERE id = 'rental_xyz';
   ```

   - ✅ Se locação estava `PENDING` e todos os pagamentos foram pagos → `status`
     deve ser `ACTIVE`
   - ✅ Se ainda há pagamentos pendentes → `status` permanece `PENDING`

3. **Verificar no painel admin:**
   - Acessar `/admin/rentals/[id]` ou `/admin/payments`
   - Verificar que o pagamento aparece como "Pago"
   - Verificar que a locação foi ativada (se aplicável)

### **❌ Possíveis erros:**

- `401 Invalid webhook token` → `access_token` incorreto
- `400 transactionId is required` → Campo `payment.id` faltando no body
- `404 Payment not found` → `transactionId` não existe no banco
- `400 Status not provided in webhook` → Campo `payment.status` faltando

---

## 📝 **CASO 3: Simular Webhook - Boleto Vencido**

### **Endpoint**

```
POST https://locacoesgb.com.br/api/payments/asaas/webhook
```

### **Headers**

```json
{
  "Content-Type": "application/json",
  "access_token": "SEU_ASAAS_WEBHOOK_SECRET_AQUI"
}
```

### **Body (JSON) - Evento PAYMENT_OVERDUE**

```json
{
  "event": "PAYMENT_OVERDUE",
  "payment": {
    "id": "pay_123456789",
    "customer": "cus_abc123",
    "value": 1500.0,
    "netValue": 1500.0,
    "description": "Pagamento de locação de equipamentos",
    "billingType": "BOLETO",
    "status": "OVERDUE",
    "dueDate": "2025-02-15",
    "originalDueDate": "2025-02-15",
    "paymentDate": null,
    "clientPaymentDate": null,
    "invoiceUrl": "https://sandbox.asaas.com/...",
    "bankSlipUrl": "https://sandbox.asaas.com/...",
    "bankSlipBarcode": "34191...",
    "identificationField": "34191.09008..."
  }
}
```

**⚠️ IMPORTANTE:** Use o mesmo `transactionId` do Caso 1.

### **✅ O que verificar na resposta (Status 200)**

```json
{
  "success": true
}
```

### **🔍 Verificações no banco/app:**

1. **Status do Payment:**

   ```sql
   SELECT id, status, "dueDate"
   FROM "Payment"
   WHERE id = 'payment_abc123';
   ```

   - ✅ `status` deve ser `OVERDUE`
   - ✅ `dueDate` deve estar no passado

2. **Efeitos na Locação:**
   - ✅ Locação permanece `PENDING` (não ativa automaticamente)
   - ✅ Sistema pode enviar notificações de vencimento (se configurado)

3. **Verificar no painel admin:**
   - Pagamento aparece como "Vencido"
   - Alertas/notificações podem ser exibidos

### **❌ Possíveis erros:**

- Mesmos erros do Caso 2

---

## 📝 **CASO 4: Simular Webhook - Cancelado/Refund**

### **4.1 - Cancelado (PAYMENT_DELETED)**

### **Endpoint**

```
POST https://locacoesgb.com.br/api/payments/asaas/webhook
```

### **Headers**

```json
{
  "Content-Type": "application/json",
  "access_token": "SEU_ASAAS_WEBHOOK_SECRET_AQUI"
}
```

### **Body (JSON) - Evento PAYMENT_DELETED**

```json
{
  "event": "PAYMENT_DELETED",
  "payment": {
    "id": "pay_123456789",
    "customer": "cus_abc123",
    "value": 1500.0,
    "description": "Pagamento de locação de equipamentos",
    "billingType": "BOLETO",
    "status": "CANCELLED",
    "dueDate": "2025-02-15",
    "deleted": true
  }
}
```

### **✅ O que verificar:**

- ✅ `payment.status` deve ser `CANCELLED` no banco
- ✅ Locação permanece `PENDING` (não ativa)

---

### **4.2 - Estornado (PAYMENT_REFUNDED)**

### **Body (JSON) - Evento PAYMENT_REFUNDED**

```json
{
  "event": "PAYMENT_REFUNDED",
  "payment": {
    "id": "pay_123456789",
    "customer": "cus_abc123",
    "value": 1500.0,
    "description": "Pagamento de locação de equipamentos",
    "billingType": "BOLETO",
    "status": "REFUNDED",
    "dueDate": "2025-02-15",
    "refund": {
      "value": 1500.0,
      "date": "2025-02-12",
      "status": "COMPLETED"
    }
  }
}
```

### **✅ O que verificar:**

- ✅ `payment.status` deve ser `REFUNDED` no banco
- ✅ Se locação estava `ACTIVE`, pode ser revertida para `PENDING` (depende da
  lógica de negócio)

---

## 📝 **CASO 5: Conciliação Manual**

### **Endpoint**

```
POST https://locacoesgb.com.br/api/payments/boleto/verify
```

### **Headers**

```json
{
  "Content-Type": "application/json",
  "Cookie": "next-auth.session-token=SEU_COOKIE_ADMIN_AQUI"
}
```

**OU** (se usando Bearer token):

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer SEU_BEARER_TOKEN_ADMIN_AQUI"
}
```

**⚠️ IMPORTANTE:** Este endpoint requer autenticação de **ADMIN**.

### **Body (JSON)**

```json
{
  "paymentId": "payment_abc123"
}
```

**⚠️ IMPORTANTE:** Use o `payment.id` anotado no Caso 1.

### **✅ O que verificar na resposta (Status 200)**

```json
{
  "payment": {
    "id": "payment_abc123",
    "status": "PAID",
    "amount": "1500.00",
    "method": "BOLETO",
    "transactionId": "pay_123456789",
    "paidAt": "2025-02-10T10:30:00.000Z",
    "dueDate": "2025-02-15T00:00:00.000Z"
  },
  "verification": {
    "status": "paid",
    "paidAt": "2025-02-10T10:30:00.000Z",
    "amount": 1500.0
  }
}
```

### **🔍 O que acontece internamente:**

1. Sistema busca o pagamento pelo `paymentId`
2. Faz requisição ao Asaas para verificar status atual:
   `GET /api/v3/payments/{transactionId}`
3. Compara status local vs. status no Asaas
4. Se houver divergência, atualiza o status local:
   - `paid` → Atualiza para `PAID` e chama `processPayment()` (ativa locação se
     aplicável)
   - `overdue` → Atualiza para `OVERDUE`
   - `cancelled` → Atualiza para `CANCELLED`
   - `refunded` → Atualiza para `REFUNDED`

### **❌ Possíveis erros:**

- `401 Unauthorized` → Usuário não é ADMIN
- `404 Pagamento não encontrado` → `paymentId` inválido
- `400 Este pagamento não é um boleto` → Payment method diferente de BOLETO
- `400 Boleto não possui transactionId` → Boleto não foi gerado corretamente

---

## 📝 **CASO 6: Verificar Painel Asaas**

### **6.1 - Logs de Webhooks**

1. Acessar painel Asaas: `https://sandbox.asaas.com` (ou produção)
2. Navegar para: **Configurações → Webhooks**
3. Verificar logs de webhooks enviados:
   - ✅ Status `200` → Webhook processado com sucesso
   - ❌ Status `401` → Token inválido
   - ❌ Status `404` → Payment não encontrado
   - ❌ Status `500` → Erro interno

### **6.2 - Verificar Pagamento no Asaas**

1. Navegar para: **Cobranças → Pagamentos**
2. Buscar pelo `transactionId` (ex: `pay_123456789`)
3. Verificar:
   - Status do pagamento no Asaas
   - Data de pagamento
   - Valor
   - Cliente associado

### **6.3 - Testar Webhook Manualmente (Asaas)**

1. No painel Asaas, acessar: **Configurações → Webhooks**
2. Clicar em **"Testar Webhook"** ou **"Enviar Webhook Manual"**
3. Selecionar evento: `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, etc.
4. Selecionar pagamento de teste
5. Verificar se webhook foi recebido no seu endpoint

---

## 🔍 **Verificações Finais no App**

### **1. Status do Payment no Banco**

```sql
SELECT
  id,
  status,
  "paidAt",
  "transactionId",
  amount,
  "dueDate",
  "rentalId",
  "quoteId"
FROM "Payment"
WHERE id = 'payment_abc123';
```

### **2. Status da Locação (se aplicável)**

```sql
SELECT
  id,
  status,
  "startDate",
  "endDate"
FROM "Rentals"
WHERE id = 'rental_xyz';
```

### **3. Verificar no Painel Admin**

- **Página de Pagamentos:** `/admin/payments`
  - Verificar status visual
  - Verificar data de pagamento
  - Verificar link para PDF do boleto

- **Página de Locações:** `/admin/rentals`
  - Verificar se locação foi ativada após pagamento
  - Verificar calendário (se aplicável)

### **4. Verificar Calendário (se aplicável)**

- Se locação foi ativada, verificar se aparece no calendário
- Verificar se datas estão corretas
- Verificar se equipamentos estão bloqueados corretamente

---

## 🚨 **Troubleshooting**

### **Problema: Webhook retorna 401**

**Causas possíveis:**

- Token `ASAAS_WEBHOOK_SECRET` incorreto
- Header `access_token` não enviado ou nome incorreto
- Token enviado via query param mas header também está presente (conflito)

**Solução:**

- Verificar variável de ambiente `ASAAS_WEBHOOK_SECRET`
- Usar apenas UMA forma de autenticação (header OU query param)
- Verificar logs do servidor para ver qual validação está falhando

### **Problema: Webhook retorna 404 "Payment not found"**

**Causas possíveis:**

- `transactionId` no webhook não corresponde a nenhum payment no banco
- Payment foi deletado
- `transactionId` está incorreto no webhook

**Solução:**

- Verificar se `payment.id` do webhook corresponde ao `transactionId` salvo no
  banco
- Verificar se payment existe:
  `SELECT * FROM "Payment" WHERE "transactionId" = 'pay_123456789';`

### **Problema: Locação não ativa após pagamento**

**Causas possíveis:**

- Ainda há outros pagamentos pendentes
- Lógica de ativação requer todos os pagamentos pagos
- Status da locação não é `PENDING`

**Solução:**

- Verificar todos os pagamentos da locação:
  ```sql
  SELECT id, status, amount
  FROM "Payment"
  WHERE "rentalId" = 'rental_xyz';
  ```
- Verificar se TODOS estão `PAID`
- Verificar status atual da locação

### **Problema: Verificação manual não atualiza status**

**Causas possíveis:**

- Asaas retorna status diferente do esperado
- Erro na comunicação com Asaas
- `ASAAS_API_KEY` incorreta

**Solução:**

- Verificar logs do servidor para ver resposta do Asaas
- Testar requisição direta ao Asaas:
  ```bash
  curl -X GET "https://sandbox.asaas.com/api/v3/payments/pay_123456789" \
    -H "access_token: SUA_API_KEY"
  ```
- Verificar se `ASAAS_API_KEY` está correta

---

## 📊 **Checklist Completo de Testes**

### **✅ Caso 1: Geração**

- [ ] Boleto gerado com sucesso
- [ ] `payment.id` anotado
- [ ] `transactionId` anotado
- [ ] `digitableLine` anotada
- [ ] `pdfUrl` anotada
- [ ] Payment criado no banco com status `PENDING`

### **✅ Caso 2: Webhook Pago**

- [ ] Webhook retorna `200`
- [ ] Payment atualizado para `PAID`
- [ ] `paidAt` preenchido
- [ ] Locação ativada (se todos pagamentos pagos)

### **✅ Caso 3: Webhook Vencido**

- [ ] Webhook retorna `200`
- [ ] Payment atualizado para `OVERDUE`
- [ ] Locação permanece `PENDING`

### **✅ Caso 4: Webhook Cancelado/Refund**

- [ ] Webhook retorna `200`
- [ ] Payment atualizado para `CANCELLED` ou `REFUNDED`
- [ ] Locação não ativada (ou revertida se aplicável)

### **✅ Caso 5: Verificação Manual**

- [ ] Endpoint retorna `200`
- [ ] Status sincronizado com Asaas
- [ ] Locação atualizada se necessário

### **✅ Caso 6: Painel Asaas**

- [ ] Webhooks aparecem nos logs com status `200`
- [ ] Pagamento visível no painel Asaas
- [ ] Status correto no Asaas

---

---

## ✅ **VALIDAÇÃO DE CONFORMIDADE LEGAL**

### **O que é Conformidade de Boletos?**

Os boletos bancários devem estar em conformidade com normas da FEBRABAN, Banco
Central e legislação tributária brasileira. Esta seção descreve como validar a
conformidade dos boletos gerados.

### **Checklist de Conformidade**

Após gerar um boleto (Caso 1), valide os seguintes pontos no PDF do boleto:

#### **1. Dados do Beneficiário**

- [ ] **CPF/CNPJ do Beneficiário**: Deve ser `34.780.330/0001-69` (CNPJ da
      empresa)
  - ⚠️ **CRÍTICO**: Se aparecer um CPF pessoal, a conta do Asaas está
    configurada incorretamente
- [ ] **Nome do Beneficiário**: Deve ser `GUSTAVO BARBOSA BRENNER` ou
      `GB LOCACOES E MANUTENCAO`
- [ ] **Endereço do Beneficiário**: Deve estar completo (R IRMAO FRANCISCO, 44 -
      HUMAITA - PORTO ALEGRE/RS)

#### **2. Dados do Pagador**

- [ ] **CPF/CNPJ do Pagador**: Deve corresponder ao documento do cliente
      informado
- [ ] **Nome do Pagador**: Deve corresponder ao nome do cliente
- [ ] **Endereço do Pagador**: Deve estar presente

#### **3. Dados do Documento**

- [ ] **Espécie Doc.**: Idealmente `CT` (Contrato) para locação de equipamentos
  - ⚠️ **Nota**: A API do Asaas pode não permitir definir a espécie via API
  - Se aparecer `DM` (Duplicata Mercantil), pode ser limitação da plataforma
- [ ] **Valor do Documento**: Deve corresponder ao valor do orçamento/locação
- [ ] **Data de Vencimento**: Deve estar correta
- [ ] **Descrição**: Deve referenciar o orçamento (ex: "Orcamento de
      equipamentos - {quoteId}")

#### **4. Vinculação**

- [ ] **Vinculação com Orçamento**: A descrição deve referenciar o ID do
      orçamento
- [ ] **Rastreabilidade**: Deve ser possível identificar qual orçamento gerou o
      boleto

### **Como Validar**

1. **Baixar PDF do Boleto**:
   - Use o campo `boleto.pdfUrl` da resposta da API
   - Ou acesse o painel do Asaas e baixe o PDF

2. **Abrir PDF e Verificar**:
   - Abra o PDF do boleto
   - Compare os dados com os valores esperados acima
   - Documente quaisquer inconsistências encontradas

3. **Se Encontrar Problemas**:
   - **Beneficiário incorreto**: Verificar configuração da conta no Asaas
   - **Espécie incorreta**: Pode ser limitação da API (documentar)
   - **Dados faltando**: Verificar dados enviados na requisição

### **Documentação Relacionada**

Para mais detalhes sobre conformidade legal:

- [`docs/features/boleto-conformity.md`](../features/boleto-conformity.md) -
  Documentação completa de conformidade
- [`docs/guides/asaas-boleto-conformity-setup.md`](./asaas-boleto-conformity-setup.md) -
  Guia de configuração e validação

---

## 📚 **Referências**

- **Documentação Asaas:** https://docs.asaas.com/
- **Webhook Events:** https://docs.asaas.com/docs/webhooks
- **API Reference:** https://docs.asaas.com/reference
- **Conformidade Legal:**
  [`docs/features/boleto-conformity.md`](../features/boleto-conformity.md)

---

**Última atualização:** Janeiro 2026 **Versão:** 1.1.0
