import type React from 'react'
import type { EmojiGroup, IconGroup, IconPickerTab } from '../model/dados'
import type {
  CategoryDesign,
  CustomIconSource,
  RenderIconOptions,
} from '../../../shared/lib/category-design-model'
import type { AllIconNames } from '../../../shared/lib/constants/all-icons'
export interface IconCustomizationCommonProps {
  onPickFile?: () => void
  className?: string
  iconTabs: Array<{ value: IconPickerTab; label: string }>
  activeTab: IconPickerTab
  onTabChange: (_tab: IconPickerTab) => void
  onRemoveIcon: () => void
  emojiSearchTerm: string
  onEmojiSearchChange: (_value: string) => void
  emojiGroups: EmojiGroup[]
  onEmojiSelect: (_emoji: string) => void
  selectedEmoji: string | null
  iconSearchTerm: string
  onIconSearchChange: (_value: string) => void
  iconGroups: IconGroup[]
  design: CategoryDesign
  activeIconName: AllIconNames
  onIconSelect: (_icon: AllIconNames) => void
  onSourceChange: (_source: CustomIconSource) => void
  formatIconLabel: (_icon: AllIconNames) => string
  defaultIconName: AllIconNames
  isProcessingUpload: boolean
  svgUrlInput: string
  onSvgUrlInputChange: (_value: string) => void
  uploadError: string | null
  onUrlApply: () => void
  urlError: string | null
  hasUploadedIcon: boolean
  onClearCustomIcon: () => void
  renderCategoryIcon: (
    _design: CategoryDesign,
    _options?: RenderIconOptions
  ) => React.ReactElement
  maxSvgFileSizeKb: number
  iconNavigationOrder?: string[]
  customIconName: string
  onCustomIconNameChange: (_value: string) => void
  customIconNameError: string | null
  onCancelCustomIcon: () => void
  onSaveCustomIcon: () => void
  isSaveDisabled?: boolean
  onClose?: () => void
}
