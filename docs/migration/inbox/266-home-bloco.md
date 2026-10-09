# 266-home-bloco

**Estado: bloqueado.** Nenhuma alteração de código nesta fatia.

Critério: um componente de home em `components/` com nome contendo `home`,
excluindo `equipment-3d-carousel`, `model-viewer`, `lazy-3d-carousel` e
`scroll-reveal-init`. `hero` já movido não conta se o arquivo não existir. Não
tocar em `app/page.tsx`.

Inventário em disco (`components/` top-level e `ui/`):

- `components/home-page-client.tsx` — **ausente** (já migrado para
  `packages/frontend/src/widgets/home-cliente/ui/HomeCliente.web.tsx`; status
  git `D`)
- Demais blocos de home já ausentes do disco (hero, why-choose-us,
  contact-section, vitrine, destaques, etc.)
- Ainda no disco, mas **fora do escopo** desta fatia:
  `equipment-3d-carousel.tsx`, `ui/model-viewer.tsx`, `ui/lazy-3d-carousel.tsx`,
  `scroll-reveal-init.tsx`

Sem candidato seguro. PARE conforme contrato da fatia.

```yaml
fatia:
  id: 266-home-bloco
  estado: bloqueado
  conceito: bloco de home legado em components/
  motivo:
    "único arquivo com nome home (home-page-client) já ausente; restantes são
    carrossel 3D / model-viewer / lazy-3d / scroll-reveal ou já migrados"
  origem: []
  destino: []
  invariantes:
    - "não tocar em app/page.tsx (Prisma da home fica para outra fatia)"
    - "não tocar em equipment-3d-carousel, model-viewer, lazy-3d-carousel,
      scroll-reveal-init"
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
