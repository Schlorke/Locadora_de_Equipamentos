'use client'

import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'
import { ScrollView, View, Text, ActivityIndicator } from 'react-native'
import { Button, Card, Checkbox, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { AdminPageHeader } from '../../../widgets/cabecalho-admin'
import {
  usePermissions,
  modules,
  roles,
  actions,
} from '../model/use-permissions'
export function AdminPermissionsPage() {
  const tenant = useTenantContext()
  const slug = usePublicTenantSlug()
  const { data: session } = useSession()
  const revision = useApiClientRevision()
  const scope = JSON.stringify([
    tenant?.tenant.id,
    tenant?.tenant.status,
    tenant?.role,
    slug,
    session?.user?.id,
    revision,
  ])
  return <AdminPermissionsPageContent key={scope} />
}
function AdminPermissionsPageContent() {
  const model = usePermissions(),
    theme = useTheme()
  if (model.loading)
    return (
      <View style={{ padding: space.lg }}>
        <ActivityIndicator color={theme.primary} />
        <Text style={{ color: theme.text }}>Carregando permissões...</Text>
      </View>
    )
  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.md,
        gap: space.lg,
        backgroundColor: theme.background,
      }}
    >
      <AdminPageHeader
        title="Gerenciar Permissões"
        subtitle="Controle de acesso granular por módulo e ação"
      />
      <Card>
        <View style={{ gap: space.sm }}>
          <Text
            accessibilityRole="header"
            style={{
              color: theme.text,
              fontWeight: typography.weight.semibold,
            }}
          >
            Selecione o Perfil
          </Text>
          {roles.map((role) => (
            <Button
              key={role.id}
              variant={model.selectedRole === role.id ? 'default' : 'outline'}
              onClick={() => model.setSelectedRole(role.id)}
            >
              {role.label} · {role.description}
            </Button>
          ))}
        </View>
      </Card>
      {modules.map((module) => (
        <Card key={module.id}>
          <View style={{ gap: space.sm }}>
            <Text
              accessibilityRole="header"
              style={{
                color: theme.text,
                fontSize: typography.size.lg,
                fontWeight: typography.weight.semibold,
              }}
            >
              {module.label}
            </Text>
            {actions.map((action) => (
              <View
                key={action.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                }}
              >
                <Checkbox
                  aria-label={module.label + ': ' + action.label}
                  checked={model.hasPermission(
                    model.selectedRole,
                    module.id,
                    action.id
                  )}
                  disabled={model.selectedRole === 'ADMIN'}
                  onCheckedChange={() =>
                    model.togglePermission(
                      model.selectedRole,
                      module.id,
                      action.id
                    )
                  }
                />
                <Text style={{ color: theme.text }}>{action.label}</Text>
              </View>
            ))}
          </View>
        </Card>
      ))}
      {model.selectedRole === 'ADMIN' ? (
        <Text style={{ color: theme.textMuted }}>
          O perfil Administrador tem acesso total a todos os módulos e ações. As
          permissões não podem ser modificadas.
        </Text>
      ) : null}
      <Button
        disabled={model.saving || model.selectedRole === 'ADMIN'}
        onClick={() => void model.handleSave()}
      >
        {model.saving ? 'Salvando...' : 'Salvar Permissões'}
      </Button>
    </ScrollView>
  )
}
