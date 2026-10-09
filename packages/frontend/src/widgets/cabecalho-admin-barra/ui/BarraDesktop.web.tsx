'use client'

import { AdminHeaderActions } from './Acoes.web'
import { useSession } from '../../../entities/sessao'

export interface AdminDesktopHeaderProps {
  isSidebarCollapsed?: boolean
}

export default function AdminDesktopHeader({
  isSidebarCollapsed = false,
}: AdminDesktopHeaderProps) {
  const { data: session } = useSession()

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  const userName = session?.user?.name || 'Usuário'
  const userRole = session?.user?.role

  return (
    // Ao lado da sidebar: 14rem (16rem em lg) expandida, 5rem recolhida; a largura vai até a borda direita.
    <header
      className="fixed top-0 right-0 hidden md:block transition-all duration-300 ease-in-out data-[sidebar-collapsed=false]:left-56 data-[sidebar-collapsed=false]:lg:left-64 data-[sidebar-collapsed=true]:left-20"
      data-stack="legacy"
      style={{
        background:
          'linear-gradient(145deg, rgba(51, 65, 85, 0.98), rgba(30, 41, 59, 0.95))', // token-check-allow: literais rgba originais do cabecalho admin
        backgroundColor: 'rgba(51, 65, 85, 0.98)', // token-check-allow: literais rgba originais do cabecalho admin
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)', // token-check-allow: literais rgba originais do cabecalho admin
        // token-check-allow: literais rgba originais do cabecalho admin
        boxShadow: `
          0 4px 20px rgba(0, 0, 0, 0.4),
          0 2px 8px rgba(0, 0, 0, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.08)
        `,
        willChange: 'left, width',
      }}
      data-sidebar-collapsed={isSidebarCollapsed}
    >
      <div className="flex h-16 items-center justify-between px-8">
        {/* Saudação e Nome do Usuário */}
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-2xl tracking-wide whitespace-nowrap">
            {getGreeting()}, {userName}!
          </span>
          {userRole === 'FINANCIAL' && (
            <span className="ml-2 inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
              Financeiro
            </span>
          )}
        </div>

        {/* Notificações e avatar (compartilhado com header mobile) */}
        <AdminHeaderActions />
      </div>
    </header>
  )
}
