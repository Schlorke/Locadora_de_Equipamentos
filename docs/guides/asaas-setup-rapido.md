# ⚡ Guia Rápido - Configuração Asaas (5 minutos)

> **Resumo executivo para configurar Asaas rapidamente**

---

## 🎯 **Passo a Passo Rápido**

### **1️⃣ Criar Conta (2 min)**

1. Acesse: **https://sandbox.asaas.com/login/auth**
2. Clique em **"Criar uma conta"**
3. Preencha:
   - Nome completo
   - Email
   - CPF/CNPJ (pode ser fictício para sandbox)
   - Telefone
   - Senha
4. Confirme o email

### **2️⃣ Obter API Key (1 min)**

1. No painel: **Perfil → Integrações → API**
2. Clique em **"Criar nova chave"**
3. **Copie a API Key** (ela só aparece uma vez!)

### **3️⃣ Configurar .env.local (1 min)**

Adicione ao arquivo `.env.local` na raiz do projeto:

```env
# Asaas - Boletos Bancários
# ⚠️ IMPORTANTE: Se a API key começa com $, escape cada $ com \$
# Exemplo: Se a key é "$aact_abc123", use "\$aact_abc123"
ASAAS_API_KEY="\$sua-api-key-aqui"
ASAAS_BASE_URL="https://api-sandbox.asaas.com/v3"
BOLETO_GATEWAY_TYPE="asaas"
BOLETO_ENVIRONMENT="sandbox"
AUTO_GENERATE_BOLETO_ON_QUOTE="true"
```

### **4️⃣ Reiniciar Servidor (30 seg)**

```bash
# Parar servidor (Ctrl+C)
pnpm dev
```

### **5️⃣ Testar (30 seg)**

```bash
node scripts/test-boleto-automatico.js
```

---

## ✅ **Pronto!**

Se o teste passar, sua integração está funcionando! 🎉

---

## 📚 **Documentação Completa**

Para detalhes completos, veja: `docs/guides/asaas-setup-completo.md`

---

## 🔧 **Configuração de Webhook (Opcional)**

Para receber notificações automáticas de pagamento:

1. No painel Asaas: **Configurações → Webhooks**
2. Criar webhook com URL: `https://seu-dominio.com/api/payments/asaas/webhook`
3. Copiar token e adicionar ao `.env.local`:
   ```env
   ASAAS_WEBHOOK_SECRET="token-do-webhook"
   ```

---

_Última atualização: Dezembro 2025_
