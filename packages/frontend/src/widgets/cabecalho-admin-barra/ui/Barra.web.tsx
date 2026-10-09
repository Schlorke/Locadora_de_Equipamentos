'use client'

import { Button } from '@gb-locacoes/ui'
import { Sheet, SheetContent, SheetTrigger } from '@gb-locacoes/ui'
import { Bell, Building, Menu, Search, UserCircle } from 'lucide-react'
import { useSession } from '../../../entities/sessao'
import type { ReactNode } from 'react'
import { PLATFORM } from '@gb-locacoes/contracts/platform'
import { siglaDaLocadora } from '../../../entities/organizacao'

/** Marca do painel: a da plataforma (painel em `app.<raiz>`), nunca a de uma locadora (achado 143). */
const MARCA_DO_PAINEL = PLATFORM.displayName
const SIGLA_DO_PAINEL = siglaDaLocadora(PLATFORM.displayName)

export interface AdminHeaderProps {
  /** Conteúdo do sheet mobile (ex.: sidebar). Injetado pelo host para evitar import entre widgets. */
  sidebar?: ReactNode
}

export default function AdminHeader({ sidebar }: AdminHeaderProps) {
  const { data: session } = useSession()

  return (
    <header
      data-stack="legacy"
      className="fixed inset-x-0 top-0 w-screen border-b border-b-[var(--header-border)] bg-[var(--header-surface)] backdrop-blur-sm"
    >
      <div className="relative flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 overflow-hidden w-full">
        <div className="flex flex-1 items-center gap-2 sm:gap-4 min-w-0">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600 shrink-0"
              >
                <Menu className="h-4 w-4" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col w-64 p-0">
              {sidebar}
            </SheetContent>
          </Sheet>

          <div className="hidden md:flex items-center gap-2 font-semibold text-white min-w-0">
            <Building className="h-5 w-5 text-orange-500 shrink-0" />
            <span className="truncate">Painel {MARCA_DO_PAINEL}</span>
          </div>

          <div className="md:hidden flex items-center gap-2 font-semibold text-white min-w-0">
            <Building className="h-4 w-4 text-orange-500 shrink-0" />
            <span className="truncate text-sm">{SIGLA_DO_PAINEL} Admin</span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 lg:gap-4 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-9 w-9 sm:h-10 sm:w-10 hidden sm:flex shrink-0 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <Search className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="sr-only">Buscar</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-9 w-9 sm:h-10 sm:w-10 hidden sm:flex shrink-0 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="sr-only">Notificações</span>
          </Button>

          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <UserCircle className="h-6 w-6 sm:h-7 sm:w-7 text-slate-400 shrink-0" />
            <div className="hidden sm:block min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-200 truncate max-w-24 lg:max-w-none">
                {session?.user?.name || 'Admin'}
              </p>
              {/* Role property is now correctly typed in session type */}
              <p className="text-xs text-slate-400 truncate max-w-24 lg:max-w-none">
                {session?.user?.role}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
