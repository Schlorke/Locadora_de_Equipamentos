# Hero: fundo consistente durante carregamento

O incidente de 2025 e os commits citados na receita antiga estão no
[registro histórico](../archive/wave135-pre-f/docs/guides/hero-loading-background-fix.md.source).
O código atual continua evitando escolher o fundo com dados vazios transitórios,
mas obtém as configurações pela composição pública da locadora.

## Caminho atual dos dados

1. `apps/clients/web/src/app/(public)/[locadora]/(vitrine)/page.tsx` lê
   `getPublicSettings`, a loja e as categorias da locadora.
2. `apps/clients/web/src/host/server/public-api.ts` é a borda servidor de
   leitura HTTP; a página não consulta Prisma diretamente.
3. `buildHeroInitialSettings`, em
   `packages/frontend/src/pages/home/model/hero-settings.ts`, recorta os dados
   passados a `HomePage` e ao Hero.
4. `packages/frontend/src/widgets/hero/ui/Hero.web.tsx` entrega esse recorte
   como `initialData` ao `usePublicSettings`, da entidade configuração.

## Contrato de apresentação preservado

O Hero deriva as imagens de `settings.heroCarousel`. Durante carregamento,
`loadingShouldShowWhite` considera tanto as imagens atuais quanto as iniciais; o
estado final usa a presença das imagens atuais. Assim, a revalidação não
descarta a previsão do fundo que já veio do servidor.

`HeroBackgroundCarousel.web.tsx` mantém a imagem e o overlay existentes quando
há slides; sem imagens, mantém o degradê histórico laranja. Não trocar esse
degradê por aliases com outra interpolação, não adicionar cores e não alterar a
animação para encobrir uma falha de dados. O fallback de revelação de 600ms não
substitui o evento `scrollRevealReady` do carrossel 3D.

## Validação de uma mudança futura

Comparar carregamento frio, revalidação e navegação interna, com locadora que
tenha imagens e locadora sem imagens. Conferir o primeiro quadro, a sequência
dos slides e a ausência de dados de outra locadora. Os testes atuais incluem
`Hero.web.test.tsx`, `Hero.partes.web.test.tsx` e os testes da rota da home.

Antes de qualquer alteração no entorno, ler integralmente o
[contrato do carrossel 3D](../features/equipment-3d-carousel.md): preservar
`scrollRevealReady`, `delayBoundsFit`, `isRevealComplete`,
`hasPassedFirstModel = currentIndex > 0`, `disableAutoFit`, `maxDuration={0}` no
primeiro modelo e a espera de 200ms. Uma captura de fundo não comprova esses
contratos nem a validação em Slow 3G.

Esta atualização só documenta os donos atuais; não muda B0, cores, layout,
timers ou comportamento 3D, nem declara uma rodada visual nova.

_Atualizado em 2026-10-09; fontes conferidas no clone pós-retirada._
