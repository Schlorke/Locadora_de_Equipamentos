# 295-components-raiz

**Estado: bloqueado.** Nenhuma alteração de código nesta fatia.

Critério exclusivo: até três `.tsx` diretamente em `components/` (não
subpastas). Excluir `equipment-3d-carousel.tsx`, `scroll-reveal-init.tsx` e
qualquer 3D/model-viewer. Já movidos (290 / 269b): `image-carousel-zoom`,
`session-provider-wrapper`, `seo-schemas`, `equipment-card`.

Regra de destino: mover só para widget ou page FSD **que já usa o arquivo**.

## Inventário em disco (`components/*.tsx`)

| Arquivo                         | Situação                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `equipment-3d-carousel.tsx`     | excluído (3D)                                                                                           |
| `scroll-reveal-init.tsx`        | excluído                                                                                                |
| `categories.tsx`                | órfão — zero imports                                                                                    |
| `categories-with-animation.tsx` | órfão — zero imports                                                                                    |
| `legal-page-layout.tsx`         | órfão — zero imports                                                                                    |
| `mdx.tsx`                       | órfão — zero imports                                                                                    |
| `quote-form.tsx`                | órfão — zero imports de produto                                                                         |
| `theme-provider.tsx`            | órfão — zero imports (`packages/ui` já tem ThemeProvider próprio)                                       |
| `service-worker-register.tsx`   | só `app/ClientLayout.tsx` (`hostExtras`); FSD não importa; `ClientLayoutShell` documenta como host-only |

Nenhum elegível é importado por widget/page em `packages/frontend`. Sem
candidato sob a regra “FSD que já usa o arquivo”. PARE.

```yaml
fatia:
  id: 295-components-raiz
  estado: bloqueado
  conceito: até três .tsx da raiz de components/ (sem 3D / scroll-reveal)
  motivo:
    "restantes são órfãos, host-only (service-worker-register) ou excluídos;
    nenhum widget/page FSD já importa candidato elegível"
  origem: []
  destino: []
  invariantes:
    - "não migrar equipment-3d-carousel / scroll-reveal-init / model-viewer"
    - "não inventar consumidor FSD para órfãos"
    - "não puxar ServiceWorkerRegister para o pacote (permanece hostExtras)"
    - "não tocar em MIGRATION.md, CHANGELOG.md, prisma, package.json, carrossel
      3D"
  comandos: []
  gate:
    arch: n/a
    tokens: n/a
    vitest_platform: n/a
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: vitest platform — fatia bloqueada sem mudança]"
    - "[NOT_VERIFIED: arch-check — fatia bloqueada sem mudança]"
    - "[NOT_VERIFIED: token-check — fatia bloqueada sem mudança]"
```
