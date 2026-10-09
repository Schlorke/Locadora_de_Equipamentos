import { expect, it, vi } from 'vitest'
const calls = vi.hoisted(() => ({ auth: vi.fn(), content: vi.fn(() => ({})) }))
vi.mock('googleapis', () => ({
  google: { content: calls.content, auth: { GoogleAuth: calls.auth } },
}))
import { createGoogleMerchantClient } from '@/lib/google-merchant/client'
// Porte da onda 135 (D9 = portar; quarentena COD-04 transferida): a mesma recusa no código que sobrevive à raiz.
import { createGoogleMerchantClient as createPortedGoogleMerchantClient } from '../../scripts/ops/google-merchant/client'
import { googleMerchantSync } from '../../scripts/ops/google-merchant'
it('rejects the legacy global Merchant factory before creating provider authentication', () => {
  expect(() => createGoogleMerchantClient()).toThrow(
    'GOOGLE_MERCHANT_LEGACY_DISABLED'
  )
  expect(calls.auth).not.toHaveBeenCalled()
})
it('the ported factory (scripts/ops/google-merchant) keeps the same refusal before any provider authentication', async () => {
  expect(() => createPortedGoogleMerchantClient()).toThrow(
    'GOOGLE_MERCHANT_LEGACY_DISABLED'
  )
  // The sync service reaches the factory before any database query: no tenant data leaves for the global feed.
  await expect(
    googleMerchantSync.syncEquipment('equipment-id')
  ).rejects.toThrow('GOOGLE_MERCHANT_LEGACY_DISABLED')
  expect(calls.auth).not.toHaveBeenCalled()
})
