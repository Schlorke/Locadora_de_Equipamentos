# 282-email-arch

**Estado: bloqueado.** Nenhuma alteração de código nesta fatia.

Critério exclusivo: `packages/frontend/src/pages/email-admin/**` somente se
`node tools/arch-check.mjs` apontar `react-dom` ou `next/*` em arquivo universal
(sem sufixo `.web`).

Resultado do gate:

- `node tools/arch-check.mjs` → **exit 0**
  (`architecture gate passed (5 packages)`)
- Nenhuma violação RUNTIME-WEB-ONLY / universal dentro de `email-admin`
- Imports web-only já estão em arquivos `.web`:
  - `ui/email-folder-list.web.tsx` → `react-dom` (`createPortal`)
  - `model/carga.web.ts` → `next/navigation` (`useSearchParams`)

Sem violação no caminho exclusivo. PARE conforme contrato da fatia.

```yaml
fatia:
  id: 282-email-arch
  estado: bloqueado
  conceito: arch-check RUNTIME-WEB-ONLY em pages/email-admin
  motivo: >-
    arch-check exit 0; react-dom e next/* já isolados em .web.tsx/.web.ts;
    nenhum arquivo universal de email-admin viola o gate
  origem: []
  destino: []
  invariantes:
    - "somente packages/frontend/src/pages/email-admin/**"
    - "mover import web-only só se arch-check apontar arquivo universal"
    - "não tocar outras pastas, prisma, carrossel 3D, package.json,
      MIGRATION.md, CHANGELOG.md"
  comandos:
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:02"
      nota: "gate passed; zero violações em email-admin"
  gate:
    arch: pass
    tokens: n/a
    vitest_platform: n/a
    violacoes_email_admin: []
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: vitest platform — fatia bloqueada sem mudança]"
    - "[NOT_VERIFIED: token-check — fora do escopo]"
```
