# Dados estruturados (JSON-LD)

> **Status**: Critical **Last updated**: 2026-09-26

---

## 1. Purpose

Publicar dados estruturados (schema.org) na home e no detalhe de equipamento sem
abrir brecha de XSS. Nomes de equipamentos, de locadoras e perguntas frequentes
chegam de dados editáveis; dentro de `<script type="application/ld+json">`
qualquer `</script>` fecharia o bloco.

## 2. Scope

**In scope**

- Serialização segura de todo JSON-LD renderizado com `dangerouslySetInnerHTML`.
- Os três pontos que geram JSON-LD hoje: `StructuredData`, `SEOSchemas` e a
  trilha do detalhe de equipamento.

**Out of scope** (Lote 5 da `docs/architecture/adr-tenant-hosts.md`)

- `getLocalBusinessData`, `buildEquipmentSeo`, `buildEquipmentCanonicalUrl` e
  `buildEquipmentBreadcrumbs` recebendo o perfil da locadora (`SiteProfile`).
- Omitir o campo quando faltar dado da locadora, em vez de usar o padrão da GB,
  e o FAQ fixo virar dado da locadora.

## 3. Entry Points

- `packages/frontend/src/shared/lib/seo/serialize-json-ld.ts`
  (`serializeJsonLd(data, space?)`).
- `packages/frontend/src/widgets/dados-estruturados/ui/StructuredData.web.tsx`
  (indentação de 2 espaços); `StructuredData.native.tsx` preserva o contrato sem
  renderizar script ou DOM no Expo.
- `packages/frontend/src/widgets/seo-schemas/ui/SEOSchemas.web.tsx` (compacto).
- `packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoTrilha.web.tsx`
  (compacto).

## 4. Core Flow

1. O componente monta o objeto schema.org.
2. `serializeJsonLd` chama `JSON.stringify(data, null, space)` e troca `<`, `>`,
   `&`, U+2028 e U+2029 pelo escape Unicode do próprio JSON (`\u003c`, `\u003e`,
   `\u0026`, `\u2028` e `\u2029`).
3. O resultado vai para `dangerouslySetInnerHTML` do
   `<script type="application/ld+json">`.

## 5. Components and Files

- `packages/frontend/src/shared/lib/seo/serialize-json-ld.ts` e o teste ao lado.
- Os três consumidores listados em Entry Points.

## 6. Data and State

- Sem estado. Valor não serializável (por exemplo `undefined` na raiz) lança
  `TypeError`.

## 7. Constraints and Edge Cases

- Regra: todo JSON-LD novo usa `serializeJsonLd`; nunca `JSON.stringify` direto
  dentro de `dangerouslySetInnerHTML`.
- Sem caractere perigoso, a saída é byte a byte igual a `JSON.stringify`. Com
  `&`, a saída muda (a URL `hasMap` do `DEFAULT_LOCAL_BUSINESS` passa a sair com
  `\u0026`), mas `JSON.parse` devolve os mesmos dados.
- O serializador é importado direto de `shared/lib/seo/serialize-json-ld`, sem
  passar por `shared/lib/index.ts` (mesmo padrão de `cn` e `formatting`). Se um
  host (`apps/clients/web`) precisar gerar JSON-LD, o cliente só pode importar
  pelos entry points do pacote: reexportar por `@gb-locacoes/frontend/app` ou
  `pages/*`, ou manter o JSON-LD dentro de `packages/frontend`.
- O fonte usa `\u{2028}`/`\u{2029}` com a flag `u` para não conter terminadores
  de linha literais (ferramentas de edição chegaram a transformar o escape em
  caractere literal).

## 8. Error Handling

- `TypeError("JSON-LD inválido: ...")` para valor não serializável; o componente
  não renderiza bloco quebrado.

## 9. Performance and Accessibility

- Um `replace` por bloco; sem impacto visual (a marcação visível é idêntica).

## 10. Tests and Validation

- `pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/shared/lib/seo packages/frontend/src/widgets/dados-estruturados packages/frontend/src/widgets/seo-schemas packages/frontend/src/pages/equipamento-detalhe`.
- Os testes interpretam o HTML renderizado com um parser HTML real e conferem o
  número exato de `<script>`, a ausência de elementos injetados, que o conteúdo
  depois dos scripts continua existindo (inclusive com `<!--<script>`) e que o
  `JSON.parse` de cada bloco devolve o texto original.

## 11. Related Docs

- `docs/issues/known-issues.md` (entrada 164)
- `docs/architecture/adr-tenant-hosts.md` (seção 4.8, SEO)
- `docs/features/tenant-hosts-web.md`

## 12. Change Log

- 2026-09-26: `serializeJsonLd` nos três pontos de JSON-LD (V22, Lote 1). Data
  de trabalho; ainda sem commit.

---

_Template version: 2026-01-20_
