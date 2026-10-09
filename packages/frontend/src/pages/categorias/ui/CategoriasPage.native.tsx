import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { ScrollView, View, Text, ActivityIndicator } from 'react-native'
import { Button, Card, Input, Dialog, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'
import { categoryToDialogCategoryData } from '../../../entities/categoria'
import {
  DEFAULT_DESIGN,
  renderCategoryIcon,
  type CategoryDesign,
} from '../../../shared/lib/category-design.native'
import { useCategoriesModel } from '../model/carga'
import type { Category } from '../model/tipos'
import {
  CategoryDialogModal,
  type NativeCategoryDialogProps,
} from './CategoriaDialog.native'
import { ViewCategoryDialog } from './VerCategoria.native'
interface AdminCategoriesPageProps {
  pickSvg?: NativeCategoryDialogProps['pickSvg']
}
export function AdminCategoriesPage(props: AdminCategoriesPageProps = {}) {
  const tenant = useTenantContext(),
    slug = usePublicTenantSlug(),
    { data: session, status } = useSession(),
    revision = useApiClientRevision()
  return (
    <CategoriesContent
      key={JSON.stringify([
        tenant?.tenant.id,
        tenant?.role,
        slug,
        session?.user?.id,
        status,
        revision,
      ])}
      {...props}
    />
  )
}
function CategoriesContent({ pickSvg }: AdminCategoriesPageProps) {
  const [message, setMessage] = useState<string | null>(null),
    pending = useRef<((value: boolean) => void) | null>(null),
    scroll = useRef<ComponentRef<typeof ScrollView>>(null)
  const m = useCategoriesModel({
    requestConfirmation: (text) =>
      new Promise<boolean>((resolve) => {
        pending.current?.(false)
        pending.current = resolve
        setMessage(text)
      }),
    onPageChange: () => scroll.current?.scrollTo({ y: 0, animated: true }),
  })
  const finish = (value: boolean) => {
    const resolve = pending.current
    pending.current = null
    setMessage(null)
    resolve?.(value)
  }
  useEffect(
    () => () => {
      pending.current?.(false)
      pending.current = null
    },
    []
  )
  const theme = useTheme(),
    text = { color: theme.text }
  return (
    <>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: space.md,
          gap: space.md,
          backgroundColor: theme.background,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            ...text,
            fontSize: typography.size.xl,
            fontWeight: typography.weight.bold,
          }}
        >
          Gerenciar Categorias
        </Text>
        <Text style={{ color: theme.textMuted }}>
          Organize e gerencie as categorias de equipamentos
        </Text>
        <Text style={text}>{m.filteredCategories.length} categorias</Text>
        <Input
          aria-label="Buscar categorias"
          placeholder="Buscar categorias..."
          value={m.searchTerm}
          onChangeText={m.setSearchTerm}
        />
        <Button onClick={m.openNewCategoryModal}>Nova Categoria</Button>
        {m.loading ? (
          <ActivityIndicator />
        ) : m.paginatedCategories.length === 0 ? (
          <Text style={text}>
            {m.searchTerm
              ? 'Nenhuma categoria encontrada.'
              : 'Crie sua primeira categoria.'}
          </Text>
        ) : (
          m.paginatedCategories.map((category) => (
            <Card key={category.id}>
              {renderCategoryIcon(
                categoryToDialogCategoryData(category, DEFAULT_DESIGN)
                  .design as CategoryDesign,
                { size: space.xl }
              )}
              <Text accessibilityRole="header" style={text}>
                {category.name}
              </Text>
              <Text style={{ color: theme.textMuted }}>
                {category.description || 'Sem descrição'}
              </Text>
              <Text style={text}>
                {category._count?.equipments || 0} equipamentos
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: space.sm,
                }}
              >
                <Button
                  variant="outline"
                  aria-label={'Visualizar ' + category.name}
                  onClick={() => m.setSelectedCategory(category)}
                >
                  Visualizar {category.name}
                </Button>
                <Button
                  variant="outline"
                  aria-label={'Editar ' + category.name}
                  onClick={() => m.openEditCategoryModal(category)}
                >
                  Editar {category.name}
                </Button>
                <Button
                  variant="outline"
                  disabled={m.isSubmitting}
                  aria-label={'Excluir ' + category.name}
                  onClick={() => void m.deleteCategory(category.id)}
                >
                  Excluir {category.name}
                </Button>
              </View>
            </Card>
          ))
        )}
        {m.totalPages > 1 ? (
          <View style={{ gap: space.sm }}>
            <Text style={text}>
              Página {m.effectiveCurrentPage} de {m.totalPages}
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button
                variant="outline"
                disabled={m.effectiveCurrentPage <= 1}
                onClick={() => m.handlePageChange(m.effectiveCurrentPage - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={m.effectiveCurrentPage >= m.totalPages}
                onClick={() => m.handlePageChange(m.effectiveCurrentPage + 1)}
              >
                Próximo
              </Button>
            </View>
          </View>
        ) : null}
      </ScrollView>
      <ViewCategoryDialog
        category={m.selectedCategory}
        isOpen={!!m.selectedCategory}
        onClose={() => m.setSelectedCategory(null)}
        onEdit={(category: Category) => m.openEditCategoryModal(category)}
      />
      <CategoryDialogModal
        isOpen={m.isModernModalOpen}
        mode={m.editingCategoryData ? 'edit' : 'create'}
        initialData={
          m.editingCategoryData as NativeCategoryDialogProps['initialData']
        }
        onClose={() => m.setIsModernModalOpen(false)}
        onSave={m.handleCategorySave}
        onStateChange={m.handleDialogStateChange}
        pickSvg={pickSvg}
      />
      <Dialog.Root
        open={message !== null}
        onOpenChange={(open) => {
          if (!open) finish(false)
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Popup>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Confirmar Exclusão</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text style={text}>{message}</Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => finish(false)}>
                  Cancelar Exclusão
                </Button>
                <Button onClick={() => finish(true)}>Confirmar Exclusão</Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
