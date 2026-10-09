# Admin desktop header

## Resumo

- Header fixo do admin desktop alinhado ao sidebar.
- Largura e left sincronizados com `w-20`, `w-56` e `lg:w-64`.
- Conteudo: saudacao + nome, sino com dropdown de notificacoes e usuario.

## Componentes e locais

- `packages/frontend/src/widgets/cabecalho-admin-barra/ui/BarraDesktop.web.tsx`:
  render, saudacao e uso de AdminHeaderActions.
- `packages/frontend/src/widgets/cabecalho-admin-barra/ui/Acoes.web.tsx`: bloco
  compartilhado (sino + dropdown notificacoes + avatar + menu usuario); usado no
  desktop e no mobile.
- `packages/frontend/src/widgets/cabecalho-admin-barra/ui/BarraMobile.web.tsx`:
  usa AdminHeaderActions para exibir o mesmo bloco no modo mobile.
- `packages/frontend/src/widgets/menu-admin/ui/BarraLateral.web.tsx`: dispara
  estado de colapso.
- `packages/frontend/src/app/providers/AdminLayoutShell.web.tsx`: compartilha
  estado do sidebar, reutilizada pelos layouts legado e web.
- `packages/frontend/src/app/styles/layout.web.css`: empilhamento existente. O
  seletor confirmado pelo gate fica no main, sem ser encoberto pelo header.

## Comportamento esperado

- Visivel apenas em md+, com `position: fixed` e `h-16`.
- `left` e `width` seguem o sidebar:
  - colapsado: left `5rem`, width `calc(100% - 5rem)`
  - expandido em md: left `14rem`, width `calc(100% - 14rem)`
  - expandido em lg+: left `16rem`, width `calc(100% - 16rem)`
- Transicao igual ao sidebar: `transition-all duration-300 ease-in-out`.
- Gradiente:
  `linear-gradient(145deg, rgba(51, 65, 85, 0.98), rgba(30, 41, 59, 0.95))`.
- Saudacao dinamica baseada no horario + nome do usuario.
- Icones de notificacoes e usuario no lado direito (via AdminHeaderActions).
- O mesmo bloco (sino + avatar) e exibido no header mobile.
- O sino abre um dropdown com as notificacoes do usuario admin.
- No mobile, o dropdown de notificacoes recebe offset horizontal para nao ficar
  colado na borda direita.
- O dropdown exibe badge com nao lidas e permite marcar todas como lidas.
- O botao do sino nao altera cor de borda no hover.

## Como validar

1. Abrir `/admin` em md e em lg.
2. Alternar o colapso do sidebar e confirmar que o header acompanha sem delay.
3. Verificar que o header ocupa a largura restante.
4. Confirmar saudacao e icones.

## Observacoes

- Nao altere cores/estilos sem pedido explicito.
- Mantenha os mesmos tamanhos do sidebar (`w-20`, `w-56`, `lg:w-64`).

Ultima atualizacao: 2025-01-29
