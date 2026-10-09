# Tarefa: Estilos do botão Close no Sheet (mobile) – Admin Email

## Resumo do problema

O **botão Close** da sidebar de visualização de mensagem de email em **modo
mobile** não está aplicando os estilos de hover solicitados. As classes Tailwind
passadas no código não estão refletidas no DOM final ou são sobrescritas, e o
comportamento visual no hover não corresponde ao pedido.

---

## 1. Contexto exato

- **Página:** `/admin/email` (painel de email do admin).
- **Modo:** **Mobile** (viewport estreito; em desktop o mesmo Sheet pode
  aparecer com breakpoint `sm:`).
- **Componente UI:** O preview da mensagem em mobile é um **Sheet** (Radix
  Dialog) que desliza da direita. Dentro do `SheetContent` existe um botão para
  fechar (Close).
- **Arquivo do botão:** `components/ui/sheet.tsx` — dentro de `SheetContent`,
  uso de `SheetPrimitive.Close asChild` com um `<button>` como filho.
- **DOM path (referência):**
  `div#radix-* (role="dialog") > button[aria-label="Close"]` Ou seja: o botão é
  filho direto do conteúdo do dialog do Sheet.

---

## 2. Especificação exata do que o usuário pediu

O usuário pediu os seguintes estilos para o **botão Close** desse Sheet em
mobile:

| Requisito               | Implementação Tailwind desejada                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Border**              | `border border-gray-200` (borda cinza clara, visível).                                                                                                                           |
| **Sombra base**         | `shadow-sm` (sombra leve no estado normal).                                                                                                                                      |
| **Hover – sombra**      | `hover:shadow-md` (sombra mais forte no hover).                                                                                                                                  |
| **Hover – fundo**       | **Sem** mudança de cor de fundo no hover. Ou seja: fundo deve permanecer **branco** (não usar `hover:bg-slate-50`, `hover:bg-slate-100` nem qualquer outro hover de background). |
| **Hover – texto/ícone** | `hover:text-orange-600` (ícone/texto em laranja no hover – cor primária do projeto).                                                                                             |

Resumo em uma frase: **Botão com `border border-gray-200`, `shadow-sm`, no
hover: `hover:shadow-md` + `hover:text-orange-600`, sem alterar o fundo (manter
branco).**

---

## 3. Estado atual do código (referência)

- **Arquivo:** `components/ui/sheet.tsx`
- **Trecho relevante (linhas ~69–77):**
- **2026-02-02:** Tamanho mobile reduzido de `h-9 w-9` para `h-7 w-7` para
  evitar sobreposição com o botão "Mais opções" no header do EmailViewer. Ícone
  X ajustado para `h-3.5 w-3.5 sm:h-4 sm:w-4`.

```tsx
<SheetPrimitive.Close asChild>
  <button
    type="button"
    aria-label="Close"
    className="inline-flex items-center justify-center disabled:pointer-events-none disabled:opacity-50 absolute right-4 top-4 h-7 w-7 rounded-lg border border-gray-200 bg-white text-slate-600 shadow-sm transition-all duration-300 hover:bg-white hover:shadow-md hover:text-orange-600 hover:border-gray-300 active:bg-slate-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:h-6 sm:w-6 sm:border-0 sm:bg-transparent sm:shadow-none sm:text-slate-500 sm:hover:text-slate-700 sm:hover:bg-slate-100"
  >
    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
  </button>
</SheetPrimitive.Close>
```

As classes pedidas **já estão** no `className` do botão
(`border border-gray-200`, `shadow-sm`, `hover:bg-white`, `hover:shadow-md`,
`hover:text-orange-600`). Ainda assim, o usuário relata que **os estilos não são
aplicados** no navegador (nem border, nem shadow, nem hover como descrito).

---

## 4. O que já foi tentado (e por que não funcionou)

1. **Ajustes apenas no `className` do Sheet**
   - Inclusão de `border border-gray-200`, `shadow-sm`, `hover:shadow-md`,
     `hover:text-orange-600`, remoção de hover de fundo.
   - **Problema:** No DOM inspecionado ainda apareciam outras classes (ex.:
     `hover:bg-slate-100`, `hover:text-slate-900`), indicando que algo
     sobrescrevia.

2. **Uso do componente `CloseButton`** (`components/ui/close-button.tsx`)
   - O `CloseButton` usa `variant` e aplica classes via `cn()` (ex.:
     `variantClasses[variant]`).
   - **Problema:** As classes do variant (ghost, ghostWhite, etc.) incluem
     hovers próprios (`hover:bg-slate-100`, `hover:text-slate-900`, etc.). Mesmo
     passando `className` com os estilos desejados, a **ordem de geração/
     especificidade no CSS do Tailwind** fazia com que as regras do variant
     ganhassem, e os estilos do usuário não apareciam.

3. **Criação do variant `sheetClose`** no `CloseButton`
   - Variant com poucas classes (ex.: `text-slate-600 shadow-sm`) para evitar
     conflito.
   - **Problema:** Continuação de conflito quando o `className` do Sheet era
     mesclado com as classes do `CloseButton` via `cn()`; no CSS final, as
     regras do variant ainda prevaleciam em alguns casos.

4. **Inversão da ordem no `cn()` do CloseButton**
   - Foi tentado colocar `className` **antes** de `variantClasses[variant]` para
     priorizar as classes passadas.
   - **Problema:** No projeto, `cn()` usa `tailwind-merge` (`lib/utils.ts`). Com
     `twMerge`, a **ordem dos argumentos importa**: o último prevalece em
     conflitos. Colocar `className` antes do variant faz o variant sobrescrever
     o `className` (comportamento errado). O contrato correto é: **variant (e
     size) primeiro, `className` por último**, para que classes passadas
     sobrescrevam as da variante. O `CloseButton` atualmente respeita essa ordem
     (`variantClasses[variant]`, depois `className`); não inverter.

5. **Substituição do `CloseButton` por um `<button>` nativo**
   - Botão simples com ícone `<X />` e o `className` completo acima, sem uso de
     `CloseButton`.
   - **Problema:** O usuário informou que **ainda não funcionou**. Possíveis
     causas:
   - Tailwind não gerando essas classes (content paths, purge, ou classes não
     detectadas).
   - Outro CSS global ou de componente sobrescrevendo.
   - Radix/Sheet injetando estilos ou classes no botão quando usa `asChild`.
   - Cache do navegador ou build desatualizado.

---

## 5. Detalhes técnicos úteis para quem for implementar

- **Radix:** `SheetPrimitive.Close` com `asChild` faz merge de props (e ref) no
  filho. O filho deve ser um único elemento (aqui, o `<button>`). Não há
  documentação de que o Radix adicione classes ao botão; mesmo assim, vale
  inspecionar no DevTools se alguma classe extra aparece no elemento.
- **Tailwind:**
  - Conflitos entre duas classes utilitárias (ex.: `hover:bg-white` vs
    `hover:bg-slate-100`) são resolvidos pela **ordem em que aparecem no CSS de
    saída**, não pela ordem no `className`.
  - Se as classes desejadas não estiverem sendo geradas, verificar
    `tailwind.config` (content) e se o arquivo `sheet.tsx` está incluído.
  - Para forçar prevalência, pode-se usar o modificador **important** do
    Tailwind: `hover:!bg-white`, `hover:!text-orange-600`, `hover:!shadow-md`,
    etc.
- **Design system do projeto:**
  - Cor primária: orange-600 (`#ea580c`).
  - Botões de close em outros contextos usam `CloseButton` com variants; aqui o
    requisito é específico para o Sheet mobile.
- **Breakpoint `sm:`:**
  - Em telas `sm` e maiores, o botão usa outras regras
    (`sm:h-6 sm:w-6 sm:border-0 sm:bg-transparent sm:shadow-none sm:text-slate-500 sm:hover:text-slate-700 sm:hover:bg-slate-100`).
    A tarefa é focada no **comportamento em mobile** (antes do `sm`).

---

## 6. Critérios de sucesso (como validar)

1. **Estado normal (mobile):**
   - Botão com borda visível cinza clara (`border-gray-200`).
   - Sombra leve (`shadow-sm`).
   - Fundo branco, ícone em cinza (ex.: `text-slate-600`).

2. **Estado hover (mobile):**
   - Sombra mais forte (`shadow-md`).
   - Ícone em laranja (`text-orange-600`).
   - Fundo continua branco (sem `hover:bg-*` aplicado).

3. **Inspeção no DevTools:**
   - O `<button>` não deve ter classes como `hover:bg-slate-50`,
     `hover:bg-slate-100` ou `hover:text-slate-900` ativas em mobile (ou, se
     existirem por algum motivo, as regras desejadas devem prevalecer, e.g. com
     `!`).

---

## 7. Arquivos envolvidos

| Arquivo                                             | Papel                                                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `components/ui/sheet.tsx`                           | Define o botão Close dentro de `SheetContent` (local onde os estilos devem ser aplicados).                             |
| `components/ui/close-button.tsx`                    | Atualmente **não** é usado para esse botão (foi trocado por `<button>` nativo); contém variants que antes conflitavam. |
| `components/admin/email/email-layout-container.tsx` | Usa `<Sheet>` para o preview de mensagem em mobile; não estiliza o botão diretamente.                                  |

---

## 8. Sugestões para a implementação

1. **Confirmar geração Tailwind:** Rodar build (`pnpm build` ou equivalente) e
   procurar no CSS gerado por classes como `hover\:text-orange-600`,
   `hover\:shadow-md`, `border-gray-200`. Se não existirem, ajustar `content` em
   `tailwind.config` para incluir `components/ui/sheet.tsx`.
2. **Usar `!` se necessário:** No `className` do botão em `sheet.tsx`, usar
   `hover:!bg-white hover:!shadow-md hover:!text-orange-600` (e eventualmente
   `border border-gray-200` / `shadow-sm` com `!` se ainda houver sobrescrita)
   para garantir que essas regras tenham prioridade.
3. **Evitar qualquer hover de fundo em mobile:** Garantir que não haja classe
   `hover:bg-*` aplicada ao botão no contexto mobile (nem por Sheet, nem por CSS
   global).
4. **Testar em mobile real ou DevTools:** Abrir `/admin/email`, redimensionar
   para largura mobile, abrir uma mensagem (Sheet), inspecionar o botão Close e
   validar estilos aplicados e no hover.

---

Data do documento: 2026-02-02. Objetivo: servir de briefing completo para outra
IA ou desenvolvedor implementar corretamente os estilos do botão Close do Sheet
(mobile) na página Admin Email.
