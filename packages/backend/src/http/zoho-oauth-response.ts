const basePath = '/admin/email'

/**
 * Com plataforma multi-host válida, o redirect URI do Zoho é fixo no host `app`
 * (modules/communications/zoho-client.ts); a antiga lib/zoho-mail/client.ts foi retirada em F. A
 * volta ao painel é relativa: o navegador a resolve contra o host que recebeu
 * este callback, nunca contra uma origem configurada à parte (`NEXTAUTH_URL`).
 */
export function redirectToPanel(search: string) {
  return new Response(null, {
    status: 307,
    headers: { Location: `${basePath}?${search}` },
  })
}

export function redirectError(msg: string) {
  return redirectToPanel(`error=${encodeURIComponent(msg)}`)
}

/** O código da volta do Zoho, ou o redirect do erro que ele devolveu ou da falta do código. */
export function receivedCode(
  searchParams: URLSearchParams
): { code: string } | { failure: Response } {
  const errorParam = searchParams.get('error')
  if (errorParam)
    return {
      failure: redirectError(
        errorParam === 'access_denied' ? 'Acesso negado ao Zoho' : errorParam
      ),
    }
  const code = searchParams.get('code')
  return code
    ? { code }
    : { failure: redirectError('Código de autorização não recebido') }
}

/** The legacy guard refusal uses provider/code errors before the authentication error. */
export function zohoOAuthAuthorizationFailure(
  request: Request,
  error: string | null | undefined
): Response {
  const received = receivedCode(new URL(request.url).searchParams)
  if ('failure' in received) return received.failure
  const msg =
    error === 'Unauthorized'
      ? 'Faça login como admin'
      : (error ?? 'Erro de autenticação')
  return redirectError(msg)
}
