# 📋 Análise de Erros - Implementação de Scroll em Modais

> **Atualização (nov/2025)**: Os modais administrativos descritos neste
> relatório foram removidos. O novo componente baseado em Base UI está sendo
> desenvolvido em `app/playground/page.tsx` (ver `docs/features/dialog-lab.md`).
> Este documento permanece como histórico das dores que motivaram a migração.

> **Data**: Janeiro 2025 **Contexto**: Correção de problemas de scroll em modais
> administrativos **Arquivos Afetados**: `app/admin/equipamentos/page.tsx`,
> `app/admin/categorias/page.tsx`

## 🚨 **Erros Cometidos e Lições Aprendidas**

### **1. Erro: Uso Incorreto do ScrollArea do Radix UI**

**❌ Problema:**

```tsx
// IMPLEMENTAÇÃO INCORRETA
<ScrollArea className="flex-1 min-h-0 max-h-full w-full overflow-y-auto">
  <div className="p-6 space-y-6">{/* conteúdo */}</div>
</ScrollArea>
```

**🔍 Causa Raiz:**

- ScrollArea do Radix UI precisa de altura específica para funcionar
- `max-h-full` não é suficiente para ativar o scroll
- Container pai não tinha altura definida adequadamente

**✅ Solução:**

```tsx
// IMPLEMENTAÇÃO CORRETA
<div
  className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden force-scroll"
  style={{ maxHeight: "calc(80vh - 120px)" }}
>
  <div className="p-6 space-y-6">{/* conteúdo */}</div>
</div>
```

### **2. Erro: Altura do Modal Muito Grande**

**❌ Problema:**

```tsx
// ALTURA PROBLEMÁTICA
className = "h-[100svh] max-h-[100svh]"
height = "calc(100svh - env(safe-area-inset-top) - env(safe-area-inset-bottom))"
```

**🔍 Causa Raiz:**

- Modal ocupava 100% da viewport
- Não havia espaço para scroll porque conteúdo cabia na tela
- Botões ficavam fora da área visível

**✅ Solução:**

```tsx
// ALTURA ADEQUADA
className = "max-h-[80vh]"
height = "80vh"
```

### **3. Erro: Falta de CSS Forçado para Scroll**

**❌ Problema:**

- Scroll não aparecia mesmo com `overflow-y-auto`
- Scrollbar nativo do navegador não era confiável
- Diferentes navegadores comportavam-se de forma inconsistente

**✅ Solução:**

```css
/* CSS FORÇADO PARA SCROLL */
.force-scroll {
  overflow-y: scroll !important;
  scrollbar-width: thin !important;
  scrollbar-color: #cbd5e1 #f8fafc !important;
}

.force-scroll::-webkit-scrollbar {
  width: 8px !important;
  background: #f8fafc !important;
}

.force-scroll::-webkit-scrollbar-track {
  background: #f8fafc !important;
  border-radius: 4px !important;
}

.force-scroll::-webkit-scrollbar-thumb {
  background: #cbd5e1 !important;
  border-radius: 4px !important;
  border: 1px solid #f8fafc !important;
}

.force-scroll::-webkit-scrollbar-thumb:hover {
  background: #94a3b8 !important;
}
```

### **4. Erro: Cálculo de Altura Incorreto**

**❌ Problema:**

- Não reservar espaço para header e footer
- Conteúdo sobrepunha elementos fixos

**✅ Solução:**

```tsx
// CÁLCULO CORRETO DE ALTURA
style={{ maxHeight: 'calc(80vh - 120px)' }}
// 120px reserva espaço para header (~60px) + footer (~60px)
```

## 📚 **Lições Aprendidas**

### **1. Sempre Testar Scroll em Diferentes Cenários**

- Conteúdo curto (sem scroll)
- Conteúdo médio (scroll parcial)
- Conteúdo longo (scroll completo)

### **2. Modal Height Best Practices**

- **Nunca usar**: `100vh` ou `100svh`
- **Sempre usar**: `80vh` ou `90vh` máximo
- **Sempre calcular**: espaço para header e footer

### **3. Scroll Implementation Checklist**

- [ ] Modal tem altura limitada (`max-h-[80vh]`)
- [ ] Container de scroll tem altura específica
- [ ] CSS com `!important` para forçar scroll
- [ ] Scrollbar customizada visível
- [ ] Header e footer fixos funcionando
- [ ] Botões sempre visíveis

### **4. Componentes Radix UI - Limitações**

- ScrollArea precisa de altura específica
- Não confiar apenas em classes Tailwind
- Sempre usar CSS inline quando necessário
- Testar em diferentes navegadores

## 🔧 **Padrão Final Estabelecido**

```tsx
// ESTRUTURA CORRETA PARA MODAIS COM SCROLL
<DialogContent
  className="max-h-[80vh]"
  style={{ height: "80vh", maxHeight: "80vh" }}
>
  <DialogHeader className="shrink-0">{/* Header fixo */}</DialogHeader>

  <div
    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden force-scroll"
    style={{ maxHeight: "calc(80vh - 120px)" }}
  >
    <div className="p-6 space-y-6">{/* Conteúdo scrollável */}</div>
  </div>

  <DialogFooter className="shrink-0">{/* Footer fixo */}</DialogFooter>
</DialogContent>
```

## 🎯 **Prevenção de Regressões**

### **Checklist Obrigatório para Novos Modais:**

1. ✅ Modal com altura `max-h-[80vh]`
2. ✅ Container de scroll com `force-scroll`
3. ✅ Altura calculada: `calc(80vh - 120px)`
4. ✅ Header e footer com `shrink-0`
5. ✅ Teste de scroll em conteúdo longo
6. ✅ Verificação de botões sempre visíveis

### **Código de Validação:**

```javascript
// Adicionar aos testes automatizados
describe("Modal Scroll Behavior", () => {
  it("should show scrollbar when content exceeds modal height", () => {
    // Teste com conteúdo longo
  })

  it("should keep header and footer fixed", () => {
    // Verificar elementos fixos
  })

  it("should show action buttons always visible", () => {
    // Verificar botões no footer
  })
})
```

---

**📝 Documentado em**: Janeiro 2025 **🔗 Relacionado**: Modal scroll
implementation, Radix UI limitations, CSS overflow behavior
