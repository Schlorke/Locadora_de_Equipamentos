import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { Badge, Button, Card, Input, Link, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { useAddresses, useAddressesScope } from '../model/use-addresses'

const fields = [
  ['street', 'Rua'],
  ['number', 'Número'],
  ['complement', 'Complemento'],
  ['neighborhood', 'Bairro'],
  ['city', 'Cidade'],
  ['state', 'Estado'],
  ['zipCode', 'CEP'],
] as const
export function EnderecosPage() {
  return <AddressesContent key={useAddressesScope()} />
}
function AddressesContent() {
  const m = useAddresses(),
    theme = useTheme()
  const primary = m.addresses.find((a) => a.isPrimary)
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
        Endereços
      </Text>
      <Text style={{ color: theme.textMuted }}>
        Gerencie seus endereços de entrega e retirada
      </Text>
      <Card>
        <View style={{ gap: space.sm }}>
          <Text
            accessibilityRole="header"
            style={{ color: theme.text, fontSize: typography.size.lg }}
          >
            Endereço Principal
          </Text>
          {primary ? (
            <>
              <Text style={{ color: theme.text }}>
                {primary.street}, {primary.number}
              </Text>
              <Text style={{ color: theme.textMuted }}>
                {primary.neighborhood} - {primary.city}/{primary.state}
              </Text>
              <Button variant="outline" onClick={() => m.handleEdit(primary)}>
                Editar Principal
              </Button>
            </>
          ) : (
            <Text style={{ color: theme.textMuted }}>
              Nenhum endereço principal definido
            </Text>
          )}
          <Button onClick={() => m.setIsAdding(true)}>Novo Endereço</Button>
        </View>
      </Card>
      {m.isAdding ? (
        <Card>
          <View style={{ gap: space.md }}>
            <Text
              accessibilityRole="header"
              style={{ color: theme.text, fontSize: typography.size.lg }}
            >
              {m.editingId ? 'Editar Endereço' : 'Adicionar Novo Endereço'}
            </Text>
            {fields.map(([name, label]) => (
              <View key={name} style={{ gap: space.xs }}>
                <Text style={{ color: theme.text }}>
                  {label}
                  {name === 'complement' ? '' : ' *'}
                </Text>
                <Input
                  aria-label={label}
                  value={m.formData[name]}
                  disabled={m.isSubmitting}
                  onChangeText={(value) =>
                    void m.handleInputChange({
                      target: {
                        name,
                        value:
                          name === 'state'
                            ? value.slice(0, 2)
                            : name === 'zipCode'
                              ? value.slice(0, 9)
                              : value,
                      },
                    })
                  }
                />
              </View>
            ))}
            <Button
              disabled={m.isSubmitting || !m.canSubmit}
              onClick={() => void m.handleSubmit({ preventDefault() {} })}
            >
              {m.isSubmitting
                ? 'Salvando...'
                : m.editingId
                  ? 'Atualizar Endereço'
                  : 'Adicionar Endereço'}
            </Button>
            <Button variant="outline" onClick={m.handleCancel}>
              Cancelar
            </Button>
          </View>
        </Card>
      ) : null}
      <Text
        accessibilityRole="header"
        style={{ color: theme.text, fontSize: typography.size.lg }}
      >
        Todos os Endereços
      </Text>
      <Text style={{ color: theme.textMuted }}>
        {m.addresses.length} endereço(s) cadastrado(s)
      </Text>
      {m.isLoading ? (
        <ActivityIndicator />
      ) : m.addresses.length ? (
        m.addresses.map((a) => (
          <Card key={a.id}>
            <View style={{ gap: space.sm }}>
              <Text
                style={{
                  color: theme.text,
                  fontWeight: typography.weight.semibold,
                }}
              >
                {a.street}, {a.number}
              </Text>
              {a.complement ? (
                <Text style={{ color: theme.text }}>{a.complement}</Text>
              ) : null}
              <Text style={{ color: theme.textMuted }}>
                {a.neighborhood} - {a.city}/{a.state}
              </Text>
              <Text style={{ color: theme.textMuted }}>CEP: {a.zipCode}</Text>
              {a.isPrimary ? (
                <Badge>Principal</Badge>
              ) : (
                <Button
                  variant="outline"
                  aria-label={'Definir principal ' + a.street}
                  onClick={() => void m.handleSetPrimary(a.id)}
                >
                  Principal
                </Button>
              )}
              <Button
                variant="outline"
                aria-label={'Editar ' + a.street}
                onClick={() => m.handleEdit(a)}
              >
                Editar
              </Button>
              <Button
                variant="outline"
                aria-label={'Excluir ' + a.street}
                disabled={m.isDeleting === a.id}
                onClick={() => void m.handleDelete(a.id)}
              >
                {m.isDeleting === a.id ? 'Excluindo...' : 'Excluir'}
              </Button>
            </View>
          </Card>
        ))
      ) : (
        <Text style={{ color: theme.textMuted }}>
          Nenhum endereço cadastrado
        </Text>
      )}
    </ScrollView>
  )
}
