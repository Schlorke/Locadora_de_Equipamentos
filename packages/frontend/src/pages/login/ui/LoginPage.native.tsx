'use client'

import { PLATFORM } from '@gb-locacoes/contracts/platform'
import { CredentialsFields } from '../../../features/entrar'
import { Card, Link, Stack, Text } from '../../../shared/ui'
import { useLoginModel, type LoginPageProps } from '../model/use-login-model'
import { useMarcaDoAcesso } from '../../../entities/organizacao'

export function LoginPage(props: LoginPageProps) {
  const model = useLoginModel(props)
  const {
    callbackUrl = null,
    social,
    allowSignUp = true,
    shell = 'storefront',
  } = props
  const platform = shell === 'platform'
  // Vitrine: marca e rodapé da própria locadora (cartão público), nunca os da GB (achado 143).
  const marca = useMarcaDoAcesso()
  return (
    <Stack padding="lg">
      <Card>
        <Stack gap="lg">
          <Text size="xl" heading={1}>
            {platform ? PLATFORM.displayName : marca.sigla}
          </Text>
          <Text size="lg" heading={2}>
            {props.requireReauthentication
              ? 'Confirme sua identidade'
              : 'Entrar'}
          </Text>
          <Text tone="muted">
            {props.requireReauthentication
              ? 'Entre novamente e revise o pedido no painel.'
              : 'Faça login com suas credenciais ou redes sociais'}
          </Text>
          <CredentialsFields model={model} />
          {social?.({
            isLoading: model.isLoading,
            onError: model.setError,
            callbackUrl: callbackUrl
              ? '/auth/callback?callbackUrl=' + encodeURIComponent(callbackUrl)
              : '/auth/callback',
          })}
          {allowSignUp && <Text tone="muted">Não tem uma conta?</Text>}
          {allowSignUp && (
            <Link
              href={
                callbackUrl
                  ? '/cadastro?callbackUrl=' + encodeURIComponent(callbackUrl)
                  : '/cadastro'
              }
            >
              Cadastre-se
            </Link>
          )}
          <Link href="/recuperar-senha">Esqueceu sua senha?</Link>
          <Text size="sm" tone="muted">
            {platform
              ? `${PLATFORM.displayName} - Sistema de Acesso`
              : marca.rodape}
          </Text>
        </Stack>
      </Card>
    </Stack>
  )
}

/** Espera da rota de login enquanto o host lê os parâmetros da URL. A casca não muda a espera no app. */
export function LoginPageFallback(_props: Pick<LoginPageProps, 'shell'>) {
  return (
    <Stack padding="lg">
      <Text tone="muted">Carregando...</Text>
    </Stack>
  )
}
