# Guia de indexação no Google e SEO – GB Locações

> **Caminhos atuais (conferidos em 2026-09-30)**: `lib/structured-data-utils.ts`
> saiu no commit `0cff7b65`; os dados estruturados (LocalBusiness e Product)
> estão em `packages/frontend/src/widgets/dados-estruturados`,
> `packages/frontend/src/widgets/seo-schemas` e
> `packages/frontend/src/entities/configuracao/model/local-business.ts` (ver
> `docs/features/structured-data-json-ld.md`).

> **Onda 135 (2026-10-08)**: no host web (`{slug}.<raiz>`), o SEO, a tag do
> Google (GA4 e Google Ads) e as metas de verificação do Search Console e da
> Meta são da locadora, gravados no painel ("SEO & Meta Tags") e montados pela
> vitrine com CSP por host: `docs/features/seo-e-medicao-da-vitrine.md`. As
> tabelas abaixo descrevem a raiz legada, que ainda serve a produção da GB até o
> corte.

Este guia descreve o processo para **indexar o site https://locacoesgb.com.br no
Google** e reforçar a presença nos resultados de busca (SEO).

---

## 1. O que o projeto já tem (pronto para indexação)

| Recurso                      | Status | Onde                                                       |
| ---------------------------- | ------ | ---------------------------------------------------------- |
| **Sitemap XML**              | ✅     | `/sitemap.xml` (gerado por `app/sitemap.ts`)               |
| **robots.txt**               | ✅     | `public/robots.txt` (aponta para o sitemap)                |
| **Meta tags**                | ✅     | `app/layout.tsx` (title, description, Open Graph, Twitter) |
| **Robots meta**              | ✅     | `index, follow` + configuração para Googlebot              |
| **Structured Data**          | ✅     | LocalBusiness (layout) + Product (páginas de equipamento)  |
| **Canonical / metadataBase** | ✅     | `https://locacoesgb.com.br` em `layout.tsx`                |
| **Imagem OG**                | ✅     | `gb-locacoes-og.png` para redes sociais                    |

Ou seja: a base técnica para indexação e SEO já está implementada. O que falta é
**registrar o site no Google e enviar o sitemap**.

---

## 2. Passo a passo: Google Search Console

### 2.1 Acessar e adicionar a propriedade

1. Acesse **[Google Search Console](https://search.google.com/search-console)**.
2. Faça login com a conta Google que será responsável pelo site (recomendado:
   conta da empresa).
3. Clique em **“Adicionar propriedade”**.
4. Escolha o tipo de propriedade:
   - **Domínio** (recomendado): cobre `https://locacoesgb.com.br` e
     `http://locacoesgb.com.br`. Exige verificação via DNS.
   - **Prefixo de URL**: apenas `https://locacoesgb.com.br`. Permite verificação
     por HTML (meta tag) ou outros métodos.

Use **“Prefixo de URL”** se não tiver acesso ao DNS; use **“Domínio”** se tiver
(mais completo).

---

### 2.2 Verificar a propriedade

#### Opção A – Verificação por tag HTML (meta tag)

1. No Search Console, ao adicionar a propriedade **por prefixo de URL**,
   selecione **“Tag HTML”**.
2. O Google mostrará algo como:
   ```html
   <meta name="google-site-verification" content="SEU_CODIGO_AQUI" />
   ```
3. Copie apenas o valor de `content` (o código longo).
4. No projeto, adicione em **`.env.local`** (ou nas variáveis de ambiente do
   deploy) a variável **`GOOGLE_SITE_VERIFICATION`** com o código que o Google
   forneceu:
   ```bash
   GOOGLE_SITE_VERIFICATION="abc123xyz_seu_codigo_real_aqui"
   ```
   **Nunca commitar tokens reais** no código; use sempre variáveis de ambiente
   (ver `.env.example`).
5. Faça deploy do site (ou rode `pnpm dev` e acesse a home para testar).
6. No Search Console, clique em **“Verificar”**.

O Next.js injeta essa chave em uma meta tag `google-site-verification` no
`<head>`. Após o deploy, a verificação deve ser concluída em alguns minutos.

#### Opção B – Verificação por arquivo HTML

1. No Search Console, escolha **“Arquivo HTML”** e baixe o arquivo (ex.:
   `google123abc.html`).
2. Coloque esse arquivo em **`public/`** do projeto (ex.:
   `public/google123abc.html`).
3. Faça deploy. A URL será `https://locacoesgb.com.br/google123abc.html`.
4. No Search Console, clique em **“Verificar”**.

#### Opção C – Verificação por DNS (propriedade “Domínio”)

1. No Search Console, ao adicionar propriedade por **Domínio**, o Google
   mostrará um registro TXT para adicionar no DNS.
2. No painel do seu provedor de domínio (onde está configurado
   `locacoesgb.com.br`), crie um registro **TXT** no host indicado (geralmente
   `@` ou o domínio raiz) com o valor exato fornecido pelo Google.
3. Aguarde a propagação do DNS (minutos a algumas horas) e clique em
   **“Verificar”** no Search Console.

---

### 2.3 Enviar o Sitemap

1. No menu do Search Console, vá em **“Sitemaps”** (ou “Mapas do site”).
2. No campo “Adicionar um novo sitemap”, informe:
   ```text
   sitemap.xml
   ```
   (ou a URL completa: `https://locacoesgb.com.br/sitemap.xml`)
3. Clique em **“Enviar”**.

O Google passará a rastrear as URLs do sitemap. O projeto já gera o sitemap em
**`app/sitemap.ts`** com:

- Páginas estáticas (home, equipamentos, sobre, contato, orçamento, área do
  cliente, privacidade, termos, cookies).
- Páginas dinâmicas de equipamentos (`/equipamentos/[id]`).
- URLs de categorias (`/equipamentos?categoria=...`).

Não é necessário enviar `sitemap.xml` manualmente a cada mudança; o Search
Console continua usando o mesmo endereço.

No host web, cada locadora tem o próprio `https://{slug}.<raiz>/sitemap.xml`
(`apps/clients/web/src/app/(public)/[locadora]/sitemap.xml/route.ts`), vazio e
`noindex` com o site em pausa ou ainda não indexável. Desde a onda 135 (lote A,
A7) ele segue o `app/sitemap.ts` acima: as mesmas frequências e prioridades,
`lastmod` com a data da geração nas páginas fixas e legais, os equipamentos
disponíveis e as categorias com equipamento disponível
(`/equipamentos?categoria=<slug>`, com a data de alteração da categoria).
Diferenças conhecidas: o equipamento sai sem `lastmod` (a leitura pública do
catálogo não traz a data de alteração), Privacidade e Termos só entram quando a
locadora publicou o texto, e a área do cliente não entra (`noindex`).

---

### 2.4 Solicitar indexação de páginas importantes (opcional)

1. No Search Console, use **“Inspeção de URL”** (barra no topo).
2. Digite a URL exata, por exemplo: `https://locacoesgb.com.br`.
3. Quando a página for analisada, use **“Solicitar indexação”** para priorizar o
   rastreamento.

Recomendado para: home, `/equipamentos`, `/orcamento`, `/contato` e algumas
páginas de equipamentos mais importantes. Não abuse (dezenas de URLs por dia); o
Google também descobre o resto pelo sitemap.

---

## 3. Conferências técnicas no projeto

### 3.1 Sitemap acessível

- Em produção, abra: **https://locacoesgb.com.br/sitemap.xml**
- Deve retornar XML com `<url>`, `<loc>`, `<lastmod>`, etc.

### 3.2 robots.txt

- Abra: **https://locacoesgb.com.br/robots.txt**
- Deve conter algo como:
  ```text
  Sitemap: https://locacoesgb.com.br/sitemap.xml
  ```
- O projeto já bloqueia `/admin`, `/api`, etc., e libera as páginas públicas.

### 3.3 Verificação Google no HTML

- Após definir `GOOGLE_SITE_VERIFICATION` em `.env.local` (ou no deploy) e fazer
  deploy, abra o código-fonte da home (Ctrl+U) e procure por
  `google-site-verification`. Deve existir uma meta tag com o valor que você
  configurou.

---

## 4. Aumentar o SEO (além da indexação)

O projeto já inclui:

- **Títulos e descrições** por página (e globais no layout).
- **Structured Data** (LocalBusiness + Product) em
  `lib/structured-data-utils.ts` e nas páginas de equipamento.
- **Open Graph e Twitter Cards** para compartilhamento.
- **metadataBase** e configuração de robots para o Googlebot.

Para reforçar ainda mais o SEO:

1. **Search Console**
   - Acompanhe “Desempenho” (cliques, impressões, CTR) e “Cobertura” / “Páginas”
     (indexadas, erros).
   - Corrija qualquer URL com erro de rastreamento ou indexação.

2. **Conteúdo**
   - Mantenha títulos e descrições únicos e relevantes por página (já feito via
     `generateMetadata` onde existe).
   - Use os campos de SEO do admin (se houver) para título/descrição do site.

3. **Performance e Core Web Vitals**
   - O Search Console mostra Core Web Vitals (LCP, FID, CLS). Melhorar esses
     indicadores pode ajudar no ranking.
   - O projeto já usa lazy loading, otimização de imagens e boas práticas;
     acompanhe os relatórios para ajustes pontuais.

4. **Links internos**
   - Menu, footer e links entre equipamentos/categorias já ajudam. Mantenha uma
     navegação clara e estável.

### 4.4 Palavras-chave recomendadas (segmento e local)

As meta keywords do site estão configuradas em **`app/layout.tsx`** com termos
de alto potencial para o segmento (locação de equipamentos para construção
civil) e para buscas locais (Porto Alegre e região). Use a mesma lógica em
títulos, descrições e conteúdo das páginas.

**Estratégia:**

- **Serviço principal:** locação/aluguel de equipamentos para construção civil e
  obras.
- **Produtos:** andaime suspenso, betoneira, compressor, cadeira para pintura.
- **Local:** Porto Alegre, região metropolitana, RS.
- **Intenção:** “aluguel de…”, “locação de…”, “equipamentos para obras”.

**Lista de palavras-chave (usar em textos, títulos e descrições):**

| Tipo      | Exemplos                                                                  |
| --------- | ------------------------------------------------------------------------- |
| Core      | locação de equipamentos para construção civil, aluguel equipamentos obras |
| Produtos  | andaime suspenso, betoneira, compressor de ar, cadeira para pintura       |
| Local     | Porto Alegre, região metropolitana Porto Alegre, construção civil RS      |
| Long-tail | aluguel de andaime Porto Alegre, locação betoneira construção civil       |
| Marca     | GB Locações                                                               |

**Onde já está aplicado:**

- Meta `keywords` no layout (lista completa em `app/layout.tsx`).
- Descrição do LocalBusiness em `lib/structured-data-utils.ts`.
- Títulos e descrições por página (quando existir `generateMetadata`).

Para páginas de equipamentos (`/equipamentos/[id]`), inclua o nome do produto e
variações (ex.: “Locação de betoneira em Porto Alegre”) nos títulos e na
descrição da página.

---

## 5. Checklist rápido

- [ ] Conta no [Google Search Console](https://search.google.com/search-console)
      criada/acessada.
- [ ] Propriedade adicionada (preferencialmente **https://locacoesgb.com.br**).
- [ ] Verificação concluída (variável `GOOGLE_SITE_VERIFICATION` no deploy
      **ou** arquivo em `public/` **ou** registro DNS).
- [ ] Sitemap enviado: `sitemap.xml` (ou URL completa) na seção “Sitemaps”.
- [ ] Conferido em produção: `https://locacoesgb.com.br/sitemap.xml` e
      `https://locacoesgb.com.br/robots.txt`.
- [ ] (Opcional) Solicitar indexação da home e de 2–3 páginas principais.
- [ ] Acompanhar, em alguns dias/semanas: “Cobertura” e “Desempenho” no Search
      Console.

---

## 6. Referências

- [Google Search Console – Ajuda](https://support.google.com/webmasters/answer/9008083)
- [Enviar sitemaps – Ajuda do Search Console](https://support.google.com/webmasters/answer/7451001)
- Documentação interna do projeto:
  `docs/internal/seo-optimization-implementation.md`

---

_Documentação criada em fevereiro de 2026. Domínio do site:
https://locacoesgb.com.br_
