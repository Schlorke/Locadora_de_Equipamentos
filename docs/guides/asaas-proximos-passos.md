# 🎯 Próximos Passos Após Cadastro no Asaas

> **Guia prático: o que fazer após completar o cadastro no Asaas Sandbox**

---

## ✅ **Você já fez:**

- [x] Criar conta no Asaas Sandbox
- [x] Completar cadastro
- [x] Corrigir dados (nome, etc.)

---

## 🚀 **Agora você precisa fazer:**

### **1️⃣ Obter API Key (2 minutos)**

1. **Acesse o painel do Asaas**: https://sandbox.asaas.com/dashboard/home
2. **Vá em**: **Perfil** (canto superior direito) → **Integrações** → **API**
   - Ou acesse diretamente: https://sandbox.asaas.com/integrations
3. **Clique em**: **"Criar nova chave"** ou **"Gerar API Key"**
4. **Dê um nome**: "GB Locações - Sandbox"
5. **⚠️ COPIE A API KEY IMEDIATAMENTE!** (ela só aparece uma vez)

A API Key terá um formato como:

```
$aact_[hash_base64_complexo]
```

**Formato esperado:**

- Começa com `$aact_`
- Seguido de um hash base64 complexo
- Tamanho: ~100-200 caracteres
- Contém caracteres especiais (`$`, `:`, `/`)

---

### **2️⃣ Configurar Variáveis de Ambiente (3 minutos)**

#### **Passo 2.1: Criar/Editar arquivo `.env.local`**

Na **raiz do projeto**, crie ou edite o arquivo `.env.local`:

```bash
# Se não existir, crie o arquivo
touch .env.local
```

#### **Passo 2.2: Adicionar Variáveis do Asaas**

Adicione estas variáveis ao arquivo `.env.local`:

```env
# =================================================================
# 💳 PAGAMENTOS - ASAAS (Boletos Bancários)
# =================================================================

# API Key do Asaas (COLE A API KEY QUE VOCÊ COPIOU AQUI)
# ⚠️ IMPORTANTE: Escape cada $ com \$ (Next.js expande $VAR não escapadas)
ASAAS_API_KEY="\$aact_SUA_API_KEY_AQUI"

# URL Base da API (sandbox)
ASAAS_BASE_URL="https://api-sandbox.asaas.com/v3"

# Tipo de gateway de boleto (deve ser "asaas")
BOLETO_GATEWAY_TYPE="asaas"

# Ambiente (sandbox ou production)
BOLETO_ENVIRONMENT="sandbox"

# (Opcional) Gerar boleto automaticamente ao criar orçamento
AUTO_GENERATE_BOLETO_ON_QUOTE="true"

# (Opcional) Token de segurança para webhooks (configurar depois)
# ASAAS_WEBHOOK_SECRET="seu-token-secreto-aqui"
```

#### **Passo 2.3: Substituir Valores**

1. **`ASAAS_API_KEY`**: Cole a API Key que você copiou no passo 1
   - ⚠️ **CRÍTICO**: Como a API key começa com `$`, você DEVE escapar cada `$`
     com `\$`
   - Exemplo: Se a key é `$aact_abc123`, use `\$aact_abc123` no `.env.local`
   - Aspas duplas NÃO impedem a expansão - o escape `\$` é obrigatório
2. **`ASAAS_BASE_URL`**: Já está correto para sandbox
3. **`BOLETO_GATEWAY_TYPE`**: Já está correto (`"asaas"`)
4. **`BOLETO_ENVIRONMENT`**: Já está correto (`"sandbox"`)

---

### **3️⃣ Reiniciar Servidor (1 minuto)**

Após adicionar as variáveis, **reinicie o servidor**:

```bash
# Se o servidor estiver rodando, pare com Ctrl+C
# Depois inicie novamente:
pnpm dev
```

**Por quê?** O Next.js carrega as variáveis de ambiente apenas na inicialização.

---

### **4️⃣ Testar a Integração (2 minutos)**

Execute o script de teste:

```bash
node scripts/test-boleto-automatico.js
```

**O que o script faz:**

1. Busca um equipamento no banco de dados
2. Cria um orçamento de teste
3. Gera um boleto automaticamente (se configurado)
4. Exibe os dados do boleto gerado

**✅ Se funcionar, você verá:**

```
✅ BOLETO GERADO AUTOMATICAMENTE!

📄 Dados do Boleto:
   Código de Barras: 34191...
   Linha Digitável: 34191.12345 67890.123456...
   PDF URL: https://sandbox.asaas.com/...
   Vencimento: 2025-02-15...
```

**❌ Se não funcionar, verifique:**

- API Key está correta?
- Variáveis de ambiente foram salvas?
- Servidor foi reiniciado?
- Há equipamentos no banco de dados?

---

### **5️⃣ Verificar no Painel Asaas (1 minuto)**

1. Acesse: https://sandbox.asaas.com/dashboard/home
2. Vá em **"Cobranças"** ou **"Payments"**
3. Você deve ver o boleto gerado listado lá

---

## 🎉 **Pronto!**

Se tudo funcionou, sua integração está configurada! 🚀

---

## 📋 **Checklist Final**

Antes de considerar completo, verifique:

- [ ] API Key obtida e copiada
- [ ] Variáveis adicionadas ao `.env.local`
- [ ] Servidor reiniciado
- [ ] Teste executado com sucesso
- [ ] Boleto visível no painel Asaas

---

## 🔧 **Próximos Passos (Opcional)**

### **Configurar Webhook (Recomendado)**

Para receber notificações automáticas quando um pagamento for confirmado:

1. No painel Asaas: **Configurações → Webhooks**
2. Criar webhook com URL: `https://seu-dominio.com/api/payments/asaas/webhook`
3. Copiar token e adicionar ao `.env.local`:
   ```env
   ASAAS_WEBHOOK_SECRET="token-do-webhook"
   ```

**Para desenvolvimento local**, você pode usar:

- **ngrok**: `ngrok http 3000` (expõe localhost:3000)
- **Vercel Preview**: Deploy de preview para obter URL pública

---

## 📚 **Documentação Relacionada**

- **Guia Completo**: `docs/guides/asaas-setup-completo.md`
- **Guia Rápido**: `docs/guides/asaas-setup-rapido.md`
- **Guia de Testes**: `docs/guides/asaas-boleto-testing.md`
- **Explicação Sandbox**: `docs/guides/asaas-sandbox-explicacao.md`

---

## ❓ **Precisa de Ajuda?**

Se encontrar problemas:

1. Verifique os logs do servidor
2. Confirme que a API Key está correta
3. Verifique se as variáveis de ambiente foram carregadas
4. Consulte `docs/guides/asaas-setup-completo.md` - seção Troubleshooting

---

_Última atualização: Dezembro 2025_
