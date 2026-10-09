'use client'

import {
  useCategoryForm,
  SAMPLE_CATEGORY_DETAILS,
  EMPTY_CATEGORY_DETAILS,
  type CategoryData,
  type DialogStateUpdater,
} from '../model/category-form'
import type { TabConfig } from '../../../features/abas-categoria'
import { CategoryShowcase } from '../../../features/abas-categoria'
import {
  ICON_PICKER_TABS,
  IconCustomizationBlock,
} from '../../../widgets/personalizar-icone'
import { Button, FOCUS_RING } from '@gb-locacoes/ui'
import { Dialog } from '@gb-locacoes/ui'
import { HoverActionMenu } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Textarea } from '@gb-locacoes/ui'
import {
  CATEGORY_PREVIEW_TABS,
  DEFAULT_DESIGN,
  DEFAULT_ICON,
  MAX_SVG_FILE_SIZE_KB,
  cloneDesign,
  renderCategoryIcon,
  svgToDataUrl,
  type CategoryDesign,
  type CategoryDialogMode,
  type CategoryPlacement,
} from '../../../shared/lib/category-design'
import { cn } from '../../../shared/lib/cn.web'
import {
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Tag as TagIcon,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
} from 'react'

import { type CustomIconProps } from '@gb-locacoes/ui'
import { useIsMobile } from '../../../shared/lib'
import { formatIconLabel } from '../../../shared/lib/icon-utils'

const RESET_ANIMATION_DURATION = 600

const DIALOG_PREVIEW_CARD = [
  'bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 shadow-sm',
  'rounded-lg p-5 relative w-full max-w-full xs:p-4 xs:rounded-md overflow-visible',
].join(' ')

const DIALOG_PREVIEW_HEADER = [
  'flex flex-col items-center justify-center sm:flex-row sm:items-center sm:justify-between',
  'gap-2 sm:gap-3 mb-4 sm:mb-3',
].join(' ')

const DIALOG_PREVIEW_BADGE = [
  'text-xs inline-flex items-center gap-2 font-medium px-4 py-2 rounded-[var(--rounded-full)] border-0 max-w-full',
  'transition-all duration-300 shadow-[4px_8px_18px_2px_rgba(0,0,0,0.18)] hover:shadow-[8px_12px_20px_2px_rgba(0,0,0,0.22)] hover:scale-[1.07]',
  'xs:text-xs xs:px-4 xs:py-2 xs:gap-1.5',
].join(' ')

const DIALOG_FORM_SECTION = ['space-y-4', 'overflow-visible'].join(' ')

function buildCategoryPreviewIcon(
  design: CategoryDesign
): ComponentType<CustomIconProps> {
  const PreviewIcon: ComponentType<CustomIconProps> = ({
    size,
    className,
    color,
  }) =>
    renderCategoryIcon(design, {
      size,
      className,
      color: color ?? design.iconColor ?? 'currentColor',
    })
  PreviewIcon.displayName = 'CategoryPreviewIcon'
  return PreviewIcon
}

function buildPreviewTabs(
  categoryName: string,
  design: CategoryDesign
): TabConfig[] {
  const resolvedName =
    categoryName.trim().length > 0 ? categoryName : 'Categoria sem nome'
  const PreviewIcon = buildCategoryPreviewIcon(design)

  return CATEGORY_PREVIEW_TABS.map((tab) => {
    const shouldInclude = tab.value === design.placement

    return {
      ...tab,
      categories: shouldInclude
        ? [
            {
              id: `${tab.value}-preview`,
              name: resolvedName,
              icon: PreviewIcon,
            },
          ]
        : [],
    }
  })
}

// Constante para o seletor do wrapper do menu de ações
const MENU_WRAPPER_SELECTOR =
  '[class*="absolute"][class*="left-1/2"][class*="top-[3.5rem"]'

function CategoryShowcasePreview({
  categoryName,
  design,
  onPlacementChange,
  disablePlacementSync,
  className,
  onReset,
  onEdit,
  iconPopoverContent,
  onIconBoxRequestAction,
}: {
  categoryName: string
  design: CategoryDesign
  onPlacementChange?: (_placement: CategoryPlacement) => void
  disablePlacementSync?: boolean
  className?: string
  onReset?: () => void
  onEdit?: () => void
  iconPopoverContent?: React.ReactNode
  onIconBoxRequestAction?: () => void
}) {
  const [isCardHovered, setIsCardHovered] = useState(false)
  const [isMenuHovered, setIsMenuHovered] = useState(false)
  const [resetAnimation, setResetAnimation] = useState(false)
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false)
  const cardAreaRef = useRef<HTMLDivElement>(null)
  const resetTimeoutRef = useRef<number | null>(null)

  // Função helper para chamar closest de forma segura
  const safeClosest = useCallback(
    (element: HTMLElement | null, selector: string): Element | null => {
      if (!element) return null
      if (
        !(element instanceof Element) ||
        typeof element.closest !== 'function'
      ) {
        return null
      }
      return element.closest(selector)
    },
    []
  )

  // Função helper para verificar se é o botão do card
  const isCardButton = useCallback((element: HTMLElement | null): boolean => {
    if (!element) return false

    // Verifica se element é um Element e tem o método closest
    if (
      !(element instanceof Element) ||
      typeof element.closest !== 'function'
    ) {
      return false
    }

    const button = element.closest('button')
    if (!button) return false

    const buttonClass = button.className || ''
    return (
      buttonClass.includes('from-slate-800') ||
      buttonClass.includes('from-slate-900') ||
      buttonClass.includes('bg-gradient-to-br')
    )
  }, [])

  const previewTabs = useMemo(
    () => buildPreviewTabs(categoryName, design),
    [categoryName, design]
  )

  const handleTabChange = useCallback(
    (tabValue: string) => {
      if (
        !disablePlacementSync &&
        (tabValue === 'phases' || tabValue === 'types')
      ) {
        onPlacementChange?.(tabValue)
      }
    },
    [disablePlacementSync, onPlacementChange]
  )

  // Detecta hover no card usando event delegation
  useEffect(() => {
    const cardArea = cardAreaRef.current
    if (!cardArea || (!onReset && !onEdit)) return

    const handleMouseOver = (e: MouseEvent) => {
      if (isCardButton(e.target as HTMLElement)) {
        setIsCardHovered(true)
      }
    }

    const handleMouseOut = (e: MouseEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement
      const isGoingToCard = isCardButton(relatedTarget)
      const isGoingToMenu = safeClosest(relatedTarget, MENU_WRAPPER_SELECTOR)

      // Se não está indo para o card nem para o menu, esconde tudo
      if (!relatedTarget || (!isGoingToCard && !isGoingToMenu)) {
        setIsCardHovered(false)
        setIsMenuHovered(false)
      }
    }

    // Usa capture phase para capturar eventos antes de qualquer coisa
    cardArea.addEventListener('mouseover', handleMouseOver, true)
    cardArea.addEventListener('mouseout', handleMouseOut, true)

    return () => {
      cardArea.removeEventListener('mouseover', handleMouseOver, true)
      cardArea.removeEventListener('mouseout', handleMouseOut, true)
    }
  }, [onReset, onEdit, isCardButton, safeClosest])

  const isVisible = isCardHovered || isMenuHovered

  // Handler para reset com animação
  const handleResetClick = useCallback(() => {
    if (!onReset) return

    // Ativa animação
    setResetAnimation(true)

    // Chama a função de reset
    onReset()

    // Reseta animação após duração
    resetTimeoutRef.current = window.setTimeout(() => {
      setResetAnimation(false)
    }, RESET_ANIMATION_DURATION)
  }, [onReset])

  const handleEditClick = useCallback(() => {
    // Abre a popover do ícone quando clica em "Editar"
    setIconPopoverOpen(true)
    onEdit?.()
  }, [onEdit])

  // Cleanup do timeout
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="w-full relative">
      <div ref={cardAreaRef}>
        <CategoryShowcase
          tabs={previewTabs}
          defaultTab={design.placement}
          gridCols={{ base: 1, sm: 1, md: 1, lg: 1 }}
          cardClassName="p-4 w-[136px] h-full min-h-[120px]"
          className={className}
          onTabChangeAction={handleTabChange}
          isDialogPreview={true}
          iconPopoverContent={iconPopoverContent}
          onIconBoxRequestAction={onIconBoxRequestAction}
          iconPopoverOpen={iconPopoverOpen}
          onIconPopoverOpenChangeAction={setIconPopoverOpen}
        />
      </div>
      {(onReset || onEdit) && (
        <div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 top-[3.5rem] z-10 flex items-center gap-2',
            isVisible ? 'pointer-events-auto' : 'pointer-events-none'
          )}
          onMouseEnter={() => setIsMenuHovered(true)}
          onMouseLeave={(e) => {
            const relatedTarget = e.relatedTarget as HTMLElement

            // Se não está indo para o card, esconde o menu
            if (!relatedTarget || !isCardButton(relatedTarget)) {
              setIsMenuHovered(false)
              // Se também não está indo para outro elemento do menu, esconde tudo
              if (!safeClosest(relatedTarget, MENU_WRAPPER_SELECTOR)) {
                setIsCardHovered(false)
              }
            }
          }}
        >
          {onEdit && (
            <HoverActionMenu
              onClick={handleEditClick}
              aria-label="Editar visual desta categoria"
              position="top-center"
              offset="top-0"
              wrapperClassName="relative left-0 translate-x-0"
              buttonClassName={
                isVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-1'
              }
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Editar</span>
            </HoverActionMenu>
          )}
          {onReset && (
            <HoverActionMenu
              onClick={handleResetClick}
              aria-label="Resetar visual desta categoria"
              position="top-center"
              offset="top-0"
              wrapperClassName="relative left-0 translate-x-0"
              buttonClassName={
                isVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-1'
              }
            >
              <RotateCcw
                className="h-3.5 w-3.5"
                style={
                  resetAnimation
                    ? {
                        animation: 'spin 0.6s ease-in-out reverse',
                      }
                    : undefined
                }
              />
              <span>Resetar</span>
            </HoverActionMenu>
          )}
        </div>
      )}
    </div>
  )
}

function CategoryDialogModal({
  isOpen,
  mode,
  onClose,
  onSave,
  initialData,
  onStateChange,
}: {
  isOpen: boolean
  mode: CategoryDialogMode
  onClose: () => void
  onSave: (_data: CategoryData) => Promise<void> | void
  initialData?: CategoryData
  onStateChange: DialogStateUpdater['onStateChange']
}) {
  const [iconDialogOpen, setIconDialogOpen] = useState(false)
  const isMobile = useIsMobile()

  // Rastreamento de estados de dialogs aninhadas para gerenciar overflow-hidden
  const [dialogStates, setDialogStates] = useState<Record<string, boolean>>({})

  // Callback para atualizar estados de dialogs aninhadas
  const handleNestedStateChange = useCallback(
    (key: string, isOpen: boolean) => {
      setDialogStates((prev) => {
        if (prev[key] === isOpen) return prev
        return { ...prev, [key]: isOpen }
      })
      // Também notifica o callback externo se fornecido
      onStateChange(key, isOpen)
    },
    [onStateChange]
  )

  // Gerenciamento de overflow-hidden no body/html quando qualquer dialog está aberta
  useEffect(() => {
    const anyDialogOpen = isOpen || Object.values(dialogStates).some(Boolean)
    const targets = [document.documentElement, document.body]

    targets.forEach((target) => {
      if (!target) return
      if (anyDialogOpen) {
        target.classList.add('overflow-hidden')
      } else {
        target.classList.remove('overflow-hidden')
      }
    })

    return () => {
      targets.forEach((target) => target?.classList.remove('overflow-hidden'))
    }
  }, [isOpen, dialogStates])

  useEffect(() => {
    onStateChange('category-icon', iconDialogOpen)
    handleNestedStateChange('category-icon', iconDialogOpen)
  }, [iconDialogOpen, onStateChange, handleNestedStateChange])

  useEffect(() => {
    if (!isMobile && iconDialogOpen) {
      setIconDialogOpen(false)
    }
  }, [iconDialogOpen, isMobile])

  const {
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
  } = useCategoryForm(
    { isOpen, mode, onClose, onSave, initialData, onStateChange },
    svgToDataUrl
  )

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    void handleSvgFile({
      name: file.name,
      type: file.type,
      size: file.size,
      read: () =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () =>
            typeof reader.result === 'string'
              ? resolve(reader.result)
              : reject(new Error('Não foi possível ler o arquivo selecionado.'))
          reader.onerror = () =>
            reject(new Error('Erro ao processar o arquivo SVG.'))
          reader.readAsText(file)
        }),
    })
  }
  const iconCustomizationBlockProps = {
    className: isMobile
      ? 'mt-0'
      : 'mt-0 w-[404px] max-w-[404px] sm:w-[404px] sm:max-w-[404px]',
    iconTabs: ICON_PICKER_TABS,
    activeTab: activeIconTab,
    onTabChange: setActiveIconTab,
    onRemoveIcon: handleRemoveIcon,
    emojiSearchTerm,
    onEmojiSearchChange: setEmojiSearchTerm,
    emojiGroups: resolvedEmojiGroups,
    onEmojiSelect: handleEmojiSelect,
    selectedEmoji,
    iconSearchTerm,
    onIconSearchChange: setIconSearchTerm,
    iconGroups: activeIconGroups,
    iconNavigationOrder,
    design: localDesign,
    activeIconName,
    onIconSelect: handleIconSelect,
    onSourceChange: handleSourceChange,
    fileInputRef,
    isProcessingUpload,
    svgUrlInput,
    onSvgUrlInputChange: setSvgUrlInput,
    onFileInputChange: handleFileInputChange,
    uploadError,
    onUrlApply: handleUrlApply,
    urlError,
    hasUploadedIcon,
    onClearCustomIcon: handleClearCustomIcon,
    renderCategoryIcon,
    maxSvgFileSizeKb: MAX_SVG_FILE_SIZE_KB,
    formatIconLabel,
    defaultIconName: DEFAULT_ICON,
    customIconName,
    onCustomIconNameChange: handleCustomIconNameChange,
    customIconNameError,
    onCancelCustomIcon: handleCancelCustomIcon,
    onSaveCustomIcon: handleSaveCustomIcon,
    isSaveDisabled: !canSaveCustomIcon,
  }

  const iconPopoverContent = !isMobile ? (
    <IconCustomizationBlock {...iconCustomizationBlockProps} />
  ) : undefined

  const mobileIconBoxRequest = isMobile
    ? () => setIconDialogOpen(true)
    : undefined

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup
          variant="default"
          data-nested-parent={iconDialogOpen ? '' : undefined}
        >
          <Dialog.Content>
            <Dialog.Header data-dialog-section="header">
              <Dialog.HeaderIcon>
                <TagIcon className="h-4 w-4" />
              </Dialog.HeaderIcon>
              <Dialog.Title className="text-xl font-semibold text-gray-800 flex items-center gap-3">
                {mode === 'edit' ? 'Editar Categoria' : 'Nova Categoria'}
              </Dialog.Title>
              <Dialog.CloseButton aria-label="Fechar dialog" />
            </Dialog.Header>

            <Dialog.Body>
              <Dialog.BodyViewport style={{ scrollbarGutter: 'stable' }}>
                <Dialog.BodyContent>
                  <section className={DIALOG_PREVIEW_CARD}>
                    <div className={DIALOG_PREVIEW_HEADER}>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          Preview da Categoria
                        </p>
                        <span className="text-xs text-slate-500">
                          Como esta categoria aparece nos cards públicos
                        </span>
                      </div>
                    </div>

                    <div className="w-full">
                      <CategoryShowcasePreview
                        categoryName={previewName}
                        design={design}
                        className="md:text-[16px] [&_button]:text-[15px] md:[&_button]:text-[16px]"
                        onPlacementChange={(placement) =>
                          setDesign((prev) =>
                            prev.placement === placement
                              ? prev
                              : {
                                  ...prev,
                                  placement,
                                }
                          )
                        }
                        onReset={handleReset}
                        onEdit={() => {
                          // Abre a popover do ícone (mesma que é aberta ao clicar no ícone)
                          // O handleEditClick no CategoryShowcasePreview já faz isso
                        }}
                        iconPopoverContent={iconPopoverContent}
                        onIconBoxRequestAction={mobileIconBoxRequest}
                      />
                    </div>

                    {isMobile && (
                      <Dialog.Root
                        open={iconDialogOpen}
                        onOpenChange={setIconDialogOpen}
                      >
                        <Dialog.Portal>
                          <Dialog.Backdrop
                            onClick={() => setIconDialogOpen(false)}
                          />
                          <Dialog.Popup
                            variant="default"
                            className="p-0 h-auto max-h-[calc(100vh-0.75rem)] w-auto max-w-[min(470px,_calc(100vw-0.5rem))] bg-transparent shadow-none ring-0"
                          >
                            <IconCustomizationBlock
                              {...iconCustomizationBlockProps}
                              onClose={() => setIconDialogOpen(false)}
                            />
                          </Dialog.Popup>
                        </Dialog.Portal>
                      </Dialog.Root>
                    )}

                    <div className="pt-5 flex flex-col items-center gap-4">
                      <div
                        className={DIALOG_PREVIEW_BADGE}
                        style={{
                          backgroundColor: design.backgroundColor,
                          color: design.fontColor,
                        }}
                      >
                        <span className="shrink-0">
                          {renderCategoryIcon(design, {
                            size: 16,
                            className: 'h-4 w-4',
                            color: design.iconColor,
                          })}
                        </span>
                        <span className="truncate font-semibold text-sm min-w-0">
                          {previewName}
                        </span>
                      </div>
                      <p className="text-xs italic text-slate-500">
                        {previewDescription}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-8 w-full">
                      <div className="flex flex-col items-center gap-1.5 text-center">
                        <label className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                          <span
                            className="absolute inset-1.5 shadow-inner"
                            style={{ backgroundColor: design.iconColor }}
                            aria-hidden="true"
                          />
                          <input
                            type="color"
                            value={design.iconColor}
                            onChange={(event) =>
                              setDesign((prev) => ({
                                ...prev,
                                iconColor: event.target.value,
                              }))
                            }
                            aria-label="Selecionar cor do ícone"
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          />
                        </label>
                        <span className="text-[11px] font-semibold text-slate-600">
                          Cor do ícone
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">
                          {design.iconColor.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-1.5 text-center">
                        <label className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                          <span
                            className="absolute inset-1.5 shadow-inner"
                            style={{
                              backgroundColor: design.backgroundColor,
                            }}
                            aria-hidden="true"
                          />
                          <input
                            type="color"
                            value={design.backgroundColor}
                            onChange={(event) =>
                              setDesign((prev) => ({
                                ...prev,
                                backgroundColor: event.target.value,
                              }))
                            }
                            aria-label="Selecionar cor de fundo"
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          />
                        </label>
                        <span className="text-[11px] font-semibold text-slate-600">
                          Cor de fundo
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">
                          {design.backgroundColor.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-1.5 text-center">
                        <label className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                          <span
                            className="absolute inset-1.5 shadow-inner"
                            style={{ backgroundColor: design.fontColor }}
                            aria-hidden="true"
                          />
                          <input
                            type="color"
                            value={design.fontColor}
                            onChange={(event) =>
                              setDesign((prev) => ({
                                ...prev,
                                fontColor: event.target.value,
                              }))
                            }
                            aria-label="Selecionar cor da fonte"
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          />
                        </label>
                        <span className="text-[11px] font-semibold text-slate-600">
                          Cor da fonte
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">
                          {design.fontColor.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className={DIALOG_FORM_SECTION}>
                    <div className="space-y-2">
                      <label
                        htmlFor={`category-name-${mode}`}
                        className="text-sm font-semibold text-slate-700"
                      >
                        Nome da Categoria *
                      </label>
                      <Input
                        id={`category-name-${mode}`}
                        value={category.name}
                        onChange={(event) =>
                          setCategory((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        maxLength={50}
                        placeholder="Ex.: Terraplenagem"
                      />
                      <span className="text-xs text-slate-500">
                        {category.name.length}/50 caracteres
                      </span>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor={`category-description-${mode}`}
                        className="text-sm font-semibold text-slate-700"
                      >
                        Descrição (Opcional)
                      </label>
                      <Textarea
                        id={`category-description-${mode}`}
                        value={category.description}
                        onChange={(event) =>
                          setCategory((prev) => ({
                            ...prev,
                            description: event.target.value,
                          }))
                        }
                        maxLength={200}
                        className="min-h-[110px]"
                        placeholder="Descreva onde essa categoria é utilizada."
                      />
                      <span className="text-xs text-slate-500">
                        {category.description.length}/200 caracteres
                      </span>
                    </div>
                  </section>
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>

            <Dialog.Footer data-dialog-section="footer">
              <div className="flex gap-4 w-full xs:gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:text-orange-600 hover:scale-105 hover:shadow-lg px-4 py-2 flex-1 h-11 xs:h-10 rounded-lg border border-slate-200 hover:bg-slate-50 bg-transparent shadow-md xs:text-sm text-slate-700',
                    FOCUS_RING
                  )}
                >
                  <X className="w-4 h-4 mr-2" aria-hidden="true" />
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm xs:text-xs font-medium disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 py-2 bg-slate-700 text-primary-foreground hover:bg-slate-600 hover:scale-105 shadow-md hover:shadow-lg transition-all duration-300 h-11 xs:h-10 px-4 flex-1"
                >
                  {isSubmitting ? (
                    <Loader2
                      className="w-4 h-4 mr-2 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                  )}
                  {isSubmitting
                    ? 'Salvando...'
                    : mode === 'edit'
                      ? 'Atualizar Categoria'
                      : 'Criar Categoria'}
                </button>
              </div>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function CategoryDialog({
  mode,
  onStateChange,
}: {
  mode: CategoryDialogMode
  onStateChange: DialogStateUpdater['onStateChange']
}) {
  const [open, setOpen] = useState(false)
  const [categoryData, setCategoryData] = useState<CategoryData>({
    id: 'sample-category',
    name: SAMPLE_CATEGORY_DETAILS.name,
    description: SAMPLE_CATEGORY_DETAILS.description,
    design: cloneDesign(DEFAULT_DESIGN),
  })

  useEffect(() => {
    onStateChange(mode === 'edit' ? 'category-edit' : 'category-create', open)
  }, [mode, onStateChange, open])

  useEffect(() => {
    setCategoryData({
      id: mode === 'edit' ? 'sample-category' : undefined,
      name:
        mode === 'edit'
          ? SAMPLE_CATEGORY_DETAILS.name
          : EMPTY_CATEGORY_DETAILS.name,
      description:
        mode === 'edit'
          ? SAMPLE_CATEGORY_DETAILS.description
          : EMPTY_CATEGORY_DETAILS.description,
      design: cloneDesign(DEFAULT_DESIGN),
    })
  }, [mode])

  const handleOpen = (next: boolean) => {
    setOpen(next)
  }

  const handleClose = () => {
    setOpen(false)
  }

  const handleSave = async (data: CategoryData) => {
    setCategoryData({
      ...data,
      design: cloneDesign(data.design),
    })
    setOpen(false)
  }

  const triggerLabel = mode === 'edit' ? 'Editar Categoria' : 'Nova Categoria'

  return (
    <>
      <Button
        variant="default"
        className="gap-2"
        onClick={() => handleOpen(true)}
      >
        {mode === 'edit' ? (
          <Pencil className="h-4 w-4" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        {triggerLabel}
      </Button>

      <CategoryDialogModal
        isOpen={open}
        mode={mode}
        onClose={handleClose}
        onSave={handleSave}
        initialData={categoryData}
        onStateChange={onStateChange}
      />
    </>
  )
}

export { CategoryDialog, CategoryDialogModal }
export type { CategoryData, CategoryDialogMode, DialogStateUpdater }
