'use client'
import { useOwnerSubscription } from '../../../entities/assinatura'

import { Button } from '@gb-locacoes/ui'
import { NotificationBadge } from '@gb-locacoes/ui'
import { useAdminBadges, type AdminBadges } from '../../../features/selos-admin'
import { cn } from '../../../shared/lib/cn.web'
import {
  ChevronsLeft,
  ChevronsRight,
  Landmark,
  FileText,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  MessageCircle,
  PackageSearch,
  Settings,
  UserCircle,
  Package,
  Wrench,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { useSignOut, useSession } from '../../../entities/sessao'
import { Link } from '@gb-locacoes/ui'
import { useVisiblePathname } from '../../../shared/lib/navigation/use-visible-pathname.web'
import { useEffect, useState } from 'react'
import { PLATFORM } from '@gb-locacoes/contracts/platform'
import { siglaDaLocadora } from '../../../entities/organizacao'

/** Marca do painel: a da plataforma (painel em `app.<raiz>`), nunca a de uma locadora (achado 143). */
const MARCA_DO_PAINEL = PLATFORM.displayName
const SIGLA_DO_PAINEL = siglaDaLocadora(PLATFORM.displayName)

export interface AdminSidebarProps {
  onCollapseChange?: (_collapsed: boolean) => void
  isCollapsed?: boolean
}

interface NavItem {
  href: string
  icon: LucideIcon
  label: string
  roles?: Array<'ADMIN' | 'OPERATOR' | 'FINANCIAL'>
  /** Chave para obter contagem de badge do hook useAdminBadges */
  badgeKey?: keyof AdminBadges
  ownerOnly?: boolean
}

const navItems: NavItem[] = [
  {
    href: '/admin/recebimentos',
    icon: Landmark,
    label: 'Recebimentos',
    roles: ['ADMIN'],
    ownerOnly: true,
  },
  {
    href: '/admin/assinatura',
    icon: Landmark,
    label: 'Assinatura',
    roles: ['ADMIN'],
    ownerOnly: true,
  },
  {
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    roles: ['ADMIN', 'OPERATOR'],
  },
  {
    href: '/admin/financeiro',
    icon: Landmark,
    label: 'Financeiro',
    roles: ['ADMIN', 'FINANCIAL'],
    badgeKey: 'financial',
  },
  {
    href: '/admin/equipamentos',
    icon: PackageSearch,
    label: 'Equipamentos',
    roles: ['ADMIN', 'OPERATOR'],
  },
  {
    href: '/admin/categorias',
    icon: ListChecks,
    label: 'Categorias',
    roles: ['ADMIN', 'OPERATOR'],
  },
  {
    href: '/admin/orcamentos',
    icon: FileText,
    label: 'Orçamentos',
    roles: ['ADMIN', 'OPERATOR'],
    badgeKey: 'quotes',
  },
  {
    href: '/admin/rentals',
    icon: Package,
    label: 'Locações',
    roles: ['ADMIN', 'OPERATOR'],
    badgeKey: 'rentals',
  },
  {
    href: '/admin/whatsapp',
    icon: MessageCircle,
    label: 'WhatsApp',
    roles: ['ADMIN', 'OPERATOR'],
    badgeKey: 'whatsapp',
  },
  {
    href: '/admin/email',
    icon: Mail,
    label: 'E-mail',
    roles: ['ADMIN', 'OPERATOR'],
    badgeKey: 'email',
  },
  {
    href: '/admin/maintenance',
    icon: Wrench,
    label: 'Manutenção',
    roles: ['ADMIN', 'OPERATOR'],
  },
  {
    href: '/admin/logistics',
    icon: Truck,
    label: 'Logística',
    roles: ['ADMIN', 'OPERATOR'],
  },
  {
    href: '/admin/settings',
    icon: Settings,
    label: 'Configurações',
    roles: ['ADMIN'],
  },
]

export default function AdminSidebar({
  onCollapseChange,
  isCollapsed: externalIsCollapsed,
}: AdminSidebarProps) {
  const pathname = useVisiblePathname()
  const { data: session } = useSession()
  const { state: ownerRead } = useOwnerSubscription()
  const signOut = useSignOut()
  const { badges } = useAdminBadges()
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false)

  // Usar estado externo se fornecido, caso contrário usar estado interno
  const isSidebarCollapsed =
    externalIsCollapsed !== undefined
      ? externalIsCollapsed
      : internalIsCollapsed

  // Sincronizar estado interno com externo quando mudar
  useEffect(() => {
    if (externalIsCollapsed !== undefined) {
      setInternalIsCollapsed(externalIsCollapsed)
    }
  }, [externalIsCollapsed])

  const toggleSidebarCollapse = () => {
    const next = !isSidebarCollapsed

    // Atualizar estado interno se não for controlado externamente
    if (externalIsCollapsed === undefined) {
      setInternalIsCollapsed(next)
    }

    // Notificar pai apenas em handlers de eventos (não durante render)
    onCollapseChange?.(next)
  }

  const SidebarContent = () => (
    <>
      <div
        className={cn(
          'border-b border-white/10 transition-all duration-300',
          isSidebarCollapsed ? 'p-4' : 'p-3 sm:p-4'
        )}
      >
        <Link
          href="/"
          className={cn(
            'flex items-center transition-all duration-300',
            isSidebarCollapsed ? 'justify-center w-full' : 'gap-2'
          )}
        >
          {isSidebarCollapsed ? (
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white rounded-lg font-bold text-lg shadow-lg shadow-black/20 transition-all duration-300 hover:scale-105 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/10 rounded-lg pointer-events-none"></div>
              <span className="relative z-10">{SIGLA_DO_PAINEL}</span>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white rounded-lg font-bold text-lg shadow-lg shadow-black/20 transition-all duration-300 hover:scale-105 shrink-0 relative flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/10 rounded-lg pointer-events-none"></div>
                <span className="relative z-10">{SIGLA_DO_PAINEL}</span>
              </div>
              <div className="overflow-hidden transition-all duration-300 ease-in-out flex flex-col min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-white whitespace-nowrap mt-0.5">
                  {MARCA_DO_PAINEL}
                </h2>
                <p className="text-xs text-slate-400 whitespace-nowrap">
                  Admin Panel
                </p>
              </div>
            </>
          )}
        </Link>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto admin-sidebar-nav">
        <ul className="space-y-2.5">
          {navItems
            .filter((item) => {
              if (item.ownerOnly) return ownerRead.kind === 'ready'
              if (!item.roles) return true
              const currentRole = session?.user?.role as
                'ADMIN' | 'OPERATOR' | 'FINANCIAL' | undefined
              if (!currentRole) return false
              return item.roles.includes(currentRole)
            })
            .map((item) => {
              const Icon = item.icon
              const isActive = pathname?.startsWith(item.href) || false

              return (
                <li key={item.href} className="list-none">
                  <Link
                    href={item.href}
                    title={item.label}
                    className={cn(
                      'flex items-center px-4 py-3 rounded-lg transition-all duration-300 ease-in-out group text-[15px] relative overflow-hidden',
                      'hover:scale-[1.02] active:scale-[0.98]',
                      isActive
                        ? 'text-white'
                        : 'text-slate-300 hover:text-white',
                      isSidebarCollapsed
                        ? 'justify-center gap-0'
                        : 'justify-start gap-3'
                    )}
                    style={
                      isActive
                        ? {
                            background:
                              'linear-gradient(145deg, rgba(251, 146, 60, 0.9), rgba(234, 88, 12, 0.8))', // token-check-allow: literais rgba originais da sidebar admin
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255, 255, 255, 0.2)', // token-check-allow: literais rgba originais da sidebar admin
                            // token-check-allow: literais rgba originais da sidebar admin
                            boxShadow: `
                      inset 0 1px 0 rgba(255, 255, 255, 0.3),
                      inset 0 -1px 0 rgba(0, 0, 0, 0.2),
                      0 4px 12px rgba(251, 146, 60, 0.3)
                    `,
                          }
                        : {
                            background:
                              'linear-gradient(145deg, rgba(71, 85, 105, 0.3), rgba(51, 65, 85, 0.2))', // token-check-allow: literais rgba originais da sidebar admin
                            backdropFilter: 'blur(4px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)', // token-check-allow: literais rgba originais da sidebar admin
                            // token-check-allow: literais rgba originais da sidebar admin
                            boxShadow: `
                      inset 0 1px 0 rgba(255, 255, 255, 0.1),
                      inset 0 -1px 0 rgba(0, 0, 0, 0.2),
                      0 2px 8px rgba(0, 0, 0, 0.2)
                    `,
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background =
                          'linear-gradient(145deg, rgba(71, 85, 105, 0.5), rgba(51, 65, 85, 0.4))' // token-check-allow: literais rgba originais da sidebar admin
                        // token-check-allow: literais rgba originais da sidebar admin
                        e.currentTarget.style.boxShadow = `
                        inset 0 1px 0 rgba(255, 255, 255, 0.2),
                        inset 0 -1px 0 rgba(0, 0, 0, 0.1),
                        0 4px 12px rgba(0, 0, 0, 0.3)
                      `
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background =
                          'linear-gradient(145deg, rgba(71, 85, 105, 0.3), rgba(51, 65, 85, 0.2))' // token-check-allow: literais rgba originais da sidebar admin
                        // token-check-allow: literais rgba originais da sidebar admin
                        e.currentTarget.style.boxShadow = `
                        inset 0 1px 0 rgba(255, 255, 255, 0.1),
                        inset 0 -1px 0 rgba(0, 0, 0, 0.2),
                        0 2px 8px rgba(0, 0, 0, 0.2)
                      `
                      }
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent rounded-lg pointer-events-none" />
                    <div className="relative shrink-0">
                      <Icon
                        className={cn(
                          'h-4 w-4 relative z-10 drop-shadow-sm',
                          isActive
                            ? 'text-white'
                            : 'text-slate-400 group-hover:text-white'
                        )}
                      />
                      {item.badgeKey && badges[item.badgeKey] > 0 && (
                        <NotificationBadge
                          count={badges[item.badgeKey]}
                          size="sm"
                          className="absolute -top-2 -right-2 z-20 h-4 w-4 min-h-0 min-w-0 text-[11px] leading-[calc(1/0.75)]"
                        />
                      )}
                    </div>
                    <div
                      className={cn(
                        'overflow-hidden transition-all duration-300 ease-in-out',
                        isSidebarCollapsed
                          ? 'w-0 opacity-0'
                          : 'w-auto opacity-100'
                      )}
                    >
                      <span className="font-medium whitespace-nowrap relative z-10">
                        {item.label}
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
        </ul>
      </nav>

      <div
        className={cn(
          'border-t border-white/10 mt-auto',
          isSidebarCollapsed ? 'px-3 py-3' : 'p-3 sm:p-4'
        )}
      >
        <div
          className={cn(
            'flex items-center min-w-0 mb-3 w-full p-3 rounded-lg relative overflow-hidden group',
            isSidebarCollapsed ? 'justify-center gap-0' : 'justify-start gap-3'
          )}
          style={{
            background:
              'linear-gradient(145deg, rgba(71, 85, 105, 0.3), rgba(51, 65, 85, 0.2))', // token-check-allow: literais rgba originais da sidebar admin
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255, 255, 255, 0.1)', // token-check-allow: literais rgba originais da sidebar admin
            // token-check-allow: literais rgba originais da sidebar admin
            boxShadow: `
              inset 0 1px 0 rgba(255, 255, 255, 0.1),
              inset 0 -1px 0 rgba(0, 0, 0, 0.2),
              0 2px 8px rgba(0, 0, 0, 0.2)
            `,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent rounded-lg pointer-events-none" />
          <UserCircle className="h-8 w-8 text-slate-300 shrink-0 relative z-10 drop-shadow-sm" />
          <div
            className={cn(
              'overflow-hidden transition-all duration-300 ease-in-out flex flex-col min-w-0 relative z-10',
              isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}
          >
            <p className="text-sm font-medium text-white whitespace-nowrap">
              {session?.user?.name || 'Administrador'}
            </p>
            <p className="text-xs text-slate-300 whitespace-nowrap">
              {session?.user?.role || 'ADMIN'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={() => signOut({ callbackUrl: '/admin/login' })}
          className={cn(
            'flex items-center px-4 py-3 rounded-lg transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] w-full group text-[15px] relative overflow-hidden',
            'text-white hover:text-white',
            isSidebarCollapsed ? 'justify-center gap-0' : 'justify-start gap-3'
          )}
          style={{
            background:
              'linear-gradient(145deg, rgba(71, 85, 105, 0.3), rgba(51, 65, 85, 0.2))', // token-check-allow: literais rgba originais da sidebar admin
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255, 255, 255, 0.1)', // token-check-allow: literais rgba originais da sidebar admin
            // token-check-allow: literais rgba originais da sidebar admin
            boxShadow: `
              inset 0 1px 0 rgba(255, 255, 255, 0.1),
              inset 0 -1px 0 rgba(0, 0, 0, 0.2),
              0 2px 8px rgba(0, 0, 0, 0.2)
            `,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(145deg, rgba(71, 85, 105, 0.5), rgba(51, 65, 85, 0.4))' // token-check-allow: literais rgba originais da sidebar admin
            // token-check-allow: literais rgba originais da sidebar admin
            e.currentTarget.style.boxShadow = `
              inset 0 1px 0 rgba(255, 255, 255, 0.2),
              inset 0 -1px 0 rgba(0, 0, 0, 0.1),
              0 4px 12px rgba(0, 0, 0, 0.3)
            `
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(145deg, rgba(71, 85, 105, 0.3), rgba(51, 65, 85, 0.2))' // token-check-allow: literais rgba originais da sidebar admin
            // token-check-allow: literais rgba originais da sidebar admin
            e.currentTarget.style.boxShadow = `
              inset 0 1px 0 rgba(255, 255, 255, 0.1),
              inset 0 -1px 0 rgba(0, 0, 0, 0.2),
              0 2px 8px rgba(0, 0, 0, 0.2)
            `
          }}
          title="Sair"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent rounded-lg pointer-events-none" />
          <LogOut className="h-4 w-4 relative z-10 drop-shadow-sm" />
          <div
            className={cn(
              'overflow-hidden transition-all duration-300 ease-in-out',
              isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}
          >
            <span className="font-medium whitespace-nowrap relative z-10">
              Sair
            </span>
          </div>
        </Button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex md:flex-col text-white transition-all duration-300 ease-in-out relative',
          isSidebarCollapsed ? 'w-20' : 'w-56 lg:w-64'
        )}
        data-stack="legacy"
        style={{
          background:
            'linear-gradient(145deg, rgba(30, 41, 59, 0.98), rgba(20, 31, 45, 0.95))', // token-check-allow: literais rgba originais da sidebar admin
          backgroundColor: 'rgba(30, 41, 59, 0.98)', // token-check-allow: literais rgba originais da sidebar admin
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)', // token-check-allow: literais rgba originais da sidebar admin
          // token-check-allow: literais rgba originais da sidebar admin
          boxShadow: `
              -4px 0 20px rgba(0, 0, 0, 0.4),
              -2px 0 8px rgba(0, 0, 0, 0.3),
              inset 1px 0 0 rgba(255, 255, 255, 0.08)
            `,
          position: 'relative',
        }}
      >
        <SidebarContent />
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebarCollapse}
          className="absolute top-1/2 -right-5 transform -translate-y-1/2 text-white hover:text-white rounded-full h-10 w-10 shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 z-[var(--layer-fab)] overflow-hidden group"
          style={{
            background:
              'linear-gradient(145deg, rgba(51, 65, 85, 0.9), rgba(30, 41, 59, 0.8))', // token-check-allow: literais rgba originais da sidebar admin
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)', // token-check-allow: literais rgba originais da sidebar admin
            // token-check-allow: literais rgba originais da sidebar admin
            boxShadow: `
              inset 0 1px 0 rgba(255, 255, 255, 0.2),
              inset 0 -1px 0 rgba(0, 0, 0, 0.3),
              0 4px 12px rgba(0, 0, 0, 0.4),
              0 2px 4px rgba(0, 0, 0, 0.2)
            `,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(145deg, rgba(71, 85, 105, 0.95), rgba(51, 65, 85, 0.9))' // token-check-allow: literais rgba originais da sidebar admin
            // token-check-allow: literais rgba originais da sidebar admin
            e.currentTarget.style.boxShadow = `
              inset 0 1px 0 rgba(255, 255, 255, 0.3),
              inset 0 -1px 0 rgba(0, 0, 0, 0.2),
              0 6px 16px rgba(0, 0, 0, 0.5),
              0 3px 6px rgba(0, 0, 0, 0.3)
            `
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(145deg, rgba(51, 65, 85, 0.9), rgba(30, 41, 59, 0.8))' // token-check-allow: literais rgba originais da sidebar admin
            // token-check-allow: literais rgba originais da sidebar admin
            e.currentTarget.style.boxShadow = `
              inset 0 1px 0 rgba(255, 255, 255, 0.2),
              inset 0 -1px 0 rgba(0, 0, 0, 0.3),
              0 4px 12px rgba(0, 0, 0, 0.4),
              0 2px 4px rgba(0, 0, 0, 0.2)
            `
          }}
          title={isSidebarCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent rounded-full pointer-events-none" />
          {isSidebarCollapsed ? (
            <ChevronsRight className="h-4 w-4 relative z-10 drop-shadow-sm" />
          ) : (
            <ChevronsLeft className="h-4 w-4 relative z-10 drop-shadow-sm" />
          )}
        </Button>
      </aside>
    </>
  )
}
