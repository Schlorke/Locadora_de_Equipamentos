# 349-public-host

Conferir `apps/clients/web/public` (node `fs` + `dir`/`fsutil`, não PowerShell
recurse). É **JUNCTION** local absoluta → `public/` da raiz; listada no
`.gitignore`. `git config core.symlinks=false`; zero entradas mode `120000` no
índice. Symlink relativo versionável (`../../../public`) **não** trocado:
quebraria checkout Windows com `core.symlinks=false`. Scan Node: **0** imports
`packages/frontend` → `lib/` da raiz (`@/lib` ou relativo escapando o pacote).
Sem cópia estilo 321. Sem CHANGELOG. Sem `pnpm arch` (sem editar packages/apps).
Sem commit. Migração **não** concluída.

```yaml
fatia:
  id: 349-public-host
  estado: intermediate
  conceito: >-
    conferir junction/symlink do public do host web; se ok, um import
    client-safe lib/ raiz restante; senão documentar e parar
  public_host:
    path: apps/clients/web/public
    tipo: JUNCTION
    alvo_lido: "C:\\Projetos\\Locadora_Equipamentos\\public"
    gitignored: true
    gitignore_linha: ".gitignore:82 apps/clients/web/public"
    core_symlinks: false
    symlinks_versionados_repo: 0
    trocado_para_symlink_relativo: false
    motivo_nao_trocar: >-
      junction é o atalho local Windows; core.symlinks=false e zero 120000 no
      índice — symlink commitável viraria arquivo-texto no checkout e quebraria
      o host; GLB permanece só em public/ da raiz (sem duplicar)
  prova_disco:
    - "node fs.lstatSync: isSymbolicLink true (junction também reporta assim)"
    - "cmd dir /AL: <JUNCTION> public
      [\\??\\C:\\Projetos\\Locadora_Equipamentos\\public]"
    - "fsutil reparsepoint: marca 0xa0000003 (ponto de montagem / junction)"
    - "git check-ignore -v: .gitignore:82"
  import_lib_raiz_restante:
    encontrado: false
    scan:
      "packages/frontend/src — @/lib e relativos que resolvem para lib/ da raiz"
    hits: 0
    copia_estilo_321: false
  arquivos_editados:
    - docs/migration/inbox/349-public-host.md
    - docs/migration/MIGRATION.md
  nao_editado:
    - apps/clients/web/public (junction mantida)
    - .gitignore
    - packages/frontend
    - public/ (raiz; GLBs)
    - carrossel 3D
    - CHANGELOG.md
  comandos:
    - cmd: "node fs.lstatSync + readlink + realpath (apps/clients/web/public)"
      exit: 0
      nota: "junction → public absoluta da raiz"
    - cmd: "cmd /c dir /AL apps\\clients\\web"
      exit: 0
      nota: "<JUNCTION> public"
    - cmd: "git ls-files -s | filtrar mode 120000"
      exit: 0
      nota: "0 symlinks versionados"
    - cmd: "scan Node imports packages/frontend → lib/ raiz"
      exit: 0
      nota: "0 hits"
    - cmd: pnpm arch
      exit: null
      nota: "não rodado — sem edição em packages/ ou apps/"
  exits_anteriores_contexto:
    pnpm_arch: 0
    pnpm_tokens: 0
    pnpm_typecheck: 0
    pnpm_check_tokens: 0
    pnpm_build_web: 0
    pnpm_bundle_mobile: 0
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test (Postgres local recusou a senha do compose,
      28P01; não tente de novo)]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```
