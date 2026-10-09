# 📧 Sistema de E-mails para Orçamentos - GB Locações

> **Status**: ✅ Implementado (Dezembro 2024) **Funcionalidade**: Envio
> automático de orçamentos por email com template moderno

---

## 📋 Visão Geral

Sistema completo de envio de emails para **3 tipos de formulários**:

1. **Formulário de Contato Simples** (`/contato`)
2. **Formulário da Página Inicial** (Hero section)
3. **Formulário de Orçamento Completo** (`/orcamento`)

---

## 🎨 Design do Email

### **Características do Template:**

- ✅ **Identidade Visual GB Locações**
  - Gradiente laranja-vermelho (#ea580c → #dc2626)
  - Logo destacado com backdrop blur
  - Efeitos visuais modernos (círculos decorativos)

- ✅ **Tipografia Profissional**
  - Font: Inter (importada do Google Fonts)
  - Hierarquia clara de informações
  - Responsivo para mobile

- ✅ **Cards Coloridos por Categoria**
  - 🔴 Vermelho claro: Dados principais (Nome)
  - 🔵 Azul claro: Contato (Email)
  - 🟢 Verde claro: Telefone
  - 🟡 Amarelo: Informações adicionais

- ✅ **Elementos Interativos**
  - Email clicável (abre cliente de email)
  - Telefone clicável (inicia ligação)
  - Hover effects nos links

- ✅ **Mobile-First**
  - Responsivo para todos os dispositivos
  - Padding ajustável
  - Fontes escaláveis

---

## 📦 Formulários Configurados

### **1. Formulário de Contato (`/contato`)**

**API**: `/api/contact`

**Campos Capturados:**

- Nome Completo \*
- Email \*
- Telefone \* (com máscara)
- Empresa/Construtora
- Equipamento de Interesse
- CPF (com máscara)
- CNPJ (com máscara)
- Mensagem \*

**Validação**: Requer CPF **OU** CNPJ

**Email enviado**:

- Subject: `🎯 Novo Orçamento - [Nome do Cliente]`
- Template: Simples com todos os campos
- Sem cálculo de valores

---

### **2. Formulário da Página Inicial (QuoteForm)**

**API**: `/api/orcamentos`

**Campos Capturados:**

- Nome Completo \*
- Email \*
- Telefone \*
- Empresa/Construtora
- CEP
- CPF
- CNPJ
- Equipamento selecionado
- Dias de locação
- Nível de urgência
- Mensagem

**Email enviado**:

- Subject: `🎯 Novo Orçamento #[ID] - [Nome]`
- Template: Com tabela de equipamentos
- **Calcula valor total**
- Mostra preço por dia, quantidade, subtotais

---

### **3. Formulário de Orçamento Completo (`/orcamento`)**

**API**: `/api/quotes`

**Campos Capturados:**

- Nome Completo \*
- Email \*
- Telefone \*
- CPF
- CNPJ
- CEP
- Mensagem
- **Lista completa de equipamentos** (múltiplos)
- Quantidade de cada
- Dias de locação de cada

**Validação**: Requer CPF **OU** CNPJ

**Email enviado**:

- Subject: `🎯 Novo Orçamento #[ID] - [Nome]`
- Template: Tabela completa de equipamentos
- **Valor total calculado** (destaque grande)
- Mostra todos os itens com detalhes
- ID do orçamento no banco

---

### 4. Boleto (apos aprovacao)

**API**: `/api/admin/quotes/[id]/send-boleto`

**Quando envia**:

- Admin aprova o orcamento e gera o boleto (preview no painel)
- Admin envia o boleto para o cliente

**Email enviado**:

- Subject: `Boleto disponivel para pagamento - GB Locacoes`
- Template: `generateBoletoEmailHTML`
- Inclui valor, vencimento, linha digitavel e link para PDF

---

### 5. Orçamento ajustado (envio manual)

**API**: `/api/admin/quotes/[id]/send-adjusted-quote`

**Quando envia**:

- Admin ajusta o valor final com justificativa
- Admin clica em "Enviar Orçamento Ajustado"

**Email enviado**:

- Subject: `Orçamento ajustado - GB Locações`
- Template: `generateQuoteStatusChangeEmailHTML` (status `ADJUSTED`)
- Inclui valor original, valor final editado e justificativa

### 6. Pagamento confirmado (webhook Asaas)

**API**: `/api/payments/boleto/webhook`

**Quando envia**:

- Webhook confirma pagamento e a conversao do orcamento e concluida.

**Email enviado**:

- Subject: `Pagamento confirmado - GB Locacoes` (ou
  `Pagamento confirmado e locacao ativa - GB Locacoes` quando convertido)
- Template: `generateQuoteStatusChangeEmailHTML` (status `COMPLETED`/`APPROVED`)

## 🎯 Estrutura do Email (Template)

### **Header (Gradiente Laranja)**

```
┌─────────────────────────────────────┐
│ [Logo GB LOCAÇÕES]                  │
│                                     │
│ 📦 Novo Orçamento de Equipamentos   │
│ Um cliente solicitou orçamento...   │
│ ⏰ 04/12/2025, 19:04               │
│ #A1B2C3D4                           │
└─────────────────────────────────────┘
```

### **Seção 1: Dados do Cliente**

- Card vermelho: Nome
- Card azul: Email (clicável)
- Card verde: Telefone (clicável)

### **Seção 2: Informações Adicionais** (se houver)

- Empresa/Construtora
- Equipamento de Interesse

### **Seção 3: Documentação** (se houver)

- CPF (formatado)
- CNPJ (formatado)

### **Seção 4: Equipamentos** (só para orçamentos completos)

```
┌───────────────────────────────────────────────┐
│ Betoneira 400L                    R$ 180,00  │
│ 📂 Betoneiras e Misturadores                 │
│ 2x · 7 dia(s) · R$ 90,00/dia                 │
└───────────────────────────────────────────────┘
```

### **Seção 5: Valor Total** (se calculado)

```
┌─────────────────────────────────────┐
│            VALOR TOTAL ESTIMADO     │
│              R$ 1.260,00            │
│ *Valor sujeito a confirmação        │
└─────────────────────────────────────┘
```

### **Seção 6: Mensagem**

- Box com borda tracejada
- Preserva quebras de linha

### **Footer**

- Instruções de resposta
- Botão de email do cliente
- Copyright GB Locações

---

## ⚙️ Configuração

### **Variáveis de Ambiente Necessárias:**

```env
RESEND_API_KEY="re_xxxxx"
FROM_EMAIL="contato@locacoesgb.com.br"
CONTACT_EMAIL="contato@locacoesgb.com.br"
```

### **Domínio Verificado:**

- ✅ Domínio `locacoesgb.com.br` verificado no Resend
- ✅ Registros DNS configurados (DKIM, SPF, DMARC)
- ✅ Email de envio: `contato@locacoesgb.com.br`

---

## 🔄 Fluxo de Orçamento

```
Cliente preenche formulário
         ↓
Validação frontend (Zod + React Hook Form)
         ↓
POST para API (/api/contact, /api/orcamentos ou /api/quotes)
         ↓
Validação backend (Zod Schema)
         ↓
Salva no banco de dados (Quote model)
         ↓
Calcula valores (se aplicável)
         ↓
Envia email via Resend
         ↓
Retorna sucesso com toast
         ↓
Cliente vê confirmação
```

---

## Diagramas Relacionados

- `docs/architecture/diagrams/quote-email-flow.mermaid`

---

## ?? Precisao de precos (dez 2025)

- `/api/quotes` e `/api/orcamentos` recalculam cada item no backend com
  `packages/domain/src/orcamento/preco.ts` (mesmo motor do `/orcamento`),
  garantindo que descontos e valores diretos aparecam nos emails.
- Os campos `pricePerDay` e `total` salvos no banco agora refletem o valor
  realmente calculado (dias x quantidade), nao apenas o `pricePerDay` base do
  equipamento.
- Caso o frontend envie valores precalculados, o backend refaz o calculo para
  evitar divergencias entre o resumo da pagina e o email recebido.
- Badges de data/hora e ID do orcamento agora ficam na mesma linha (inline) para
  evitar quebra estranha em alguns clientes de email.
- Cada equipamento no email exibe a miniatura (primeira imagem do catalogo) ao
  lado esquerdo do bloco de detalhes.

---

## 📧 Tipos de Email por Formulário

| Formulário     | API               | Calcula Valor? | Salva no Banco? | Campos Extras               |
| -------------- | ----------------- | -------------- | --------------- | --------------------------- |
| `/contato`     | `/api/contact`    | ❌ Não         | ❌ Não          | CPF, CNPJ, Empresa          |
| Página Inicial | `/api/orcamentos` | ✅ Sim         | ✅ Sim          | Urgência, Dias              |
| `/orcamento`   | `/api/quotes`     | ✅ Sim         | ✅ Sim          | Múltiplos equipamentos, CEP |

---

## 🎯 Diferenças dos Templates

### **Contato Simples:**

- Mais compacto
- Sem tabela de equipamentos
- Sem cálculo de valores
- Foco em contato inicial

### **Orçamento Completo:**

- Tabela detalhada de equipamentos
- Cálculo de valores por item
- Valor total em destaque
- ID do orçamento
- Informações de CEP

---

## 🔒 Segurança

- ✅ **Rate Limiting**: 10 requisições/minuto por IP
- ✅ **Validação Zod**: Backend valida todos os campos
- ✅ **XSS Protection**: HTML escapado automaticamente
- ✅ **Dados sensíveis**: CPF/CNPJ armazenados com segurança

---

## 🧪 Testando

### **Teste Manual:**

1. **Formulário de Contato:**

   ```
   http://localhost:3000/contato
   ```

   - Preencha todos os campos
   - Informe CPF ou CNPJ
   - Verifique email no Zoho

2. **Formulário da Página Inicial:**

   ```
   http://localhost:3000/
   ```

   - Role até "Solicite um Orçamento"
   - Preencha e envie
   - Email deve ter valor calculado

3. **Formulário de Orçamento Completo:**

   ```
   http://localhost:3000/orcamento
   ```

   - Adicione equipamentos ao carrinho
   - Preencha dados
   - Email deve ter tabela completa

### **Validações Esperadas:**

- ❌ Email vazio → Erro
- ❌ CPF e CNPJ vazios → Erro
- ❌ Telefone vazio → Erro
- ✅ Todos preenchidos → Sucesso
- ✅ Toast aparece por 8 segundos
- ✅ Email chega no Zoho
- ✅ Template moderno é exibido

---

## 🚀 Próximas Melhorias

### **Fase 0.2: Dashboard de Orçamentos**

- Listar todos os orçamentos recebidos
- Filtrar por status (Novo, Em Análise, Aprovado)
- Responder diretamente pela plataforma

### **Fase 1: Automações**

- Email de confirmação para o cliente
- Email de lembrete (follow-up)
- Templates personalizados por tipo

---

## 📊 Métricas

- **Tempo de envio**: ~400-800ms
- **Taxa de entrega**: 100% (Resend Delivered)
- **Testes**: 30/31 passando
- **Performance**: < 1s resposta total

---

## 🐛 Troubleshooting

### **Email não chega:**

1. Verifique `https://resend.com/emails`
2. Veja status: Delivered, Bounced, Spam
3. Aguarde até 2 minutos (propagação)

### **Template quebrado:**

1. Verifique HTML no código
2. Teste no Resend preview
3. Valide variáveis (data, equipments)

### **Erro 503:**

- Variáveis de ambiente não configuradas
- Verifique `.env.local`
- Reinicie o servidor

---

**Última atualização**: 2026-01-10 **Versão**: 2.1.0 **Autor**: GB Locações
Development Team
