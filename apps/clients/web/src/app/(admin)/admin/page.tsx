'use client'

import { AdminIndexPage, resolveAdminIndexRedirect } from '@gb-locacoes/frontend/pages/admin-entrada'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { hostAuth } from '../../../host/auth/client'

/**
 * Destino do índice com a query que chegou a /admin (ex.: a sugestão `?locadora=` do host de locadora, D8): com
 * sessão, a query segue para o dashboard; sem sessão, vai no `callbackUrl` da entrada da equipe, que o repassa ao
 * login, e depois de entrar /admin a recebe de novo.
 */
function withIndexQuery(href: string, signedIn: boolean, search: string): string {
  if (search === '' || search === '?') return href
  const target = new URL(href, 'http://painel.invalid')
  if (signedIn) new URLSearchParams(search).forEach((value, name) => target.searchParams.append(name, value))
  else target.searchParams.set('callbackUrl', '/admin' + search)
  return target.pathname + target.search
}

/**
 * Índice do painel (destino de app.<raiz>/ e do login da equipe): decide pela sessão do host, como o host anterior
 * fazia. Com sessão, o dashboard; sem sessão (ou sessão indisponível), a entrada da equipe. A query de /admin vai junto.
 */
export default function Page() {
  const router = useRouter()
  useEffect(() => {
    let active = true
    void hostAuth
      .getSession()
      .then(
        (session) => Boolean(session?.user),
        () => false
      )
      .then((signedIn) => {
        const href = resolveAdminIndexRedirect(signedIn ? 'authenticated' : 'unauthenticated', signedIn)
        // A query é lida na hora do redirecionamento (a URL do navegador é a de /admin).
        if (active && href) router.replace(withIndexQuery(href, signedIn, window.location.search))
      })
    return () => {
      active = false
    }
  }, [router])
  return <AdminIndexPage />
}
