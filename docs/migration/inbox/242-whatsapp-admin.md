# 242-whatsapp-admin

A tela saiu de `app/admin/whatsapp/page.tsx`. A URL `/admin/whatsapp` continua
no shell fino, que só renderiza `AdminWhatsAppPage`. O título continua WhatsApp.
O subtítulo continua Acompanhe e responda mensagens de clientes. Os limites
continuam 50 conversas e 50 mensagens. As rotas de API continuam
`/api/admin/whatsapp/conversations` e `.../messages`. Não havia telefone
hardcoded na origem; nenhum `555198205163` (orçamento) nem `5551998205163` (FAB)
foi introduzido — o `phone` continua vindo da conversa da API.

```yaml
fatia:
  id: 242-whatsapp-admin
  estado: intermediate
  conceito: página admin WhatsApp
  origem:
    - app/admin/whatsapp/page.tsx
  destino:
    - packages/frontend/src/pages/whatsapp-admin/ui/WhatsAppAdminPage.web.tsx
    - packages/frontend/src/pages/whatsapp-admin/index.ts
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
        "WhatsAppAdminPage.web.test.tsx: source e rota sem 555198205163 e sem
        5551998205163"
    - id: shell
      prova:
        "WhatsAppAdminPage.web.test.tsx: rota importa
        @gb-locacoes/frontend/pages/whatsapp-admin e retorna AdminWhatsAppPage"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/whatsapp-admin/ui/WhatsAppAdminPage.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 1
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: fail
    tokens: pass
    violacoes_conhecidas:
      - "FSD-PUBLIC-API pages/configuracoes sem index (fora desta fatia)"
      - "FSD-PUBLIC-API pages/email-admin sem index (fora desta fatia)"
      - "components/admin/whatsapp/* continua legado"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: página /admin/whatsapp no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
