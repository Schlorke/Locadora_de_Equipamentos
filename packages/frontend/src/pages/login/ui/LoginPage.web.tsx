'use client'

import { PLATFORM } from '@gb-locacoes/contracts/platform'
import { AlertTriangle, Eye, EyeOff } from 'lucide-react'
import type { FormEvent } from 'react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Link,
} from '../../../shared/ui'
import { useMarcaDoAcesso } from '../../../entities/organizacao'
import { useLoginModel, type LoginPageProps } from '../model/use-login-model'

const SCREEN_GRADIENT =
  'bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200'

/**
 * Moldura e marca por casca (`shell`). Vitrine: a tela sobe sob o cabeçalho fixo da vitrine (o shell reserva a altura
 * dele) e mostra a marca da locadora. Plataforma: a tela ocupa o espaço abaixo da barra da plataforma, sem
 * deslocamento, e mostra o nome provisório da plataforma.
 */
const FRAME = {
  storefront: {
    screen: `min-h-screen ${SCREEN_GRADIENT} md:-mt-[96px]`,
    center:
      'flex min-h-screen items-center justify-center  px-4 pb-8 md:px-6 md:pt-24 md:pb-8 lg:mt-3 xl:px-4 xl:py-20',
    fallback: `min-h-screen ${SCREEN_GRADIENT}`,
    markWidth: 'w-16',
  },
  platform: {
    screen: `flex flex-1 flex-col ${SCREEN_GRADIENT}`,
    center:
      'flex flex-1 items-center justify-center px-4 py-8 md:px-6 xl:py-12',
    fallback: `flex-1 ${SCREEN_GRADIENT}`,
    markWidth: 'w-fit px-5',
    mark: PLATFORM.displayName,
    footer: `${PLATFORM.displayName} - Sistema de Acesso`,
  },
} as const

export function LoginPage(props: LoginPageProps) {
  const model = useLoginModel(props)
  const {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    error,
    isLoading,
  } = model
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void model.submit()
  }
  const {
    callbackUrl = null,
    social,
    allowSignUp = true,
    shell = 'storefront',
  } = props
  const frame = FRAME[shell]
  // Vitrine: marca e rodapé da própria locadora (cartão público), nunca os da GB (achado 143).
  const marcaDaLocadora = useMarcaDoAcesso()
  const marca =
    shell === 'platform'
      ? { sigla: FRAME.platform.mark, rodape: FRAME.platform.footer }
      : marcaDaLocadora
  const handleSocialError = model.setError
  return (
    <div className={frame.screen}>
      <div className={frame.center}>
        {/* Container do login centralizado */}
        <div className="w-full pt-5 max-w-md relative z-10">
          <Card className="w-full shadow-2xl border-0 bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden animate-scale-in">
            <div className="overflow-y-auto rounded-2xl max-h-auto">
              <CardHeader className="text-center space-y-4 py-3 pt-8 px-4 md:px-8 md:py-8 md:space-y-3 xl:px-6 animate-fade-in-up">
                {/* Logo melhorado com animação */}
                <div
                  className={`mx-auto flex h-16 ${frame.markWidth} items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white shadow-xl animate-scale-in relative overflow-hidden`}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-60"></div>
                  <span className="text-2xl font-bold tracking-tight relative z-10">
                    {marca.sigla}
                  </span>
                </div>
                {/* Título e descrição centralizados */}
                <div className="space-y-2 max-w-sm mx-auto">
                  <CardTitle className="text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                    {props.requireReauthentication
                      ? 'Confirme sua identidade'
                      : 'Entrar'}
                  </CardTitle>
                  <CardDescription className="text-slate-600 text-sm leading-relaxed">
                    {props.requireReauthentication
                      ? 'Entre novamente para confirmar uma ação da assinatura. Depois, revise e confirme o pedido no painel.'
                      : 'Faça login com suas credenciais ou redes sociais'}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-8 space-y-6 md:px-8 md:pb-4 md:space-y-4 xl:px-6">
                <form
                  onSubmit={handleSubmit}
                  className="space-y-4 w-full max-w-sm mx-auto md:max-w-sm"
                >
                  {error && (
                    <Alert
                      variant="destructive"
                      className="border-red-200 bg-red-50/90 backdrop-blur-sm rounded-2xl shadow-md"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="text-red-800 text-sm font-semibold">
                        Erro de Login
                      </AlertTitle>
                      <AlertDescription className="text-red-700 text-sm leading-relaxed">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="text-slate-700 font-semibold text-sm block text-left"
                    >
                      E-mail
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className="h-12 text-sm placeholder:text-slate-400 bg-white/90 backdrop-blur-sm transition-all duration-200 rounded-md hover:shadow-md"
                      aria-label="Digite seu e-mail"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="password"
                      className="text-slate-700 font-semibold text-sm block text-left"
                    >
                      Senha
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Digite sua senha"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        className="h-12 pr-12 text-sm placeholder:text-slate-400 bg-white/90 backdrop-blur-sm transition-all duration-200 rounded-md hover:shadow-md"
                        aria-label="Digite sua senha"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-slate-100 rounded-md transition-all duration-200"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLoading}
                        aria-label={
                          showPassword ? 'Ocultar senha' : 'Mostrar senha'
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-slate-500" />
                        ) : (
                          <Eye className="h-4 w-4 text-slate-500" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="pt-1">
                    <Button
                      type="submit"
                      className="w-full h-12 bg-slate-700 hover:bg-slate-600 border border-slate-700 hover:border-slate-600 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none rounded-md"
                      disabled={isLoading}
                      aria-label="Entrar no Sistema"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          <span className="text-sm">Entrando...</span>
                        </div>
                      ) : (
                        'Entrar no Sistema'
                      )}
                    </Button>
                  </div>
                </form>

                {social?.({
                  isLoading,
                  onError: handleSocialError,
                  callbackUrl: callbackUrl
                    ? `/auth/callback?callbackUrl=${encodeURIComponent(callbackUrl)}`
                    : '/auth/callback',
                })}

                {/* Links de navegação */}
                <div className="text-center space-y-2">
                  {allowSignUp && (
                    <div className="text-sm text-slate-600">
                      Não tem uma conta?{' '}
                      <Link
                        href={
                          callbackUrl
                            ? `/cadastro?callbackUrl=${encodeURIComponent(callbackUrl)}`
                            : '/cadastro'
                        }
                        className="text-slate-700 hover:text-orange-600 font-medium underline transition-colors duration-200"
                      >
                        Cadastre-se
                      </Link>
                    </div>
                  )}
                  <div className="text-sm text-slate-600">
                    <Link
                      href="/recuperar-senha"
                      className="text-slate-700 hover:text-orange-600 font-medium underline transition-colors duration-200"
                    >
                      Esqueceu sua senha?
                    </Link>
                  </div>
                </div>

                {/* Seção de informações */}
                <div className="text-center space-y-2 pt-3 border-t border-slate-200/60 max-w-sm mx-auto">
                  <p className="text-xs text-slate-400 pt-2 leading-relaxed">
                    {marca.rodape}
                  </p>
                </div>
              </CardContent>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** Espera da rota de login enquanto o host lê os parâmetros da URL (fallback do Suspense), na mesma casca da tela. */
export function LoginPageFallback({
  shell = 'storefront',
}: Pick<LoginPageProps, 'shell'>) {
  return (
    <div
      className={`${FRAME[shell].fallback} flex items-center justify-center`}
    >
      <div role="status" className="text-center">
        <div
          aria-hidden
          className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-brand"
        />
        <p className="mt-4 text-muted-foreground">Carregando...</p>
      </div>
    </div>
  )
}
