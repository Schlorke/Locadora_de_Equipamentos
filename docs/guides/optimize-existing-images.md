# Imagens existentes: otimização e limites operacionais

A
[receita de otimização em lote anterior](../archive/wave135-pre-f/docs/guides/optimize-existing-images.md.source)
foi arquivada. O comando e os parâmetros daquele registro não são um pipeline
operacional atual: o antigo otimizador não existe nesta árvore e não foi
substituído por um comando de migração equivalente.

## O fluxo atual cobre novos uploads

- `apps/services/api/src/app/api/upload/route.ts`: verifica o principal e exige
  ADMIN antes de entregar a requisição à composição do host.
- `apps/services/api/src/host/branding.ts`: compõe `createImageUpload` da
  entrada pública `@gb-locacoes/backend/http` com a transação e o armazenamento.
- `packages/backend/src/http/image-upload.ts`: valida finalidade, aplica o
  orçamento de uploads e escolhe o caminho da locadora.
- `packages/backend/src/modules/catalog/image-upload.ts`: valida conteúdo e
  tipo, saneia SVG e prepara os bytes. JPEG/PNG viram WebP com qualidade 80 e
  largura máxima de 1200px, sem ampliar imagens menores; os demais formatos
  aceitos seguem o comportamento implementado.

Esses parâmetros são do upload atual, não uma proposta para recomprimir todos os
objetos antigos. Consulte também
[onde ficam as imagens](where-are-images-stored.md).

## Se uma migração de objetos antigos for necessária

1. Inventariar somente objetos e referências da conta e locadora autorizadas,
   distinguindo arquivos estáticos do produto de URLs de armazenamento.
2. Preservar os originais e as referências antes de planejar qualquer escrita.
   Definir explicitamente escopo, formato, dimensões, retorno e janela.
3. Preparar uma simulação sem alteração de DB/Storage e uma comparação de
   aparência/dimensões das imagens reais. Não trocar URLs ou apagar originais
   somente porque um arquivo recomprimido é menor.
4. Tratar execução e eventual remoção como operação específica autorizada, com
   infraestrutura própria configurada. O upload normal não executa esse lote.

`scripts/ops/storage-utils.ts` contém utilitários de remoção mantidos em
quarentena operacional; não é sucessor do otimizador nem uma rotina de limpeza
automática. Esta documentação não ativa esses utilitários ou serviços GB.

As provas de upload estão em `tests/unit/image-upload.test.ts` e
`tests/api-host/branding.http.test.ts`. Sua presença não certifica objetos
antigos, conta cloud configurada ou uma migração executada.

_Atualizado em 2026-10-09; nenhuma otimização ou escrita externa executada._
