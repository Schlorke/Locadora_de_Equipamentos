'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSettingsApi } from '../api/use-settings-api'
import type { SettingsInput } from './settings.schema'
import { isAbortError } from '../../../shared/api'
import { toast } from '../../../shared/lib/toast'
import type { ReactNode } from 'react'
import {
  imageValidationError,
  type SettingsImage,
  type SettingsImagePicker,
} from './media'
import {
  horarioDoFormulario,
  horarioParaSalvar,
  type HorarioDoFormulario,
} from './horario'
import {
  conteudoDoFormulario,
  conteudoParaSalvar,
  medicaoDoFormulario,
  type CampoDoConteudo,
  type ConteudoDoFormulario,
} from './conteudo-do-site'

/** Seções que gravam o conteúdo da vitrine (`siteContent`); a de SEO leva a medição e a verificação (onda 135, A11). */
const SECOES_DO_CONTEUDO: readonly SectionKey[] = [
  'content',
  'commitments',
  'seo',
]

// Padrões vazios para o contato: o formulário de uma locadora nunca nasce com o contato de outra, que o salvar
// gravaria nas configurações dela (achado 143). O título SEO é obrigatório (settings.schema): padrão neutro.
const DEFAULT_COMPANY_PHONE = ''
const DEFAULT_WHATSAPP_NUMBER = ''
const DEFAULT_CONTACT_EMAIL = ''
const DEFAULT_MARKETING_EMAIL = ''
const DEFAULT_COMPANY_ADDRESS = ''
const DEFAULT_ABOUT_US_TEXT = ''
const DEFAULT_SEO_TITLE = 'Locação de Equipamentos para Construção'
const DEFAULT_SEO_DESCRIPTION =
  'Locação de equipamentos para construção civil com qualidade e segurança'

export type SectionKey =
  | 'company'
  | 'hero'
  | 'social'
  | 'seo'
  | 'system'
  | 'custom'
  | 'hours'
  | 'content'
  | 'commitments'

type SectionState = Record<SectionKey, boolean>

const INITIAL_SECTION_STATE: SectionState = {
  company: false,
  hero: false,
  social: false,
  seo: false,
  system: false,
  custom: false,
  hours: false,
  content: false,
  commitments: false,
}

const INITIAL_FORM_DATA: SettingsInput = {
  companyPhone: DEFAULT_COMPANY_PHONE,
  companyIconUrl: '',
  aboutUsText: DEFAULT_ABOUT_US_TEXT,
  companyAddress: DEFAULT_COMPANY_ADDRESS,
  heroCarousel: [],
  waveAnimation: 'animated',
  contactEmail: DEFAULT_CONTACT_EMAIL,
  marketingEmail: DEFAULT_MARKETING_EMAIL,
  socialLinks: {},
  seoTitle: DEFAULT_SEO_TITLE,
  seoDescription: DEFAULT_SEO_DESCRIPTION,
  themeColorPrimary: '#ea580c', // token-check-allow: laranja primário padrão das settings
  maintenanceMode: false,
  analyticsTrackingId: '',
  footerText: '',
  businessHours: {},
  supportChat: true,
  whatsappNumber: DEFAULT_WHATSAPP_NUMBER,
  favicon: '',
  logoSecondary: '',
  defaultLanguage: 'pt-BR',
  baseCurrency: 'BRL',
  maintenanceMessage: '',
  smtpConfig: {},
  uploadLimits: {},
  securityConfig: {},
  customCss: '',
  customJs: '',
}

function getSectionName(section: string) {
  const names: Record<string, string> = {
    company: 'Informações da Empresa',
    hero: 'Carousel Principal',
    social: 'Redes Sociais',
    seo: 'SEO e Metadados',
    system: 'Configurações do Sistema',
    custom: 'Configurações Avançadas',
    hours: 'Horário de Funcionamento',
    content: 'Conteúdo do Site',
    commitments: 'O que você garante aos clientes',
  }
  return names[section] || section
}

function getDefaultValues(section: string): Partial<SettingsInput> {
  switch (section) {
    case 'company':
      return {
        companyPhone: DEFAULT_COMPANY_PHONE,
        whatsappNumber: DEFAULT_WHATSAPP_NUMBER,
        contactEmail: DEFAULT_CONTACT_EMAIL,
        marketingEmail: DEFAULT_MARKETING_EMAIL,
        companyAddress: DEFAULT_COMPANY_ADDRESS,
        aboutUsText: DEFAULT_ABOUT_US_TEXT,
        companyIconUrl: '',
      }
    case 'hero':
      return { heroCarousel: [], waveAnimation: 'animated' }
    case 'social':
      return { whatsappNumber: '', socialLinks: {} }
    case 'seo':
      return {
        seoTitle: DEFAULT_SEO_TITLE,
        seoDescription: DEFAULT_SEO_DESCRIPTION,
        favicon: '',
      }
    case 'system':
      return {
        maintenanceMode: false,
        supportChat: true,
        defaultLanguage: 'pt-BR',
        baseCurrency: 'BRL',
      }
    case 'custom':
      return { analyticsTrackingId: '', customCss: '', customJs: '' }
    default:
      return {}
  }
}

export function formatPhoneNumber(value: string) {
  const numbers = value.replace(/\D/g, '')
  const limitedNumbers = numbers.slice(0, 11)

  if (limitedNumbers.length <= 2) {
    return limitedNumbers
  } else if (limitedNumbers.length <= 6) {
    return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2)}`
  } else if (limitedNumbers.length <= 10) {
    return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2, 6)}-${limitedNumbers.slice(6)}`
  } else {
    return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2, 7)}-${limitedNumbers.slice(7)}`
  }
}

export interface SettingsMessages {
  saved(name: string): ReactNode
  reset(name: string): ReactNode
  restored(name: string): ReactNode
}
const plainMessages: SettingsMessages = {
  saved: (name) => 'Configurações de ' + name + ' atualizadas com sucesso.',
  reset: (name) =>
    'Apenas as configurações da seção "' +
    name +
    '" serão restauradas aos valores padrão. As demais configurações não serão afetadas.',
  restored: (name) =>
    'As configurações de "' +
    name +
    '" foram restauradas aos valores padrão e salvas com sucesso.',
}
export function useSettingsData({
  messages = plainMessages,
  pickImages,
}: { messages?: SettingsMessages; pickImages?: SettingsImagePicker } = {}) {
  const {
    getSettings,
    updateSettings,
    uploadLogo,
    listCategoryNames,
    isCurrent,
  } = useSettingsApi()
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [activeSection, setActiveSection] = useState<string>('company')
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [heroCarouselIndex, setHeroCarouselIndex] = useState(0)
  const [sectionLoading, setSectionLoading] = useState<SectionState>({
    ...INITIAL_SECTION_STATE,
  })
  const [sectionResetting, setSectionResetting] = useState<SectionState>({
    ...INITIAL_SECTION_STATE,
  })
  const [formData, setFormData] = useState<SettingsInput>({
    ...INITIAL_FORM_DATA,
  })
  // Onda 134: horário, conteúdo do site e compromissos (formulários de texto, validados ao salvar). O último valor
  // salvo fica guardado: salvar outra seção com um destes inválido reenvia o salvo, nunca apaga nem quebra o PUT.
  const [horario, setHorario] = useState<HorarioDoFormulario>(() =>
    horarioDoFormulario({})
  )
  const [conteudo, setConteudo] = useState<ConteudoDoFormulario>(() =>
    conteudoDoFormulario({})
  )
  const [errosDoHorario, setErrosDoHorario] = useState<
    Partial<Record<string, string>>
  >({})
  const [errosDoConteudo, setErrosDoConteudo] = useState<
    Partial<Record<CampoDoConteudo, string>>
  >({})
  const [carregandoCategorias, setCarregandoCategorias] = useState(false)
  const salvos = useRef<{
    businessHours: SettingsInput['businessHours']
    siteContent: SettingsInput['siteContent']
  }>({ businessHours: {}, siteContent: {} })

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await getSettings()
        if (!result.success)
          throw new Error(
            result.error || 'Não foi possível carregar as configurações.'
          )
        if (result.success && result.data) {
          setFormData({
            companyPhone: result.data.companyPhone || DEFAULT_COMPANY_PHONE,
            companyIconUrl: result.data.companyIconUrl || '',
            aboutUsText: result.data.aboutUsText || DEFAULT_ABOUT_US_TEXT,
            companyAddress:
              result.data.companyAddress || DEFAULT_COMPANY_ADDRESS,
            heroCarousel:
              (result.data.heroCarousel as Array<{
                imageUrl: string
                id?: string
                title?: string
                description?: string
                link?: string
                order?: number
              }>) || [],
            waveAnimation:
              (result.data.waveAnimation as 'none' | 'static' | 'animated') ||
              'animated',
            contactEmail: result.data.contactEmail || DEFAULT_CONTACT_EMAIL,
            marketingEmail:
              result.data.marketingEmail || DEFAULT_MARKETING_EMAIL,
            socialLinks:
              (result.data.socialLinks as {
                facebook?: string
                instagram?: string
                linkedin?: string
                whatsapp?: string
                youtube?: string
                twitter?: string
              }) || {},
            seoTitle: result.data.seoTitle || DEFAULT_SEO_TITLE,
            seoDescription:
              result.data.seoDescription || DEFAULT_SEO_DESCRIPTION,
            themeColorPrimary: result.data.themeColorPrimary || '#ea580c', // token-check-allow: fallback laranja primário das settings
            maintenanceMode: result.data.maintenanceMode || false,
            analyticsTrackingId: result.data.analyticsTrackingId || '',
            footerText: result.data.footerText || '',
            businessHours:
              (result.data.businessHours as {
                monday?: { closed: boolean; open?: string; close?: string }
                tuesday?: { closed: boolean; open?: string; close?: string }
                wednesday?: { closed: boolean; open?: string; close?: string }
                thursday?: { closed: boolean; open?: string; close?: string }
                friday?: { closed: boolean; open?: string; close?: string }
                saturday?: { closed: boolean; open?: string; close?: string }
                sunday?: { closed: boolean; open?: string; close?: string }
              }) || {},
            supportChat: result.data.supportChat !== false,
            whatsappNumber:
              result.data.whatsappNumber || DEFAULT_WHATSAPP_NUMBER,
            favicon: result.data.favicon || '',
            logoSecondary: result.data.logoSecondary || '',
            defaultLanguage: result.data.defaultLanguage || 'pt-BR',
            baseCurrency: result.data.baseCurrency || 'BRL',
            maintenanceMessage: result.data.maintenanceMessage || '',
            smtpConfig:
              (result.data.smtpConfig as {
                host?: string
                port?: number
                secure?: boolean
                username?: string
                password?: string
                fromEmail?: string
                fromName?: string
              }) || {},
            uploadLimits:
              (result.data.uploadLimits as {
                maxFileSize?: number
                allowedTypes?: string[]
                maxFiles?: number
              }) || {},
            securityConfig:
              (result.data.securityConfig as {
                enableRecaptcha?: boolean
                recaptchaSiteKey?: string
                recaptchaSecretKey?: string
                enable2FA?: boolean
                sessionTimeout?: number
                maxLoginAttempts?: number
              }) || {},
            customCss: result.data.customCss || '',
            customJs: result.data.customJs || '',
          })
          // Horário e conteúdo pelo formato de leitura (o inválido fica de fora, como na vitrine).
          const horarioLido = horarioDoFormulario(result.data.businessHours)
          const conteudoLido = conteudoDoFormulario(result.data.siteContent)
          setHorario(horarioLido)
          setConteudo(conteudoLido)
          salvos.current = {
            businessHours: horarioParaSalvar(horarioLido).horario,
            siteContent: conteudoParaSalvar(conteudoLido).conteudo ?? {},
          }
        }
      } catch (error) {
        if (isAbortError(error) || !isCurrent()) return
        console.error('Erro ao carregar configurações:', error)
        toast.error('Erro', {
          description: 'Não foi possível carregar as configurações.',
        })
      } finally {
        if (isCurrent()) setIsLoadingData(false)
      }
    }

    loadSettings()
  }, [getSettings, isCurrent])

  const updateField = useCallback(
    (field: keyof SettingsInput, value: unknown) => {
      setFormData((prev) => {
        const next = { ...prev, [field]: value }

        if (field === 'aboutUsText') {
          const textValue =
            typeof value === 'string' && value.trim().length > 0
              ? value
              : DEFAULT_ABOUT_US_TEXT
          const shouldSyncSeoDescription =
            !prev.seoDescription ||
            prev.seoDescription === prev.aboutUsText ||
            prev.seoDescription === DEFAULT_SEO_DESCRIPTION
          if (shouldSyncSeoDescription) {
            next.seoDescription = textValue
          }
        }

        return next
      })
    },
    []
  )

  const handlePhoneChange = useCallback(
    (field: keyof SettingsInput, value: string) => {
      updateField(field, formatPhoneNumber(value))
    },
    [updateField]
  )

  const active = useRef({ section: activeSection, revision: 0 })
  if (active.current.section !== activeSection)
    active.current = {
      section: activeSection,
      revision: active.current.revision + 1,
    }
  const selectionRevision = active.current.revision
  const current = (section = activeSection) =>
    isCurrent() &&
    active.current.section === section &&
    active.current.revision === selectionRevision
  const ended = () =>
    Object.assign(new Error('Seleção encerrada.'), { name: 'AbortError' })
  const uploadLogoFile = async (image: SettingsImage) => {
    const section = activeSection
    if (!current(section)) return false
    const error = imageValidationError(image)
    if (error) {
      toast.error('Erro', { description: error })
      return false
    }
    setIsUploadingLogo(true)
    try {
      image.multipart.append('type', 'logo')
      const data = await uploadLogo(image.multipart)
      if (!current(section)) return true
      updateField('companyIconUrl', data.url)
      toast.success('Sucesso!', { description: 'Logo enviado com sucesso.' })
    } catch (error) {
      if (isAbortError(error) || !current(section)) return true
      console.error('Erro ao fazer upload:', error)
      toast.error('Erro', {
        description: 'Não foi possível fazer upload da imagem.',
      })
    } finally {
      if (isCurrent()) setIsUploadingLogo(false)
    }
    return true
  }
  const chooseLogo = async () => {
    if (!pickImages || isUploadingLogo) return
    const section = activeSection
    setIsUploadingLogo(true)
    try {
      const files = await pickImages(false)
      if (!current(section)) return
      if (files[0]) await uploadLogoFile(files[0])
    } catch (error) {
      if (isAbortError(error) || !current(section)) return
      toast.error('Erro', {
        description: 'Não foi possível selecionar a imagem.',
      })
    } finally {
      if (isCurrent()) setIsUploadingLogo(false)
    }
  }
  const uploadHeroFile = async (image: SettingsImage) => {
    const section = activeSection
    if (!current(section)) throw ended()
    const error = imageValidationError(image)
    if (error) throw new Error(error)
    const result = await uploadLogo(image.multipart)
    if (!current(section)) throw ended()
    if (typeof result.url !== 'string' || !result.url)
      throw new Error('Resposta inválida do upload')
    return result.url
  }
  const chooseHeroImages = async (remaining: number) => {
    const section = activeSection
    if (!pickImages || !current(section)) throw ended()
    const files = await pickImages(true)
    if (!current(section)) throw ended()
    if (files.length > remaining)
      throw new Error('Quantidade de imagens excede o limite disponível.')
    const result: string[] = []
    for (const file of files) {
      if (!current(section)) throw ended()
      result.push(await uploadHeroFile(file))
    }
    return result
  }

  const handleRemoveLogo = () => {
    updateField('companyIconUrl', '')
    toast.success('Logo removido', {
      description: 'O logo foi removido com sucesso.',
    })
  }

  /** Formulário inteiro com o horário e o conteúdo; `null` quando a seção salva tem erro (mostrado na tela). */
  const montarEnvio = (
    section: SectionKey,
    base: SettingsInput,
    formHorario: HorarioDoFormulario,
    formConteudo: ConteudoDoFormulario
  ): SettingsInput | null => {
    const h = horarioParaSalvar(formHorario)
    const c = conteudoParaSalvar(formConteudo)
    if (section === 'hours') setErrosDoHorario(h.erros)
    if (SECOES_DO_CONTEUDO.includes(section)) setErrosDoConteudo(c.erros)
    if (section === 'hours' && Object.keys(h.erros).length > 0) {
      toast.error('Erro', { description: 'Confira o horário de cada dia.' })
      return null
    }
    // Nenhum valor inválido é descartado em silêncio: a seção que grava o conteúdo mostra o erro e não salva.
    if (SECOES_DO_CONTEUDO.includes(section) && !c.conteudo) {
      toast.error('Erro', {
        description:
          section === 'seo'
            ? 'Confira os campos destacados de medição e verificação.'
            : 'Confira os campos destacados do conteúdo do site.',
      })
      return null
    }
    return {
      ...base,
      businessHours:
        Object.keys(h.erros).length === 0
          ? h.horario
          : salvos.current.businessHours,
      siteContent: c.conteudo ?? salvos.current.siteContent,
    }
  }

  const saveSection = async (section: SectionKey) => {
    const envio = montarEnvio(section, formData, horario, conteudo)
    if (!envio) return
    setSectionLoading((prev) => ({ ...prev, [section]: true }))

    try {
      const result = await updateSettings(envio)

      if (result.success) {
        salvos.current = {
          businessHours: envio.businessHours,
          siteContent: envio.siteContent,
        }
        toast.success('Sucesso!', {
          description: messages.saved(getSectionName(section)),
        })
      } else {
        toast.error('Erro', {
          description: result.error || 'Erro ao atualizar configurações.',
        })
      }
    } catch (error) {
      if (isAbortError(error) || !isCurrent()) return
      console.error('Erro ao salvar:', error)
      toast.error('Erro', { description: 'Erro interno do servidor.' })
    } finally {
      if (isCurrent())
        setSectionLoading((prev) => ({ ...prev, [section]: false }))
    }
  }

  const resetSection = async (section: SectionKey) => {
    const sectionName = getSectionName(section)

    toast.warning(`Resetar configurações de ${sectionName}?`, {
      description: messages.reset(sectionName),
      duration: Infinity,
      action: {
        label: 'Confirmar',
        onClick: async () => {
          if (!isCurrent()) return
          setSectionResetting((prev) => ({ ...prev, [section]: true }))

          try {
            const defaults = getDefaultValues(section)
            const newFormData = { ...formData, ...defaults }
            setFormData(newFormData)
            // Onda 134: restaurar o horário apaga o horário; o conteúdo, os campos de texto (os compromissos ficam);
            // os compromissos, só os interruptores (todos desligados, D-E). Onda 135 (A11): a medição e a
            // verificação são da seção de SEO; só restaurar o SEO as apaga.
            const vazio = conteudoDoFormulario({})
            const novoHorario =
              section === 'hours' ? horarioDoFormulario({}) : horario
            const novoConteudo =
              section === 'content'
                ? {
                    ...vazio,
                    commitments: conteudo.commitments,
                    ...medicaoDoFormulario(conteudo),
                  }
                : section === 'commitments'
                  ? { ...conteudo, commitments: vazio.commitments }
                  : section === 'seo'
                    ? { ...conteudo, ...medicaoDoFormulario(vazio) }
                    : conteudo
            setHorario(novoHorario)
            setConteudo(novoConteudo)

            await new Promise<void>((resolve) => setTimeout(resolve, 100))

            if (!isCurrent()) return
            const envio = montarEnvio(
              section,
              newFormData,
              novoHorario,
              novoConteudo
            )
            if (!envio) return
            const result = await updateSettings(envio)

            if (result.success) {
              salvos.current = {
                businessHours: envio.businessHours,
                siteContent: envio.siteContent,
              }
              toast.success(`Seção "${sectionName}" restaurada!`, {
                description: messages.restored(sectionName),
              })
            } else {
              toast.error('Erro ao salvar', {
                description:
                  result.error || 'Não foi possível salvar as configurações.',
              })
            }
          } catch (error) {
            if (isAbortError(error) || !isCurrent()) return
            console.error('Erro ao resetar e salvar:', error)
            toast.error('Erro ao resetar', {
              description: 'Ocorreu um erro ao restaurar as configurações.',
            })
          } finally {
            if (isCurrent())
              setSectionResetting((prev) => ({ ...prev, [section]: false }))
          }
        },
      },
      cancel: {
        label: 'Cancelar',
        onClick: () => {
          if (!isCurrent()) return
          toast.info('Operação cancelada', {
            description: 'As configurações não foram alteradas.',
          })
        },
      },
    })
  }

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId)
  }

  /** Destaques do rodapé com as categorias da locadora (até 8, até 60 caracteres cada, como o contrato aceita). */
  const usarMinhasCategorias = async () => {
    setCarregandoCategorias(true)
    try {
      const nomes = await listCategoryNames()
      if (!isCurrent()) return
      const destaques = [
        ...new Set(nomes.map((nome) => nome.trim()).filter(Boolean)),
      ]
        .filter((nome) => nome.length <= 60)
        .slice(0, 8)
      if (destaques.length === 0) {
        toast.info('Sem categorias', {
          description: 'Cadastre categorias de equipamentos para usá-las aqui.',
        })
        return
      }
      setConteudo((atual) => ({
        ...atual,
        footerHighlights: destaques.join('\n'),
      }))
    } catch (error) {
      if (isAbortError(error) || !isCurrent()) return
      toast.error('Erro', {
        description: 'Não foi possível carregar as categorias.',
      })
    } finally {
      if (isCurrent()) setCarregandoCategorias(false)
    }
  }

  return {
    isLoadingData,
    activeSection,
    isUploadingLogo,
    heroCarouselIndex,
    setHeroCarouselIndex,
    sectionLoading,
    sectionResetting,
    formData,
    updateField,
    handlePhoneChange,
    uploadLogoFile,
    chooseLogo,
    uploadHeroFile,
    chooseHeroImages,
    handleRemoveLogo,
    saveSection,
    resetSection,
    handleSectionChange,
    horario,
    atualizarHorario: setHorario,
    errosDoHorario,
    conteudo,
    atualizarConteudo: setConteudo,
    errosDoConteudo,
    usarMinhasCategorias,
    carregandoCategorias,
  }
}
