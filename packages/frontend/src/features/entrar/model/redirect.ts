/**
 * Destino depois da autenticação.
 *
 * O papel considerado é o do vínculo (membership) na locadora selecionada, como a sessão do
 * runtime já expõe em `session.user.role` e `TenantContext.role`. E-mail e `User.role` legado
 * não decidem destino: não existe administrador por e-mail fixo. Sem locadora selecionada não há
 * papel a considerar e o destino é neutro.
 */

/** Destino quando não há locadora selecionada: não presume papel algum. */
export const NEUTRAL_REDIRECT = '/'

/** Papel de membership da locadora selecionada → área de destino. */
export function resolveMembershipRedirect(role?: string | null): string {
  if (role === 'ADMIN') return '/admin/dashboard'
  if (role === 'CLIENT' || role === 'FINANCIAL' || role === 'OPERATOR')
    return '/area-cliente'
  return NEUTRAL_REDIRECT
}

// Caracteres de controle C0 (inclui TAB, CR e LF) e DEL: o parser de URL do navegador descarta TAB/CR/LF, o que
// transforma "/\t/host" em "//host".
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}
const SAME_ORIGIN_PROBE = 'http://callback.invalid'

/**
 * Segmento de ponto ("." ou ".."), que o navegador remove ao normalizar: "/.//host" vira "//host". O parser de URL
 * também trata "%2e" como ponto, e "%2f"/"%5c" que sobram depois da decodificação são barras disfarçadas.
 */
function hasDotSegmentOrEncodedSeparator(path: string): boolean {
  if (/%2e|%2f|%5c/i.test(path)) return true
  return path.split('/').some((segment) => segment === '.' || segment === '..')
}

/**
 * Aceita só caminho relativo seguro da própria origem: começa com uma única "/", sem "//" nem "/\" (que o navegador
 * trata como outra origem), sem barra invertida, sem caracteres de controle, sem esquema, sem segmentos de ponto e sem
 * ponto ou barra codificados no caminho. O caminho também é normalizado como o navegador faz (URL com base fictícia) e
 * recusado se o resultado sair da origem ou começar com "//" ou "/\". Valor malformado é ignorado.
 */
export function safeInternalCallback(
  callbackUrl: string | null | undefined
): string | null {
  if (!callbackUrl) return null
  let decodedUrl: string
  try {
    decodedUrl = decodeURIComponent(callbackUrl)
  } catch {
    return null
  }
  if (!decodedUrl.startsWith('/') || decodedUrl.startsWith('//')) return null
  if (decodedUrl.includes('\\') || hasControlCharacter(decodedUrl)) return null
  const path = decodedUrl.split(/[?#]/, 1)[0] ?? ''
  if (hasDotSegmentOrEncodedSeparator(path)) return null
  // Última defesa: normalizado contra uma origem qualquer, o destino tem de continuar nela e com caminho de uma "/" só.
  try {
    const normalized = new URL(decodedUrl, SAME_ORIGIN_PROBE)
    if (normalized.origin !== SAME_ORIGIN_PROBE) return null
    if (
      normalized.pathname.startsWith('//') ||
      normalized.pathname.startsWith('/\\')
    )
      return null
  } catch {
    return null
  }
  return decodedUrl
}

/** Tela de login. */
export const SIGN_IN_PATH = '/login'

/**
 * Link do login com retorno para onde a pessoa estava: `callbackUrl` = caminho visível da rota + query. Só vai um
 * retorno que o login aceita e usa sem mudar (`safeInternalCallback` decodifica o valor outra vez); senão, só o
 * caminho; senão, o login sem retorno. É a regra do "Entrar" da área privada (RuntimeBootstrap).
 */
export function signInHref(routePath: string | undefined, query = ''): string {
  if (!routePath) return SIGN_IN_PATH
  const back = [routePath + query, routePath].find(
    (candidate) => safeInternalCallback(candidate) === candidate
  )
  return back
    ? `${SIGN_IN_PATH}?callbackUrl=${encodeURIComponent(back)}`
    : SIGN_IN_PATH
}

/** A UI flag only; no action or idempotency key is encoded in the authentication return. */
export function reauthenticationHref(routePath: string, query = ''): string {
  const href = signInHref(routePath, query)
  return href + (href.includes('?') ? '&' : '?') + 'reauthenticate=1'
}

/** Destino após login: callback interno ou o papel da locadora selecionada. */
export function resolveLoginRedirect(input: {
  callbackUrl: string | null
  /** @deprecated Ignorado: o destino não depende de e-mail. */
  email?: string
  /** Papel de membership na locadora selecionada; ausente quando não há seleção. */
  role?: string | null
}): string {
  return (
    safeInternalCallback(input.callbackUrl) ??
    resolveMembershipRedirect(input.role)
  )
}

/** /entrar com sessão já existente: papel da locadora selecionada. O e-mail é ignorado. */
export function resolveEntrarSessionRedirect(
  _email: string,
  role?: string | null
): string {
  return resolveMembershipRedirect(role)
}

/**
 * /entrar logo após o envio da senha: a identidade acabou de mudar e ainda não escolheu uma
 * locadora, portanto o destino é neutro. O e-mail é ignorado.
 */
export function resolveEntrarSubmitRedirect(_email?: string): string {
  return NEUTRAL_REDIRECT
}

/** /auth/callback. loading e sessão sem usuário não redirecionam. */
export function resolveAuthCallbackRedirect(input: {
  status: 'loading' | 'authenticated' | 'unauthenticated'
  hasUser: boolean
  /** @deprecated Ignorado: o destino não depende de e-mail. */
  email?: string
  /** Papel de membership na locadora selecionada; ausente quando não há seleção. */
  role?: string | null
  callbackUrl: string | null
}): string | null {
  if (input.status === 'loading') return null
  if (input.status === 'unauthenticated') return '/login'
  if (!input.hasUser) return null
  return resolveLoginRedirect({
    callbackUrl: input.callbackUrl,
    role: input.role,
  })
}
