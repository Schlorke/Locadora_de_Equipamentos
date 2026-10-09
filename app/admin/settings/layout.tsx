import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveTenantPrincipal } from '@/lib/tenant'

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Sessão da aplicação + vínculo com a locadora selecionada; User.role global não autoriza.
  const access = await resolveTenantPrincipal(
    new Request('http://internal.local/admin/settings', {
      headers: await headers(),
    })
  )
  if (!access.ok)
    redirect(access.response.status === 401 ? '/admin/login' : '/admin')

  // Verificar se é especificamente ADMIN nesta locadora (não apenas OPERATOR ou FINANCIAL)
  if (access.principal.role !== 'ADMIN') redirect('/admin')

  return <>{children}</>
}
