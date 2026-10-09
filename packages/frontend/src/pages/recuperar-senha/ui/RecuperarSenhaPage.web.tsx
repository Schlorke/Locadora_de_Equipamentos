"use client";

import { PLATFORM } from "@gb-locacoes/contracts/platform";
import { AlertTriangle, ArrowLeft, CheckCircle, Mail } from "lucide-react";
import { type FormEvent, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Link } from "../../../shared/ui";
import { useMarcaDoAcesso } from "../../../entities/organizacao";

import { useRecovery } from "../model/use-recovery";
import type { RecuperarSenhaPageProps } from "./contract";

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

export function RecuperarSenhaPage({ shell = "storefront" }: RecuperarSenhaPageProps) {
  const model = useRecovery();
  // Vitrine: sigla da própria locadora (cartão público), nunca a de outra locadora (achados 143 e 146).
  const marcaDaLocadora = useMarcaDoAcesso();
  const sigla = shell === "platform" ? FRAME.platform.mark : marcaDaLocadora.sigla;
  const { email, setEmail, isLoading, isSuccess, setIsSuccess, error } = model;
  const handleSubmit = (event: FormEvent) => { event.preventDefault(); void model.submit(); };

  if (isSuccess) {
    return (
      <Screen shell={shell}>
        <Card className="w-full shadow-2xl border-0 bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden animate-scale-in">
          <CardHeader className="text-center space-y-3 py-6 px-6 animate-fade-in-up">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 via-green-600 to-green-700 text-white shadow-xl">
              <CheckCircle className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-slate-800 tracking-tight">
                Email Enviado!
              </CardTitle>
              <CardDescription className="text-slate-600 text-sm">
                Verifique sua caixa de entrada e siga as instruções para
                redefinir sua senha.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="px-6 pb-6 space-y-4">
            <div className="text-center space-y-4">
              <p className="text-sm text-slate-600">
                Enviamos um link de recuperação para{' '}
                <strong>{email}</strong>
              </p>
              <p className="text-xs text-slate-500">
                O link expira em 1 hora. Se você não receber o email,
                verifique sua pasta de spam.
              </p>

              <div className="pt-4 space-y-3">
                <Button
                  onClick={() => {
                    setIsSuccess(false)
                    setEmail('')
                  }}
                  variant="outline"
                  className="w-full h-12 border-slate-300"
                >
                  Enviar Novamente
                </Button>

                <Link
                  href="/login"
                  className="inline-flex items-center justify-center w-full h-12 text-sm text-slate-600 hover:text-orange-600 hover:underline transition-colors duration-200"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao Login
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen shell={shell}>
      <Card className="w-full shadow-2xl border-0 bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden animate-scale-in">
        <CardHeader className="text-center space-y-3 py-6 px-6 animate-fade-in-up">
          <div className={`mx-auto flex h-16 ${FRAME[shell].markWidth} items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white shadow-xl relative overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-60 pointer-events-none"></div>
            <span className="text-2xl font-bold tracking-tight relative z-10">
              {sigla}
            </span>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold text-slate-800 tracking-tight">
              Recuperar Senha
            </CardTitle>
            <CardDescription className="text-slate-600 text-sm">
              Digite seu email para receber instruções de recuperação
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
                htmlFor="email"
                className="text-slate-700 font-semibold text-sm"
              >
                E-mail
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="h-12 pl-10 text-sm placeholder:text-slate-400"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className={"w-full text-sm bg-[linear-gradient(to_right,#f97316,#ea580c,#f97316)] bg-[length:200%_100%] bg-left hover:bg-right shadow-md hover:scale-105 hover:shadow-lg transition-[background-position,transform,box-shadow] duration-500 ease-in-out" /* token-check-allow: gradiente laranja do botão de recuperar senha, orange-500 e orange-600 */}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Enviando...</span>
                </div>
              ) : (
                'Enviar Instruções'
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
