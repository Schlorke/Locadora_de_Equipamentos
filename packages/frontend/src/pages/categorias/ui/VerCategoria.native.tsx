import { View, Text } from 'react-native'
import { Button, Dialog, useTheme } from '@gb-locacoes/ui'
import { space, radius } from '@gb-locacoes/design-tokens'
import { categoryToDialogCategoryData } from '../../../entities/categoria'
import {
  DEFAULT_DESIGN,
  renderCategoryIcon,
  type CategoryDesign,
} from '../../../shared/lib/category-design.native'
import type { Category } from '../model/tipos'
export interface ViewCategoryDialogProps {
  category: Category | null
  isOpen: boolean
  onClose: () => void
  onEdit: (category: Category) => void
}
export function ViewCategoryDialog({
  category,
  isOpen,
  onClose,
  onEdit,
}: ViewCategoryDialogProps) {
  const theme = useTheme(),
    text = { color: theme.text }
  const design = category
    ? (categoryToDialogCategoryData(category, DEFAULT_DESIGN)
        .design as CategoryDesign)
    : DEFAULT_DESIGN
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Visualizar Categoria</Dialog.Title>
              <Dialog.CloseButton
                aria-label="Fechar dialog"
                onClick={onClose}
              />
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.BodyViewport>
                <Dialog.BodyContent>
                  {category ? (
                    <View style={{ gap: space.md }}>
                      <Text accessibilityRole="header" style={text}>
                        Preview da Categoria
                      </Text>
                      <Text style={text}>
                        Aba atual:{' '}
                        {design.placement === 'phases'
                          ? 'Fases da obra'
                          : 'Tipo de trabalho'}
                      </Text>
                      <View
                        style={{
                          backgroundColor: theme.secondary,
                          padding: space.md,
                          borderRadius: radius.md,
                          alignItems: 'center',
                          gap: space.sm,
                        }}
                      >
                        {renderCategoryIcon(design, {
                          size: space.xl,
                          color: theme.onPrimary,
                        })}
                        <Text style={text}>{category.name}</Text>
                      </View>
                      <View
                        style={{
                          backgroundColor: design.backgroundColor,
                          padding: space.sm,
                          borderRadius: radius.lg,
                          flexDirection: 'row',
                          gap: space.sm,
                        }}
                      >
                        {renderCategoryIcon(design, {
                          size: space.md,
                          color: design.iconColor,
                        })}
                        <Text style={{ color: design.fontColor }}>
                          {category.name}
                        </Text>
                      </View>
                      <Text style={text}>
                        {category.description || 'Sem descrição'}
                      </Text>
                      <Text style={text}>
                        Equipamentos: {category._count?.equipments || 0}
                      </Text>
                      <Text style={text}>ID da Categoria: {category.id}</Text>
                    </View>
                  ) : null}
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
              <Button
                onClick={() => {
                  if (category) {
                    onClose()
                    onEdit(category)
                  }
                }}
              >
                Editar Categoria
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
