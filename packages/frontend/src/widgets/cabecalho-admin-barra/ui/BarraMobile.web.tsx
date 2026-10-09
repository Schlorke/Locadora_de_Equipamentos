'use client'

import { AdminHeaderActions } from './Acoes.web'
import { Button } from '@gb-locacoes/ui'
import { Menu } from 'lucide-react'
import { Link } from '@gb-locacoes/ui'
import { useVisiblePathname } from '../../../shared/lib/navigation/use-visible-pathname.web'
import { PLATFORM } from '@gb-locacoes/contracts/platform'
import { siglaDaLocadora } from '../../../entities/organizacao'

/** Sigla do painel: a da plataforma (painel em `app.<raiz>`), nunca a de uma locadora (achado 143). */
const SIGLA_DO_PAINEL = siglaDaLocadora(PLATFORM.displayName)

export interface AdminMobileHeaderProps {
  onMenuOpen?: () => void
}

export default function AdminMobileHeader({
  onMenuOpen,
}: AdminMobileHeaderProps) {
  const pathname = useVisiblePathname()

  const getPageTitle = () => {
    if (pathname?.includes('/dashboard')) return 'Dashboard'
    if (pathname?.includes('/equipamentos')) return 'Equipamentos'
    if (pathname?.includes('/categorias')) return 'Categorias'
    if (pathname?.includes('/orcamentos')) return 'Orçamentos'
    if (pathname?.includes('/rentals')) return 'Locações'
    if (pathname?.includes('/whatsapp')) return 'WhatsApp'
    if (pathname?.includes('/email')) return 'E-mail'
    if (pathname?.includes('/financial')) return 'Financeiro'
    if (pathname?.includes('/maintenance')) return 'Manutenção'
    if (pathname?.includes('/logistics')) return 'Logística'
    if (pathname?.includes('/settings')) return 'Configurações'
    return `${SIGLA_DO_PAINEL} Admin`
  }

  return (
    <header
      className="fixed inset-x-0 top-0 w-screen backdrop-blur-sm md:hidden"
      data-stack="legacy"
      style={{
        backgroundColor: 'rgb(51, 65, 85)', // token-check-allow: literais rgba originais do cabecalho admin
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div className="flex h-16 items-center justify-between gap-2 px-4">
        {/* Logo e Título */}
        <Link href="/" className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white rounded-lg font-bold text-lg shadow-lg shadow-black/20 transition-all duration-200 hover:scale-105 shrink-0 relative flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/10 rounded-lg pointer-events-none"></div>
            <span className="relative z-10">{SIGLA_DO_PAINEL}</span>
          </div>
          <span className="font-semibold text-white truncate text-base">
            {getPageTitle()}
          </span>
        </Link>

        {/* Notificações e avatar (mesmo bloco do header desktop) */}
        <AdminHeaderActions className="shrink-0" />

        {/* Menu Hambúrguer */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onMenuOpen?.()}
          className="h-10 w-10 text-white hover:text-white z-[var(--layer-fab)] relative overflow-hidden group transition-all duration-300 ease-out hover:scale-105 active:scale-95 shrink-0"
          style={{
            background:
              'linear-gradient(145deg, rgba(51, 65, 85, 0.9), rgba(30, 41, 59, 0.8))', // token-check-allow: literais rgba originais do cabecalho admin
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)', // token-check-allow: literais rgba originais do cabecalho admin
            // token-check-allow: literais rgba originais do cabecalho admin
            boxShadow: `
                inset 0 1px 0 rgba(255, 255, 255, 0.2),
                inset 0 -1px 0 rgba(0, 0, 0, 0.3),
                0 4px 12px rgba(0, 0, 0, 0.4),
                0 2px 4px rgba(0, 0, 0, 0.2)
              `,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(145deg, rgba(71, 85, 105, 0.95), rgba(51, 65, 85, 0.9))' // token-check-allow: literais rgba originais do cabecalho admin
            // token-check-allow: literais rgba originais do cabecalho admin
            e.currentTarget.style.boxShadow = `
                inset 0 1px 0 rgba(255, 255, 255, 0.3),
                inset 0 -1px 0 rgba(0, 0, 0, 0.2),
                0 6px 16px rgba(0, 0, 0, 0.5),
                0 3px 6px rgba(0, 0, 0, 0.3)
              `
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(145deg, rgba(51, 65, 85, 0.9), rgba(30, 41, 59, 0.8))' // token-check-allow: literais rgba originais do cabecalho admin
            // token-check-allow: literais rgba originais do cabecalho admin
            e.currentTarget.style.boxShadow = `
                inset 0 1px 0 rgba(255, 255, 255, 0.2),
                inset 0 -1px 0 rgba(0, 0, 0, 0.3),
                0 4px 12px rgba(0, 0, 0, 0.4),
                0 2px 4px rgba(0, 0, 0, 0.2)
              `
          }}
          aria-label="Abrir menu de navegação"
        >
          {/* Efeito de brilho interno */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent rounded-lg pointer-events-none" />
          {/* Ícone com efeito de profundidade */}
          <Menu className="h-5 w-5 relative z-10 drop-shadow-sm" />
        </Button>
      </div>
    </header>
  )
}
