import type { Prisma } from '@prisma/client'
import type { CompanyData } from '@gb-locacoes/contracts/onboarding'
import { semanticThemes } from '@gb-locacoes/design-tokens'

// Documented historical matrix (PROMPT_CURSOR_FINANCEIRO, existingAuth.permissions).
// ADMIN is implicit; CLIENT grants do not bypass the tenant principal's admin gate.
const permissions = [
  { role: 'FINANCIAL', module: 'FINANCIAL', action: 'READ' },
  { role: 'FINANCIAL', module: 'FINANCIAL', action: 'WRITE' },
  { role: 'CLIENT', module: 'RENTALS', action: 'READ' },
  { role: 'CLIENT', module: 'QUOTES', action: 'READ' },
  { role: 'CLIENT', module: 'CONTRACTS', action: 'READ' },
  { role: 'OPERATOR', module: 'QUOTES', action: 'READ' },
  { role: 'OPERATOR', module: 'RENTALS', action: 'READ' },
] as const

/** Platform credentials can INSERT these four tenant tables, and cannot SELECT them. */
export async function seedOnboardingTenant(
  tx: Prisma.TransactionClient,
  tenantId: string,
  company: CompanyData,
  email: string
) {
  const theme = semanticThemes.light
  await tx.setting.createMany({
    data: [
      {
        tenantId,
        seoTitle: company.tradeName,
        seoDescription: '',
        footerText: company.tradeName,
        companyPhone: company.phone,
        whatsappNumber: company.phone,
        contactEmail: email,
        companyAddress: [
          company.addressLine,
          company.addressNumber,
          company.addressComplement,
          company.district,
          company.city,
          company.state,
          company.postalCode,
        ]
          .filter(Boolean)
          .join(', '),
        themeColorPrimary: theme.brand.default,
        // Explicitly exclude legacy branding, scripts and integration credentials.
        companyIconUrl: '',
        aboutUsText: '',
        heroCarousel: [],
        socialLinks: {},
        smtpConfig: {},
        marketingEmail: '',
        favicon: '',
        logoSecondary: '',
        customCss: '',
        customJs: '',
        publicBaseUrl: null,
      },
    ],
  })
  await tx.financialSetting.createMany({ data: [{ tenantId }] })
  await tx.permission.createMany({
    data: permissions.map((row) => ({ tenantId, ...row })),
  })
  await tx.category.createMany({
    data: [
      {
        tenantId,
        name: 'Geral',
        slug: 'geral',
        description: null,
        iconColor: theme.brand.default,
        bgColor: theme.surface.default,
        fontColor: theme.text.default,
      },
    ],
  })
}
