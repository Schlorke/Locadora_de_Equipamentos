# Pagina de Termos (/termos) - Documentacao

## 1. Proposito

Pagina publica com os Termos e Condicoes de Uso da propria locadora. Desde a
onda 134 o texto nao mora mais no codigo: cada locadora publica os Termos dela
no painel (Configuracoes, "Textos Legais"), e a GB recebe os textos de antes
pelo `tools/gb-site-settings.mjs` (runbook
`docs/operations/gb-site-settings.md`).

## 2. Fonte de Verdade

- A documentacao completa (contrato do documento, rotas, painel, pausa,
  orcamento e testes) esta em `docs/features/conteudo-da-vitrine.md`.
- Pagina: `packages/frontend/src/pages/termos/ui/TermosPage.{web,native}.tsx`;
  no host web o documento e lido no servidor
  (`apps/clients/web/src/app/(public)/[locadora]/(vitrine)/termos/page.tsx`).
- A data "Ultima atualizacao" vem do documento publicado (`lastUpdated`).
- A introducao publicada (`intro`) aparece antes das secoes na web e no app (no
  app desde a segunda rodada da onda 134).
- O dialogo de Termos do `/orcamento` mostra o mesmo documento; sem Termos
  publicados, o pedido segue sem a caixa de aceite (decisao D-C, parte 1).

## 3. Armadilhas a Evitar

- Nao voltar a escrever texto legal no frontend: o texto e de cada locadora.
- O historico das versoes publicadas nao e o git: cada publicacao substitui a
  anterior e so o hash vai para `audit_logs` (guardar versoes e a decisao D-F).
- Nao alterar o layout visual sem solicitacao explicita.

## 4. Historico de Alteracoes

| Data       | Descricao                                                               | Autor    |
| ---------- | ----------------------------------------------------------------------- | -------- |
| 2026-01-19 | Conteudo centralizado + alinhamento com orcamento-page                  | IA Codex |
| 2026-10-07 | Onda 134: Termos de cada locadora pelo painel; ponteiro para a doc nova | Claude   |
| 2026-10-07 | Onda 134, segunda rodada: introducao dos Termos tambem no app           | Claude   |
