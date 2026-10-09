import { ScrollView, Text, View } from 'react-native'
import { Badge, Button, Card, Input, Link, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { useProfile, useProfileScope } from '../model/use-profile'

const fields = [
  ['name', 'Nome Completo'],
  ['email', 'E-mail'],
  ['phone', 'Telefone'],
  ['company', 'Empresa'],
  ['cpf', 'CPF'],
  ['cnpj', 'CNPJ'],
] as const
export function PerfilPage() {
  return <ProfileContent key={useProfileScope()} />
}
function ProfileContent() {
  const m = useProfile(),
    theme = useTheme()
  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.md,
        gap: space.md,
        backgroundColor: theme.background,
      }}
    >
      <Link href="/area-cliente">Voltar para Área do Cliente</Link>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.text,
          fontSize: typography.size.xl,
          fontWeight: typography.weight.bold,
        }}
      >
        Meu Perfil
      </Text>
      <Text style={{ color: theme.textMuted }}>
        Gerencie suas informações pessoais e configurações
      </Text>
      <Card>
        <View style={{ gap: space.md }}>
          <Text
            accessibilityRole="header"
            style={{ color: theme.text, fontSize: typography.size.lg }}
          >
            Informações Pessoais
          </Text>
          <Button
            variant="outline"
            onClick={() =>
              m.isEditing ? void m.handleCancel() : m.setIsEditing(true)
            }
          >
            {m.isEditing ? 'Cancelar' : 'Editar'}
          </Button>
          {fields.map(([name, label]) => (
            <View key={name} style={{ gap: space.xs }}>
              <Text style={{ color: theme.text }}>{label}</Text>
              <Input
                aria-label={label}
                value={m.formData[name]}
                disabled={!m.isEditing}
                type={
                  name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'
                }
                onChangeText={(value) =>
                  m.handleInputChange({ target: { name, value } })
                }
              />
            </View>
          ))}
          <Text accessibilityRole="header" style={{ color: theme.text }}>
            Status da Conta
          </Text>
          {(
            [
              ['E-mail', m.emailStatus],
              ['Telefone', m.phoneStatus],
              ['Documentos', m.documentsStatus],
            ] as const
          ).map(([label, status]) => (
            <View key={label} style={{ gap: space.xs }}>
              <Text style={{ color: theme.text }}>{label}</Text>
              <Badge variant={status === 'verified' ? 'default' : 'outline'}>
                {status === 'verified'
                  ? 'Verificado'
                  : status === 'error'
                    ? 'Erro'
                    : 'Pendente'}
              </Badge>
            </View>
          ))}
          {m.isEditing ? (
            <Button onClick={() => void m.handleSave()}>
              Salvar Alterações
            </Button>
          ) : null}
        </View>
      </Card>
      <Card>
        <View style={{ gap: space.sm }}>
          <Text
            accessibilityRole="header"
            style={{ color: theme.text, fontSize: typography.size.lg }}
          >
            Segurança
          </Text>
          <Text style={{ color: theme.text }}>Alterar Senha</Text>
          <Text style={{ color: theme.textMuted }}>
            Atualize sua senha regularmente
          </Text>
          <Button variant="outline" disabled>
            Alterar
          </Button>
          <Text style={{ color: theme.text }}>Dispositivos Conectados</Text>
          <Button variant="outline" disabled>
            Gerenciar
          </Button>
        </View>
      </Card>
    </ScrollView>
  )
}
