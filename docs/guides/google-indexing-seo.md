# Indexação e SEO da vitrine por locadora

O SEO atual pertence à locadora identificada pelo host `{slug}.<raiz>`. Não
reutilize domínio, identificadores ou metas de verificação da GB-Locações para
configurar o novo SaaS ou uma outra locadora. Nesta preparação não foram
registrados domínios, propriedades no Google ou serviços de hospedagem.

## Implementação atual

Os metadados das páginas públicas usam
`apps/clients/web/src/app/(public)/[locadora]/(vitrine)/seo.ts` e os modelos
compartilhados de `packages/frontend/src/entities/configuracao`. O layout da
locadora monta somente os identificadores e verificações permitidos no seu
`siteContent`. Título, descrição, canonical, Open Graph e dados estruturados
devem manter a origem e a identidade da mesma locadora.

O sitemap é gerado por
`apps/clients/web/src/app/(public)/[locadora]/sitemap.xml/route.ts`. Inclui as
páginas públicas previstas, equipamentos e categorias, além de privacidade e
termos quando publicados pela locadora; cookies segue o contrato da plataforma.
A política de devolução conserva o tratamento previsto no código do sitemap.

O robots é gerado por
`apps/clients/web/src/app/(public)/[locadora]/robots.txt/route.ts`. Site
desligado responde com o 404 neutro. Site em pausa, ainda não indexável ou fora
do ambiente de produção usa `Disallow: /`. Quando indexável em produção, mantém
as áreas privadas excluídas e aponta o sitemap na origem canônica da locadora.

As regras, entradas e testes estão em
[SEO e medição da vitrine](../features/seo-e-medicao-da-vitrine.md),
[dados estruturados](../features/structured-data-json-ld.md) e
[site por estado](../features/site-por-estado.md). Não basta um build passar
para certificar indexação, publicação ou resultados no Google.

## Preparação futura por ambiente

Depois de escolher infraestrutura e domínio, conferir o host, publicação, estado
indexável, metadados, robots e sitemap da locadora alvo. Configurar as
verificações no painel e validar o HTML e os cabeçalhos realmente servidos,
mantendo as restrições de CSP. Identificadores reais não devem ser gravados em
documentação versionada nem usados como defaults de outra empresa.

O cadastro e envio a serviços externos são uma etapa posterior, vinculada ao
domínio e à conta corretos. Esta documentação não autoriza publicar, cadastrar
uma propriedade, enviar sitemap ou modificar a produção da GB-Locações.

## Registro histórico da GB

O antigo roteiro global, que citava `app/sitemap.ts`, `app/layout.tsx` e
`lib/structured-data-utils.ts`, foi substituído neste guia e preservado em
[arquivo histórico](../archive/google-indexing-seo-gb-pre-f.md.source). Esses
caminhos da raiz foram aposentados; o arquivo histórico registra o processo
anterior, sem servir como setup operacional do SaaS.
