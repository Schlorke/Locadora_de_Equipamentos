# Quick Start — Storybook GB Locações

Este guia usa a configuração atual de `.storybook/main.ts` e
`.storybook/preview.tsx`. A implementação compartilhada continua em
`packages/ui` e `packages/frontend`; stories não são uma segunda cópia do
produto. Consulte [AI_CONTEXT.md](AI_CONTEXT.md) e o
[guia operacional](../docs/guides/storybook.md).

## Iniciar

Na raiz do workspace, com as dependências do lockfile instaladas, confirme que a
porta 6006 está livre e execute:

```powershell
pnpm storybook
```

Acesse `http://localhost:6006` enquanto o processo estiver ativo. Ao terminar,
encerre somente o servidor que você iniciou. Este documento não atesta que há um
servidor rodando.

## Navegar e consumir componentes

Comece por `Introduction/Welcome`, `Design Tokens` e `Public/Atoms`. O menu
organiza também `Public`, `Admin` e `Shared`; veja as stories realmente
coletadas, sem usar contagens históricas como inventário atual.

Em `Public/Atoms/Button`, examine as variantes e o Playground, depois confira o
contrato em `packages/ui/src/contract/button.ts`. Os controles dessa story
mostram um recorte das variantes do contrato; não autorizam estilos novos.

```tsx
import { Button } from "@gb-locacoes/ui"

export function Example() {
  return <Button variant="default">Salvar</Button>
}
```

Use a entrada pública do pacote. As regras de importação FSD continuam valendo
para componentes do produto em `packages/frontend`; o alias `@/` da configuração
do Storybook aponta para a raiz do workspace e não é uma API pública de
componentes.

## Verificar a story

Teste os estados expostos pelos controles, o foco e a navegação por teclado. O
addon `@storybook/addon-a11y` auxilia a inspeção; ausência de avisos não
comprova conformidade completa. Confira também a composição em diferentes
tamanhos de viewport e as fontes efetivamente carregadas.

Os tokens do runtime pertencem a `packages/design-tokens/src`. A referência
`design-tokens/base.json` usada pelas stories não substitui os contratos do
design system. O preview importa `@gb-locacoes/frontend/app/styles.css`;
preserve cores, medidas, camadas e variantes documentadas em
[design-system.md](../docs/features/design-system.md).

## Construir sem deixar artefatos no repo

Informe uma pasta própria absoluta fora do checkout:

```powershell
pnpm build-storybook --output-dir <pasta-temporaria-absoluta>
```

Logs, capturas e o build estático devem ficar fora do repositório. O preview usa
Inter/Jost por `next/font/google`; configuração não prova que a fonte ou o build
carregou. Storybook não substitui testes dos hosts, HTTP, sessões, isolamento de
tenant ou validação visual do produto.

## Se houver erro

Leia a primeira mensagem do processo e registre o diagnóstico fora do repo. Não
apague `node_modules` ou árvores de cache como receita automática: podem conter
links e recursos compartilhados. Para conferir a instalação existente, use o
lockfile atual e `pnpm install --frozen-lockfile` somente na etapa autorizada de
instalação; incompatibilidade do lockfile deve ser investigada, sem regenerá-lo
por tentativa.

Uma story precisa corresponder aos globs atuais: `stories/**/*.mdx` ou
`stories/**/*.stories.@(js|jsx|mjs|ts|tsx)`. Confira o título exportado e a
entrada pública do componente. Não use instruções de configuração que recriem
fachadas aposentadas do produto.

`pnpm test-storybook` não é um script do `package.json` atual. Os comandos de
configuração/diagnóstico existentes são `storybook:doctor`, `storybook:check` e
`storybook:info`; não equivalem a uma execução visual. Veja a cadência e as
provas necessárias em [testing.md](../docs/guides/testing.md).

A versão anterior, incluindo contagens, exemplos e a receita de remoção de
pastas, está preservada com os bytes originais em
[arquivo histórico](../docs/archive/wave135-pre-f/stories/QUICK_START.md.source).
O README desse diretório registra a proveniência; essa receita histórica não é
uma instrução operacional atual.
