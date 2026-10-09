# SKILL: Implementação de Dialogs no Projeto GB Locações

> **Propósito**: Este documento é uma fonte de conhecimento persistente e
> definitiva para implementação de dialogs neste projeto. Qualquer IA integrada
> (Claude, Cursor, etc.) DEVE consultar e seguir rigorosamente este guia ao
> criar, modificar ou sugerir dialogs.

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura de Componentes](#arquitetura-de-componentes)
3. [Estrutura Obrigatória](#estrutura-obrigatória)
4. [Mecanismo de Nested Dialogs](#mecanismo-de-nested-dialogs)
5. [Padrões de Header](#padrões-de-header)
6. [Padrões de Body](#padrões-de-body)
7. [Padrões de Footer](#padrões-de-footer)
8. [Tipografia e Cores](#tipografia-e-cores)
9. [Variantes de Dialog](#variantes-de-dialog)
10. [Exemplos de Referência](#exemplos-de-referência)
11. [O Que Fazer e NÃO Fazer](#o-que-fazer-e-não-fazer)
12. [Checklist de Implementação](#checklist-de-implementação)

---

## Visão Geral

Este projeto utiliza um sistema de dialogs baseado no **Base UI**
(`@base-ui/react/dialog`), não o Radix UI Dialog padrão. O componente principal
está em `components/ui/dialog.tsx` e exporta um objeto `Dialog` com
subcomponentes compostos.

### Componente Principal

```tsx
import { Dialog } from "@/components/ui/dialog"
```

### Subcomponentes Disponíveis

| Subcomponente         | Função                                             |
| --------------------- | -------------------------------------------------- |
| `Dialog.Root`         | Container raiz que gerencia estado open/close      |
| `Dialog.Portal`       | Portal para renderização fora do DOM pai           |
| `Dialog.Backdrop`     | Overlay escuro atrás da dialog (bg-black/60)       |
| `Dialog.Popup`        | Container visual da dialog com variantes           |
| `Dialog.Content`      | Wrapper interno para layout flex                   |
| `Dialog.Header`       | Cabeçalho com gradiente e borda inferior           |
| `Dialog.HeaderIcon`   | Ícone no header (gradiente slate-600 to slate-700) |
| `Dialog.Title`        | Título da dialog (text-xl font-semibold)           |
| `Dialog.Description`  | Descrição opcional abaixo do título                |
| `Dialog.CloseButton`  | Botão X no canto superior direito                  |
| `Dialog.Body`         | Container do conteúdo com flex-1                   |
| `Dialog.BodyViewport` | Área scrollável com overflow controlado            |
| `Dialog.BodyContent`  | Padding e espaçamento do conteúdo                  |
| `Dialog.Footer`       | Rodapé com fundo cinza e borda superior            |
| `Dialog.Close`        | Componente para fechar a dialog                    |
| `Dialog.Trigger`      | Trigger para abrir a dialog                        |

---

## Arquitetura de Componentes

### Importação Correta

```tsx
"use client"

import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, SomeIcon } from "lucide-react"
```

### Estrutura Completa Padrão

```tsx
<Dialog.Root open={isOpen} onOpenChange={onClose}>
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Popup variant="default">
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.HeaderIcon>
            <SomeIcon className="h-4 w-4" />
          </Dialog.HeaderIcon>
          <Dialog.Title className="text-xl font-semibold text-gray-800">
            Título da Dialog
          </Dialog.Title>
          <Dialog.CloseButton aria-label="Fechar dialog" />
        </Dialog.Header>

        <Dialog.Body>
          <Dialog.BodyViewport style={{ scrollbarGutter: "stable" }}>
            <Dialog.BodyContent>{/* Conteúdo aqui */}</Dialog.BodyContent>
          </Dialog.BodyViewport>
        </Dialog.Body>

        <Dialog.Footer>{/* Botões de ação */}</Dialog.Footer>
      </Dialog.Content>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

---

## Estrutura Obrigatória

### Hierarquia de Componentes

A hierarquia DEVE ser respeitada exatamente:

```
Dialog.Root
├── Dialog.Portal
│   ├── Dialog.Backdrop
│   └── Dialog.Popup
│       └── Dialog.Content
│           ├── Dialog.Header
│           │   ├── Dialog.HeaderIcon
│           │   ├── Dialog.Title
│           │   └── Dialog.CloseButton
│           ├── Dialog.Body
│           │   └── Dialog.BodyViewport
│           │       └── Dialog.BodyContent
│           └── Dialog.Footer
```

### Atributos de Seção (Data Attributes)

Para facilitar estilização e debugging, use:

```tsx
<Dialog.Header data-dialog-section="header">
<Dialog.Footer data-dialog-section="footer">
```

---

## Mecanismo de Nested Dialogs

### Conceito

O sistema suporta dialogs aninhadas (nested) onde uma segunda dialog pode abrir
sobre a primeira. Quando isso acontece:

1. A **primeira dialog** recua visualmente (escala reduzida)
2. Um **overlay escuro** é aplicado sobre a primeira dialog
3. A **segunda dialog** recebe foco e contraste total

### Implementação

#### 1. Estado de Controle

```tsx
const [nestedDialogOpen, setNestedDialogOpen] = useState(false)
```

#### 2. Atributo data-nested-parent

Na `Dialog.Popup` da dialog PAI:

```tsx
<Dialog.Popup
  variant="default"
  data-nested-parent={nestedDialogOpen ? '' : undefined}
>
```

#### 3. Overlay Manual (Opcional)

Para controle mais preciso do overlay:

```tsx
<Dialog.Content className="relative">
  {nestedDialogOpen && (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-black/45"
    />
  )}
  {/* resto do conteúdo */}
</Dialog.Content>
```

#### 4. Dialog Filha (Nested)

```tsx
{
  /* Dentro do Dialog.BodyContent da dialog pai */
}
;<Dialog.Root open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Popup
      variant="default"
      className="max-w-md h-auto max-h-[70vh] md:h-auto md:max-h-[70vh]"
    >
      <Dialog.Content>
        <Dialog.Header className="flex-col items-start gap-1 pb-3">
          <Dialog.CloseButton />
          <Dialog.Title className="text-lg font-semibold text-gray-900">
            Confirmar Ação?
          </Dialog.Title>
        </Dialog.Header>
        {/* ... */}
      </Dialog.Content>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

### Classes CSS para Nested

O sistema aplica automaticamente via CSS:

```css
/* Dialog pai quando tem filha aberta */
data-[nested-dialog-open]:after:absolute
data-[nested-dialog-open]:after:inset-0
data-[nested-dialog-open]:after:rounded-[inherit]
data-[nested-dialog-open]:after:bg-black/5

/* Dialog pai recuando */
-data-[nested-parent]:translate-y-[0.85rem]
data-[nested-parent]:scale-[0.985]
```

---

## Padrões de Header

### Header Padrão (Dialog Principal)

```tsx
<Dialog.Header>
  <Dialog.HeaderIcon>
    <Eye className="h-4 w-4" />
  </Dialog.HeaderIcon>
  <Dialog.Title className="text-xl font-semibold text-gray-800">
    Visualizar Equipamento
  </Dialog.Title>
  <Dialog.CloseButton aria-label="Fechar dialog" />
</Dialog.Header>
```

**Estilos aplicados automaticamente:**

- Background: `bg-gradient-to-r from-slate-50 to-slate-100`
- Padding: `p-4 md:p-6`
- Borda: `border-b border-gray-100`
- Border radius: `rounded-t-2xl`

### Header com Informações Adicionais

```tsx
<Dialog.Header>
  <Dialog.HeaderIcon className="overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-orange-500">
    {/* Avatar ou imagem */}
    <img src={userImage} alt="" className="h-full w-full object-cover" />
  </Dialog.HeaderIcon>
  <Dialog.Title className="text-xl font-semibold text-gray-800">
    Detalhes do Orçamento - {userName}
  </Dialog.Title>
  {/* Informação adicional à direita */}
  <div className="ml-auto mr-10 flex items-center gap-2 text-sm text-gray-500">
    <Clock className="w-4 h-4" />
    <span>{formattedDate}</span>
  </div>
  <Dialog.CloseButton />
</Dialog.Header>
```

### Header para Dialog de Confirmação (Nested/Compacta)

```tsx
<Dialog.Header className="flex-col items-start gap-1 pb-3">
  <Dialog.CloseButton />
  <Dialog.Title className="text-lg font-semibold text-gray-900">
    Rejeitar Orçamento?
  </Dialog.Title>
</Dialog.Header>
```

**Diferenças para dialogs de confirmação:**

- Título: `text-lg` (não `text-xl`)
- Layout: `flex-col items-start`
- Sem HeaderIcon (opcional)
- CloseButton antes do título

### HeaderIcon - Especificações

**Tamanho padrão:** 32x32px (h-8 w-8) **Ícone interno:** 16x16px (h-4 w-4) **Cor
padrão:** `bg-gradient-to-br from-slate-600 to-slate-700 text-white`

```tsx
;<Dialog.HeaderIcon>
  <Package className="h-4 w-4" />
</Dialog.HeaderIcon>

{
  /* Com cor customizada */
}
;<Dialog.HeaderIcon className="bg-gradient-to-br from-red-500 to-red-600">
  <AlertTriangle className="h-4 w-4" />
</Dialog.HeaderIcon>

{
  /* Com avatar/imagem */
}
;<Dialog.HeaderIcon className="overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-orange-500">
  <img src={avatar} className="h-full w-full object-cover" />
</Dialog.HeaderIcon>
```

---

## Padrões de Body

### Body Padrão

```tsx
<Dialog.Body>
  <Dialog.BodyViewport style={{ scrollbarGutter: "stable" }}>
    <Dialog.BodyContent>{/* Conteúdo */}</Dialog.BodyContent>
  </Dialog.BodyViewport>
</Dialog.Body>
```

**scrollbarGutter: 'stable'** - Evita layout shift quando scrollbar
aparece/desaparece.

### Body para Dialogs Compactas

```tsx
<Dialog.Body className="flex-none">
  <Dialog.BodyViewport className="max-h-[50vh] overflow-y-auto">
    <Dialog.BodyContent className="space-y-2 py-2">
      {/* Conteúdo */}
    </Dialog.BodyContent>
  </Dialog.BodyViewport>
</Dialog.Body>
```

### Seções de Conteúdo com Cards

```tsx
<Dialog.BodyContent>
  {/* Card com borda colorida à esquerda */}
  <Card className="border-l-4 border-l-blue-500">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-lg">
        <User className="w-5 h-5 text-blue-600" />
        Informações do Cliente
      </CardTitle>
    </CardHeader>
    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Campos de informação */}
    </CardContent>
  </Card>

  {/* Card com borda verde */}
  <Card className="border-l-4 border-l-green-500">{/* ... */}</Card>
</Dialog.BodyContent>
```

### Campo de Informação Padrão

```tsx
<div className="flex items-center gap-3">
  <Mail className="w-4 h-4 text-gray-400" />
  <div>
    <div className="text-sm text-gray-500">Email</div>
    <div className="font-medium">{email}</div>
  </div>
</div>
```

---

## Padrões de Footer

### Footer Padrão (2 botões)

```tsx
<Dialog.Footer>
  <div className="flex gap-4 w-full xs:gap-2 flex-wrap">
    <Button
      variant="outline"
      onClick={onClose}
      className="flex-1 h-10 rounded-lg border border-slate-200 hover:bg-slate-50 bg-transparent shadow-md hover:scale-105 hover:shadow-lg transition-all duration-300"
    >
      <X className="w-4 h-4 mr-2" />
      Fechar
    </Button>
    <Button
      onClick={onSubmit}
      className="flex-1 h-10 shadow-md transition-all duration-300 hover:shadow-lg"
    >
      <Edit className="w-4 h-4 mr-2" />
      Editar
    </Button>
  </div>
</Dialog.Footer>
```

### Footer para Dialog de Confirmação

```tsx
<Dialog.Footer className="flex flex-row gap-3">
  <Button
    variant="outline"
    onClick={() => setShowDialog(false)}
    disabled={isLoading}
    className="flex-1"
  >
    Cancelar
  </Button>
  <Button
    variant="default"
    onClick={handleConfirm}
    disabled={isLoading}
    className="flex-1"
  >
    {isLoading ? "Processando..." : "Confirmar"}
  </Button>
</Dialog.Footer>
```

### Footer com Múltiplos Botões

```tsx
<Dialog.Footer>
  <div className="flex flex-col gap-3 w-full">
    <div className="grid grid-cols-2 gap-3">
      <Button variant="outline" onClick={onReject}>
        <XCircle className="w-4 h-4 mr-2" />
        Rejeitar
      </Button>
      <Button onClick={onApprove}>
        <CheckCircle className="w-4 h-4 mr-2" />
        Aprovar
      </Button>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <Button variant="outline" onClick={onAdjust}>
        <Edit className="w-4 h-4 mr-2" />
        Ajustar
      </Button>
      <Button variant="outline" onClick={onViewBoleto}>
        <Download className="w-4 h-4 mr-2" />
        Abrir Boleto
      </Button>
    </div>
  </div>
</Dialog.Footer>
```

### Footer Responsivo

```tsx
<Dialog.Footer className="flex flex-col-reverse sm:flex-row gap-3">
  <Button variant="outline" className="w-full sm:flex-1">
    Cancelar
  </Button>
  <Button className="w-full sm:flex-1">Confirmar</Button>
</Dialog.Footer>
```

---

## Tipografia e Cores

### Títulos

| Contexto              | Classes                                | Exemplo                  |
| --------------------- | -------------------------------------- | ------------------------ |
| Dialog principal      | `text-xl font-semibold text-gray-800`  | "Detalhes do Orçamento"  |
| Dialog de confirmação | `text-lg font-semibold text-gray-900`  | "Excluir Orçamento?"     |
| Seção/Card título     | `text-lg` + ícone                      | "Informações do Cliente" |
| Subtítulo de seção    | `text-sm font-semibold text-slate-700` | "Preview do Equipamento" |

### Descrições e Labels

| Contexto            | Classes                                |
| ------------------- | -------------------------------------- |
| Descrição em dialog | `text-sm text-gray-600`                |
| Label de campo      | `text-sm text-gray-500`                |
| Valor de campo      | `font-medium` ou `font-medium text-sm` |
| Texto auxiliar      | `text-xs text-slate-500`               |
| Texto itálico       | `text-xs italic text-slate-500`        |

### Cores de Ícones

| Contexto                 | Cor                                      |
| ------------------------ | ---------------------------------------- |
| Ícone em campo           | `text-gray-400`                          |
| Ícone de seção           | `text-{color}-600` (ex: `text-blue-600`) |
| Ícone de status positivo | `text-green-500` ou `text-green-600`     |
| Ícone de status negativo | `text-red-500` ou `text-red-600`         |
| Ícone de warning         | `text-yellow-500`                        |

### Cores de Cards com Borda

```tsx
// Informações gerais - Azul
<Card className="border-l-4 border-l-blue-500">

// Período/Datas - Verde
<Card className="border-l-4 border-l-green-500">

// Status/Financeiro - Púrpura
<Card className="border-l-4 border-l-purple-500">

// Alertas/Perdas - Vermelho
<Card className="border-l-4 border-l-red-500">

// Dinâmico (cor da categoria)
<Card style={{ borderLeft: `4px solid ${category.bgColor}` }}>
```

---

## Variantes de Dialog

### Variant: default

```tsx
<Dialog.Popup variant="default">
```

**Especificações:**

- Largura: `w-[calc(100vw-0.8rem)] max-w-lg`
- Altura: `h-[80vh] max-h-[80vh] md:h-[71vh] md:max-h-[71vh]`
- Border radius: `rounded-2xl`
- Shadow: `shadow-2xl ring-1 ring-slate-200`

### Variant: compact

```tsx
<Dialog.Popup variant="compact">
```

**Especificações:**

- Largura: `w-96 max-w-[calc(100vw-3rem)]`
- Padding: `p-4 md:p-6`
- Border radius: `rounded-lg`
- Background: `bg-gray-50`

### Customizações Comuns

```tsx
// Dialog maior
<Dialog.Popup variant="default" className="max-w-4xl">

// Dialog de confirmação (altura auto)
<Dialog.Popup variant="default" className="max-w-md h-auto max-h-[70vh] md:h-auto md:max-h-[70vh]">

// Dialog de formulário complexo
<Dialog.Popup variant="default" className="max-w-xl max-h-[90vh] md:max-h-[85vh]">

// Dialog sem ring
<Dialog.Popup variant="default" className="ring-0">
```

---

## Exemplos de Referência

### Arquivos de Referência no Projeto

| Tipo de Dialog             | Arquivo                                             |
| -------------------------- | --------------------------------------------------- |
| Dialog completa com nested | `app/admin/orcamentos/page.tsx`                     |
| Dialog de visualização     | `components/dialogs/view-equipment-dialog.tsx`      |
| Dialog de formulário       | `components/dialogs/category-dialog.tsx`            |
| Alert dialog               | `components/ui/alert-dialog.tsx`                    |
| Dialog de confirmação      | `components/dialogs/logout-confirmation-dialog.tsx` |

### Padrão de Dialog com Nested para Confirmação

```tsx
// Em app/admin/orcamentos/page.tsx
// Veja as dialogs: showDeleteDialog, showRejectDialog, showRemoveApprovalDialog
```

---

## O Que Fazer e NÃO Fazer

### FAZER

- Usar a estrutura hierárquica completa de componentes
- Aplicar `data-nested-parent` quando houver dialogs aninhadas
- Usar `scrollbarGutter: 'stable'` no BodyViewport
- Incluir `aria-label` no CloseButton
- Usar ícones de 16x16 (h-4 w-4) dentro do HeaderIcon
- Manter padding consistente (p-4 md:p-6)
- Usar Cards com borda colorida para seções de conteúdo
- Aplicar transições suaves nos botões (transition-all duration-300)

### NÃO FAZER

- Usar Radix Dialog diretamente (usar `@/components/ui/dialog`)
- Omitir o Dialog.Backdrop
- Colocar Dialog.Portal fora de Dialog.Root
- Usar tamanhos de fonte diferentes dos especificados
- Esquecer de gerenciar estado `nestedDialogOpen` para dialogs aninhadas
- Usar `z-index` manual (o sistema de layers já cuida disso)
- Criar headers sem o gradiente padrão
- Omitir o botão de fechar (CloseButton)

---

## Checklist de Implementação

Antes de finalizar uma dialog, verifique:

- [ ] Estrutura hierárquica correta (Root > Portal > Backdrop + Popup)
- [ ] Dialog.Content com layout flex correto
- [ ] Header com HeaderIcon, Title e CloseButton
- [ ] Body com BodyViewport e BodyContent
- [ ] Footer com botões padronizados
- [ ] Tipografia seguindo os padrões (text-xl para título principal)
- [ ] Ícones com tamanhos corretos (h-4 w-4)
- [ ] Se tem nested dialog: estado e `data-nested-parent` configurados
- [ ] Transições e hover states nos botões
- [ ] Aria labels para acessibilidade
- [ ] Responsividade testada (mobile e desktop)

---

## Atualizações

| Data       | Descrição                   |
| ---------- | --------------------------- |
| 2026-02-01 | Documentação inicial criada |

---

> **Nota para IAs**: Este documento deve ser consultado SEMPRE que implementar
> ou modificar dialogs. Em caso de dúvida sobre um padrão específico, consulte
> os arquivos de referência listados acima. Priorize consistência visual e de
> comportamento com as dialogs existentes no projeto.
