import { ScrollView, Text } from 'react-native'
import { Link, useNavigate, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { useEquipmentScope } from '../model/escopo'
import { useNewEquipment } from '../model/use-new-equipment'
import type { EquipmentFormPageProps } from '../model/tipos'
import { EquipmentForm } from './Formulario.native'
export function NovoEquipamentoPage(props: EquipmentFormPageProps = {}) {
  return <NewContent key={useEquipmentScope(null)} {...props} />
}
function NewContent(props: EquipmentFormPageProps) {
  const navigate = useNavigate(),
    m = useNewEquipment((href) => navigate?.(href)),
    theme = useTheme()
  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.md,
        gap: space.md,
        backgroundColor: theme.background,
      }}
    >
      <Link href="/admin/equipamentos">Voltar aos Equipamentos</Link>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.text,
          fontSize: typography.size.xl,
          fontWeight: typography.weight.bold,
        }}
      >
        Novo Equipamento
      </Text>
      <EquipmentForm {...props} model={m} busy={m.isLoading} />
    </ScrollView>
  )
}
