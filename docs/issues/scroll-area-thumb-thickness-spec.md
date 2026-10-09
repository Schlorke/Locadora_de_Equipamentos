# Especificação: Scrollbar com Espessura Visual Idêntica

> **Objetivo**: Delegar correção para que scrollbar vertical e horizontal tenham
> a **mesma espessura visual** no componente ScrollArea.

---

## 1. Problema

A **scrollbar vertical** (lado direito) aparece **mais grossa** que a
**scrollbar horizontal** (parte inferior) na tela de e-mails do admin. O usuário
relatou a inconsistência visual múltiplas vezes.

**Contexto de uso**: Página `/admin/email`, visualização de e-mail com
`ScrollArea` que exibe ambas as scrollbars (vertical e horizontal) ao mesmo
tempo.

---

## 2. Arquivos Envolvidos

| Arquivo                                         | Descrição                                       |
| ----------------------------------------------- | ----------------------------------------------- |
| `components/ui/scroll-area.tsx`                 | Componente principal a ser corrigido            |
| `components/admin/email/email-viewer.tsx`       | Usa `<ScrollArea horizontal>` (linha ~372)      |
| `components/admin/email/email-message-list.tsx` | Usa `<ScrollArea>` apenas vertical (linha ~322) |

---

## 3. Estado Atual do Código (scroll-area.tsx)

```tsx
// ScrollBar - classes do track (container da scrollbar)
orientation === 'vertical' &&
  'h-full w-2 border-l-transparent py-1 rounded-full justify-center',
orientation === 'horizontal' &&
  'h-2 w-full flex-col border-t border-t-transparent px-4',

// ScrollAreaThumb - classes do thumb (pegador)
'relative flex-1 rounded-full bg-orange-600 hover:bg-orange-700 transition-colors duration-200',
orientation === 'vertical' && 'min-h-[20px]',
orientation === 'horizontal' && 'min-w-[20px]',
```

**Valores Tailwind**:

- `w-2` = 8px
- `h-2` = 8px
- `py-1` = 4px padding top/bottom (vertical)

---

## 4. Comportamento do Radix UI ScrollArea

O pacote `@radix-ui/react-scroll-area` controla o thumb assim:

1. **Dimensão ao longo do scroll (comprimento do thumb)**:
   - Radix define `--radix-scroll-area-thumb-width` (horizontal) ou
     `--radix-scroll-area-thumb-height` (vertical)
   - Calculado por `getThumbSize(sizes)` com base em viewport, conteúdo e
     padding do track

2. **Dimensão perpendicular (espessura do thumb)**:
   - **Não é definida pelo Radix** via variável CSS
   - O thumb usa `width: var(--radix-scroll-area-thumb-width)` e
     `height: var(--radix-scroll-area-thumb-height)` em `style` inline
   - Para scrollbar vertical: só `--radix-scroll-area-thumb-height` é definida
     (comprimento); a largura vem do layout do track
   - Para scrollbar horizontal: só `--radix-scroll-area-thumb-width` é definida
     (comprimento); a altura vem do layout do track

3. **Origem da espessura visual**:
   - Vem do **track** (elemento pai do thumb): `w-2` para vertical, `h-2` para
     horizontal
   - Padding do track (`py-1`, `px-4`) pode alterar o espaço disponível e o
     layout

---

## 5. Hipóteses para a Diferença Visual

1. **Padding assimétrico**: `py-1` no vertical vs ausência de `py` no horizontal
   pode afetar o cálculo interno
2. **Subpixel / arredondamento**: `w-2` e `h-2` podem renderizar diferente em
   alguns navegadores/zooms
3. **Flex layout**: `flex-1` no thumb pode se comportar diferente em eixos
   distintos
4. **Override explícito**: Talvez seja necessário forçar espessura do thumb via
   `width`/`height` em CSS ou Tailwind, em vez de depender apenas do track

---

## 6. O que Já Foi Tentado (sem sucesso)

- De `w-3`/`h-3` (12px) para `w-2.5`/`h-2.5` (10px)
- De `w-2.5`/`h-2.5` para `w-2`/`h-2` (8px)
- Padding `py-4` → `py-[2px]` → `py-1` no vertical
- Remoção das setas decorativas da scrollbar vertical
- Alinhamento de padding: `px-[2px]`, `py-[2px]`, etc.

O problema visual permanece: a scrollbar vertical continua parecendo mais
grossa.

---

## 7. Caminhos de Solução Sugeridos

### A) Forçar espessura do thumb via CSS

Definir espessura explícita no **Thumb** em vez de depender só do track:

- Scrollbar vertical: `width: 8px` (ou classe equivalente) no thumb
- Scrollbar horizontal: `height: 8px` (ou classe equivalente) no thumb

Possível implementação em `thumbClassName` ou classes condicionais no
`ScrollAreaThumb`.

### B) Variáveis CSS customizadas

Criar variáveis no track, por ex. `--scroll-thumb-size: 8px`, e aplicá-las ao
thumb para garantir o mesmo valor em ambas as orientações.

### C) Inspeção no DevTools

- Medir o thumb real no navegador (largura vertical vs altura horizontal)
- Confirmar se a diferença está no track ou no thumb
- Verificar se há estilos globais ou de outro componente sobrescrevendo

### D) Ajuste fino de padding

- Igualar padding vertical e horizontal nos tracks (ex.: `p-[2px]` em ambos)
- Testar `p-0` para ver se a espessura visual se iguala

---

## 8. Critério de Aceite

- Scrollbar **vertical** e **horizontal** devem ter **espessura visual
  idêntica**
- Mantém cor `bg-orange-600` e hover `bg-orange-700`
- Mantém `rounded-full` e `transition-colors duration-200`
- Não quebrar uso em `email-viewer`, `email-message-list` e `email-folder-list`
- Manter o design system (AGENTS.md, design-system.md)

---

## 9. Referências

- [Radix UI Scroll Area](https://www.radix-ui.com/primitives/docs/components/scroll-area)
- `node_modules/@radix-ui/react-scroll-area/dist/index.mjs` (linhas ~350–440:
  como as variáveis do thumb são definidas)
- `docs/features/design-system.md`
- `docs/features/admin-email-ui-ux.md`

---

## 10. Checklist para Implementação

- [ ] Inspecionar elementos no DevTools e documentar dimensões reais do track e
      do thumb
- [ ] Garantir que track vertical e horizontal tenham a mesma espessura (em px)
- [ ] Garantir que o thumb use espessura idêntica em ambas as orientações
- [ ] Testar em Chrome, Firefox e Edge (e Safari se disponível)
- [ ] Testar em diferentes zooms (100%, 125%, etc.)
- [ ] Atualizar `CHANGELOG.md` e `docs/features/admin-email-ui-ux.md` (se
      relevante)
- [ ] Verificar se não há regressão em `email-folder-list` e
      `email-message-list`

---

_Especificação criada em 2026-02-01 para delegação da correção._
