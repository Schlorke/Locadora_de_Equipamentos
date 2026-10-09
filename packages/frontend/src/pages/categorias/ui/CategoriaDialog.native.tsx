import { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { Button, Input, Textarea, Dialog, useTheme } from '@gb-locacoes/ui'
import { space, border, radius } from '@gb-locacoes/design-tokens'
import {
  IconCustomizationBlock,
  ICON_PICKER_TABS,
} from '../../../widgets/personalizar-icone'
import {
  CATEGORY_PREVIEW_TABS,
  MAX_SVG_FILE_SIZE_KB,
  DEFAULT_ICON,
  DEFAULT_DESIGN,
  cloneDesign,
  renderCategoryIcon,
  svgToDataUrl,
} from '../../../shared/lib/category-design.native'
import { formatIconLabel } from '../../../shared/lib/icon-utils'
import { toast } from '../../../shared/lib/toast'
import { isAbortError } from '../../../shared/api'
import {
  useCategoryForm,
  type CategoryData,
  type CategoryDialogProps,
  type SvgFileInput,
  SAMPLE_CATEGORY_DETAILS,
  EMPTY_CATEGORY_DETAILS,
} from '../model/category-form'
export type { CategoryData, DialogStateUpdater } from '../model/category-form'
export type { CategoryDialogMode } from '../../../shared/lib/category-design-model'
export interface NativeCategoryDialogProps extends CategoryDialogProps {
  pickSvg?: () => Promise<SvgFileInput | null>
}
export function CategoryDialogModal(props: NativeCategoryDialogProps) {
  return props.isOpen ? (
    <CategoryForm
      key={JSON.stringify([props.mode, props.initialData?.id])}
      {...props}
    />
  ) : null
}
function CategoryForm(props: NativeCategoryDialogProps) {
  const m = useCategoryForm(props, svgToDataUrl),
    theme = useTheme(),
    [iconsOpen, setIconsOpen] = useState(false)
  const [colorDraft, setColorDraft] = useState({
    iconColor: m.design.iconColor,
    backgroundColor: m.design.backgroundColor,
    fontColor: m.design.fontColor,
  })
  useEffect(
    () =>
      setColorDraft({
        iconColor: m.design.iconColor,
        backgroundColor: m.design.backgroundColor,
        fontColor: m.design.fontColor,
      }),
    [m.design.iconColor, m.design.backgroundColor, m.design.fontColor]
  )
  const validColors = Object.values(colorDraft).every((value) =>
    /^#[0-9a-f]{6}$/i.test(value)
  )
  const text = { color: theme.text }
  const pick = async () => {
    if (!props.pickSvg) return
    // Hold a live form lifetime through the platform picker as well as file reading.
    await m.pickSvg(props.pickSvg)
  }
  const closeIcons = (open: boolean) => {
    if (!open) m.cancelPendingSvg()
    setIconsOpen(open)
  }
  const save = async () => {
    try {
      await m.handleSubmit()
    } catch (error) {
      if (!isAbortError(error))
        toast.error('Erro ao salvar categoria', {
          description:
            error instanceof Error ? error.message : 'Tente novamente.',
        })
    }
  }
  return (
    <Dialog.Root
      open={props.isOpen}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                {props.mode === 'edit' ? 'Editar Categoria' : 'Nova Categoria'}
              </Dialog.Title>
              <Dialog.CloseButton
                aria-label="Fechar dialog"
                onClick={props.onClose}
              />
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.BodyViewport>
                <Dialog.BodyContent>
                  <View style={{ gap: space.md }}>
                    <Text accessibilityRole="header" style={text}>
                      Preview da Categoria
                    </Text>
                    <Text style={{ color: theme.textMuted }}>
                      Como esta categoria aparece nos cards públicos
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: space.sm,
                      }}
                    >
                      {CATEGORY_PREVIEW_TABS.map((tab) => (
                        <Button
                          key={tab.value}
                          disabled={m.isSubmitting}
                          variant={
                            m.design.placement === tab.value
                              ? 'default'
                              : 'outline'
                          }
                          onClick={() =>
                            m.setDesign((prev) => ({
                              ...prev,
                              placement: tab.value,
                            }))
                          }
                        >
                          {tab.label}
                        </Button>
                      ))}
                    </View>
                    <View style={{ alignItems: 'center', gap: space.sm }}>
                      <View
                        style={{
                          backgroundColor: theme.secondary,
                          borderRadius: radius.md,
                          padding: space.lg,
                          alignItems: 'center',
                          gap: space.sm,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: theme.primary,
                            padding: space.sm,
                            borderRadius: radius.sm,
                          }}
                        >
                          {renderCategoryIcon(m.design, {
                            size: space.xl,
                            color: theme.onPrimary,
                          })}
                        </View>
                        <Text style={text}>{m.previewName}</Text>
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: space.sm,
                          padding: space.sm,
                          borderRadius: radius.lg,
                          backgroundColor: m.design.backgroundColor,
                        }}
                      >
                        {renderCategoryIcon(m.design, {
                          size: space.md,
                          color: m.design.iconColor,
                        })}
                        <Text style={{ color: m.design.fontColor }}>
                          {m.previewName}
                        </Text>
                      </View>
                      <Text style={{ color: theme.textMuted }}>
                        {m.previewDescription}
                      </Text>
                    </View>
                    <Button
                      variant="outline"
                      disabled={m.isSubmitting}
                      onClick={() => setIconsOpen(true)}
                    >
                      Personalizar ícone
                    </Button>
                    <Button
                      variant="outline"
                      disabled={m.isSubmitting}
                      onClick={m.handleReset}
                    >
                      Restaurar padrão
                    </Button>
                    {(
                      [
                        { key: 'iconColor', label: 'Cor do ícone' },
                        { key: 'backgroundColor', label: 'Cor de fundo' },
                        { key: 'fontColor', label: 'Cor da fonte' },
                      ] as const
                    ).map((field) => (
                      <View key={field.key} style={{ gap: space.xs }}>
                        <Text style={text}>{field.label}</Text>
                        <View
                          style={{
                            height: space.md,
                            borderWidth: border.hairline,
                            borderColor: theme.border,
                            backgroundColor: m.design[field.key],
                            borderRadius: radius.sm,
                          }}
                        />
                        <Input
                          aria-label={field.label}
                          disabled={m.isSubmitting}
                          value={colorDraft[field.key]}
                          onChangeText={(value) => {
                            setColorDraft((prev) => ({
                              ...prev,
                              [field.key]: value,
                            }))
                            if (/^#[0-9a-f]{6}$/i.test(value))
                              m.setDesign((prev) => ({
                                ...prev,
                                [field.key]: value,
                              }))
                          }}
                        />
                      </View>
                    ))}
                    <Text style={text}>Nome da categoria</Text>
                    <Input
                      aria-label="Nome da categoria"
                      value={m.category.name}
                      disabled={m.isSubmitting}
                      onChangeText={(name) =>
                        m.setCategory((prev) => ({
                          ...prev,
                          name: name.slice(0, 50),
                        }))
                      }
                    />
                    <Text style={{ color: theme.textMuted }}>
                      {m.category.name.length}/50 caracteres
                    </Text>
                    <Text style={text}>Descrição (Opcional)</Text>
                    <Textarea
                      aria-label="Descrição (Opcional)"
                      value={m.category.description}
                      disabled={m.isSubmitting}
                      onChangeText={(description) =>
                        m.setCategory((prev) => ({
                          ...prev,
                          description: description.slice(0, 200),
                        }))
                      }
                    />
                    <Text style={{ color: theme.textMuted }}>
                      {m.category.description.length}/200 caracteres
                    </Text>
                  </View>
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={props.onClose}>
                Cancelar
              </Button>
              <Button
                disabled={!m.canSubmit || !validColors}
                onClick={() => void save()}
              >
                {m.isSubmitting
                  ? 'Salvando...'
                  : props.mode === 'edit'
                    ? 'Atualizar Categoria'
                    : 'Criar Categoria'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
      <Dialog.Root open={iconsOpen} onOpenChange={closeIcons}>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Popup style={{ height: space.xxl * 14 }}>
            <IconCustomizationBlock
              iconTabs={ICON_PICKER_TABS}
              activeTab={m.activeIconTab}
              onTabChange={m.setActiveIconTab}
              onRemoveIcon={m.handleRemoveIcon}
              emojiSearchTerm={m.emojiSearchTerm}
              onEmojiSearchChange={m.setEmojiSearchTerm}
              emojiGroups={m.resolvedEmojiGroups}
              onEmojiSelect={m.handleEmojiSelect}
              selectedEmoji={m.selectedEmoji}
              iconSearchTerm={m.iconSearchTerm}
              onIconSearchChange={m.setIconSearchTerm}
              iconGroups={m.activeIconGroups}
              iconNavigationOrder={m.iconNavigationOrder}
              design={m.localDesign}
              activeIconName={m.activeIconName}
              onIconSelect={m.handleIconSelect}
              onSourceChange={m.handleSourceChange}
              formatIconLabel={formatIconLabel}
              defaultIconName={DEFAULT_ICON}
              isProcessingUpload={m.isProcessingUpload}
              svgUrlInput={m.svgUrlInput}
              onSvgUrlInputChange={m.setSvgUrlInput}
              uploadError={m.uploadError}
              onUrlApply={m.handleUrlApply}
              urlError={m.urlError}
              hasUploadedIcon={m.hasUploadedIcon}
              onClearCustomIcon={m.handleClearCustomIcon}
              renderCategoryIcon={renderCategoryIcon}
              maxSvgFileSizeKb={MAX_SVG_FILE_SIZE_KB}
              customIconName={m.customIconName}
              onCustomIconNameChange={m.handleCustomIconNameChange}
              customIconNameError={m.customIconNameError}
              onCancelCustomIcon={m.handleCancelCustomIcon}
              onSaveCustomIcon={m.handleSaveCustomIcon}
              isSaveDisabled={!m.canSaveCustomIcon}
              onPickFile={() => void pick()}
              onClose={() => closeIcons(false)}
            />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </Dialog.Root>
  )
}
export function CategoryDialog({
  mode,
  onStateChange,
  pickSvg,
}: {
  mode: NativeCategoryDialogProps['mode']
  onStateChange: NativeCategoryDialogProps['onStateChange']
  pickSvg?: NativeCategoryDialogProps['pickSvg']
}) {
  const [open, setOpen] = useState(false),
    [data, setData] = useState<CategoryData>()
  const details =
    mode === 'edit' ? SAMPLE_CATEGORY_DETAILS : EMPTY_CATEGORY_DETAILS
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true)
          onStateChange('category-' + mode, true)
        }}
      >
        {mode === 'edit' ? 'Editar Categoria' : 'Nova Categoria'}
      </Button>
      <CategoryDialogModal
        isOpen={open}
        mode={mode}
        onClose={() => {
          setOpen(false)
          onStateChange('category-' + mode, false)
        }}
        onSave={setData}
        initialData={
          data ?? { ...details, design: cloneDesign(DEFAULT_DESIGN) }
        }
        onStateChange={onStateChange}
        pickSvg={pickSvg}
      />
    </>
  )
}
