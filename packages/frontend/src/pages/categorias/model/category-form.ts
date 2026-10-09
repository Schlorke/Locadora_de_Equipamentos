'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useScopedApiClient } from '../../../shared/api'
import { toast } from '../../../shared/lib/toast'
import {
  DEFAULT_CUSTOM_ICON,
  DEFAULT_DESIGN,
  DEFAULT_ICON,
  MAX_SVG_FILE_SIZE_KB,
  cloneDesign,
  isValidSvgFile,
  isValidSvgUrl,
  sanitizeSvg,
  type CategoryDesign,
  type CategoryDetails,
  type CategoryDialogMode,
  type CustomIconSource,
} from '../../../shared/lib/category-design-model'
import type { AllIconNames } from '../../../shared/lib/constants/all-icons'
import { normalizeIconName } from '../../../shared/lib/icon-utils'
import {
  buildEmojiGroups,
  buildIconGroups,
  useEmojiRecents,
  useIconRecents,
  type IconPickerTab,
} from '../../../widgets/personalizar-icone'
export interface SvgFileInput {
  name: string
  type: string
  size: number
  read: () => Promise<string>
}
export interface CategoryDialogProps {
  isOpen: boolean
  mode: CategoryDialogMode
  onClose: () => void
  onSave: (data: CategoryData) => Promise<void> | void
  initialData?: CategoryData
  onStateChange: DialogStateUpdater['onStateChange']
}
export interface DialogStateUpdater {
  onStateChange: (..._args: [key: string, isOpen: boolean]) => void
}

const MAX_ICON_NAME_LENGTH = 50

const extractNameFromFile = (fileName: string): string => {
  const base = fileName.replace(/\.[^/.]+$/, '')
  return base.slice(0, MAX_ICON_NAME_LENGTH)
}

const extractNameFromUrl = (value: string): string => {
  try {
    const parsed = new URL(value)
    const segments = parsed.pathname.split('/').filter(Boolean)
    const candidate = segments.pop() ?? 'ícone personalizado'
    const decoded = decodeURIComponent(candidate.replace(/\.svg$/i, ''))
    const cleaned = decoded.trim() || 'ícone personalizado'
    return cleaned.slice(0, MAX_ICON_NAME_LENGTH)
  } catch (_error) {
    return 'ícone personalizado'
  }
}

export type CategoryData = {
  id?: string
  name: string
  description: string
  design: CategoryDesign
}

export const SAMPLE_CATEGORY_DETAILS: CategoryDetails = {
  name: 'Terraplenagem',
  description:
    'Preparação do terreno, nivelamento e compactação antes da concretagem.',
}

export const EMPTY_CATEGORY_DETAILS: CategoryDetails = {
  name: '',
  description: '',
}

export function useCategoryForm(
  { isOpen, mode, onClose, onSave, initialData }: CategoryDialogProps,
  svgToDataUrl: (svg: string) => string
) {
  const apiClient = useScopedApiClient(
    JSON.stringify([isOpen, mode, initialData?.id])
  )
  const uploadRevision = useRef(0),
    submitting = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  useEffect(() => {
    uploadRevision.current++
    return () => {
      uploadRevision.current++
    }
  }, [apiClient])
  const initialCategory = useMemo<CategoryDetails>(() => {
    if (initialData) {
      return {
        name: initialData.name,
        description: initialData.description,
      }
    }
    return mode === 'edit' ? SAMPLE_CATEGORY_DETAILS : EMPTY_CATEGORY_DETAILS
  }, [initialData, mode])

  const initialDesign = useMemo<CategoryDesign>(() => {
    if (initialData) {
      return cloneDesign(initialData.design)
    }
    return cloneDesign(DEFAULT_DESIGN)
  }, [initialData])

  const [category, setCategory] = useState<CategoryDetails>(initialCategory)
  const [design, setDesign] = useState<CategoryDesign>(initialDesign)

  // Estado para customização de ícones no Popover
  const [localDesign, setLocalDesign] = useState<CategoryDesign>(() =>
    cloneDesign(design)
  )
  const [isProcessingUpload, setIsProcessingUpload] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [svgUrlInput, setSvgUrlInput] = useState(
    design.customIcon.source === 'url' ? (design.customIcon.url ?? '') : ''
  )
  const [iconSearchTerm, setIconSearchTerm] = useState('')
  const [emojiSearchTerm, setEmojiSearchTerm] = useState('')
  const [activeIconTab, setActiveIconTab] = useState<IconPickerTab>('icons')

  // Sincronizar localDesign com design quando design mudar
  useEffect(() => {
    setLocalDesign(cloneDesign(design))
    setSvgUrlInput(
      design.customIcon.source === 'url' ? (design.customIcon.url ?? '') : ''
    )
  }, [design])

  const { recents: iconRecents, addRecentIcon } = useIconRecents()
  const { recents: emojiRecents, addRecentEmoji } = useEmojiRecents()

  const { groups: resolvedEmojiGroups } = useMemo(
    () =>
      buildEmojiGroups({
        searchTerm: emojiSearchTerm,
        recentEmojis: emojiRecents,
      }),
    [emojiSearchTerm, emojiRecents]
  )

  const { groups: activeIconGroups, navigationOrder: iconNavigationOrder } =
    useMemo(
      () =>
        buildIconGroups({
          searchTerm: iconSearchTerm,
          recentIcons: iconRecents,
        }),
      [iconSearchTerm, iconRecents]
    )

  const selectedEmoji =
    localDesign.customIcon.source === 'emoji'
      ? (localDesign.customIcon.emoji ?? null)
      : null

  const activeIconName = normalizeIconName(localDesign.icon) ?? localDesign.icon

  const handleSourceChange = (source: CustomIconSource) => {
    uploadRevision.current++
    setIsProcessingUpload(false)
    setUploadError(null)
    setUrlError(null)

    if (source === 'none') {
      setLocalDesign((prev) => ({
        ...prev,
        customIcon: { ...DEFAULT_CUSTOM_ICON },
      }))
      setActiveIconTab('icons')
      return
    }

    if (source === 'upload') {
      setLocalDesign((prev) => ({
        ...prev,
        customIcon: {
          source: 'upload',
          name:
            prev.customIcon.source === 'upload'
              ? (prev.customIcon.name ?? '')
              : '',
        },
      }))
      setSvgUrlInput('')
      setActiveIconTab('custom')
      return
    }

    if (source === 'url') {
      setLocalDesign((prev) => ({
        ...prev,
        customIcon: {
          source: 'url',
          url:
            prev.customIcon.source === 'url' ? prev.customIcon.url : undefined,
          name:
            prev.customIcon.source === 'url'
              ? (prev.customIcon.name ?? '')
              : '',
        },
      }))
      setActiveIconTab('custom')
    }
  }

  const handleSvgFile = async (file: SvgFileInput) => {
    setIsProcessingUpload(false)
    const cycle = ++uploadRevision.current
    const current = () =>
      apiClient.isCurrent() && isOpen && cycle === uploadRevision.current
    if (!current()) return
    if (!isValidSvgFile(file)) {
      setUploadError(
        'Selecione um arquivo SVG válido com até ' +
          MAX_SVG_FILE_SIZE_KB +
          'kb.'
      )
      return
    }
    setIsProcessingUpload(true)
    try {
      const result = await file.read()
      if (!current()) return
      if (typeof result !== 'string')
        throw new Error('Não foi possível ler o arquivo selecionado.')
      const sanitized = sanitizeSvg(result)
      if (!sanitized)
        throw new Error(
          'Não foi possível validar este SVG. Remova scripts ou elementos externos e tente novamente.'
        )
      const dataUrl = svgToDataUrl(sanitized)
      if (!dataUrl)
        throw new Error('Não foi possível gerar a pré-visualização do arquivo.')
      setLocalDesign((prev) => ({
        ...prev,
        customIcon: {
          source: 'upload',
          svgContent: sanitized,
          dataUrl,
          fileName: file.name,
          name: extractNameFromFile(file.name),
        },
      }))
      setUploadError(null)
      setUrlError(null)
      setActiveIconTab('custom')
    } catch (error) {
      if (current())
        setUploadError(
          error instanceof Error
            ? error.message
            : 'Erro ao processar o arquivo SVG.'
        )
    } finally {
      if (current()) setIsProcessingUpload(false)
    }
  }

  const pickSvg = async (pick: () => Promise<SvgFileInput | null>) => {
    const cycle = uploadRevision.current
    if (!apiClient.isCurrent() || !isOpen) return
    try {
      const file = await pick()
      if (
        !apiClient.isCurrent() ||
        !isOpen ||
        cycle !== uploadRevision.current ||
        !file
      )
        return
      await handleSvgFile(file)
    } catch (error) {
      if (apiClient.isCurrent() && cycle === uploadRevision.current)
        setUploadError(
          error instanceof Error
            ? error.message
            : 'Erro ao processar o arquivo SVG.'
        )
    }
  }

  const handleUrlApply = () => {
    uploadRevision.current++
    setIsProcessingUpload(false)
    const value = svgUrlInput.trim()

    if (!value) {
      setUrlError('Informe uma URL de SVG válida.')
      return
    }

    if (!isValidSvgUrl(value)) {
      setUrlError('Use uma URL https:// que termine em .svg.')
      return
    }

    setLocalDesign((prev) => ({
      ...prev,
      customIcon: {
        source: 'url',
        url: value,
        name: extractNameFromUrl(value),
      },
    }))

    setUploadError(null)
    setUrlError(null)
    setActiveIconTab('custom')
  }

  const handleClearCustomIcon = () => {
    uploadRevision.current++
    setIsProcessingUpload(false)
    setLocalDesign((prev) => ({
      ...prev,
      customIcon: { ...DEFAULT_CUSTOM_ICON },
    }))
    setSvgUrlInput('')
    setUploadError(null)
    setUrlError(null)
    setEmojiSearchTerm('')
    setIconSearchTerm('')
  }

  const handleEmojiSelect = (emoji: string) => {
    uploadRevision.current++
    setIsProcessingUpload(false)
    setLocalDesign((prev) => ({
      ...prev,
      customIcon: {
        source: 'emoji',
        emoji,
      },
    }))
    setActiveIconTab('emoji')
    addRecentEmoji(emoji)
    // Aplicar mudança imediatamente ao design
    setDesign((prev) => ({
      ...prev,
      customIcon: {
        source: 'emoji',
        emoji,
      },
    }))
  }

  const handleIconSelect = (iconName: AllIconNames) => {
    uploadRevision.current++
    setIsProcessingUpload(false)
    const resolved = normalizeIconName(iconName) ?? iconName
    setLocalDesign((prev) => ({
      ...prev,
      icon: resolved,
      customIcon: { ...DEFAULT_CUSTOM_ICON },
    }))
    setActiveIconTab('icons')
    addRecentIcon(resolved)
    // Aplicar mudança imediatamente ao design
    setDesign((prev) => ({
      ...prev,
      icon: resolved,
      customIcon: { ...DEFAULT_CUSTOM_ICON },
    }))
  }

  const handleRemoveIcon = () => {
    uploadRevision.current++
    setIsProcessingUpload(false)
    setLocalDesign((prev) => ({
      ...prev,
      icon: DEFAULT_ICON,
      customIcon: { ...DEFAULT_CUSTOM_ICON },
    }))
    setSvgUrlInput('')
    setUploadError(null)
    setUrlError(null)
    setActiveIconTab('icons')
    setEmojiSearchTerm('')
    setIconSearchTerm('')
    // Aplicar mudança imediatamente ao design
    setDesign((prev) => ({
      ...prev,
      icon: DEFAULT_ICON,
      customIcon: { ...DEFAULT_CUSTOM_ICON },
    }))
  }

  const customIconName = localDesign.customIcon.name ?? ''
  const trimmedCustomIconName = customIconName.trim()
  const customIconNameError =
    trimmedCustomIconName.length > MAX_ICON_NAME_LENGTH
      ? 'O nome precisa ter menos que 50 caracteres.'
      : null
  const hasUploadedIcon =
    (localDesign.customIcon.source === 'upload' &&
      Boolean(localDesign.customIcon.dataUrl)) ||
    (localDesign.customIcon.source === 'url' &&
      Boolean(localDesign.customIcon.url))

  const handleCustomIconNameChange = (value: string) => {
    setLocalDesign((prev) => ({
      ...prev,
      customIcon: {
        ...prev.customIcon,
        name: value,
      },
    }))
  }

  const handleCancelCustomIcon = () => {
    handleClearCustomIcon()
  }

  const handleSaveCustomIcon = () => {
    if (
      !hasUploadedIcon ||
      trimmedCustomIconName.length === 0 ||
      customIconNameError
    ) {
      toast.error('Finalize o upload antes de salvar.', {
        description:
          'Envie um SVG válido ou informe uma URL e defina um nome com até 50 caracteres.',
      })
      return
    }
    const sanitizedName = trimmedCustomIconName
    setLocalDesign((prev) => ({
      ...prev,
      customIcon: {
        ...prev.customIcon,
        name: sanitizedName,
      },
    }))
    // Aplicar mudança ao design
    setDesign((prev) => ({
      ...prev,
      customIcon: {
        ...localDesign.customIcon,
        name: sanitizedName,
      },
    }))
    setActiveIconTab('icons')
    toast.success('Ícone personalizado salvo!', {
      description: sanitizedName,
    })
  }

  const canSaveCustomIcon =
    hasUploadedIcon &&
    (localDesign.customIcon.source === 'upload' ||
      localDesign.customIcon.source === 'url') &&
    trimmedCustomIconName.length > 0 &&
    !customIconNameError

  useEffect(() => {
    if (initialData) {
      setCategory({
        name: initialData.name,
        description: initialData.description,
      })
      setDesign(cloneDesign(initialData.design))
      return
    }
    setCategory(initialCategory)
    setDesign(initialDesign)
  }, [initialCategory, initialDesign, initialData, mode])

  const previewName =
    category.name.trim().length > 0 ? category.name : 'Categoria sem nome'
  const previewDescription =
    category.description.trim().length > 0
      ? category.description
      : 'Adicione uma descrição para destacar esta categoria.'

  const canSubmit = category.name.trim().length > 0 && !isSubmitting

  const handleReset = () => {
    uploadRevision.current++
    setIsProcessingUpload(false)
    const preservedPlacement = design.placement
    setCategory(initialCategory)
    setDesign({
      ...cloneDesign(DEFAULT_DESIGN),
      placement: preservedPlacement,
    })
  }

  const handleSubmit = async () => {
    if (!canSubmit || !apiClient.isCurrent() || !isOpen || submitting.current)
      return
    submitting.current = true
    try {
      setIsSubmitting(true)
      await onSave({
        id: initialData?.id,
        name: category.name,
        description: category.description,
        design,
      })
      if (apiClient.isCurrent()) onClose()
    } finally {
      submitting.current = false
      if (apiClient.isCurrent()) setIsSubmitting(false)
    }
  }

  return {
    category,
    setCategory,
    design,
    setDesign,
    localDesign,
    isProcessingUpload,
    uploadError,
    urlError,
    svgUrlInput,
    setSvgUrlInput,
    iconSearchTerm,
    setIconSearchTerm,
    emojiSearchTerm,
    setEmojiSearchTerm,
    activeIconTab,
    setActiveIconTab,
    resolvedEmojiGroups,
    activeIconGroups,
    iconNavigationOrder,
    selectedEmoji,
    activeIconName,
    handleSourceChange,
    handleSvgFile,
    pickSvg,
    cancelPendingSvg: () => {
      uploadRevision.current++
      setIsProcessingUpload(false)
    },
    handleUrlApply,
    handleClearCustomIcon,
    handleEmojiSelect,
    handleIconSelect,
    handleRemoveIcon,
    customIconName,
    customIconNameError,
    hasUploadedIcon,
    handleCustomIconNameChange,
    handleCancelCustomIcon,
    handleSaveCustomIcon,
    canSaveCustomIcon,
    previewName,
    previewDescription,
    canSubmit,
    handleReset,
    handleSubmit,
    isSubmitting,
  }
}
