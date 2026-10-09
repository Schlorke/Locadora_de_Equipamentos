<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may
all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` (resolved from this file's directory; in
monorepos the `next` package may not be visible from the repo root) before
writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at
`node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a
diff only re-creates the uncommitted change; committing it with your work keeps
the tree clean.

<!-- END:nextjs-agent-rules -->

## `public/` do host é cópia gerada

`apps/clients/web/public` é uma pasta real gerada por
`tools/sync-web-public.mjs` a partir de `public/` da raiz (a fonte única dos
assets). O `predev` e o `prebuild` deste `package.json` rodam a cópia; a captura
visual (`tests/visual/playwright.visual.config.ts`) a roda antes do `next dev`,
que ali é chamado direto e pula o `predev`.

- Edite só `public/` da raiz; a cópia é incremental (tamanho e data) e apaga o
  que saiu da fonte, só dentro da pasta com o sentinela `.sync-web-public`.
- A pasta está no `.gitignore`; nunca a versione nem a troque por junção ou
  symlink (regra 7 do AGENTS.md da raiz; entrada 171 dos known-issues).
- Arquivo novo ou alterado em `public/` com o `next dev` já rodando só chega ao
  host na próxima sincronização: rode `node tools/sync-web-public.mjs` (na raiz)
  ou reinicie o `dev`.
- Uma sincronização por vez: execuções simultâneas (dois `dev`/`build`, agentes
  no mesmo checkout) se serializam pelo trinco
  `apps/clients/web/.sync-web-public.lock`, que só existe enquanto uma delas
  roda. A segunda avisa que está aguardando e depois acha tudo pronto. Trinco de
  processo que morreu sai sozinho; se a ferramenta desistir de esperar (60 s) e
  nenhuma sincronização estiver rodando, apague só esse arquivo.
- Se a ferramenta recusar porque o destino é um link (resto do antigo
  `link-web-public`), remova só o link, sem recursão, e rode de novo:

  ```bash
  cmd /c rmdir apps\clients\web\public   # Windows (cmd ou PowerShell)
  unlink apps/clients/web/public          # Linux/macOS
  node tools/sync-web-public.mjs
  ```
