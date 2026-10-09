# 🔐 Diretrizes de Segurança em Documentação - GB Locações

**Data de Criação:** 30/12/2025 **Status:** ATIVO - Obrigatório seguir
**Severidade:** CRÍTICA

---

## 📋 SUMÁRIO EXECUTIVO

Este documento estabelece diretrizes obrigatórias para evitar exposição de
credenciais, chaves de API, tokens e outras informações sensíveis em arquivos de
documentação versionados no Git.

**⚠️ REGRA DE OURO:** Nunca exponha credenciais reais em arquivos de
documentação, mesmo que pareçam "exemplos".

---

## 🚨 PROBLEMA IDENTIFICADO (DEZ 2025)

### **O Que Aconteceu**

Chaves de API do Asaas foram expostas em múltiplos arquivos de documentação:

- `docs/issues/asaas-api-key-env-problem.md` - Chave completa exposta
- `docs/guides/asaas-setup-completo.md` - Chave de exemplo exposta
- `docs/guides/asaas-proximos-passos.md` - Chave de exemplo exposta

### **Por Que É Perigoso**

1. **Repositório Versionado:** Arquivos commitados no Git mantêm histórico
   permanente
2. **Exposição Pública:** Se o repositório for público, credenciais ficam
   expostas
3. **Acesso Não Autorizado:** Chaves expostas podem ser usadas por terceiros
4. **Violação de Compliance:** Expor credenciais viola políticas de segurança

### **Impacto**

- Credenciais comprometidas precisam ser revogadas
- Novo processo de rotação de chaves necessário
- Potencial uso malicioso das credenciais expostas
- Risco de violação de dados e sistemas

---

## ✅ REGRAS OBRIGATÓRIAS

### **1. NUNCA Exponha Credenciais Reais**

#### ❌ INCORRETO

```env
# NUNCA FAÇA ISSO - Exemplos com chaves reais expostas
ASAAS_API_KEY="$aact_hmlg_[hash_completo_exposto]"
STRIPE_SECRET_KEY="[CHAVE_STRIPE_REAL_EXPOSTA_AQUI]"
DATABASE_URL="postgresql://user:senha123@host:5432/database"
NEXTAUTH_SECRET="sua-chave-real-de-256-bits-aqui"
```

**⚠️ NOTA IMPORTANTE:** Mesmo em exemplos de "NÃO FAZER", NUNCA use padrões que
correspondam a formatos reais de chaves (ex: padrões do tipo `sk_*` ou `pk_*`
usados por serviços de pagamento). Use apenas placeholders genéricos como
`[CHAVE_AQUI]` ou `[SECRET]` para evitar detecção automática de segredos pelo
GitHub.

#### ✅ CORRETO

```env
# Use placeholders genéricos e claros
ASAAS_API_KEY="\$aact_[SUA_API_KEY_AQUI]"
STRIPE_SECRET_KEY="[YOUR_STRIPE_SECRET_KEY]"
DATABASE_URL="postgresql://username:password@host:port/database"
NEXTAUTH_SECRET="your-production-secret-256-bits"
```

### **2. Use Placeholders Padronizados**

#### **Padrões Recomendados**

| Tipo de Credencial | Placeholder Padrão                          | Exemplo                                             |
| ------------------ | ------------------------------------------- | --------------------------------------------------- |
| API Keys           | `[SUA_API_KEY_AQUI]` ou `your-api-key-here` | `ASAAS_API_KEY="\$aact_[SUA_API_KEY_AQUI]"`         |
| Secret Keys        | `your-production-secret` ou `[SECRET]`      | `STRIPE_SECRET_KEY="[YOUR_STRIPE_SECRET_KEY]"`      |
| Tokens             | `your-production-token`                     | `RESEND_API_KEY="your-production-resend-key"`       |
| Passwords          | `password` ou `[PASSWORD]`                  | `DATABASE_URL="postgresql://user:password@host/db"` |
| Database URLs      | `postgresql://user:pass@host:port/db`       | Usar formato genérico                               |
| OAuth Secrets      | `your-oauth-secret`                         | `GOOGLE_CLIENT_SECRET="your-google-client-secret"`  |

### **3. Mantenha Contexto Técnico Sem Expor Dados**

#### ✅ BOM EXEMPLO

````markdown
**Formato da API Key Asaas:**

- Começa com `$aact_`
- Seguido de hash base64 complexo
- Tamanho: ~100-200 caracteres
- Contém caracteres especiais: `$`, `:`, `/`

**Exemplo de configuração:**

```env
ASAAS_API_KEY="\$aact_[SUA_API_KEY_AQUI]"
```
````

````

#### ❌ MAU EXEMPLO

```markdown
**API Key real:**
```env
ASAAS_API_KEY="$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJl..."
````

````

### **4. Adicione Avisos de Segurança Quando Necessário**

```markdown
⚠️ **NOTA DE SEGURANÇA:** Este documento foi sanitizado para remover credenciais reais.
Use apenas placeholders em exemplos. Nunca exponha chaves reais em documentação.
````

---

## 📝 CHECKLIST DE VALIDAÇÃO

Antes de commitar qualquer arquivo de documentação, verifique:

- [ ] ❌ Nenhuma chave de API real está exposta
- [ ] ❌ Nenhum token ou secret real está presente
- [ ] ❌ Nenhuma senha real está documentada
- [ ] ✅ Placeholders genéricos são usados
- [ ] ✅ Contexto técnico é mantido (formato, tamanho, estrutura)
- [ ] ✅ Avisos de segurança foram adicionados quando necessário
- [ ] ✅ Exemplos são claramente marcados como fictícios

### **Comando Útil para Verificação**

```bash
# Buscar possíveis credenciais expostas (executar antes de commit)
grep -riE "(api[_-]?key|secret|token|password|pwd)\s*[=:]\s*[\"']?[a-zA-Z0-9\$]{30,}" docs/

# Buscar padrões específicos de APIs conhecidas
grep -riE "(aact_|sk_live_|sk_test_|pk_live_|pk_test_)[a-zA-Z0-9]{30,}" docs/
```

---

## 🔍 TIPOS DE CREDENCIAIS SENSÍVEIS

### **1. Chaves de API e Tokens**

- API Keys (Asaas, Stripe, Resend, etc.)
- Access Tokens
- Bearer Tokens
- OAuth Tokens
- Webhook Secrets

### **2. Credenciais de Banco de Dados**

- Connection Strings completos (com senha)
- Passwords de banco de dados
- Connection URLs com credenciais

### **3. Segredos de Autenticação**

- NEXTAUTH_SECRET
- JWT Secrets
- Session Secrets
- Encryption Keys

### **4. Credenciais de Serviços Externos**

- Stripe (sk*live*_, sk*test*_, pk*live*_, pk*test*_)
- Google OAuth (GOCSPX-\*)
- Facebook OAuth
- SendGrid API Keys
- Resend API Keys
- ZapSign Tokens
- Melhor Envio Tokens

---

## 🛡️ PROCEDIMENTO EM CASO DE EXPOSIÇÃO

Se você descobrir que uma credencial foi exposta:

### **1. Revogação Imediata (CRÍTICO)**

1. **Revogar a credencial exposta imediatamente** no painel do serviço
2. Gerar nova credencial
3. Atualizar `.env.local` e variáveis de ambiente de produção

### **2. Limpeza do Repositório**

Se o repositório for privado:

- Considerar usar `git-filter-repo` ou `BFG Repo-Cleaner` para limpar histórico
- Se já foi feito push, a credencial já está comprometida

Se o repositório for público:

- A credencial está definitivamente comprometida
- Revogar imediatamente e considerar audit log do serviço

### **3. Sanitização da Documentação**

1. Substituir credenciais por placeholders
2. Adicionar aviso de segurança no documento
3. Commit com mensagem: `fix(security): sanitize exposed credentials in docs`

### **4. Comunicação**

- Notificar equipe sobre a exposição
- Verificar logs de uso da credencial exposta
- Monitorar atividades suspeitas no período de exposição

---

## 📚 EXEMPLOS DE BOAS PRÁTICAS

### **Exemplo 1: Configuração de Variáveis de Ambiente**

````markdown
### Configuração do .env.local

```env
# ⚠️ IMPORTANTE: Substitua os placeholders pelas suas credenciais reais
# NUNCA commite o arquivo .env.local com credenciais reais

ASAAS_API_KEY="\$aact_[SUA_API_KEY_AQUI]"
STRIPE_SECRET_KEY="[YOUR_STRIPE_SECRET_KEY]"
NEXTAUTH_SECRET="your-production-secret-256-bits"
DATABASE_URL="postgresql://username:password@host:port/database"
```
````

````

### **Exemplo 2: Documentação de Problemas/Troubleshooting**

```markdown
### Problema: API Key não está sendo carregada

**Sintoma:**
```typescript
process.env.ASAAS_API_KEY // Retorna undefined
````

**Solução:**

```env
# ❌ INCORRETO
ASAAS_API_KEY="$aact_[hash_completo]"

# ✅ CORRETO (escape cada $)
ASAAS_API_KEY="\$aact_[hash_completo_com_cada_$_escapado]"
```

⚠️ **NOTA DE SEGURANÇA:** Exemplos acima usam placeholders. Nunca exponha chaves
reais em documentação.

````

### **Exemplo 3: Guias de Setup**

```markdown
## Passo 3: Configurar API Key

1. Acesse o painel do Asaas
2. Gere uma nova API Key
3. Copie a chave (formato: `$aact_[hash]`)
4. Adicione ao `.env.local`:

```env
ASAAS_API_KEY="\$aact_[COLE_SUA_CHAVE_AQUI]"
````

**Formato esperado:**

- Começa com `$aact_`
- ~100-200 caracteres
- Contém caracteres especiais: `$`, `:`, `/`

```

---

## 🔗 REFERÊNCIAS

- [OWASP - Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitHub - Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [12-Factor App - Config](https://12factor.net/config)

---

## ✅ RESPONSABILIDADES

### **Para Desenvolvedores**

- ✅ Sempre usar placeholders em documentação
- ✅ Revisar arquivos antes de commit
- ✅ Executar verificação de credenciais antes de push
- ✅ Reportar exposições imediatamente

### **Para Code Reviewers**

- ✅ Verificar ausência de credenciais em PRs
- ✅ Rejeitar PRs com credenciais expostas
- ✅ Garantir uso de placeholders apropriados

### **Para a IA/Agentes**

- ✅ NUNCA incluir credenciais reais em documentação
- ✅ Sempre usar placeholders genéricos
- ✅ Manter contexto técnico sem expor dados sensíveis
- ✅ Adicionar avisos de segurança quando necessário

---

**Última atualização:** 30/12/2025
**Versão:** 1.0
**Mantido por:** Equipe de Desenvolvimento GB Locações
```
