import { ResetPasswordPage } from '@gb-locacoes/frontend/pages/reset-password'

/**
 * Destino do link de recuperação de senha (`<origem do host>/reset-password?token=`, montado pela identidade e por
 * /api/auth/forgot-password): o token da query segue para a tela. Token ausente ou repetido abre "Link invalido".
 * A tela fica na casca da plataforma do layout `(auth)`.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { token } = await searchParams
  return <ResetPasswordPage token={typeof token === 'string' ? token : ''} shell="platform" />
}
