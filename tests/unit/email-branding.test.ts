import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/tenant', () => ({ withTenantTransaction: vi.fn() }))
import {
  normalizeEmailBranding,
  emailAssetUrl,
  type EmailBranding,
} from '../../packages/backend/src/modules/communications/tenant-branding'
import * as legacyTemplates from '@/lib/email-templates'
// Contraparte da API compartilhada (onda 135, B5): o serviço usa os geradores direto do backend.
import {
  generateBoletoEmailHTML as serviceBoleto,
  generateContactEmailHTML as serviceContact,
  generateQuoteEmailHTML as serviceQuote,
  generateQuoteStatusChangeEmailHTML as serviceQuoteStatus,
  generateCustomerQuoteConfirmationEmailHTML as serviceConfirmation,
} from '@gb-locacoes/backend/communications'
const TEMPLATE_HOSTS = [
  ['legacy root', legacyTemplates],
  [
    'service',
    {
      generateBoletoEmailHTML: serviceBoleto,
      generateContactEmailHTML: serviceContact,
      generateQuoteEmailHTML: serviceQuote,
      generateQuoteStatusChangeEmailHTML: serviceQuoteStatus,
      generateCustomerQuoteConfirmationEmailHTML: serviceConfirmation,
    },
  ],
] as const
const branding: EmailBranding = {
  name: 'Locadora A',
  publicBaseUrl: 'https://locadora-a.example.test',
  logoUrl: null,
  contactEmail: null,
  phone: null,
  address: null,
}
afterEach(() => vi.unstubAllEnvs())
describe.each(TEMPLATE_HOSTS)(
  '%s',
  (
    _host,
    {
      generateBoletoEmailHTML,
      generateContactEmailHTML,
      generateQuoteEmailHTML,
      generateQuoteStatusChangeEmailHTML,
      generateCustomerQuoteConfirmationEmailHTML,
    }
  ) => {
    describe('explicit tenant email branding', () => {
      it('requires a name and URL without using environment fallback', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://wrong.example.test')
        expect(() =>
          normalizeEmailBranding({ ...branding, publicBaseUrl: '' })
        ).toThrow()
        expect(() =>
          normalizeEmailBranding({ ...branding, name: '' })
        ).toThrow()
      })
      it('validates HTTPS, credentials, query fragments and production HTTP', () => {
        vi.stubEnv('NODE_ENV', 'production')
        for (const publicBaseUrl of [
          'http://localhost:3000',
          'http://example.test',
          'javascript:alert(1)',
          'https://user:secret@example.test',
          'https://example.test?x=1',
          'https://example.test#x',
        ])
          expect(() =>
            normalizeEmailBranding({ ...branding, publicBaseUrl })
          ).toThrow()
        vi.stubEnv('NODE_ENV', 'test')
        expect(
          normalizeEmailBranding({
            ...branding,
            publicBaseUrl: 'http://localhost:3000',
          }).publicBaseUrl
        ).toBe('http://localhost:3000')
      })
      it('escapes company name and configured image, rejecting executable assets', () => {
        expect(
          normalizeEmailBranding({
            ...branding,
            name: 'A <B>',
            logoUrl: '/logo.png?a=1&b=2',
          }).logoHtml
        ).toContain('A &lt;B&gt;')
        expect(emailAssetUrl(branding, '/logo.png?a=1&b=2')).toBe(
          'https://locadora-a.example.test/logo.png?a=1&amp;b=2'
        )
        expect(() => emailAssetUrl(branding, 'javascript:alert(1)')).toThrow()
      })
      it('all existing templates receive tenant identity and preserve one HTML implementation', () => {
        const templates = [
          generateContactEmailHTML(
            branding,
            {
              name: 'Cliente',
              email: 'client@example.test',
              phone: '123',
              message: 'Contato',
            },
            'quote1'
          ),
          generateQuoteEmailHTML(
            branding,
            {
              customerName: 'Cliente',
              customerEmail: 'client@example.test',
              customerPhone: '123',
            },
            [],
            10,
            'quote1'
          ),
          generateBoletoEmailHTML(branding, {
            customerName: 'Cliente',
            quoteId: 'quote1',
            amount: 10,
            dueDate: new Date('2030-01-01'),
          }),
          generateQuoteStatusChangeEmailHTML(
            branding,
            'Cliente',
            'quote1',
            'ADJUSTED',
            10,
            20,
            'Ajuste',
            null,
            false
          ),
          generateCustomerQuoteConfirmationEmailHTML(
            branding,
            { customerName: 'Cliente', quoteId: 'quote1' },
            [],
            10
          ),
        ]
        for (const html of templates) {
          expect(html).toContain('Locadora A')
          expect(html).not.toMatch(/GB Loca|locacoesgb|wrong\.example/)
        }
        for (const html of templates.slice(2))
          expect(html).toContain(
            'https://locadora-a.example.test/area-cliente/'
          )
      })
    })
  }
)
