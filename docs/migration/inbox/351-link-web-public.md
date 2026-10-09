# 351-link-web-public

> **Substituído (onda 9b, achado 130)**: a junção contrariava a regra 7 do
> `AGENTS.md`. `tools/link-web-public.mjs`, o script `link:web-public` e a
> junção não existem mais; `apps/clients/web/public` é uma cópia real gerada por
> `tools/sync-web-public.mjs` no predev/prebuild do host web
> (`apps/clients/web/AGENTS.md`). Registro histórico abaixo.

Script versionado `tools/link-web-public.mjs` para criar, se faltar,
`apps/clients/web/public` como **junction** (Windows, absoluta) ou **symlink
relativo** (outros SO) apontando para `public/` da raiz. Se já for
junction/symlink para esse destino, não faz nada. Se existir pasta real com
arquivos, **não** apaga. Não copia GLB. Não versiona symlink (continua
gitignored; `core.symlinks=false`).

## Invocação

```bash
node tools/link-web-public.mjs
```

Ou via npm script (raiz):

```bash
pnpm link:web-public
```

Nesta máquina a junction já existia e apontava para
`C:\Projetos\Locadora_Equipamentos\public` — script **não** executado (só
`node --check`). Junction preservada. Sem commit. Migração **não** concluída.

```yaml
fatia:
  id: 351-link-web-public
  estado: intermediate
  conceito: >-
    script Node versionado que cria junction/symlink local
    apps/clients/web/public → public/ da raiz; sem apagar pasta real com
    arquivos; sem versionar symlink
  script: tools/link-web-public.mjs
  invocacao: "node tools/link-web-public.mjs"
  npm_script: "link:web-public"
  public_host:
    path: apps/clients/web/public
    tipo: JUNCTION
    alvo: "C:\\Projetos\\Locadora_Equipamentos\\public"
    preservada: true
    script_executado: false
    motivo_nao_executar: "já junction válida para public/ da raiz"
  nao_editado:
    - apps/clients/web/public (junction mantida)
    - public/ (raiz; GLBs)
    - carrossel 3D
    - prebuild / postinstall / db:generate
  arquivos_editados:
    - tools/link-web-public.mjs
    - package.json (só script link:web-public)
    - docs/migration/inbox/351-link-web-public.md
    - docs/migration/MIGRATION.md
    - CHANGELOG.md
  comandos:
    - cmd: "node --check tools/link-web-public.mjs"
      exit: 0
      nota: "sintaxe OK; script não rodado"
    - cmd: "fsutil / Get-Item apps/clients/web/public"
      exit: 0
      nota: "JUNCTION → public/ raiz preservada"
    - cmd: pnpm arch
      exit: null
      nota: "não rodado — script em tools/, fora de packages/apps"
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test (sem .env local; senha do compose recusada)]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```
