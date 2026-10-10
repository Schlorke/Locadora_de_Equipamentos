import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('WhatsApp admin', () => {
  it('mantém título, APIs, limites e não mistura telefones de orçamento/FAB', () => {
    const source = readFileSync(
      new URL('./WhatsAppAdminPage.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('title="WhatsApp"')
    expect(source).toContain(
      'subtitle="Acompanhe e responda mensagens de clientes"'
    )
    const model = readFileSync(
      new URL('../model/use-whatsapp-page.ts', import.meta.url),
      'utf8'
    )
    expect(model).toContain('CONVERSATIONS_LIMIT = 50')
    expect(model).toContain('MESSAGES_LIMIT = 50')
    expect(model).toContain('api.conversations(CONVERSATIONS_LIMIT)')
    expect(model).toContain('messageApi.messages(')
    expect(model).toContain('sendApi.send(selectedConversationId, text)')
    expect(model).toContain("phone: String(c.phone ?? '')")
    expect(model).toContain(
      "currentConversation?.displayName ?? currentConversation?.phone ?? 'Conversa'"
    )
    expect(source).toContain("from './Layout.web'")
    expect(source).toContain("from './DialogoCompleto.web'")
    expect(source).toContain("from './DialogoCompositor.web'")
    expect(source).not.toContain('components/admin/whatsapp')
    expect(source).not.toContain('555198205163')
    expect(source).not.toContain('5551998205163')

    const uiDir = new URL('.', import.meta.url)
    for (const file of [
      'Layout.web.tsx',
      'ListaConversas.web.tsx',
      'ListaMensagens.web.tsx',
      'Visualizador.web.tsx',
      'DialogoCompleto.web.tsx',
      'DialogoCompositor.web.tsx',
    ]) {
      const path = new URL(file, uiDir)
      expect(existsSync(path)).toBe(true)
      const body = readFileSync(path, 'utf8')
      expect(body).not.toContain('555198205163')
      expect(body).not.toContain('5551998205163')
    }

    expect(
      existsSync(
        new URL(
          '../../../../../../components/admin/whatsapp/whatsapp-layout-container.tsx',
          import.meta.url
        )
      )
    ).toBe(false)

    // A rota do host web mantém a composição compartilhada.
    const webRoute = readFileSync(
      new URL(
        '../../../../../../apps/clients/web/src/app/(admin)/admin/whatsapp/page.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/whatsapp-admin["']/
    )
    expect(webRoute).toContain('return <AdminWhatsAppPage />')
    expect(webRoute).not.toContain('555198205163')
    expect(webRoute).not.toContain('5551998205163')
  })
})
