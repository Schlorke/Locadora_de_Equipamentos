'use client'
import { useEffect, useState } from 'react'
import {
  PublicBusinessHoursSchema,
  PublicLegalAvailabilitySchema,
  PublicLegalIdentitySchema,
  parsePublicSiteContent,
  type PublicBusinessHours,
  type PublicLegalAvailability,
  type PublicLegalIdentity,
  type SiteContent,
} from '@gb-locacoes/contracts/settings'
import { useApiClient } from '../../../shared/api'
import { usePublicTenantSlug } from '../../organizacao/@x/configuracao'
export interface PublicSettings {
  companyPhone: string
  whatsappNumber: string
  contactEmail: string
  marketingEmail: string
  companyAddress: string
  companyIconUrl: string
  aboutUsText: string
  socialLinks: Record<string, string>
  heroCarousel: Array<{ imageUrl: string }>
  waveAnimation: 'none' | 'static' | 'animated'
  /** Horário de funcionamento da própria locadora; `null` sem horário (achado 147). */
  businessHours: PublicBusinessHours | null
  /** Nome empresarial e CNPJ da própria locadora; `null` fora do contrato ou sem resposta (achado 147). */
  legalIdentity: PublicLegalIdentity | null
  /** Conteúdo institucional da própria locadora, chave a chave (onda 134); sem dado, `{}`. */
  siteContent: SiteContent
  /** Quais textos legais a locadora publicou (onda 134); fora do contrato ou sem resposta, nenhum. */
  legalDocuments: PublicLegalAvailability
}
const NO_LEGAL_DOCUMENTS: PublicLegalAvailability = {
  terms: false,
  privacy: false,
  returnPolicy: false,
}
const emptySettings: PublicSettings = {
  companyPhone: '',
  whatsappNumber: '',
  contactEmail: '',
  marketingEmail: '',
  companyAddress: '',
  companyIconUrl: '',
  aboutUsText: '',
  socialLinks: {},
  heroCarousel: [],
  waveAnimation: 'animated',
  businessHours: null,
  legalIdentity: null,
  siteContent: {},
  legalDocuments: NO_LEGAL_DOCUMENTS,
}
function normalizeSettings(
  data: Partial<PublicSettings> | null | undefined
): PublicSettings {
  const result = { ...emptySettings, ...data }
  for (const field of [
    'companyPhone',
    'whatsappNumber',
    'contactEmail',
    'marketingEmail',
    'companyAddress',
    'companyIconUrl',
    'aboutUsText',
  ] as const)
    if (typeof result[field] !== 'string') result[field] = ''
  if (!result.socialLinks || typeof result.socialLinks !== 'object')
    result.socialLinks = {}
  if (!Array.isArray(result.heroCarousel)) result.heroCarousel = []
  if (!['none', 'static', 'animated'].includes(result.waveAnimation))
    result.waveAnimation = 'animated'
  // Horário e identificação legal só no formato do contrato; qualquer outra forma fica de fora, sem valor padrão.
  const hours = PublicBusinessHoursSchema.safeParse(result.businessHours)
  result.businessHours =
    hours.success && Object.keys(hours.data).length > 0 ? hours.data : null
  const legal = PublicLegalIdentitySchema.safeParse(result.legalIdentity)
  result.legalIdentity = legal.success ? legal.data : null
  // Onda 134: leitura tolerante (a chave inválida sai, a desconhecida é ignorada), a mesma regra do backend.
  result.siteContent = parsePublicSiteContent(result.siteContent).content
  const documents = PublicLegalAvailabilitySchema.safeParse(
    result.legalDocuments
  )
  result.legalDocuments = documents.success
    ? documents.data
    : NO_LEGAL_DOCUMENTS
  return result
}
type UsePublicSettingsOptions = {
  initialData?: Partial<PublicSettings> | null
  tenantSlug?: string | null
}
export function usePublicSettings(options?: UsePublicSettingsOptions) {
  const api = useApiClient(),
    selectedSlug = usePublicTenantSlug(),
    slug = options?.tenantSlug ?? selectedSlug
  const hasInitialData = Boolean(options?.initialData)
  const [settings, setSettings] = useState<PublicSettings>(() =>
    normalizeSettings(options?.initialData)
  )
  const [loadedSlug, setLoadedSlug] = useState(slug)
  const [isLoading, setIsLoading] = useState(!hasInitialData),
    [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (hasInitialData) return
    const controller = new AbortController()
    setSettings(emptySettings)
    setLoadedSlug(slug)
    setError(null)
    if (!slug) {
      setError('Selecione uma locadora para consultar suas informações.')
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    api
      .request<Partial<PublicSettings>>(
        '/api/settings/public?tenantSlug=' + encodeURIComponent(slug),
        { signal: controller.signal }
      )
      .then((data) => {
        if (!controller.signal.aborted) setSettings(normalizeSettings(data))
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Informações da locadora indisponíveis.'
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [api, slug, hasInitialData])
  return {
    settings: hasInitialData
      ? normalizeSettings(options?.initialData)
      : loadedSlug === slug
        ? settings
        : emptySettings,
    isLoading,
    error,
  }
}
