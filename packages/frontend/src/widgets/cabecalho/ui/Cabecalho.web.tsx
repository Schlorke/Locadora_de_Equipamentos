'use client'

import React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@gb-locacoes/ui'
import { HEADER_MENU_TRIGGER } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { CloseButton } from '@gb-locacoes/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@gb-locacoes/ui'
import { NotificationBadgeWrapper } from '@gb-locacoes/ui'
import { useCartNotifications } from '../../../features/carrinho'
import { useIsMobile } from '../../../shared/lib'
import { usePublicSettings } from '../../../entities/configuracao'
import {
  siglaDaLocadora,
  useIdentidadePublica,
} from '../../../entities/organizacao'
import {
  HEADER_CLIENT_ANCHOR,
  HEADER_CLIENT_AREA_HREF,
  HEADER_EQUIPMENTS_HREF,
  HEADER_INTERNAL_NAV_KEY,
  HEADER_NAVIGATION,
  HEADER_SCROLL_KEY,
  buildHeaderUserMenu,
  getHeaderFirstName,
  getHeaderUserInitials,
  isHeaderActivePage,
  isHeaderStaff,
  shouldAdjustClientAreaScroll,
  shouldAdjustMobileClientMenu,
} from '../model/usuario'
import { cn } from '../../../shared/lib/cn.web'
import {
  Bell,
  ChevronDown,
  FileText,
  Home,
  LogOut,
  MapPin,
  Menu,
  Phone,
  Settings,
  Shield,
  ShoppingCart,
  User,
} from 'lucide-react'
import { useSession } from '../../../entities/sessao'
import Image from 'next/image'
import { Link } from '@gb-locacoes/ui'
import { useRouter } from 'next/navigation'
import { useVisiblePathname } from '../../../shared/lib/navigation/use-visible-pathname.web'
import { useEffect, useRef, useState } from 'react'
import { HeaderSearchCombobox } from './Busca.web'
import { LogoutConfirmationDialog } from './Sair.web'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false)
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const pathname = useVisiblePathname()
  const router = useRouter()
  const { data: session, status } = useSession()
  const isAuthenticated = status === 'authenticated' && session?.user
  const isUnauthenticated = status === 'unauthenticated'
  const { itemCount } = useCartNotifications()
  const { settings, isLoading } = usePublicSettings()
  // Telefone e WhatsApp da própria locadora, cada um só quando informado (vazio ou só espaços não conta): o "|" da
  // produção só entre os dois e, sem nenhum (ou sem locadora), o bloco sai; carregando, fica no lugar, só com o ícone.
  const telefone = settings.companyPhone.trim()
  const whatsapp = settings.whatsappNumber.trim()
  // Marca da própria locadora (cartão público); sem ela, nada de outra locadora no lugar (achado 143, T12).
  const identidade = useIdentidadePublica()
  const nome = identidade?.nome ?? null
  const [notificationCount, setNotificationCount] = useState(0)
  const isMobile = useIsMobile()
  const userMenuCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const avatarMenuCloseTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)

  const syncNotificationCount = (unreadCount: number) => {
    localStorage.setItem('gb-locacoes-unread-count', unreadCount.toString())
    const event = new CustomEvent('notificationUpdate', {
      detail: { unreadCount },
    })
    window.dispatchEvent(event)
  }

  // Escutar mudanças nas notificações via evento customizado
  useEffect(() => {
    const handleNotificationUpdate = (e: CustomEvent) => {
      setNotificationCount(e.detail.unreadCount)
    }

    // Escutar evento customizado para atualização imediata
    window.addEventListener(
      'notificationUpdate',
      handleNotificationUpdate as EventListener
    )

    // Verificar valor inicial
    const unreadCount = localStorage.getItem('gb-locacoes-unread-count')
    if (unreadCount) {
      setNotificationCount(parseInt(unreadCount))
    }

    return () => {
      window.removeEventListener(
        'notificationUpdate',
        handleNotificationUpdate as EventListener
      )
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) {
      return
    }

    let isActive = true

    const fetchStats = async () => {
      try {
        const response = await fetch('/api/client/notifications/stats')
        if (!response.ok) {
          return
        }

        const data = await response.json()
        if (!isActive) return

        const unreadCount = typeof data?.unread === 'number' ? data.unread : 0
        syncNotificationCount(unreadCount)
      } catch (error) {
        console.error('[Header] Failed to sync notification stats:', error)
      }
    }

    fetchStats()

    return () => {
      isActive = false
    }
  }, [session?.user?.id, status])

  // Limpar timeout de fechamento do menu do usuário ao desmontar
  useEffect(() => {
    return () => {
      if (userMenuCloseTimeoutRef.current) {
        clearTimeout(userMenuCloseTimeoutRef.current)
      }
      if (avatarMenuCloseTimeoutRef.current) {
        clearTimeout(avatarMenuCloseTimeoutRef.current)
      }
    }
  }, [])

  const handleInternalNavigation = () => {
    sessionStorage.setItem(HEADER_INTERNAL_NAV_KEY, 'true')
    setIsMenuOpen(false)
  }

  const handleMinhaContaNavigation = () => {
    sessionStorage.setItem(HEADER_INTERNAL_NAV_KEY, 'true')
    setIsMenuOpen(false)

    if (shouldAdjustClientAreaScroll(pathname)) {
      sessionStorage.setItem(HEADER_SCROLL_KEY, HEADER_CLIENT_ANCHOR)
      window.location.href = HEADER_CLIENT_AREA_HREF
    }
  }

  const handleUserMenuNavigation = (href: string) => {
    handleInternalNavigation()

    if (shouldAdjustMobileClientMenu(isMobile, href)) {
      sessionStorage.setItem(HEADER_SCROLL_KEY, HEADER_CLIENT_ANCHOR)
    }

    router.push(href)
  }

  const handleEquipmentsNavigation = () => {
    window.location.href = HEADER_EQUIPMENTS_HREF
    setIsMenuOpen(false)
  }

  const navigation = HEADER_NAVIGATION

  const isActivePage = (href: string) => isHeaderActivePage(pathname, href)
  const getUserInitials = getHeaderUserInitials
  const getFirstName = getHeaderFirstName
  const isAdmin = isHeaderStaff(session?.user?.role)

  // Itens do menu do usuário (baseado na navegação da área do cliente)
  const menuIconByHref = {
    '/admin': Shield,
    '/area-cliente': Home,
    '/area-cliente/notificacoes': Bell,
    '/area-cliente/perfil': User,
    '/area-cliente/historico': FileText,
    '/area-cliente/enderecos': MapPin,
    '/contato': Phone,
  }
  const userMenuItems = buildHeaderUserMenu(isAdmin).map((item) => ({
    ...item,
    icon: menuIconByHref[item.href as keyof typeof menuIconByHref],
  }))

  // Handler para abrir dialog de logout
  const handleLogout = () => {
    setIsLogoutDialogOpen(true)
  }

  return (
    <header className="fixed inset-x-0 top-0 w-screen z-[var(--layer-sticky)] shadow-lg border-b border-b-[var(--header-border)] bg-[var(--header-surface)] backdrop-blur-sm">
      {/* Top Bar - paddingTop estende o fundo por trás da status bar do iOS */}
      <div
        className="text-white py-2.5 w-full"
        style={{
          backgroundColor: '#334155', // token-check-allow: slate-700 do cabeçalho fixo
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.625rem)',
          backgroundImage: 'none',
          boxShadow: 'none',
          border: 'none',
        }}
      >
        <div className="max-w-7xl mx-auto pl-4 pr-4 min-[769px]:pr-[max(var(--space-4),calc((var(--viewport-width)_-_100%)/2_+_var(--space-4)))]">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-4">
              {telefone || whatsapp || isLoading ? (
                <div className="flex items-start sm:items-center gap-2 font-medium">
                  <Phone className="h-4 w-4 text-slate-200" />
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    {/* No celular, só o WhatsApp, como na produção; sem ele, o telefone fica em toda largura (nunca o ícone sozinho). */}
                    {telefone ? (
                      <a
                        href={`tel:+55${telefone.replace(/\D/g, '')}`}
                        className={cn(
                          whatsapp && 'hidden sm:inline',
                          'text-slate-100 hover:text-white transition-colors'
                        )}
                      >
                        {telefone}
                      </a>
                    ) : null}
                    {telefone && whatsapp ? (
                      <span className="hidden sm:inline text-slate-300">|</span>
                    ) : null}
                    {whatsapp ? (
                      <a
                        href={`tel:+55${whatsapp.replace(/\D/g, '')}`}
                        className="text-slate-100 hover:text-white transition-colors"
                      >
                        {whatsapp}
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <span className="hidden md:inline text-slate-200 font-light">
                Atendimento especializado • Entregamos em toda região
              </span>
            </div>
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  {/* Menu do "Olá, {nome}!" - Independente */}
                  <DropdownMenu
                    open={isUserMenuOpen}
                    onOpenChange={setIsUserMenuOpen}
                    modal={false}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        data-own-frame
                        className={cn(
                          'flex items-center gap-2 text-slate-200 hover:text-white transition-all duration-200 font-medium',
                          HEADER_MENU_TRIGGER
                        )}
                        suppressHydrationWarning
                        onMouseEnter={() => {
                          if (userMenuCloseTimeoutRef.current) {
                            clearTimeout(userMenuCloseTimeoutRef.current)
                            userMenuCloseTimeoutRef.current = null
                          }
                          setIsUserMenuOpen(true)
                        }}
                        onMouseLeave={() => {
                          userMenuCloseTimeoutRef.current = setTimeout(
                            () => setIsUserMenuOpen(false),
                            120
                          )
                        }}
                      >
                        <span>Olá, {getFirstName(session.user.name)}!</span>
                        <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-56 max-h-none bg-white shadow-xl border border-slate-200 rounded-xl p-2"
                      onMouseEnter={() => {
                        if (userMenuCloseTimeoutRef.current) {
                          clearTimeout(userMenuCloseTimeoutRef.current)
                          userMenuCloseTimeoutRef.current = null
                        }
                      }}
                      onMouseLeave={() => {
                        if (userMenuCloseTimeoutRef.current) {
                          clearTimeout(userMenuCloseTimeoutRef.current)
                          userMenuCloseTimeoutRef.current = null
                        }
                        userMenuCloseTimeoutRef.current = setTimeout(
                          () => setIsUserMenuOpen(false),
                          120
                        )
                      }}
                    >
                      {userMenuItems.map((item) => (
                        <React.Fragment key={item.href}>
                          <DropdownMenuItem
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                              item.href === '/admin'
                                ? 'text-slate-700 hover:bg-orange-50 hover:text-orange-600 font-semibold'
                                : 'text-slate-700 hover:bg-orange-50 hover:text-orange-600'
                            }`}
                            onClick={() => {
                              if (item.href === '/admin') {
                                router.push('/admin')
                              } else {
                                handleUserMenuNavigation(item.href)
                              }
                            }}
                          >
                            <div className="relative">
                              <item.icon className="h-4 w-4" />
                              {item.showBadge && notificationCount > 0 && (
                                <div className="absolute -top-[0.29rem] right-[0rem] w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                              )}
                            </div>
                            <span>{item.label}</span>
                          </DropdownMenuItem>
                          {/* Divisória após o item "Painel Administrador" */}
                          {item.href === '/admin' && (
                            <DropdownMenuSeparator className="my-2 bg-slate-200" />
                          )}
                        </React.Fragment>
                      ))}
                      <DropdownMenuItem
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                        onClick={handleLogout}
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sair</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Menu do Avatar - Completamente Independente */}
                  {isAdmin ? (
                    <DropdownMenu
                      open={isAvatarMenuOpen}
                      onOpenChange={setIsAvatarMenuOpen}
                      modal={false}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          data-own-frame
                          className={cn(
                            'flex items-center justify-center rounded-full',
                            HEADER_MENU_TRIGGER
                          )}
                          aria-label={session.user.name || 'Usuário'}
                          suppressHydrationWarning
                          onMouseEnter={() => {
                            if (avatarMenuCloseTimeoutRef.current) {
                              clearTimeout(avatarMenuCloseTimeoutRef.current)
                              avatarMenuCloseTimeoutRef.current = null
                            }
                            setIsUserMenuOpen(false)
                            setIsAvatarMenuOpen(true)
                          }}
                          onMouseLeave={() => {
                            if (avatarMenuCloseTimeoutRef.current) {
                              clearTimeout(avatarMenuCloseTimeoutRef.current)
                              avatarMenuCloseTimeoutRef.current = null
                            }
                            avatarMenuCloseTimeoutRef.current = setTimeout(
                              () => setIsAvatarMenuOpen(false),
                              120
                            )
                          }}
                        >
                          <Avatar className="h-7 w-7 border-2 border-slate-300/50 hover:border-blue-300 hover:border-2 transition-colors cursor-pointer">
                            {session.user.image ? (
                              <AvatarImage
                                src={session.user.image}
                                alt={session.user.name || 'Usuário'}
                              />
                            ) : null}
                            <AvatarFallback className="bg-slate-400 text-white text-xs font-medium">
                              {getUserInitials(session.user.name)}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-56 bg-white shadow-xl border border-slate-200 rounded-xl p-2"
                        onMouseEnter={() => {
                          if (avatarMenuCloseTimeoutRef.current) {
                            clearTimeout(avatarMenuCloseTimeoutRef.current)
                            avatarMenuCloseTimeoutRef.current = null
                          }
                        }}
                        onMouseLeave={() => {
                          if (avatarMenuCloseTimeoutRef.current) {
                            clearTimeout(avatarMenuCloseTimeoutRef.current)
                            avatarMenuCloseTimeoutRef.current = null
                          }
                          avatarMenuCloseTimeoutRef.current = setTimeout(
                            () => setIsAvatarMenuOpen(false),
                            120
                          )
                        }}
                      >
                        <div className="flex items-center gap-3 px-2 py-2">
                          <Avatar className="h-10 w-10">
                            {session.user.image ? (
                              <AvatarImage
                                src={session.user.image}
                                alt={session.user.name || 'Usuário'}
                              />
                            ) : null}
                            <AvatarFallback className="bg-slate-400 text-white text-sm font-medium">
                              {getUserInitials(session.user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col gap-0.5 overflow-hidden">
                            <span className="text-sm font-medium text-slate-900 truncate">
                              {session.user.name}
                            </span>
                            <span className="text-xs text-slate-500 truncate">
                              {session.user.email}
                            </span>
                          </div>
                        </div>
                        <DropdownMenuSeparator className="my-2 bg-slate-200" />
                        <DropdownMenuItem
                          className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-slate-700 hover:bg-orange-50 hover:text-orange-600"
                          onClick={() => router.push('/area-cliente/perfil')}
                        >
                          <User className="h-4 w-4" />
                          <span>Meu Perfil</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-slate-700 hover:bg-orange-50 hover:text-orange-600"
                          onClick={() => router.push('/admin/settings')}
                        >
                          <Settings className="h-4 w-4" />
                          <span>Configurações</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-2 bg-slate-200" />
                        <DropdownMenuItem
                          className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={handleLogout}
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sair</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <DropdownMenu
                      open={isAvatarMenuOpen}
                      onOpenChange={setIsAvatarMenuOpen}
                      modal={false}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          data-own-frame
                          className={cn(
                            'flex items-center justify-center rounded-full',
                            HEADER_MENU_TRIGGER
                          )}
                          aria-label={session.user.name || 'Usuário'}
                          suppressHydrationWarning
                          onMouseEnter={() => {
                            if (avatarMenuCloseTimeoutRef.current) {
                              clearTimeout(avatarMenuCloseTimeoutRef.current)
                              avatarMenuCloseTimeoutRef.current = null
                            }
                            setIsUserMenuOpen(false)
                            setIsAvatarMenuOpen(true)
                          }}
                          onMouseLeave={() => {
                            if (avatarMenuCloseTimeoutRef.current) {
                              clearTimeout(avatarMenuCloseTimeoutRef.current)
                              avatarMenuCloseTimeoutRef.current = null
                            }
                            avatarMenuCloseTimeoutRef.current = setTimeout(
                              () => setIsAvatarMenuOpen(false),
                              120
                            )
                          }}
                        >
                          <Avatar className="h-7 w-7 border-2 border-slate-300/50 hover:border-slate-200 transition-colors cursor-pointer">
                            {session.user.image ? (
                              <AvatarImage
                                src={session.user.image}
                                alt={session.user.name || 'Usuário'}
                              />
                            ) : null}
                            <AvatarFallback className="bg-slate-400 text-white text-xs font-medium">
                              {getUserInitials(session.user.name)}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-56 bg-white shadow-xl border border-slate-200 rounded-xl p-2"
                        onMouseEnter={() => {
                          if (avatarMenuCloseTimeoutRef.current) {
                            clearTimeout(avatarMenuCloseTimeoutRef.current)
                            avatarMenuCloseTimeoutRef.current = null
                          }
                        }}
                        onMouseLeave={() => {
                          if (avatarMenuCloseTimeoutRef.current) {
                            clearTimeout(avatarMenuCloseTimeoutRef.current)
                            avatarMenuCloseTimeoutRef.current = null
                          }
                          avatarMenuCloseTimeoutRef.current = setTimeout(
                            () => setIsAvatarMenuOpen(false),
                            120
                          )
                        }}
                      >
                        <div className="flex items-center gap-3 px-2 py-2">
                          <Avatar className="h-10 w-10">
                            {session.user.image ? (
                              <AvatarImage
                                src={session.user.image}
                                alt={session.user.name || 'Usuário'}
                              />
                            ) : null}
                            <AvatarFallback className="bg-slate-400 text-white text-sm font-medium">
                              {getUserInitials(session.user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col gap-0.5 overflow-hidden">
                            <span className="text-sm font-medium text-slate-900 truncate">
                              {session.user.name}
                            </span>
                            <span className="text-xs text-slate-500 truncate">
                              {session.user.email}
                            </span>
                          </div>
                        </div>
                        <DropdownMenuSeparator className="my-2 bg-slate-200" />
                        <DropdownMenuItem
                          className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-slate-700 hover:bg-orange-50 hover:text-orange-600"
                          onClick={() => router.push('/area-cliente/perfil')}
                        >
                          <User className="h-4 w-4" />
                          <span>Meu Perfil</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-slate-700 hover:bg-orange-50 hover:text-orange-600"
                          onClick={() => router.push('/area-cliente/enderecos')}
                        >
                          <MapPin className="h-4 w-4" />
                          <span>Endereços</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-2 bg-slate-200" />
                        <DropdownMenuItem
                          className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={handleLogout}
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sair</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              ) : isUnauthenticated ? (
                <>
                  <Link
                    href="/login"
                    className="text-slate-200 hover:text-white transition-all duration-200 font-medium hover:underline"
                    onClick={handleInternalNavigation}
                  >
                    Log In
                  </Link>
                  <Link
                    href="/login"
                    className="flex items-center justify-center"
                    onClick={handleInternalNavigation}
                    aria-label="Entrar ou criar conta"
                  >
                    <Avatar className="h-7 w-7 border-2 border-slate-300/50 hover:border-slate-200 transition-colors cursor-pointer">
                      <AvatarFallback className="bg-slate-400/80 text-white">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Dialog de confirmação de logout */}
      {isAuthenticated && (
        <LogoutConfirmationDialog
          open={isLogoutDialogOpen}
          onOpenChange={setIsLogoutDialogOpen}
          callbackUrl="/"
        />
      )}

      {/* Main Header - fundo branco próprio (o <header> fixed é branco translúcido; a Top Bar acima tem #334155) */}
      <div className="bg-white/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto pl-4 pr-4 min-[769px]:pr-[max(var(--space-4),calc((var(--viewport-width)_-_100%)/2_+_var(--space-4)))]">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center space-x-3 group"
              onClick={handleInternalNavigation}
            >
              {settings.companyIconUrl ? (
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-lg transition-all duration-200 group-hover:scale-105">
                  <Image
                    src={settings.companyIconUrl}
                    alt={nome ?? 'Logo da locadora'}
                    fill
                    className="object-contain p-1"
                    unoptimized
                  />
                </div>
              ) : nome ? (
                <div className="bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white p-2.5 rounded-xl font-bold text-lg shadow-lg transition-all duration-200 group-hover:scale-105">
                  {siglaDaLocadora(nome)}
                </div>
              ) : null}
              <div>
                {nome ? (
                  <div className="font-bold text-lg text-slate-800 group-hover:text-slate-900 transition-colors duration-200">
                    {nome}
                  </div>
                ) : null}
                <div className="text-xs text-slate-500 group-hover:text-slate-600 transition-colors duration-200">
                  Equipamentos para Construção
                </div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-8">
              {navigation.map((item) => {
                const isActive = isActivePage(item.href)
                const isEquipments = item.name === 'Equipamentos'
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`relative font-medium transition-all duration-200 group py-2 ${
                      isActive
                        ? 'text-orange-600'
                        : 'text-slate-700 hover:text-orange-600'
                    }`}
                    onClick={
                      isEquipments
                        ? handleEquipmentsNavigation
                        : handleInternalNavigation
                    }
                  >
                    {item.name}
                    <span
                      className={`absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full transition-transform duration-300 origin-center ${
                        isActive
                          ? 'transform scale-x-100'
                          : 'transform scale-x-0 group-hover:scale-x-100'
                      }`}
                    ></span>
                  </Link>
                )
              })}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center space-x-2">
              <HeaderSearchCombobox />

              {/* Usuário com notificação */}
              {isAuthenticated ? (
                <NotificationBadgeWrapper count={notificationCount} size="sm">
                  <Button
                    variant="header-action"
                    size="sm"
                    data-active={
                      pathname?.startsWith('/area-cliente') || undefined
                    }
                    className={cn(
                      'rounded-xl group',
                      pathname?.startsWith('/area-cliente')
                        ? 'text-orange-600'
                        : 'text-slate-700 hover:text-orange-600'
                    )}
                    asChild
                  >
                    <Link href="/area-cliente#dashboard-banner">
                      <User
                        className={cn(
                          'h-5 w-5 transition-transform',
                          pathname?.startsWith('/area-cliente')
                            ? 'scale-110'
                            : 'group-hover:scale-110'
                        )}
                      />
                      <span className="sr-only">Minha conta</span>
                    </Link>
                  </Button>
                </NotificationBadgeWrapper>
              ) : isUnauthenticated ? (
                <Button
                  variant="header-action"
                  size="sm"
                  data-active={
                    pathname?.startsWith('/login') ||
                    pathname?.startsWith('/cadastro') ||
                    undefined
                  }
                  className={cn(
                    'rounded-xl group',
                    pathname?.startsWith('/login') ||
                      pathname?.startsWith('/cadastro')
                      ? 'text-orange-600'
                      : 'text-slate-700 hover:text-orange-600'
                  )}
                  asChild
                >
                  <Link href="/login">
                    <User
                      className={cn(
                        'h-5 w-5 transition-transform',
                        pathname?.startsWith('/login') ||
                          pathname?.startsWith('/cadastro')
                          ? 'scale-110'
                          : 'group-hover:scale-110'
                      )}
                    />
                    <span className="sr-only">Minha conta</span>
                  </Link>
                </Button>
              ) : null}

              {/* Carrinho com notificação */}
              <NotificationBadgeWrapper count={itemCount} size="sm">
                <Button
                  variant="header-action"
                  size="sm"
                  data-active={pathname?.startsWith('/orcamento') || undefined}
                  className={cn(
                    'rounded-xl group',
                    pathname?.startsWith('/orcamento')
                      ? 'text-orange-600'
                      : 'text-slate-700 hover:text-orange-600'
                  )}
                  asChild
                >
                  <Link href="/orcamento">
                    <ShoppingCart
                      className={cn(
                        'h-5 w-5 transition-transform',
                        pathname?.startsWith('/orcamento')
                          ? 'scale-110'
                          : 'group-hover:scale-110'
                      )}
                    />
                    <span className="sr-only">Carrinho</span>
                  </Link>
                </Button>
              </NotificationBadgeWrapper>
            </div>

            {/* Mobile Menu Button */}
            {isMenuOpen ? (
              <CloseButton
                onClick={() => setIsMenuOpen(false)}
                variant="ghost"
                size="md"
                className="lg:hidden text-slate-700 hover:text-orange-600 hover:bg-orange-50 transition-all duration-200 rounded-xl"
                aria-label="Fechar menu"
              />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden text-slate-700 hover:text-orange-600 hover:bg-orange-50 transition-all duration-200 rounded-xl"
                onClick={() => setIsMenuOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="h-6 w-6" />
              </Button>
            )}
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="lg:hidden border-t border-slate-200/50 py-4 bg-white/95 backdrop-blur-sm">
              <nav className="space-y-1">
                {navigation.map((item) => {
                  const isActive = isActivePage(item.href)
                  const isEquipments = item.name === 'Equipamentos'
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`block px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 mx-2 ${
                        isActive
                          ? 'text-orange-600 bg-orange-50'
                          : 'text-slate-700 hover:text-orange-600 hover:bg-orange-50'
                      }`}
                      onClick={
                        isEquipments
                          ? handleEquipmentsNavigation
                          : handleInternalNavigation
                      }
                    >
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
              <div className="mt-6 pt-4 border-t border-slate-200/50 px-2 space-y-2">
                {isAuthenticated ? (
                  <div className="space-y-2">
                    <NotificationBadgeWrapper
                      count={notificationCount}
                      size="md"
                      className="w-full"
                    >
                      <Button
                        variant="outline"
                        asChild
                        className="w-full h-12 rounded-xl border-slate-200 hover:bg-orange-50 hover:border-orange-200 transition-all duration-200"
                      >
                        <Link
                          href="/area-cliente#dashboard-banner"
                          onClick={handleMinhaContaNavigation}
                        >
                          <User className="h-5 w-5 mr-2" />
                          Minha Conta
                        </Link>
                      </Button>
                    </NotificationBadgeWrapper>
                    <NotificationBadgeWrapper
                      count={itemCount}
                      size="md"
                      className="w-full"
                    >
                      <Button
                        variant="outline"
                        asChild
                        className="w-full h-12 rounded-xl border-slate-200 hover:bg-orange-50 hover:border-orange-200 transition-all duration-200"
                      >
                        <Link
                          href="/orcamento"
                          onClick={handleInternalNavigation}
                        >
                          <ShoppingCart className="h-5 w-5 mr-2" />
                          Carrinho
                        </Link>
                      </Button>
                    </NotificationBadgeWrapper>
                  </div>
                ) : isUnauthenticated ? (
                  <Button
                    variant="outline"
                    asChild
                    className="w-full h-12 rounded-xl border-slate-200 hover:text-orange-600 transition-all duration-200"
                  >
                    <Link href="/login" onClick={handleInternalNavigation}>
                      Log In
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
