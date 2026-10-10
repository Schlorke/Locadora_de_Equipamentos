# 📧 Templates de Email - Referência Rápida

> **Referência**: renderizadores internos ao backend. A versão 2.0.0 e a
> compatibilidade declarada pertencem ao registro de Dezembro 2024; não são
> validação atual de entrega ou clientes de email.

---

## ⚡ Uso Rápido

Exemplos dentro de `packages/backend/src/modules/communications`, com
`loadTenantBranding` e `context` injetados. A marca é da Organization ativa;
imports relativos abaixo são internos, não entradas públicas dos hosts/clientes.
Para entrega, a API compõe `createQuoteCreatedEffects` pela entrada
`@gb-locacoes/backend/communications` e o worker processa o pedido persistido.

### **Formulário de Contato Simples**

```typescript
import { generateContactEmailHTML } from "./email-templates"

const branding = await loadTenantBranding(context)
const html = generateContactEmailHTML(
  branding,
  {
    name: "Nome do Cliente",
    email: "cliente@email.com",
    phone: "51999887766",
    message: "Mensagem aqui",
    // Opcionais:
    company: "Nome da Empresa",
    equipment: "Equipamento de Interesse",
    cpf: "123.456.789-00",
    cnpj: "12.345.678/0001-90"
  },
  "contact-id-exemplo"
)
```

### **Orçamento Completo**

```typescript
import { generateQuoteEmailHTML } from "./email-templates"

const branding = await loadTenantBranding(context)
const html = generateQuoteEmailHTML(
  branding,
  {
    customerName: "Nome do Cliente",
    customerEmail: "cliente@email.com",
    customerPhone: "51999887766",
    customerCompany: "Empresa (opcional)",
    message: "Mensagem (opcional)"
  },
  [
    {
      name: "Andaime Suspenso 10m",
      category: "Andaimes",
      quantity: 2,
      days: 15,
      pricePerDay: 120.0,
      total: 3600.0
    }
  ],
  3600.0,
  "quoteId123"
)
```

---

## 🎨 Padrões de Design

### **Cores**

```css
/* Header */
Background: linear-gradient(135deg, #334155, #475569)
Logo: linear-gradient(135deg, #f97316, #ea580c, #c2410c)
Texto: #ffffff

/* "Orçamento" */
Color: #ffd700
Glow: 0 0 20px rgba(255,215,0,0.8), 0 0 30px rgba(255,215,0,0.5)

/* Card */
Background: #ffffff
Shadow: 0 4px 12px rgba(0,0,0,0.05)
```

### **Emojis**

```
👤 Nome       ✉️ Email      📞 Telefone
📄 CPF        📋 CNPJ       🏢 Empresa
🛠️ Equipamento  💬 Mensagem   🎯 Alvo
⏰ Data/Hora  📦 Produtos
```

---

## ✅ Checklist de Validação

- [ ] Header com texto branco (#ffffff)
- [ ] Logo GB sem glow
- [ ] "Orçamento" com glow dourado
- [ ] Emojis visíveis em todos os ícones
- [ ] Sombra sutil no card
- [ ] Layout 2 colunas no header
- [ ] Links clicáveis (email, tel)
- [ ] Responsivo

---

## ⚠️ Regras Críticas

### **✅ SEMPRE:**

1. Use `<table>` para layout
2. Use emojis (não SVG)
3. Use `#ffffff` (não rgba)
4. Use inline styles
5. Teste em Gmail + Outlook

### **❌ NUNCA:**

1. Não use flexbox/grid
2. Não use SVG inline
3. Não use rgba() em texto
4. Não use CSS externo
5. Não use position absolute

---

## 📁 Arquivos Principais

```
packages/backend/src/modules/communications/email-templates.ts  # HTML interno
packages/backend/src/modules/communications/tenant-branding.ts  # marca por locadora
packages/backend/src/modules/communications/quote-created-effects.ts # efeito de outbox
apps/services/api/src/host/notification-effects.ts              # composição dos efeitos
apps/services/api/src/app/api/contact/route.ts                  # 202, contato persistido/fila
apps/services/api/src/app/api/orcamentos/route.ts               # 201, orçamento/fila
apps/services/api/src/app/api/quotes/route.ts                    # 201, orçamento/fila
public/email-templates/quote-template.html                      # referência visual histórica
docs/features/email-templates.md                               # documentação completa
```

---

## 🔧 Troubleshooting Rápido

| Problema              | Solução                             |
| --------------------- | ----------------------------------- |
| Texto preto no header | Usar `#ffffff` ao invés de `rgba()` |
| Ícones não aparecem   | Usar emojis ao invés de SVG         |
| Layout quebrado       | Usar `<table>` ao invés de divs     |
| Sombra não aparece    | Normal - é enhancement progressivo  |

---

## 📚 Documentação Completa

- [Guia Completo](./email-templates.md)
- [Sistema de Orçamentos](./quote-email-system.md)
- [Design System](./design-system.md)

---

**Última atualização**: Dezembro 2024
