import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import type { StorefrontLegalDocument } from '@gb-locacoes/contracts/storefront-legal'
import type { TenantPrincipal } from '../identity/index'
import { createAdminSettings, storefrontLegalDigest } from './admin-settings'

// Onda 134 (lote vitrine-conteúdo): textos legais da vitrine por locadora, publicados pelo painel. Cada publicação e
// despublicação grava o documento e a data juntos e uma linha em audit_logs na mesma transação, com o hash e o tamanho,
// nunca o texto. Sem a linha de configurações, a rota não cria uma com os padrões do Prisma (que trazem o título SEO da
// GB): 409 SETTINGS_NOT_CONFIGURED.
const principal: TenantPrincipal = {
  tenantId: 'tenant-alfa',
  userId: 'user-alfa',
  membershipId: 'membership-alfa',
  role: 'ADMIN',
}
const documento: StorefrontLegalDocument = {
  version: 1,
  lastUpdated: '19 de janeiro de 2026',
  intro: 'Bem-vindo aos Termos da Locadora Alfa. Texto fixture-private.',
  sections: [
    {
      id: 'contato',
      title: 'Contato',
      blocks: [{ type: 'paragraph', text: 'Fale conosco.' }],
      contactCard: true,
    },
  ],
}

/** JSON canônico (chaves em ordem) do documento validado: a base do hash gravado na auditoria. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map(
          (key) =>
            JSON.stringify(key) +
            ':' +
            canonical((value as Record<string, unknown>)[key])
        )
        .join(',') +
      '}'
    )
  return JSON.stringify(value)
}

function setup(rows: Array<Record<string, unknown>>) {
  const calls: string[] = []
  const tx = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
      calls.push('lock:' + strings.join('?').replace(/\s+/g, ' ').trim())
      return [{ id: principal.tenantId }]
    }),
    setting: {
      findMany: vi.fn(async () => {
        calls.push('settings:read')
        return rows
      }),
      update: vi.fn(async (args: Prisma.SettingUpdateArgs) => {
        calls.push('settings:update')
        return { ...rows[0], ...(args.data as object) }
      }),
      create: vi.fn(async () => {
        calls.push('settings:create')
        return {}
      }),
    },
    auditLog: {
      create: vi.fn(async (_args: { data: Record<string, unknown> }) => {
        calls.push('audit')
        return {}
      }),
    },
  }
  const withTenantTransaction = vi.fn(
    async <T>(
      _context: { tenantId: string },
      operation: (client: Prisma.TransactionClient) => Promise<T>
    ) => {
      calls.push('begin')
      const result = await operation(tx as unknown as Prisma.TransactionClient)
      calls.push('commit')
      return result
    }
  )
  const settings = createAdminSettings({
    withTenantTransaction: withTenantTransaction as unknown as Parameters<
      typeof createAdminSettings
    >[0]['withTenantTransaction'],
    revalidatePath: vi.fn(),
  })
  return { tx, calls, settings, withTenantTransaction }
}

describe('storefrontLegalDigest', () => {
  it('sha256 e tamanho do JSON canônico do documento (independe da ordem das chaves)', () => {
    const esperado = canonical(documento)
    expect(storefrontLegalDigest(documento)).toEqual({
      sha256: createHash('sha256').update(esperado, 'utf8').digest('hex'),
      bytes: Buffer.byteLength(esperado, 'utf8'),
    })
    const reordenado = JSON.parse(
      JSON.stringify({
        sections: documento.sections,
        intro: documento.intro,
        lastUpdated: documento.lastUpdated,
        version: 1,
      })
    )
    expect(storefrontLegalDigest(reordenado)).toEqual(
      storefrontLegalDigest(documento)
    )
  })
})

describe('saveLegalDocument (publicar)', () => {
  it('sem linha de configurações: SETTINGS_NOT_CONFIGURED e nada escrito', async () => {
    const { tx, settings } = setup([])
    expect(
      await settings.saveLegalDocument(principal, 'terms', documento)
    ).toEqual({ ok: false, code: 'SETTINGS_NOT_CONFIGURED' })
    expect(tx.setting.create).not.toHaveBeenCalled()
    expect(tx.setting.update).not.toHaveBeenCalled()
    expect(tx.auditLog.create).not.toHaveBeenCalled()
  })

  it('trava a organização antes de ler; grava documento e data juntos e a auditoria na mesma transação', async () => {
    const { tx, calls, settings, withTenantTransaction } = setup([
      { id: 'setting-alfa', tenantId: principal.tenantId },
    ])
    const result = await settings.saveLegalDocument(
      principal,
      'privacy',
      documento
    )
    expect(withTenantTransaction).toHaveBeenCalledTimes(1)
    expect(withTenantTransaction.mock.calls[0]![0]).toBe(principal)
    expect(calls[0]).toBe('begin')
    expect(calls[1]).toMatch(
      /^lock:SELECT id FROM organizations WHERE id = \? FOR UPDATE$/
    )
    expect(calls.slice(2)).toEqual([
      'settings:read',
      'settings:update',
      'audit',
      'commit',
    ])
    expect(tx.$queryRaw.mock.calls[0]!.slice(1)).toEqual([principal.tenantId])
    const update = tx.setting.update.mock.calls[0]![0]
    expect(update.where).toEqual({
      id_tenantId: { id: 'setting-alfa', tenantId: principal.tenantId },
    })
    const data = update.data as Record<string, unknown>
    expect(Object.keys(data).sort()).toEqual([
      'privacyDocument',
      'privacyPublishedAt',
    ])
    expect(data.privacyDocument).toEqual(documento)
    const publishedAt = data.privacyPublishedAt as Date
    expect(publishedAt).toBeInstanceOf(Date)
    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'privacy',
        document: documento,
        publishedAt: publishedAt.toISOString(),
      },
    })
    const audit = tx.auditLog.create.mock.calls[0]![0]
    expect(audit.data).toEqual({
      tenantId: principal.tenantId,
      userId: principal.userId,
      action: 'STOREFRONT_LEGAL_PUBLISHED',
      entity: 'Setting',
      entityId: 'setting-alfa',
      changes: {
        kind: 'privacy',
        ...storefrontLegalDigest(documento),
        publishedAt: publishedAt.toISOString(),
      },
    })
    // Nunca o texto: nem a introdução, nem o título, nem o marcador do documento.
    expect(JSON.stringify(audit)).not.toMatch(/fixture-private|Fale conosco/)
  })

  it('configuração duplicada: erro, nada escrito', async () => {
    const { tx, settings } = setup([
      { id: 'a', tenantId: principal.tenantId },
      { id: 'b', tenantId: principal.tenantId },
    ])
    await expect(
      settings.saveLegalDocument(principal, 'terms', documento)
    ).rejects.toThrow(/duplicada/)
    expect(tx.setting.update).not.toHaveBeenCalled()
    expect(tx.auditLog.create).not.toHaveBeenCalled()
  })
})

describe('removeLegalDocument (despublicar)', () => {
  it('zera documento e data juntos e audita a despublicação com o hash do texto retirado', async () => {
    const publishedAt = new Date('2026-10-01T12:00:00Z')
    const { tx, calls, settings } = setup([
      {
        id: 'setting-alfa',
        tenantId: principal.tenantId,
        returnPolicyDocument: documento,
        returnPolicyPublishedAt: publishedAt,
      },
    ])
    expect(
      await settings.removeLegalDocument(principal, 'returnPolicy')
    ).toEqual({
      ok: true,
      value: { kind: 'returnPolicy', document: null, publishedAt: null },
    })
    expect(calls[1]).toMatch(/FOR UPDATE$/)
    // NULL do SQL (DbNull), não o null do JSON: o CHECK de forma recusaria 'null'::jsonb.
    expect(tx.setting.update.mock.calls[0]![0].data).toEqual({
      returnPolicyDocument: Prisma.DbNull,
      returnPolicyPublishedAt: null,
    })
    const audit = tx.auditLog.create.mock.calls[0]![0]
    expect(audit.data).toMatchObject({
      action: 'STOREFRONT_LEGAL_UNPUBLISHED',
      entity: 'Setting',
      entityId: 'setting-alfa',
      userId: principal.userId,
      tenantId: principal.tenantId,
      changes: {
        kind: 'returnPolicy',
        ...storefrontLegalDigest(documento),
        publishedAt: null,
        previousPublishedAt: publishedAt.toISOString(),
      },
    })
    expect(JSON.stringify(audit)).not.toContain('fixture-private')
  })

  it('nada publicado (ou sem configurações): LEGAL_DOCUMENT_NOT_PUBLISHED, nada escrito', async () => {
    for (const rows of [
      [],
      [
        {
          id: 'setting-alfa',
          tenantId: principal.tenantId,
          termsDocument: null,
          termsPublishedAt: null,
        },
      ],
    ]) {
      const { tx, settings } = setup(rows)
      expect(await settings.removeLegalDocument(principal, 'terms')).toEqual({
        ok: false,
        code: 'LEGAL_DOCUMENT_NOT_PUBLISHED',
      })
      expect(tx.setting.update).not.toHaveBeenCalled()
      expect(tx.auditLog.create).not.toHaveBeenCalled()
    }
  })
})

describe('getLegalDocument (painel)', () => {
  it('documento e data da própria locadora; sem nada, os dois nulos', async () => {
    const publishedAt = new Date('2026-10-01T12:00:00Z')
    expect(
      await setup([
        {
          id: 's',
          tenantId: principal.tenantId,
          termsDocument: documento,
          termsPublishedAt: publishedAt,
        },
      ]).settings.getLegalDocument(principal, 'terms')
    ).toEqual({
      kind: 'terms',
      document: documento,
      publishedAt: publishedAt.toISOString(),
    })
    expect(
      await setup([]).settings.getLegalDocument(principal, 'privacy')
    ).toEqual({ kind: 'privacy', document: null, publishedAt: null })
  })
})

describe('conteúdo institucional no formulário do painel', () => {
  it('o GET devolve siteContent e o PUT o grava inteiro; sem siteContent no corpo, o gravado fica', async () => {
    const atual = {
      id: 'setting-alfa',
      tenantId: principal.tenantId,
      seoTitle: 'Alfa',
      siteContent: { experienceYears: 7 },
      smtpConfig: {},
      securityConfig: {},
      termsDocument: documento,
    }
    const { tx, settings } = setup([atual])
    const lido = await settings.getSettings(principal)
    expect(lido.success && lido.data).toMatchObject({
      siteContent: { experienceYears: 7 },
    })
    // Os textos legais têm rota própria: nunca no formulário.
    expect(lido.success && lido.data).not.toHaveProperty('termsDocument')
    const base = {
      seoTitle: 'Alfa',
      seoDescription: 'Locação',
      themeColorPrimary: '#ea580c',
      waveAnimation: 'animated' as const,
      maintenanceMode: false,
      supportChat: true,
      defaultLanguage: 'pt-BR',
      baseCurrency: 'BRL',
    }
    await settings.updateSettings(principal, {
      ...base,
      siteContent: { clientsServed: 300 },
    })
    expect(
      (tx.setting.update.mock.calls[0]![0].data as Record<string, unknown>)
        .siteContent
    ).toEqual({ clientsServed: 300 })
    await settings.updateSettings(principal, base)
    expect(tx.setting.update.mock.calls[1]![0].data).not.toHaveProperty(
      'siteContent'
    )
  })
})
