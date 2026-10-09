# ADR — Verificação dos limites de runtime e fundamentos nativos

Data: 2026-09-25. Estado: implementado; não certifica paridade de produto nem
execução em dispositivo.

## Decisão

O gate usa o AST TypeScript para enumerar imports, exports, requires, imports
dinâmicos, diretivas, JSX e referências globais. Os aliases são resolvidos pelo
tsconfig do pacote e pelos exports condicionais antes da classificação FSD.
Alias desconhecido, subpath não exportado, dependência não declarada e import
dinâmico não determinável bloqueiam.

O grafo nativo começa nas variantes .native e nos fontes do host Expo, incluindo
variantes ainda não consumidas por uma rota. O grafo cliente inclui módulos use
client e assets JavaScript públicos. Imports somente de tipo não atravessam o
grafo de runtime. A fronteira use server é permitida como RPC no web; não
autoriza código de servidor no native. Reexports são percorridos
conservadoramente, mesmo quando um consumidor não usa todos os símbolos.

O AST resolve bindings locais antes de classificar window, document, alert,
confirm e outros identificadores do navegador. Um parâmetro chamado document não
é um global DOM. Elementos JSX HTML e dependências DOM transitivas no native
bloqueiam com a cadeia de imports.

## Inventário explícito

arch.config.json registra raízes legadas e arquivos de processo que não são
runtime. O código legado não desaparece do relatório: app, lib, middlewares,
schemas, stores, types, proxy.ts, instrumentation.ts, public e design-tokens da
raiz são inventariados. Diretórios gerados de build/dependências e
testes/documentação têm classificação explícita. Arquivo de runtime fora das
raízes declaradas bloqueia.

O typecheck inclui projetos separados para UI web/native, frontend web/native e
hosts. packages/frontend/tsconfig.native.json inclui todas as variantes nativas,
enquanto o projeto mobile valida o grafo realmente importado pelas rotas Expo.
Ambos são necessários.

## Migração aplicada

- Ícones customizados compartilham geometria; web gera SVG DOM e native usa
  react-native-svg.
- Recents e carrinho acessam armazenamento por variante; seletores nativos,
  toast e paginação têm eventos reais.
- Catálogo, contato, permissões, documentação da API, personalização de ícones e
  exemplos de toast compartilham modelos.
- Privacidade, cookies e devolução compartilham árvores de conteúdo. A
  comparação de HTML completo antes/depois passou nas três páginas; o renderer
  nativo usa View/Text. Termos reutiliza termsSections.
- Clipboard e leitura de SVG são adapters do host Expo; contratos não importam
  Expo.
- GridMotion nativo responde ao gesto e à preferência de movimento reduzido. O
  teste simula eventos, sem medir frames em aparelho.
- O antigo useQuoteForm sem consumidores foi aposentado: aguardava um timer e
  anunciava envio sem API. Os fluxos reais não foram substituídos por esse
  demonstrador.

## Limites

O gate verifica fontes locais e dependências declaradas, não o código interno de
todos os pacotes externos. Não substitui o compilador Next/RSC, testes de
autorização, comportamento de componentes, bundle analisado ou dispositivo. Um
componente que apenas retorna children pode passar arquitetura e ainda falhar
funcionalmente. Essa lacuna deve ser tratada com receitas e testes de interação
do catálogo.

O gate chegou a zero após retirar as 15 raízes DOM remanescentes. Isso não
significa que todo o produto foi conectado no Expo. Seleção de locadora,
bootstrap de sessão, escopo de carrinho, rotas administrativas/cliente e
componentes nativos incompletos continuam tendo critérios próprios.

## Evidência reproduzível

- pnpm arch
- pnpm typecheck
- node node_modules/vitest/vitest.mjs run --config vitest.unit.config.ts
  tests/unit/architecture-runtime.test.ts
- pnpm test:platform
- pnpm build:web
- pnpm --filter @gb-locacoes/mobile bundle

Quatorze testes do verificador cobrem alias desconhecido, precedência de alias,
FSD, reexports transitivos, DOM, bindings, servidor/cliente, RPC, imports
dinâmicos e inventário legado. O resultado completo de cada execução deve ser
informado: o catálogo do design system ainda tinha uma falha real de cobertura
de receitas na primeira execução ampla posterior à migração.
