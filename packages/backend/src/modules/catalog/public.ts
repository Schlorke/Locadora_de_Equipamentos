import type { Prisma, PrismaClient } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { withTenantTransaction } from '../identity/index'
import { createPublicEquipmentDetail } from './public-detail'
import {
  parseStorefrontLegalDocument,
  type StorefrontLegalDocumentResponse,
  type StorefrontLegalKind,
} from '@gb-locacoes/contracts/storefront-legal'
import {
  LEGAL_AVAILABILITY_SELECT,
  LEGAL_IDENTITY_SELECT,
  publicBusinessHours,
  publicLegalAvailability,
  publicLegalIdentity,
  publicSeoText,
  publicSettingsBody,
  publicSiteContent,
} from './public-settings'

type Money = { toString(): string }

/** Linha pública de equipamento; campos anuláveis tratados como no legado. */
type PublicEquipmentRow = {
  id: string
  name: string
  description: string | null
  pricePerDay: Money
  images: string[]
  available: boolean | null
  maxStock: number | null
  dailyDiscount: number | null
  weeklyDiscount: number | null
  biweeklyDiscount: number | null
  monthlyDiscount: number | null
  popularPeriod: string | null
  dailyDirectValue: Money | null
  weeklyDirectValue: Money | null
  biweeklyDirectValue: Money | null
  monthlyDirectValue: Money | null
  dailyUseDirectValue: boolean
  weeklyUseDirectValue: boolean
  biweeklyUseDirectValue: boolean
  monthlyUseDirectValue: boolean
  category: {
    id: string
    name: string
    icon: string | null
    iconColor: string
    bgColor: string
    fontColor: string
    customIcon: Prisma.JsonValue | null
  } | null
}

function toPublicEquipment(equipment: PublicEquipmentRow) {
  // Priorizar primeira imagem do array ou usar placeholder
  let primaryImage = null
  if (equipment.images && equipment.images.length > 0) {
    primaryImage = equipment.images[0]
  }

  return {
    id: equipment.id,
    name: equipment.name,
    description: equipment.description,
    pricePerDay: Number(equipment.pricePerDay), // Converter Decimal para number
    imageUrl: primaryImage, // Campo principal para imagem
    images:
      equipment.images && equipment.images.length > 0
        ? equipment.images
        : primaryImage
          ? [primaryImage]
          : [],
    isAvailable: equipment.available ?? true,
    category: equipment.category
      ? {
          id: equipment.category.id,
          name: equipment.category.name,
          icon: equipment.category.icon,
          iconColor: equipment.category.iconColor,
          bgColor: equipment.category.bgColor,
          fontColor: equipment.category.fontColor,
          customIcon: equipment.category.customIcon,
        }
      : null,
    reviews: [],
    // Campos de desconto e configuração de períodos
    dailyDiscount: equipment.dailyDiscount || 0,
    weeklyDiscount: equipment.weeklyDiscount || 0,
    biweeklyDiscount: equipment.biweeklyDiscount || 0,
    monthlyDiscount: equipment.monthlyDiscount || 0,
    popularPeriod: equipment.popularPeriod || 'weekly',
    maxStock: equipment.maxStock ?? 1,
    // Campos de valor direto
    dailyDirectValue: Number(equipment.dailyDirectValue) || 0,
    weeklyDirectValue: Number(equipment.weeklyDirectValue) || 0,
    biweeklyDirectValue: Number(equipment.biweeklyDirectValue) || 0,
    monthlyDirectValue: Number(equipment.monthlyDirectValue) || 0,
    // Campos de controle de método de preço
    dailyUseDirectValue: equipment.dailyUseDirectValue || false,
    weeklyUseDirectValue: equipment.weeklyUseDirectValue || false,
    biweeklyUseDirectValue: equipment.biweeklyUseDirectValue || false,
    monthlyUseDirectValue: equipment.monthlyUseDirectValue || false,
  }
}

/**
 * Leituras públicas de uma locadora já resolvida pelo adaptador (tenantSlug).
 * Nunca há locadora padrão: o contexto é obrigatório e cada leitura roda em
 * transação com `app.tenant_id` local.
 */
export function createPublicCatalog(prisma: PrismaClient) {
  const read = <T>(
    context: TenantContext,
    operation: (_tx: Prisma.TransactionClient) => Promise<T>
  ) => withTenantTransaction(prisma, context, operation)

  return {
    getPublicEquipment: createPublicEquipmentDetail(prisma),
    listPublicCategories(context: TenantContext) {
      return read(context, (tx) =>
        tx.category.findMany({
          where: { tenantId: context.tenantId },
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            iconColor: true,
            bgColor: true,
            fontColor: true,
            slug: true,
            placement: true,
            customIcon: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { equipments: true } },
          },
          orderBy: { name: 'asc' },
        })
      )
    },
    async listPublicEquipments(context: TenantContext) {
      const equipments = await read(context, (tx) =>
        tx.equipment.findMany({
          where: { tenantId: context.tenantId },
          include: { category: true },
          orderBy: { createdAt: 'desc' },
        })
      )
      return equipments.map(toPublicEquipment)
    },
    /** Autocomplete: termos com menos de dois caracteres não consultam o banco. */
    async searchPublicEquipments(context: TenantContext, query: string | null) {
      if (!query || query.trim().length < 2) return []
      // Buscar equipamentos que contenham o termo de busca no nome ou descrição
      return read(context, (tx) =>
        tx.equipment.findMany({
          where: {
            tenantId: context.tenantId,
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
            available: true, // Apenas equipamentos disponíveis
          },
          select: {
            id: true,
            name: true,
            description: true,
            pricePerDay: true,
            category: { select: { name: true } },
            images: true,
          },
          take: 8, // Limitar a 8 sugestões para performance
          orderBy: { name: 'asc' },
        })
      )
    },
    /**
     * Configurações públicas da vitrine; `null` quando a locadora ainda não configurou. Inclui o horário de
     * funcionamento e a identificação legal da organização (nome empresarial e CNPJ), lidos na mesma transação da
     * locadora (achado 147; regras em `./public-settings`).
     */
    getPublicSettings(context: TenantContext) {
      return read(context, async (tx) => {
        const setting = await tx.setting.findFirst({
          where: { tenantId: context.tenantId },
          select: {
            companyPhone: true,
            whatsappNumber: true,
            contactEmail: true,
            companyAddress: true,
            companyIconUrl: true,
            marketingEmail: true,
            aboutUsText: true,
            socialLinks: true,
            heroCarousel: true,
            waveAnimation: true,
            businessHours: true,
            siteContent: true,
            seoTitle: true,
            seoDescription: true,
            ...LEGAL_AVAILABILITY_SELECT,
          },
        })
        if (!setting) return null
        const organization = await tx.organization.findUnique({
          where: { id: context.tenantId },
          select: LEGAL_IDENTITY_SELECT,
        })
        return publicSettingsBody({
          ...setting,
          businessHours: publicBusinessHours(setting.businessHours),
          legalIdentity: publicLegalIdentity(organization),
          siteContent: publicSiteContent(setting.siteContent, (invalidKeys) =>
            console.warn('[site-content] chaves inválidas descartadas', {
              tenantId: context.tenantId,
              invalidKeys,
            })
          ),
          legalDocuments: publicLegalAvailability(setting),
          seoTitle: publicSeoText(setting.seoTitle),
          seoDescription: publicSeoText(setting.seoDescription),
        })
      })
    },
    /**
     * Texto legal publicado da locadora (onda 134): lê só a coluna do documento e a data, na transação da locadora.
     * `null` sem configurações, sem documento ou com documento fora do contrato (registrado sem o texto).
     */
    getPublicLegalDocument(
      context: TenantContext,
      kind: StorefrontLegalKind
    ): Promise<StorefrontLegalDocumentResponse | null> {
      return read(context, async (tx) => {
        const where = { tenantId: context.tenantId }
        const row =
          kind === 'terms'
            ? await tx.setting
                .findFirst({
                  where,
                  select: { termsDocument: true, termsPublishedAt: true },
                })
                .then(
                  (value) =>
                    value && {
                      document: value.termsDocument,
                      publishedAt: value.termsPublishedAt,
                    }
                )
            : kind === 'privacy'
              ? await tx.setting
                  .findFirst({
                    where,
                    select: { privacyDocument: true, privacyPublishedAt: true },
                  })
                  .then(
                    (value) =>
                      value && {
                        document: value.privacyDocument,
                        publishedAt: value.privacyPublishedAt,
                      }
                  )
              : await tx.setting
                  .findFirst({
                    where,
                    select: {
                      returnPolicyDocument: true,
                      returnPolicyPublishedAt: true,
                    },
                  })
                  .then(
                    (value) =>
                      value && {
                        document: value.returnPolicyDocument,
                        publishedAt: value.returnPolicyPublishedAt,
                      }
                  )
        if (!row || row.document === null || row.publishedAt === null)
          return null
        const parsed = parseStorefrontLegalDocument(row.document)
        if (parsed.status !== 'ok') {
          console.warn('[storefront-legal] documento fora do contrato', {
            tenantId: context.tenantId,
            kind,
            status: parsed.status,
          })
          return null
        }
        return {
          kind,
          document: parsed.document,
          publishedAt: row.publishedAt.toISOString(),
        }
      })
    },
  }
}
