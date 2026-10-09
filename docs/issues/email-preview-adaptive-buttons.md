# Comportamento preservado: Botões adaptativos no Preview de Email (estilo Outlook)

> **Para IAs e Code Review (incl. Cursor Review Bot)**: Este comportamento foi
> implementado intencionalmente e **NÃO deve ser removido, simplificado ou
> alterado** sem solicitação explícita do usuário. Não sugerir remoção do
> ResizeObserver, do ActionButton, da prop `compact`, nem da classe `min-w-0`.

---

## 1. O que é

No painel de email (`/admin/email`), na área de **preview da mensagem** (painel
direito redimensionável), os botões **Responder**, **Encaminhar** e **Expandir**
são **adaptativos**:

- Quando o painel de preview tem **largura suficiente** (≥ 500px): os botões
  exibem **ícone + texto**.
- Quando o usuário **reduz a largura** do painel (arrastando o separador): os
  botões passam a exibir **apenas o ícone**, e ao passar o mouse aparece um
  **tooltip** com o texto (Responder, Encaminhar, Expandir).

Isso evita que os botões fiquem ocultos ou quebrados em monitores menores ou
quando o preview está estreito, no mesmo espírito do Outlook.

---

## 2. Onde está implementado

- **Arquivo**: `components/admin/email/email-viewer.tsx`
- **Elementos que NÃO devem ser removidos ou alterados**:
  1. **Componente interno `ActionButton`**
     - Recebe `icon`, `label`, `onClick`, `compact` (e demais props).
     - Quando `compact === true`: renderiza só o ícone e envolve o botão em
       `<Tooltip>` com a label.
     - Quando `compact === false`: renderiza ícone + texto (label).
  2. **Estado `isCompact`** e **`ResizeObserver`**
     - O `EmailViewer` observa a largura do container (div com
       `ref={containerRef}`).
     - Se `contentRect.width < 500` → `setIsCompact(true)`; caso contrário
       `setIsCompact(false)`.
  3. **Uso de `compact={isCompact}`** nos botões Responder, Encaminhar e
     Expandir
     - Esses três botões devem receber `compact={isCompact}`. Não substituir por
       breakpoint de tela (ex.: `hidden sm:inline`).
  4. **Classe `min-w-0` no container observado**
     - O div que recebe `ref={containerRef}` deve ter `min-w-0` na `className`
       (ex.: `flex h-full min-h-0 min-w-0 flex-col ...`).
     - Sem `min-w-0`, em layout flex o container não encolhe com o painel e o
       recurso deixa de funcionar.

---

## 3. O que NÃO fazer

- **Não remover** o `ResizeObserver` nem o estado `isCompact`.
- **Não remover** o componente `ActionButton` nem a prop `compact`.
- **Não remover** a classe `min-w-0` do container com `ref={containerRef}`.
- **Não substituir** a lógica por breakpoints de viewport (ex.: mostrar texto só
  em `sm:` ou `md:`); o comportamento deve ser baseado na **largura do
  container** (painel de preview), não na largura da tela.
- **Não alterar** o threshold de 500px sem justificativa de produto/UX; 500px é
  o valor atual documentado e testado.

---

## 4. Referências

- Especificação de UI/UX do email admin: `docs/features/admin-email-ui-ux.md`
  (seção "Botões adaptativos no Preview (estilo Outlook)").
- Índice de issues: `docs/issues/known-issues.index.md` (High-Risk Topics).

---

_Última atualização: 2026-02-02_
