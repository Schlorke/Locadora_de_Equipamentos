'use client'
import {Suspense,useCallback,type ReactNode} from 'react'
import type {Session} from 'next-auth'
import {getSession,signOut} from 'next-auth/react'
import {useRouter,useSearchParams} from 'next/navigation'
import {useVisiblePathname} from '../../shared/lib/navigation/use-visible-pathname.web'
import {AppProviders} from './AppProviders'
import {usePublicTenantRouting} from './public-tenant-routing'
import {sessionTenantStorage} from './public-tenant-storage.web'
const auth={getSession,async signOut(){await signOut({redirect:false})}}
// O layout legado lê a sessão no servidor (rota dinâmica), então useSearchParams já resolve no SSR sem adiar a árvore.
function LegacyBootstrap({children,session}:{children:ReactNode;session:Session|null|undefined}){
 const router=useRouter(),pathname=useVisiblePathname(),search=useSearchParams(),query=search.toString()
 const applySlug=useCallback((slug:string)=>{const params=new URLSearchParams(query);params.set('tenantSlug',slug);router.replace(pathname+'?'+params.toString(),{scroll:false})},[router,pathname,query])
 const routing=usePublicTenantRouting({pathname,explicitSlug:search.get('tenantSlug'),storage:sessionTenantStorage,applySlug})
 const navigate=useCallback((href:string)=>router.push(routing.resolveHref(href)),[router,routing.resolveHref])
 return <AppProviders auth={auth} initialSession={session} navigate={navigate} refreshKey={pathname} {...routing}>{children}</AppProviders>}
/** `session` vem de getServerSession no layout: `null` = visitante confirmado; ausente = consulta no cliente. */
export function SessionProviderWrapper({children,session}:{children:ReactNode;session?:Session|null}){return <Suspense fallback={null}><LegacyBootstrap session={session}>{children}</LegacyBootstrap></Suspense>}
