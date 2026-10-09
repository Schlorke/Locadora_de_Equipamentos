"use client";

import { PLATFORM } from "@gb-locacoes/contracts/platform";
import { AlertTriangle, ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react";
import { type FormEvent, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Link } from "../../../shared/ui";
import { useMarcaDoAcesso } from "../../../entities/organizacao";

import { useResetPassword } from "../model/use-reset-password";
import type { ResetPasswordPageProps } from "./contract";

const SCREEN_GRADIENT = "bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200";

/**
 * Moldura por casca: na vitrine a tela sobe sob o cabeçalho fixo (o shell reserva a altura dele) e mostra a sigla da
 * própria locadora (cartão público); na plataforma ocupa o espaço abaixo da barra, sem deslocamento, com o nome
 * provisório da plataforma.
 */
const FRAME = {
  storefront: {
    screen: `min-h-screen ${SCREEN_GRADIENT} -mt-[100px] md:-mt-[96px]`,
    center: "flex min-h-screen items-center justify-center px-4 pt-[120px] md:pt-0",
    markWidth: "w-16",
  },
  platform: {
    screen: `flex flex-1 flex-col ${SCREEN_GRADIENT}`,
    center: "flex flex-1 items-center justify-center px-4 py-8",
    markWidth: "w-fit px-5",
    mark: PLATFORM.displayName,
  },
} as const;

function Screen({ shell, children }: { shell: keyof typeof FRAME; children: ReactNode }) {
  return (
    <div className={FRAME[shell].screen}>
      <div className={FRAME[shell].center}>
        <div className="w-full max-w-md relative z-10">{children}</div>
      </div>
    </div>
  );
}

export function ResetPasswordPage({ token = "", shell = "storefront" }: ResetPasswordPageProps) {
  const model = useResetPassword(token);
  // Vitrine: sigla da própria locadora (cartão público), nunca a de outra locadora (achados 143 e 146).
  const marcaDaLocadora = useMarcaDoAcesso();
  const sigla = shell === "platform" ? FRAME.platform.mark : marcaDaLocadora.sigla;
  const { hasToken, password, setPassword, confirmPassword, setConfirmPassword, showPassword, setShowPassword, showConfirmPassword, setShowConfirmPassword, isLoading, isSuccess, error } = model;
  const handleSubmit = (event: FormEvent) => { event.preventDefault(); void model.submit(); };

  if (!hasToken) {
    return (
      <Screen shell={shell}>
        <Card className="w-full shadow-2xl border-0 bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="text-center space-y-3 py-6 px-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white shadow-xl">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-slate-800 tracking-tight">
                Link invalido
              </CardTitle>
              <CardDescription className="text-slate-600 text-sm">
                Este link nao e valido ou expirou. Solicite um novo link de
                recuperacao.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="px-6 pb-6 space-y-4">
            <Button
              asChild
              variant="outline"
              className="w-full h-12 border-slate-300"
            >
              <Link href="/recuperar-senha">Solicitar novo link</Link>
            </Button>

            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full h-12 text-sm text-slate-600 hover:text-orange-600 hover:underline transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Login
            </Link>
          </CardContent>
        </Card>
      </Screen>
    )
  }

  if (isSuccess) {
    return (
      <Screen shell={shell}>
        <Card className="w-full shadow-2xl border-0 bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="text-center space-y-3 py-6 px-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 via-green-600 to-green-700 text-white shadow-xl">
              <CheckCircle className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-slate-800 tracking-tight">
                Senha redefinida
              </CardTitle>
              <CardDescription className="text-slate-600 text-sm">
                Sua senha foi atualizada com sucesso. Voce ja pode fazer
                login novamente.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="px-6 pb-6 space-y-4">
            <Button asChild className="w-full h-12">
              <Link href="/login">Ir para Login</Link>
            </Button>
          </CardContent>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen shell={shell}>
      <Card className="w-full shadow-2xl border-0 bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
        <CardHeader className="text-center space-y-3 py-6 px-6">
          <div className={`mx-auto flex h-16 ${FRAME[shell].markWidth} items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white shadow-xl relative overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-60 pointer-events-none"></div>
            <span className="text-2xl font-bold tracking-tight relative z-10">
              {sigla}
            </span>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold text-slate-800 tracking-tight">
              Redefinir Senha
            </CardTitle>
            <CardDescription className="text-slate-600 text-sm">
              Digite sua nova senha para concluir a recuperacao
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert
                variant="destructive"
                className="border-red-200 bg-red-50/90"
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-red-800 text-sm font-semibold">
                  Erro
                </AlertTitle>
                <AlertDescription className="text-red-700 text-sm">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-slate-700 font-semibold text-sm"
              >
                Nova senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua nova senha"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-12 pr-10 text-sm placeholder:text-slate-400"
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

            <div className="space-y-2">
              <Label
                htmlFor="confirmPassword"
                className="text-slate-700 font-semibold text-sm"
              >
                Confirmar senha
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirme sua nova senha"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-12 pr-10 text-sm placeholder:text-slate-400"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-slate-100 rounded-md transition-all duration-200"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  disabled={isLoading}
                  aria-label={
                    showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-500" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className={"w-full text-sm bg-[linear-gradient(to_right,#f97316,#ea580c,#f97316)] bg-[length:200%_100%] bg-left hover:bg-right shadow-md hover:scale-105 hover:shadow-lg transition-[background-position,transform,box-shadow] duration-500 ease-in-out" /* token-check-allow: gradiente laranja do botão de redefinir senha, orange-500 e orange-600 */}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Salvando...</span>
                </div>
              ) : (
                'Redefinir Senha'
              )}
            </Button>
          </form>

          <div className="text-center pt-4">
            <Link
              href="/login"
              className="inline-flex items-center text-sm text-slate-600 hover:text-orange-600 hover:underline transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </Screen>
  )
}
