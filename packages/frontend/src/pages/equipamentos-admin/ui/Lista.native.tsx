import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  Link,
  useNavigate,
  useTheme,
} from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { useEquipmentScope } from '../model/escopo'
import { useEquipmentListData, formatPrice } from '../model/lista.native'
import type { EquipmentImagePort } from '../model/tipos'
import { ViewEquipmentDialog } from './VerEquipamento.native'
export function AdminEquipmentsPage(props: EquipmentImagePort = {}) {
  return <EquipmentListContent key={useEquipmentScope(null)} {...props} />
}
function EquipmentListContent({ image }: EquipmentImagePort) {
  const m = useEquipmentListData(),
    theme = useTheme(),
    navigate = useNavigate()
  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.md,
        gap: space.md,
        backgroundColor: theme.background,
      }}
    >
      <Link href="/admin/dashboard">Voltar ao Painel</Link>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.text,
          fontSize: typography.size.xl,
          fontWeight: typography.weight.bold,
        }}
      >
        Equipamentos
      </Text>
      <Text style={{ color: theme.textMuted }}>
        {m.filteredEquipments.length} equipamento(s) encontrado(s)
      </Text>
      <Link href="/admin/equipamentos/novo">Novo Equipamento</Link>
      <Input
        aria-label="Buscar equipamentos"
        value={m.searchTerm}
        onChangeText={m.setSearchTerm}
        placeholder="Buscar equipamentos..."
      />
      <Text accessibilityRole="header" style={{ color: theme.text }}>
        Categorias
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {[{ id: 'all', name: 'Todas as Categorias' }, ...m.categories].map(
          (category) => (
            <Button
              key={category.id}
              variant={
                m.selectedCategory === category.id ? 'default' : 'outline'
              }
              onClick={() => m.setSelectedCategory(category.id)}
            >
              {category.name}
            </Button>
          )
        )}
      </View>
      <Text accessibilityRole="header" style={{ color: theme.text }}>
        Disponibilidade
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {[
          ['all', 'Todos'],
          ['available', 'Disponíveis'],
          ['unavailable', 'Indisponíveis'],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={m.availabilityFilter === value ? 'default' : 'outline'}
            onClick={() => m.setAvailabilityFilter(value!)}
          >
            {label}
          </Button>
        ))}
      </View>
      {m.loading ? (
        <ActivityIndicator />
      ) : m.currentEquipments.length ? (
        m.currentEquipments.map((equipment) => (
          <Card key={equipment.id}>
            <View style={{ gap: space.sm, padding: space.md }}>
              {equipment.images[0] && image
                ? image({
                    src: equipment.images[0],
                    alt: equipment.name,
                    height: 160,
                  })
                : null}
              <Text
                accessibilityRole="header"
                style={{ color: theme.text, fontSize: typography.size.lg }}
              >
                {equipment.name}
              </Text>
              <Text style={{ color: theme.text }}>
                {equipment.category?.name ?? 'Sem categoria'}
              </Text>
              <Text style={{ color: theme.text }}>
                {formatPrice(equipment.pricePerDay)} / dia
              </Text>
              <Badge>
                {equipment.isAvailable ? 'Disponível' : 'Indisponível'}
              </Badge>
              <Button
                variant="outline"
                onClick={() => m.setSelectedEquipment(equipment)}
                aria-label={'Visualizar ' + equipment.name}
              >
                Visualizar
              </Button>
              <Link
                href={'/admin/equipamentos/' + encodeURIComponent(equipment.id)}
              >
                Detalhes de {equipment.name}
              </Link>
              <Button
                variant="outline"
                onClick={() => m.handleEditEquipment(equipment)}
                aria-label={'Editar ' + equipment.name}
              >
                Editar
              </Button>
              <Button
                variant="outline"
                onClick={() => m.setEquipmentToDelete(equipment)}
                aria-label={'Excluir ' + equipment.name}
              >
                Excluir
              </Button>
            </View>
          </Card>
        ))
      ) : (
        <Text style={{ color: theme.textMuted }}>
          Nenhum equipamento encontrado
        </Text>
      )}
      {!m.loading && m.totalPages > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text style={{ color: theme.text }}>
            Página {m.currentPage} de {m.totalPages}
          </Text>
          <Button
            variant="outline"
            disabled={m.currentPage <= 1}
            onClick={() => m.handlePageChange(m.currentPage - 1)}
          >
            Página Anterior
          </Button>
          <Button
            variant="outline"
            disabled={m.currentPage >= m.totalPages}
            onClick={() => m.handlePageChange(m.currentPage + 1)}
          >
            Próxima Página
          </Button>
        </View>
      ) : null}
      <Button
        variant="outline"
        onClick={() => {
          m.fetchEquipments()
          m.fetchCategories()
        }}
      >
        Atualizar Lista
      </Button>
      <ViewEquipmentDialog
        equipment={m.selectedEquipment}
        isOpen={!!m.selectedEquipment}
        onClose={() => m.setSelectedEquipment(null)}
        onEdit={(equipment) =>
          navigate?.(
            '/admin/equipamentos/' +
              encodeURIComponent(equipment.id) +
              '/editar'
          )
        }
        image={image}
      />
      <Dialog.Root
        open={!!m.equipmentToDelete}
        onOpenChange={(open) => {
          if (!open && !m.isDeleting) m.setEquipmentToDelete(null)
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
                <Text style={{ color: theme.text }}>
                  Tem certeza que deseja excluir o equipamento "
                  {m.equipmentToDelete?.name}"? Esta ação não pode ser desfeita.
                </Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  variant="outline"
                  disabled={m.isDeleting}
                  onClick={() => m.setEquipmentToDelete(null)}
                >
                  Cancelar Exclusão
                </Button>
                <Button disabled={m.isDeleting} onClick={m.handleConfirmDelete}>
                  {m.isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </ScrollView>
  )
}
