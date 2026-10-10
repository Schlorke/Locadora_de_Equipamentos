# Fontes fixadas da produção para a paridade Tailwind

Os quatro arquivos `*.source` são cópias binárias dos blobs do commit
`eb4c0098d5d8686b8d72e9aaf560968bb65274e4`, a referência histórica
`main eb4c0098` usada por `../production.json`. A cópia tem o sufixo `.source`
para ser um dado de teste, sem entrar no inventário de código ou na formatação
de fontes do produto. O gerador materializa os nomes originais em uma pasta
temporária própria. A `.gitattributes` desta pasta conserva os bytes no clone,
inclusive quando `core.autocrlf=true`.

`manifest.json` registra o commit completo, o caminho original, o caminho da
fixture, o objeto Git, o tamanho e o SHA-256 de cada arquivo. O gerador recusa
commit diferente, conjunto incompleto ou duplicado, links, arquivo vazio e bytes
que não correspondam ao SHA-256 e ao objeto Git registrados. Não busca o commit
antigo, não usa a raiz legada como alternativa e não precisa que o histórico
antigo esteja publicado.

| Caminho original                            | Blob Git                                   |
| ------------------------------------------- | ------------------------------------------ |
| `tailwind.config.cjs`                       | `e86a8753a3a7b6da5e0748a120768307f3420087` |
| `postcss.config.cjs`                        | `96c040d5c20007a5bae487a263fb4ed769fc51c0` |
| `app/globals.css`                           | `b44aa49364b26b700c6fe6a313a6a866c4af5d26` |
| `design-tokens/output/tokens-tailwind.json` | `3d7415671409afeae10dd22ca4a66ab77b696f9c` |

Não edite ou formate esses arquivos históricos. Uma atualização de referência
exige nova origem identificada, novos hashes e revisão explícita. Os tokens e as
classes do produto atual continuam vindo dos mesmos módulos compartilhados.

A antiga app/globals.css e a antiga pipeline do Style Dictionary
(design-tokens/output/tokens-tailwind.json e design-system:build-tokens) foram
retiradas do produto. O arquivo .source conserva a origem daquela referência,
sem importar código antigo no runtime atual. O teste de aposentadoria verifica
os SHA-256 dos seis registros históricos (quatro blobs, manifesto e referência)
antes de usar esta legenda como contexto; todos os bytes continuam varridos.
Byte, origem, caminho trocado ou arquivo novo não herdam essa classificação.

## Execução normal

`pnpm test:visual-tools` lê `production.json` já versionado e não precisa das
dependências antigas nem de acesso ao histórico. A referência Tailwind é uma
prova de valores de CSS; a aceitação humana e a comparação das capturas são
evidências distintas.

## Reprodução manual isolada

Use a versão de Node definida pelo projeto e pnpm `10.27.0`. O gerador carrega
PostCSS e `@tailwindcss/postcss` do checkout atual, como antes. Os compiladores
e plugins da produção vêm de um runtime externo indicado por `--pnpm`:

| Dependência externa          | Versão histórica fixada |
| ---------------------------- | ----------------------- |
| `tailwindcss`                | `3.4.17`                |
| `tailwindcss-animate`        | `1.0.7`                 |
| `tailwind-scrollbar`         | `4.0.2`                 |
| `autoprefixer`               | `10.4.24`               |
| `postcss` no runtime externo | `8.5.6`                 |

Esses números vêm de `package.json` e `pnpm-lock.yaml` do mesmo commit. O
lockfile também contém PostCSS `8.4.31` como dependência transitiva; a
declaração direta era `^8.5.6`. O gerador verifica as versões dos quatro pacotes
que resolve explicitamente. O runtime externo abaixo fixa as dependências
diretas e a resolução de Tailwind 3, inclusive nos plugins; não substitui o
lockfile do produto atual.

Na primeira preparação, crie uma pasta temporária própria, fora do repositório,
sem junções ou links para seus `node_modules`. Grave ali este `package.json`:

```json
{
  "name": "tailwind-production-reproduction",
  "private": true,
  "packageManager": "pnpm@10.27.0",
  "dependencies": {
    "tailwindcss": "3.4.17",
    "tailwindcss-animate": "1.0.7",
    "tailwind-scrollbar": "4.0.2",
    "autoprefixer": "10.4.24",
    "postcss": "8.5.6"
  },
  "pnpm": {
    "overrides": {
      "tailwindcss": "3.4.17"
    }
  }
}
```

No PowerShell, os caminhos são fornecidos pelo operador. Execute a partir da
raiz do checkout:

```powershell
$taskRuntime = 'CAMINHO_TEMPORARIO_PROPRIO_DO_RUNTIME'
$taskEvidence = 'CAMINHO_TEMPORARIO_PROPRIO_DA_EVIDENCIA'
pnpm --dir $taskRuntime install --offline --ignore-scripts --ignore-workspace
node tests/visual/support/tailwind-parity-fixture.mjs `
  --pnpm "$taskRuntime/node_modules/.pnpm" `
  --work $taskEvidence `
  --out "$taskEvidence/production.reproduced.json"
```

As duas pastas precisam existir. A instalação offline exige os pacotes no store
local. Se faltar um pacote, a preparação deve parar; obtenção pela rede é uma
etapa separada, sujeita à autorização do operador. Não instale essas versões no
workspace atual. Preserve o lockfile criado no runtime e seu hash com a
evidência; reutilizações devem acrescentar `--frozen-lockfile` ao comando de
instalação. Este procedimento não promete reconstruir todo o grafo transitivo do
lockfile histórico a partir das cinco versões diretas.

Compare a saída externa com `production.json` e revise toda diferença antes de
substituir a referência. `--out` não altera o formato da fixture. Quando
omitido, mantém o destino original
`tests/visual/tailwind-parity/production.json`; use o destino externo para uma
verificação que preserve a referência. Somente após uma atualização intencional
e revisada execute o teste de paridade contra a referência correspondente:

```powershell
pnpm exec vitest run --config tests/visual/vitest.config.ts tests/visual/tailwind-parity.test.ts
```

Não copie o histórico antigo, credenciais, `.env`, a instalação antiga ou
arquivos além dos quatro blobs canônicos para reproduzir a referência. O gerador
remove seus arquivos temporários no caminho de sucesso. Uma falha de dependência
ou compilação ainda exige inventariar e remover apenas a pasta temporária que
essa execução criou; não use remoção recursiva sobre links.
