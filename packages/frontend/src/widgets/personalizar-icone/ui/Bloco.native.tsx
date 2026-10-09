import { useRef, type ComponentRef } from 'react'
import {
  Alert,
  View,
  Text,
  Pressable,
  SectionList,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { Button, Input, useTheme } from '@gb-locacoes/ui'
import { space, radius, border, typography } from '@gb-locacoes/design-tokens'
import {
  renderIcon,
  type AllIconNames,
} from '../../../shared/lib/constants/all-icons'
import type { IconCustomizationCommonProps } from './contract'
export interface IconCustomizationBlockProps extends IconCustomizationCommonProps {
  onPickFile: () => void
}
function chunk<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size)
  )
}
export function IconCustomizationBlock(props: IconCustomizationBlockProps) {
  const theme = useTheme(),
    list = useRef<ComponentRef<typeof SectionList<string[]>>>(null)
  const emoji = props.activeTab === 'emoji'
  const groups = emoji
    ? props.emojiGroups.map((group) => ({
        id: group.id,
        title: group.label,
        data: chunk(group.emojis, 6),
      }))
    : props.iconGroups.map((group) => ({
        id: group.id,
        title: group.label,
        data: chunk<string>(group.icons, 6),
      }))
  const search = emoji ? props.emojiSearchTerm : props.iconSearchTerm
  const searchChange = emoji
    ? props.onEmojiSearchChange
    : props.onIconSearchChange
  const remove = () =>
    Alert.alert(
      'Remover ícone personalizado?',
      'Esta ação removerá o SVG selecionado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            if (['upload', 'url'].includes(props.design.customIcon.source))
              props.onClearCustomIcon()
            else props.onRemoveIcon()
          },
        },
      ]
    )
  const reset = () => {
    props.onRemoveIcon()
    props.onEmojiSearchChange('')
    props.onIconSearchChange('')
    props.onTabChange('icons')
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.surface,
        borderRadius: radius.lg,
        padding: space.md,
        gap: space.md,
      }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {props.iconTabs.map((tab) => (
          <Button
            key={tab.value}
            variant={props.activeTab === tab.value ? 'default' : 'outline'}
            onClick={() => props.onTabChange(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Button variant="outline" onClick={reset}>
          Restaurar padrão
        </Button>
        <Button variant="outline" onClick={remove}>
          Remover ícone
        </Button>
        {props.onClose ? (
          <Button variant="outline" onClick={props.onClose}>
            Fechar
          </Button>
        ) : null}
      </View>
      {props.activeTab !== 'custom' ? (
        <>
          <Input
            value={search}
            onChangeText={searchChange}
            placeholder={emoji ? 'Buscar emoji...' : 'Buscar ícone...'}
          />
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
          >
            {groups.map((group, index) => (
              <Button
                key={group.id}
                variant="outline"
                size="sm"
                onClick={() =>
                  list.current?.scrollToLocation({
                    sectionIndex: index,
                    itemIndex: 0,
                    animated: true,
                  })
                }
              >
                {group.title}
              </Button>
            ))}
          </View>
          <SectionList
            ref={list}
            sections={groups}
            style={{ flex: 1 }}
            stickySectionHeadersEnabled
            keyExtractor={(row, index) => row.join('|') + index}
            initialNumToRender={12}
            onScrollToIndexFailed={(info: {
              averageItemLength: number
              index: number
            }) => {
              list.current
                ?.getScrollResponder()
                ?.scrollTo({
                  y: info.averageItemLength * info.index,
                  animated: true,
                })
            }}
            renderSectionHeader={({
              section,
            }: {
              section: { title: string }
            }) => (
              <Text
                accessibilityRole="header"
                style={{
                  paddingVertical: space.sm,
                  backgroundColor: theme.surface,
                  color: theme.text,
                  fontWeight: typography.weight.semibold,
                }}
              >
                {section.title}
              </Text>
            )}
            ListEmptyComponent={
              <Text style={{ color: theme.textMuted }}>
                Nenhum resultado encontrado.
              </Text>
            }
            renderItem={({ item: row }) => (
              <View
                style={{
                  flexDirection: 'row',
                  gap: space.sm,
                  paddingVertical: space.xs,
                }}
              >
                {row.map((value) => {
                  const selected = emoji
                    ? props.selectedEmoji === value
                    : props.activeIconName === value
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityLabel={
                        emoji
                          ? value
                          : props.formatIconLabel(value as AllIconNames)
                      }
                      accessibilityState={{ selected }}
                      onPress={() =>
                        emoji
                          ? props.onEmojiSelect(value)
                          : props.onIconSelect(value as AllIconNames)
                      }
                      style={{
                        flex: 1,
                        minHeight: space.xxl,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: border.hairline,
                        borderRadius: radius.sm,
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: theme.surface,
                      }}
                    >
                      {emoji ? (
                        <Text style={{ fontSize: typography.size.lg }}>
                          {value}
                        </Text>
                      ) : (
                        renderIcon(
                          value as AllIconNames,
                          space.lg,
                          selected ? theme.primary : theme.text
                        )
                      )}
                    </Pressable>
                  )
                })}
              </View>
            )}
          />
        </>
      ) : (
        <ScrollView
          contentContainerStyle={{ gap: space.md }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            accessibilityRole="header"
            style={{ color: theme.text, fontWeight: typography.weight.semibold }}
          >
            Ícone personalizado para o cartão principal
          </Text>
          <Text style={{ color: theme.textMuted }}>
            As cores do botão permanecem fixas. Use um SVG customizado para
            representar melhor a categoria.
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button
              variant="outline"
              onClick={() => props.onSourceChange('upload')}
            >
              Upload
            </Button>
            <Button
              variant="outline"
              onClick={() => props.onSourceChange('url')}
            >
              URL externa
            </Button>
          </View>
          {props.design.customIcon.source === 'upload' ? (
            <View style={{ gap: space.sm }}>
              <Button
                variant="outline"
                onClick={props.onPickFile}
                disabled={props.isProcessingUpload}
              >
                Selecionar arquivo SVG
              </Button>
              {props.isProcessingUpload ? (
                <ActivityIndicator color={theme.primary} />
              ) : null}
              <Text style={{ color: theme.textMuted }}>
                {props.design.customIcon.fileName ??
                  'Formato SVG até ' +
                    props.maxSvgFileSizeKb +
                    'kb. Scripts e elementos externos são removidos automaticamente.'}
              </Text>
              {props.uploadError ? (
                <Text accessibilityRole="alert" style={{ color: theme.danger }}>
                  {props.uploadError}
                </Text>
              ) : null}
            </View>
          ) : null}
          {props.design.customIcon.source === 'url' ? (
            <View style={{ gap: space.sm }}>
              <Input
                value={props.svgUrlInput}
                onChangeText={props.onSvgUrlInputChange}
                placeholder="https://exemplo.com/icone.svg"
              />
              <Button
                variant="outline"
                onClick={props.onUrlApply}
                disabled={
                  !props.svgUrlInput.trim() ||
                  props.svgUrlInput.trim() === props.design.customIcon.url
                }
              >
                Aplicar
              </Button>
              <Text style={{ color: theme.textMuted }}>
                Aceitamos apenas URLs HTTPS públicas que terminem em .svg.
              </Text>
              {props.urlError ? (
                <Text accessibilityRole="alert" style={{ color: theme.danger }}>
                  {props.urlError}
                </Text>
              ) : null}
            </View>
          ) : null}
          {props.hasUploadedIcon ? (
            <View style={{ gap: space.sm }}>
              <Text style={{ color: theme.text }}>Pré-visualização</Text>
              {props.renderCategoryIcon(props.design, { size: space.xxl })}
              <Button variant="outline" onClick={props.onClearCustomIcon}>
                Remover ícone personalizado
              </Button>
              <Text style={{ color: theme.text }}>
                Nome do ícone ({props.customIconName.length}/50)
              </Text>
              <Input
                value={props.customIconName}
                onChangeText={props.onCustomIconNameChange}
                placeholder="Defina um nome descritivo"
              />
              {props.customIconNameError ? (
                <Text accessibilityRole="alert" style={{ color: theme.danger }}>
                  {props.customIconNameError}
                </Text>
              ) : null}
              <Button variant="outline" onClick={props.onCancelCustomIcon}>
                Cancelar
              </Button>
              <Button
                disabled={props.isSaveDisabled}
                onClick={props.onSaveCustomIcon}
              >
                Salvar ícone
              </Button>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}
