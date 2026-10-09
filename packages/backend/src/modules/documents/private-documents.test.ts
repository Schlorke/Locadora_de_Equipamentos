import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createPrivateDocumentStorage,
  isOwnedDocumentPath,
  preparePrivateDocument,
  createDocumentPath,
  parseCaptureMetadata,
} from './private-documents'

describe('private document boundary', () => {
  it.each([
    'tenants/other/clients/client/file.pdf',
    'tenants/tenant/clients/other/file.pdf',
    'tenants/tenant/clients/client/../secret.pdf',
    'tenants/tenant/clients/client/%2e%2e.pdf',
    'tenants/tenant/clients/client/file.exe',
  ])('refuses an unowned or malformed path: %s', (path) => {
    expect(isOwnedDocumentPath(path, 'tenant', 'client')).toBe(false)
  })
  it('creates an owned unpredictable file key and rejects malformed identifiers', () => {
    const path = createDocumentPath('tenant', 'client', 'pdf')
    expect(isOwnedDocumentPath(path, 'tenant', 'client')).toBe(true)
    expect(createDocumentPath('tenant', 'client', 'pdf')).not.toBe(path)
    expect(() => createDocumentPath('../tenant', 'client', 'pdf')).toThrow(
      'Identificador inválido'
    )
  })
  it.each([true, undefined])(
    'refuses a bucket without an explicitly private policy: %s',
    async (isPublic) => {
      const from = vi.fn()
      const getClient = vi.fn(
        async () =>
          ({
            storage: {
              getBucket: async () => ({
                data: { public: isPublic },
                error: null,
              }),
              from,
            },
          }) as unknown as Pick<SupabaseClient, 'storage'>
      )
      const service = createPrivateDocumentStorage({ getClient })
      expect(getClient).not.toHaveBeenCalled()
      await expect(service.getPrivateDocumentStorage()).rejects.toThrow(
        'PRIVATE_DOCUMENT_STORAGE_UNAVAILABLE'
      )
      expect(from).not.toHaveBeenCalled()
    }
  )
  it('opens only the checked private bucket', async () => {
    const from = vi.fn(() => ({ marker: 'private' }))
    const getBucket = vi.fn(async () => ({
      data: { public: false },
      error: null,
    }))
    const service = createPrivateDocumentStorage({
      getClient: async () =>
        ({ storage: { getBucket, from } }) as unknown as Pick<
          SupabaseClient,
          'storage'
        >,
    })
    expect(await service.getPrivateDocumentStorage()).toEqual({
      marker: 'private',
    })
    expect(getBucket).toHaveBeenCalledWith('gb-locacoes-client-documents')
    expect(from).toHaveBeenCalledWith('gb-locacoes-client-documents')
  })
  it('rejects mislabeled or incomplete PDF bytes and oversized metadata', async () => {
    await expect(
      preparePrivateDocument(
        new File(['bad'], 'contract.pdf', { type: 'application/pdf' })
      )
    ).rejects.toThrow('PDF inválido')
    expect(() => parseCaptureMetadata('[]')).toThrow(
      'Metadados devem ser um objeto JSON'
    )
    expect(() => parseCaptureMetadata('x'.repeat(16385))).toThrow(
      'Metadados inválidos'
    )
    const result = await preparePrivateDocument(
      new File(['%PDF-1.7\nfixture\n%%EOF'], 'contract.pdf', {
        type: 'application/pdf',
      })
    )
    expect(result.mimeType).toBe('application/pdf')
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/)
  })
})
