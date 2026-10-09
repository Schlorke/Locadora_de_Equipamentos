# 300-reexports-ui

Auditoria exclusiva dos candidatos a reexport em `components/ui/`. Nenhum dos
cinco arquivos é só reexport de `@gb-locacoes/ui` (nem de widget em
`packages/frontend`): todos têm implementação própria. Nenhum import de produto
foi trocado e nenhum arquivo foi apagado. Fora do escopo (não tocados):
`model-viewer.tsx`, `lazy-3d-carousel.tsx`, `category-badge.tsx`. Comportamento,
cores e telefones de WhatsApp preservados por ausência de mudança. Esta fatia
está em estado intermediate; a migração não está concluída.

```yaml
fatia:
  id: 300-reexports-ui
  estado: intermediate
  conceito: auditoria de reexports candidatas em components/ui
  origem:
    - components/ui/carousel.tsx
    - components/ui/form.tsx
    - components/ui/sidebar.tsx
    - components/ui/social-login-buttons.tsx
    - components/ui/whatsapp-button.tsx
  destino: []
  pulados_implementacao_propria:
    - id: carousel
      motivo:
        Embla + Carousel/Content/Item/Previous/Next locais; só Button de
        @gb-locacoes/ui
      linhas_aprox: 263
    - id: form
      motivo:
        FormProvider/Controller/FormField/Label stack local; só Label de
        @gb-locacoes/ui
      linhas_aprox: 179
    - id: sidebar
      motivo:
        SidebarProvider + cookie + Sheet/menu API locais;
        Button/Input/Sheet/Skeleton de @gb-locacoes/ui
      linhas_aprox: 744
    - id: social-login-buttons
      motivo:
        signIn next-auth + botões Google/Facebook locais; só Button de
        @gb-locacoes/ui
      linhas_aprox: 136
    - id: whatsapp-button
      motivo:
        wrapper Button verde com MessageCircle local; só Button de
        @gb-locacoes/ui
      linhas_aprox: 48
  invariantes:
    - id: sem-reexport
      prova:
        "nenhum dos 5 inicia com export * from / reexport thin; packages/ui sem
        Carousel/Form/Sidebar/SocialLoginButtons/WhatsAppButton"
    - id: exclusoes
      prova:
        "model-viewer.tsx, lazy-3d-carousel.tsx, category-badge.tsx não tocados"
    - id: whatsapp-cores
      prova:
        "whatsapp-button.tsx intacto (bg-green-600); nenhum telefone alterado"
  comandos:
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:32"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:32"
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "carousel, form, sidebar, social-login-buttons, whatsapp-button,
        category-badge, model-viewer e lazy-3d-carousel ainda em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: vitest platform — nenhum teste afetado (zero diff de
      código)]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
