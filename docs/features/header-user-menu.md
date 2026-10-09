# Menu de usuario no header

## Resumo

- Menu do usuario no header usa DropdownMenu + Avatar.
- Lista links da area do cliente e acao de sair.
- Para evitar scroll interno, o menu do header usa `max-h-none`.

## Componentes e locais

- `packages/frontend/src/widgets/cabecalho/ui/Cabecalho.web.tsx`: renderiza o
  menu e aplica override de altura.
- `packages/ui/src/web/DropdownMenu.web.tsx`: estilos base com `max-h-[300px]`,
  usados por outros dropdowns (ex.: admin).

## Comportamento esperado

- Abre ao passar o mouse no botao "Ola, [nome]!" ou ao clicar no botao.
- Permanece aberto apenas enquanto o mouse estiver sobre o botao ou sobre o
  proprio dropdown: ao sair do botao inicia timer de 120ms para fechar; ao
  entrar no dropdown esse timer e cancelado; ao sair do dropdown fecha de
  imediato.
- Deve listar todos os itens sem scroll interno.
- No mobile, ao clicar em itens da area do cliente, ajusta o scroll para o topo
  do `#dashboard-banner` considerando a altura do header.
- Quando houver notificacoes nao lidas, o item "Notificacoes" exibe a bolinha
  vermelha de alerta ao lado do icone.
- Enquanto a sessao esta carregando, nao deve exibir "Sign In/Log In" para
  evitar flash de estado deslogado.
- A sessao inicial deve ser fornecida pelo server no `SessionProvider` para
  evitar estado `loading` no primeiro paint e impedir flicker do "Log In".

## Como validar

1. Logar como cliente e abrir o menu do header.
2. Confirmar que todos os itens aparecem sem scroll interno.
3. No mobile, clicar em "Meus Orcamentos" e verificar que o topo do banner
   aparece logo abaixo do header.
4. Com notificacoes nao lidas, confirmar a bolinha vermelha no item
   "Notificacoes" do dropdown.

## Observacoes

- Evite alterar o componente base de dropdown para nao impactar outras telas.
- Se for preciso limitar altura em outro lugar, ajuste o `className` no uso
  especifico.

Ultima atualizacao: 2026-01-21
