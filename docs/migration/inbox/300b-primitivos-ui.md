# 300b-primitivos-ui

Cinco primitivos com implementação própria saíram de `components/ui/`:
`carousel`, `form` (RHF), `sidebar`, `social-login-buttons` e `whatsapp-button`.
Cada um ganhou contrato + web + native em `packages/ui`. Web preserva Embla,
React Hook Form, cookie/sidebar, `signIn` e classes verdes do WhatsApp. Native
não repete Tailwind. Imports de produto (`app/login`, stories Form) apontam para
`@gb-locacoes/ui`. Legados aposentados. Esta fatia está em estado intermediate;
a migração não está concluída.

```yaml
fatia:
  id: 300b-primitivos-ui
  estado: intermediate
  conceito: carousel, form RHF, sidebar, social-login, whatsapp-button
  origem:
    - components/ui/carousel.tsx
    - components/ui/form.tsx
    - components/ui/sidebar.tsx
    - components/ui/social-login-buttons.tsx
    - components/ui/whatsapp-button.tsx
  destino:
    - packages/ui/src/contract/carousel.ts
    - packages/ui/src/contract/rhf-form.ts
    - packages/ui/src/contract/sidebar.ts
    - packages/ui/src/contract/social-login-buttons.ts
    - packages/ui/src/contract/whatsapp-button.ts
    - packages/ui/src/web/Carousel.web.tsx
    - packages/ui/src/native/Carousel.native.tsx
    - packages/ui/src/web/Form.web.tsx
    - packages/ui/src/native/Form.native.tsx
    - packages/ui/src/web/Sidebar.web.tsx
    - packages/ui/src/native/Sidebar.native.tsx
    - packages/ui/src/web/SocialLoginButtons.web.tsx
    - packages/ui/src/native/SocialLoginButtons.native.tsx
    - packages/ui/src/web/WhatsAppButton.web.tsx
    - packages/ui/src/native/WhatsAppButton.native.tsx
  invariantes:
    - id: carousel
      prova:
        "Carousel.web.test.tsx: embla-carousel-react + overflow-hidden; native
        sem className/embla"
    - id: form
      prova:
        "Form.web.test.tsx: FormProvider/Controller + text-destructive; native
        sem FormProvider/Tailwind"
    - id: sidebar
      prova:
        "Sidebar.web.test.tsx: cookie sidebar:state + bg-sidebar; sem import
        packages/frontend; native sem bg-sidebar"
    - id: social-login
      prova:
        "SocialLoginButtons.web.test.tsx: signIn google/facebook +
        #4285F4/#1877F2; native sem next-auth/Tailwind"
    - id: whatsapp
      prova:
        "WhatsAppButton.web.test.tsx: bg-green-600 + Solicitar Orçamento; native
        sem bg-green-600"
    - id: exclusoes
      prova:
        "model-viewer, lazy-3d-carousel, category-badge, equipment-3d-carousel,
        scroll-reveal não tocados"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Carousel.web.test.tsx
        packages/ui/src/web/Form.web.test.tsx
        packages/ui/src/web/Sidebar.web.test.tsx
        packages/ui/src/web/SocialLoginButtons.web.test.tsx
        packages/ui/src/web/WhatsAppButton.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 16:37"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:37"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:37"
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "category-badge, model-viewer e lazy-3d-carousel ainda em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/carousel.tsx
    - components/ui/form.tsx
    - components/ui/sidebar.tsx
    - components/ui/social-login-buttons.tsx
    - components/ui/whatsapp-button.tsx
  nao_verificado:
    - "[NOT_VERIFIED: Carousel/Form/Sidebar/SocialLogin/WhatsApp no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
