'use client'

import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'

import {
  usePermissions,
  modules as permissionModules,
  roles,
  actions,
} from '../model/use-permissions'
import { AdminPageHeader } from '../../../widgets/cabecalho-admin'
import { AdminCard } from '../../../widgets/cartao-admin'
import { Button } from '@gb-locacoes/ui'
import { Card, CardContent } from '@gb-locacoes/ui'
import { Checkbox } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { motion } from 'framer-motion'
import {
  Shield,
  Save,
  User,
  Package,
  DollarSign,
  Wrench,
  Truck,
  FileText,
  Settings,
} from 'lucide-react'

const actionResponsiveClass: Record<string, string> = {
  READ: '',
  WRITE: 'hidden sm:table-cell',
  DELETE: 'hidden md:table-cell',
  APPROVE: 'hidden lg:table-cell',
  MANAGE: 'hidden lg:table-cell',
}
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
  const {
    selectedRole,
    setSelectedRole,
    loading,
    saving,
    hasPermission,
    togglePermission,
    handleSave,
  } = usePermissions()
  const icons = { Package, FileText, DollarSign, Wrench, Truck, User, Settings }
  const modules = permissionModules.map((module) => ({
    ...module,
    icon: icons[module.icon],
  }))
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'linear',
          }}
          className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8 pb-24 md:pb-12 max-w-7xl mx-auto">
        <AdminPageHeader
          title="Gerenciar Permissões"
          subtitle="Controle de acesso granular por módulo e ação"
          icon={<Shield className="w-8 h-8" />}
          className="mb-8"
        />

        {/* Seleção de Role */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card className="border-0 shadow-xl bg-white backdrop-blur-sm">
            <CardContent className="p-6">
              <Label className="text-base font-semibold mb-4 block">
                Selecione o Perfil
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role.id)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedRole === role.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5" />
                      <div className="text-left">
                        <p className="font-semibold">{role.label}</p>
                        {role.description && (
                          <p className="text-sm text-gray-500">
                            {role.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabela de Permissões */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <AdminCard
            title={`Permissões - ${roles.find((r) => r.id === selectedRole)?.label}`}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-4 font-semibold text-gray-700">
                      Módulo
                    </th>
                    {actions.map((action) => (
                      <th
                        key={action.id}
                        className={`${actionResponsiveClass[action.id] ? actionResponsiveClass[action.id] + ' ' : ''}text-center p-4 font-semibold text-gray-700`}
                      >
                        {action.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modules.map((module) => {
                    const ModuleIcon = module.icon
                    return (
                      <tr
                        key={module.id}
                        className="border-b border-gray-100 hover:bg-orange-50 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <ModuleIcon className="w-5 h-5 text-gray-500" />
                            <span className="font-medium">{module.label}</span>
                          </div>
                        </td>
                        {actions.map((action) => (
                          <td
                            key={action.id}
                            className={`${actionResponsiveClass[action.id] ? actionResponsiveClass[action.id] + ' ' : ''}p-4 text-center`}
                          >
                            <Checkbox
                              checked={hasPermission(
                                selectedRole,
                                module.id,
                                action.id
                              )}
                              onCheckedChange={() =>
                                togglePermission(
                                  selectedRole,
                                  module.id,
                                  action.id
                                )
                              }
                              disabled={selectedRole === 'ADMIN'} // Admin tem todas as permissões
                            />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {selectedRole === 'ADMIN' && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> O perfil Administrador tem acesso total
                  a todos os módulos e ações. As permissões não podem ser
                  modificadas.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving || selectedRole === 'ADMIN'}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar Permissões'}
              </Button>
            </div>
          </AdminCard>
        </motion.div>
      </div>
    </div>
  )
}
