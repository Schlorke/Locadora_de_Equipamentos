# Storybook do produto compartilhado

O Storybook usa as fontes do produto compartilhado, com configuração em
`.storybook/main.ts` e `.storybook/preview.tsx`. O preview importa
`@gb-locacoes/frontend/app/styles.css`; a antiga `app/globals.css` da raiz, que
reimportava essa entrada, foi retirada em F. Não recrie CSS ou componentes da
raiz para fazê-lo funcionar.

## Configuração e autoria

- `framework.options.nextConfigPath` aponta para
  `apps/clients/web/next.config.mjs`, sem depender do antigo `next.config.mjs`
  da raiz, retirado em F.
- As stories são lidas de `stories/**/*.mdx` e
  `stories/**/*.stories.@(js|jsx|mjs|ts|tsx)`. O conteúdo estático usa `public/`
  do workspace; não há junção de assets para o host.
- Componentes do design system pertencem a `packages/ui`; tokens a
  `packages/design-tokens`; regras/composição do produto a `packages/frontend`.
  Siga [design-system.md](../features/design-system.md) e
  [stories/README.md](../../stories/README.md), preservando entrypoints
  públicos.

## Executar e construir

`pnpm storybook` inicia o servidor na porta 6006. Antes de iniciar, confirme a
porta livre; encerre somente o servidor que você criou. A URL local só está
disponível enquanto esse processo existir; documentação não atesta servidor
rodando.

Para construir, informe uma pasta própria fora do repositório:

```powershell
pnpm build-storybook --output-dir <pasta-temporaria-absoluta>
```

Não deixe `storybook-static`, relatórios, logs ou capturas no repo. O preview
usa Inter/Jost por `next/font/google`; confira o ambiente e os artefatos reais
antes de concluir que fontes ou build foram carregados corretamente.

## Validação e limites

`tests/unit/storybook-config.test.ts` caracteriza configuração, CSS e dono do
Next config. `pnpm typecheck`/`pnpm lint` e o build estático têm funções
distintas; use a cadência de [testing.md](testing.md). `pnpm test-storybook` não
é um script declarado no `package.json` atual; não o apresente como uma suíte
executada. Storybook não substitui capturas do host, testes HTTP ou prova de
sessão, isolamento, dinheiro e integrações.

O relatório de entrega de 04/11/2025, suas contagens, exemplos e receitas estão
preservados sem alterações no
[arquivo histórico](../archive/wave135-pre-f/guides/storybook.md.source). Ele
não declara que um servidor permanece ativo nem que a árvore F está verde.
