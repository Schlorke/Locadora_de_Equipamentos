# 271-whatsapp-componentes

Os seis componentes usados só por `/admin/whatsapp` saíram de
`components/admin/whatsapp/**` para o slice `pages/whatsapp-admin`. A página
importa Layout, DialogoCompleto e DialogoCompositor pelo caminho relativo do
slice. O telefone continua vindo da conversa da API; nenhum `555198205163`
(orçamento) nem `5551998205163` (FAB) foi introduzido.
`widgets/whatsapp-flutuante` não foi tocado. Pasta legada apagada. Esta fatia
está em estado intermediate; a migração não está concluída.

```yaml
fatia:
  id: 271-whatsapp-componentes
  estado: intermediate
  conceito: componentes UI exclusivos da página admin WhatsApp
  origem:
    - components/admin/whatsapp/whatsapp-layout-container.tsx
    - components/admin/whatsapp/whatsapp-conversation-list.tsx
    - components/admin/whatsapp/whatsapp-message-list.tsx
    - components/admin/whatsapp/whatsapp-viewer.tsx
    - components/admin/whatsapp/whatsapp-full-view-dialog.tsx
    - components/admin/whatsapp/whatsapp-composer-dialog.tsx
  destino:
    - packages/frontend/src/pages/whatsapp-admin/ui/Layout.web.tsx
    - packages/frontend/src/pages/whatsapp-admin/ui/ListaConversas.web.tsx
    - packages/frontend/src/pages/whatsapp-admin/ui/ListaMensagens.web.tsx
    - packages/frontend/src/pages/whatsapp-admin/ui/Visualizador.web.tsx
    - packages/frontend/src/pages/whatsapp-admin/ui/DialogoCompleto.web.tsx
    - packages/frontend/src/pages/whatsapp-admin/ui/DialogoCompositor.web.tsx
  telefone_preservado:
    nenhum_hardcoded (conversation.phone da API; sem 555198205163 nem
    5551998205163)
  invariantes:
    - id: titulo-apis
      prova:
        "WhatsAppAdminPage.web.test.tsx: WhatsApp, subtítulo, LIMIT 50, APIs
        conversations/messages, phone da API"
    - id: telefones-separados
      prova:
        "WhatsAppAdminPage.web.test.tsx: página, UI movida e rota sem
        555198205163 e sem 5551998205163"
    - id: componentes-no-slice
      prova:
        "WhatsAppAdminPage.web.test.tsx: imports ./Layout.web
        ./DialogoCompleto.web ./DialogoCompositor.web; pasta legada ausente"
    - id: shell
      prova:
        "WhatsAppAdminPage.web.test.tsx: rota importa
        @gb-locacoes/frontend/pages/whatsapp-admin e retorna AdminWhatsAppPage"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/whatsapp-admin/ui/WhatsAppAdminPage.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 15:58"
    - cmd: "node tools/arch-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:58"
      nota: >-
        2 violações pré-existentes fora da fatia: widgets/cartao-equipamento sem
        index; email-admin/ui/email-folder-list.tsx com react-dom sem .web.
        Nenhuma violação em whatsapp-admin.
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:58"
      nota: >-
        1 violação pré-existente em packages/ui/src/native/Progress.native.tsx
        (borderRadius 9999). Nenhuma violação em whatsapp-admin.
  gate:
    arch: fail_externo
    tokens: fail_externo
    vitest_platform: pass
    violacoes_conhecidas:
      - "arch: widgets/cartao-equipamento sem index (fora da fatia 271)"
      - "arch: email-admin email-folder-list.tsx react-dom (fora da fatia 271;
        email proibido)"
      - "token-check: Progress.native.tsx borderRadius 9999 (fora da fatia 271)"
      - "resizable continua em components/ui/resizable (primitivo legado)"
      - "widgets/whatsapp-flutuante não tocado (FAB 5551998205163)"
  aposentado:
    - components/admin/whatsapp/whatsapp-layout-container.tsx
    - components/admin/whatsapp/whatsapp-conversation-list.tsx
    - components/admin/whatsapp/whatsapp-message-list.tsx
    - components/admin/whatsapp/whatsapp-viewer.tsx
    - components/admin/whatsapp/whatsapp-full-view-dialog.tsx
    - components/admin/whatsapp/whatsapp-composer-dialog.tsx
  callers_atualizados:
    - packages/frontend/src/pages/whatsapp-admin/ui/WhatsAppAdminPage.web.tsx
  nao_verificado:
    - "[NOT_VERIFIED: página /admin/whatsapp no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
