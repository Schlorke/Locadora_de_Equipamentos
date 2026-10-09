# 🚀 Guia Completo de Configuração - Asaas (Boletos Bancários)

> **Guia passo a passo para configurar a integração com Asaas e habilitar a
> emissão automática de boletos bancários**

---

## 📋 **Índice**

1. [Criar Conta no Asaas Sandbox](#1-criar-conta-no-asaas-sandbox)
2. [Obter API Key](#2-obter-api-key)
3. [Configurar Variáveis de Ambiente](#3-configurar-variáveis-de-ambiente)
4. [Configurar Webhook](#4-configurar-webhook)
5. [Testar a Integração](#5-testar-a-integração)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. **Criar Conta no Asaas Sandbox**

### **Passo 1.1: Acessar o Sandbox**

1. Acesse: **https://sandbox.asaas.com/login/auth**
2. Clique em **"Criar conta"** ou **"Cadastrar"**

### **Passo 1.2: Preencher Dados de Cadastro**

Preencha os seguintes campos:

- **Nome completo**: Seu nome
- **Email**: Um email válido (pode ser de teste)
- **CPF/CNPJ**: Use um CPF/CNPJ válido para testes
- **Telefone**: Número válido
- **Senha**: Crie uma senha segura

> **💡 Dica**: No sandbox, você pode usar dados fictícios para testes, mas o
> CPF/CNPJ deve estar em formato válido.

### **Passo 1.3: Confirmar Email**

1. Verifique sua caixa de entrada
2. Clique no link de confirmação enviado pelo Asaas
3. Faça login no painel

### **Passo 1.4: Acessar o Painel**

Após o login, você será redirecionado para o painel do Asaas Sandbox:

- **URL**: `https://sandbox.asaas.com/dashboard/home`
- Você verá o dashboard com opções de cobrança, clientes, etc.

---

## 2. **Obter API Key**

### **Passo 2.1: Acessar Configurações**

1. No painel do Asaas, clique no **ícone de perfil** (canto superior direito)
2. Selecione **"Integrações"** ou **"API"**
3. Ou acesse diretamente: **https://sandbox.asaas.com/integrations**

### **Passo 2.2: Gerar API Key**

1. Procure pela seção **"API"** ou **"Chaves de API"**
2. Clique em **"Criar nova chave"** ou **"Gerar API Key"**
3. Dê um nome descritivo (ex: "GB Locações - Sandbox")
4. **Copie a API Key gerada** (você só verá ela uma vez!)

> **⚠️ IMPORTANTE**:
>
> - A API Key é exibida apenas uma vez
> - Guarde-a em local seguro
> - Ela será usada nas variáveis de ambiente

### **Passo 2.3: Verificar API Key**

A API Key do sandbox geralmente tem o formato:

```
$aact_[hash_base64_complexo]
```

**Exemplo de formato** (use sua chave real do painel Asaas):

- Formato: `$aact_[hash]`
- Tamanho: ~100-200 caracteres
- Contém caracteres especiais: `$`, `:`, `/`

---

## 3. **Configurar Variáveis de Ambiente**

### **Passo 3.1: Localizar Arquivo .env**

No projeto, você precisa configurar as variáveis no arquivo `.env.local` (ou
`.env`):

```bash
# Localização: raiz do projeto
.env.local
```

### **Passo 3.2: Adicionar Variáveis do Asaas**

Adicione as seguintes variáveis ao seu arquivo `.env.local`:

```env
# =================================================================
# 💳 PAGAMENTOS - ASAAS (Boletos Bancários)
# =================================================================

# API Key do Asaas (obtida no passo 2.2)
# ⚠️ IMPORTANTE: Como a API key começa com $, é necessário ESCAPAR cada $ com \$
# O Next.js usa dotenv-expand que expande variáveis $VAR não escapadas
# ⚠️ SEGURANÇA: Substitua [SUA_API_KEY_AQUI] pela chave real obtida no painel Asaas
ASAAS_API_KEY="\$aact_[SUA_API_KEY_AQUI]"

# URL Base da API (sandbox ou produção)
ASAAS_BASE_URL="https://api-sandbox.asaas.com/v3"

# Token de segurança para webhooks (gerar no passo 4)
ASAAS_WEBHOOK_SECRET="seu-token-secreto-aqui"

# Tipo de gateway de boleto (deve ser "asaas")
BOLETO_GATEWAY_TYPE="asaas"

# Ambiente (sandbox ou production)
BOLETO_ENVIRONMENT="sandbox"

# (Opcional) Gerar boleto automaticamente ao criar orçamento
AUTO_GENERATE_BOLETO_ON_QUOTE="true"
```

### **Passo 3.3: Substituir Valores**

1. **`ASAAS_API_KEY`**: Cole a API Key obtida no passo 2.2
   - ⚠️ **CRÍTICO**: Como a API key do Asaas começa com `$`, você DEVE escapar
     cada `$` com `\$`
   - Exemplo: Se a key é `$aact_abc123`, use `\$aact_abc123` no `.env.local`
   - Se a key contiver múltiplos `$`, escape todos eles
   - Aspas duplas NÃO impedem a expansão - o escape `\$` é obrigatório
2. **`ASAAS_BASE_URL`**: Mantenha como está para sandbox
3. **`ASAAS_WEBHOOK_SECRET`**: Será configurado no próximo passo
4. **`BOLETO_GATEWAY_TYPE`**: Deve ser exatamente `"asaas"`

### **Passo 3.4: Reiniciar Servidor**

Após adicionar as variáveis, reinicie o servidor de desenvolvimento:

```bash
# Parar o servidor (Ctrl+C)
# Iniciar novamente
pnpm dev
```

---

## 4. **Configurar Webhook**

O webhook permite que o Asaas notifique automaticamente seu sistema quando um
pagamento for confirmado, vencido ou cancelado.

### **Passo 4.1: Gerar Token de Webhook**

1. No painel Asaas, acesse: **Configurações → Webhooks**
2. Ou acesse diretamente: **https://sandbox.asaas.com/webhooks**
3. Clique em **"Criar novo webhook"** ou **"Adicionar webhook"**

### **Passo 4.2: Configurar URL do Webhook**

Preencha os seguintes campos:

- **URL**: `https://seu-dominio.com/api/payments/asaas/webhook`
  - **Para desenvolvimento local**: Use um serviço como ngrok ou configure no
    Vercel
  - **Para produção**: Use seu domínio real (ex:
    `https://locacoesgb.com.br/api/payments/asaas/webhook`)

- **Eventos para escutar**:
  - ✅ `PAYMENT_RECEIVED` (Pagamento recebido)
  - ✅ `PAYMENT_CONFIRMED` (Pagamento confirmado)
  - ✅ `PAYMENT_OVERDUE` (Pagamento vencido)
  - ✅ `PAYMENT_REFUNDED` (Pagamento estornado)
  - ✅ `PAYMENT_CANCELLED` (Pagamento cancelado)

### **Passo 4.3: Obter Token de Segurança**

1. Após criar o webhook, o Asaas gerará um **token de acesso**
2. **Copie este token** - ele será o valor de `ASAAS_WEBHOOK_SECRET`
3. Adicione ao `.env.local`:

```env
ASAAS_WEBHOOK_SECRET="token-gerado-pelo-asaas"
```

### **Passo 4.4: Testar Webhook (Opcional)**

Para testar o webhook em desenvolvimento local, você pode usar:

- **ngrok**: `ngrok http 3000` (expõe localhost:3000)
- **Vercel**: Deploy de preview para obter URL pública

---

## 5. **Testar a Integração**

### **Passo 5.1: Verificar Configuração**

Execute o script de teste:

```bash
node scripts/test-boleto-automatico.js
```

Este script irá:

1. Buscar um equipamento no banco
2. Criar um orçamento de teste
3. Gerar um boleto automaticamente (se configurado)
4. Exibir os dados do boleto gerado

### **Passo 5.2: Verificar no Painel Asaas**

1. Acesse: **https://sandbox.asaas.com/dashboard/home**
2. Vá em **"Cobranças"** ou **"Payments"**
3. Você deve ver o boleto gerado listado lá

### **Passo 5.3: Testar Geração Manual via API**

Use o Postman/Insomnia para testar o endpoint:

```http
POST http://localhost:3000/api/payments/boleto/generate
Content-Type: application/json

{
  "quoteId": "seu-quote-id-aqui",
  "amount": 1500.0,
  "dueDate": "2025-02-15T00:00:00.000Z",
  "description": "Pagamento de locação",
  "customerName": "João da Silva",
  "customerDocument": "12345678900",
  "customerEmail": "joao@example.com"
}
```

### **Passo 5.4: Verificar Resposta**

A resposta deve conter:

```json
{
  "payment": {
    "id": "payment_abc123",
    "transactionId": "pay_123456789",
    "status": "PENDING",
    "method": "BOLETO"
  },
  "boleto": {
    "barcode": "34191...",
    "digitableLine": "34191.12345 67890.123456 78901.234567 8 90123456789012",
    "pdfUrl": "https://sandbox.asaas.com/...",
    "dueDate": "2025-02-15T00:00:00.000Z"
  }
}
```

---

## 6. **Troubleshooting**

### **❌ Erro: "ASAAS_API_KEY is not configured"**

**Causa**: A variável `ASAAS_API_KEY` não está configurada ou está vazia.

**Causa Mais Comum**: API key não está escapada corretamente

- O Next.js usa `@next/env/dotenv-expand` que expande variáveis `$VAR` não
  escapadas
- Se sua API key começa com `$`, ela será interpretada como variável de ambiente
  e ficará vazia

**Solução**:

1. Verifique se o arquivo `.env.local` existe
2. **ESCAPE cada `$` na API key com `\$`**:

   ```env
   # ❌ ERRADO (valor vazio)
   ASAAS_API_KEY="$aact_abc123"

   # ✅ CORRETO (valor carregado)
   ASAAS_API_KEY="\$aact_abc123"
   ```

3. Se a key contiver múltiplos `$`, escape todos eles
4. Reinicie o servidor (`pnpm dev`) para recarregar as variáveis

### **❌ Erro: "Asaas request failed: 401 Unauthorized"**

**Causa**: API Key inválida ou expirada.

**Solução**:

1. Gere uma nova API Key no painel Asaas
2. Atualize `ASAAS_API_KEY` no `.env.local`
3. Reinicie o servidor

### **❌ Erro: "Boleto não foi gerado automaticamente"**

**Causa**: Variáveis de ambiente não configuradas corretamente.

**Solução**:

1. Verifique se `BOLETO_GATEWAY_TYPE=asaas`
2. Verifique se `ASAAS_API_KEY` está configurada
3. Verifique se `AUTO_GENERATE_BOLETO_ON_QUOTE=true` (se quiser geração
   automática)

### **❌ Webhook não está recebendo notificações**

**Causa**: URL do webhook incorreta ou token inválido.

**Solução**:

1. Verifique a URL do webhook no painel Asaas
2. Confirme que `ASAAS_WEBHOOK_SECRET` está correto
3. Teste o webhook manualmente usando o Postman (veja
   `docs/guides/asaas-boleto-testing.md`)

### **❌ Boleto gerado mas não aparece no painel Asaas**

**Causa**: Pode ser um problema de sincronização ou API Key incorreta.

**Solução**:

1. Verifique os logs do servidor para erros
2. Confirme que está usando a API Key correta do sandbox
3. Verifique se o cliente foi criado corretamente no Asaas

---

## 📚 **Próximos Passos**

Após configurar o Asaas:

1. **Testar fluxo completo**: Veja `docs/guides/asaas-boleto-testing.md`
2. **Configurar produção**: Quando estiver pronto, mude para produção:
   - `ASAAS_BASE_URL="https://api.asaas.com/v3"`
   - `BOLETO_ENVIRONMENT="production"`
   - Use API Key de produção
3. **Monitorar pagamentos**: Configure alertas e notificações
4. **Documentar processos**: Mantenha documentação atualizada

---

## 🔗 **Links Úteis**

- **Documentação Asaas**: https://docs.asaas.com/
- **API Reference**: https://docs.asaas.com/reference
- **Webhook Events**: https://docs.asaas.com/docs/webhooks
- **Painel Sandbox**: https://sandbox.asaas.com/dashboard/home
- **Guia de Testes**: `docs/guides/asaas-boleto-testing.md`

---

## ✅ **Checklist de Configuração**

Antes de considerar a configuração completa, verifique:

- [ ] Conta criada no Asaas Sandbox
- [ ] API Key obtida e configurada em `.env.local`
- [ ] `ASAAS_BASE_URL` configurado (sandbox)
- [ ] `BOLETO_GATEWAY_TYPE=asaas` configurado
- [ ] Webhook configurado (opcional, mas recomendado)
- [ ] `ASAAS_WEBHOOK_SECRET` configurado (se usando webhook)
- [ ] Servidor reiniciado após adicionar variáveis
- [ ] Teste de geração de boleto executado com sucesso
- [ ] Boleto visível no painel Asaas
- [ ] Webhook testado (se configurado)

---

_Última atualização: Dezembro 2025_
