'use client'
import {useCallback,useEffect,useState} from 'react'
import {withPublicTenant,type TenantContext} from '../../entities/organizacao'
import {internalRoutePrefixOf,toVisiblePathname} from '../../shared/lib/navigation'

/** Chave da última locadora pública visitada (sessionStorage no web, AsyncStorage no native). */
export const PUBLIC_TENANT_STORAGE_KEY='public-tenant-slug'

const PRIVATE_PREFIXES=['/area-cliente','/perfil','/enderecos','/historico']
// Entradas administrativas públicas: o web usa /admin/login e /admin/entrada; o Expo Router usa rotas planas.
const PUBLIC_ADMIN_ENTRIES=['/admin/login','/admin/entrada','/admin-login','/admin-entrada']
// Rotas públicas que alteram o carrinho ao montar (ex.: /orcamento?equipmentId=...) e precisam do escopo já resolvido.
const SESSION_BOUND_PREFIXES=['/orcamento']

const within=(pathname:string,prefix:string)=>pathname===prefix||pathname.startsWith(prefix+'/')
const identity=(href:string)=>href

function isPrivateAreaPath(pathname:string){
 if(pathname.startsWith('/admin'))return !PUBLIC_ADMIN_ENTRIES.some(entry=>pathname.startsWith(entry))
 return PRIVATE_PREFIXES.some(prefix=>within(pathname,prefix))
}

export interface PublicTenantStorage{getItem(key:string):string|null|Promise<string|null>;setItem(key:string,value:string):unknown}
/** Modo legado: a locadora pública vem de `?tenantSlug=` e é lembrada no armazenamento do host. */
export interface LegacyPublicTenantRoutingOptions{
 mode?:'legacy'
 pathname:string
 /** `tenantSlug` da URL atual; `null` sem parâmetro; `undefined` enquanto o host ainda não leu a URL desta rota. */
 explicitSlug:string|null|undefined
 storage:PublicTenantStorage
 /** Reflete a locadora lembrada ou selecionada na URL do host (web: router.replace; native: router.setParams). */
 applySlug:(slug:string)=>void
}
/**
 * Modo host: a locadora vem do host (`{slug}.<raiz>`) e é fixa para a árvore inteira. Não lê nem
 * grava armazenamento, não reescreve a URL e os hrefs saem sem `?tenantSlug=`.
 */
export interface HostPublicTenantRoutingOptions{
 mode:'host'
 /** Caminho informado pelo roteador; pode vir com o prefixo interno `/{slug}` do rewrite. */
 pathname:string
 /** Slug já validado pelo host (layout do segmento de locadora). */
 tenantSlug:string
}
export type PublicTenantRoutingOptions=LegacyPublicTenantRoutingOptions|HostPublicTenantRoutingOptions
/** Props prontas para `AppProviders`. */
export interface PublicTenantRouting{
 publicTenantSlug:string|null
 /** Área que exige sessão e locadora selecionada. */
 privateArea:boolean
 /** A árvore espera sessão e escopo do carrinho antes de renderizar; rotas públicas renderizam já no servidor. */
 awaitSession:boolean
 resolveHref:(href:string)=>string
 onTenantSelected:(selection:TenantContext)=>void
 /** Prefixo interno de rewrite (`/{slug}`) no modo host; `null` no legado. */
 internalRoutePrefix:string|null
}

function remember(storage:PublicTenantStorage,slug:string){try{void Promise.resolve(storage.setItem(PUBLIC_TENANT_STORAGE_KEY,slug)).catch(()=>{})}catch{/* armazenamento indisponível: segue sem memória */}}

/** Fonte única da área privada e da locadora pública para os hosts (web e native), no modo legado ou host. */
export function usePublicTenantRouting(options:PublicTenantRoutingOptions):PublicTenantRouting{
 const hostSlug=options.mode==='host'?options.tenantSlug:null
 const legacy=options.mode==='host'?null:options
 const explicitSlug=legacy?legacy.explicitSlug:undefined,storage=legacy?.storage??null,applySlug=legacy?.applySlug??null
 const internalRoutePrefix=internalRoutePrefixOf(hostSlug)
 // O roteador pode informar o caminho interno (/{slug}/...) no servidor e o visível no cliente: normaliza antes de decidir a área.
 const pathname=toVisiblePathname(options.pathname,internalRoutePrefix)
 const [remembered,setRemembered]=useState<string|null>(null)
 const publicTenantSlug=hostSlug??explicitSlug??remembered
 useEffect(()=>{
  if(hostSlug!==null||!storage||!applySlug)return
  if(explicitSlug===undefined)return
  if(explicitSlug){setRemembered(explicitSlug);remember(storage,explicitSlug);return}
  let active=true
  void Promise.resolve().then(()=>remembered??storage.getItem(PUBLIC_TENANT_STORAGE_KEY)).then(saved=>{if(active&&saved){setRemembered(saved);applySlug(saved)}}).catch(()=>{})
  return()=>{active=false}
 },[hostSlug,explicitSlug,remembered,pathname,storage,applySlug])
 const legacyResolveHref=useCallback((href:string)=>withPublicTenant(href,publicTenantSlug),[publicTenantSlug])
 const onTenantSelected=useCallback((selection:TenantContext)=>{
  // No modo host a locadora pública é a do host: a seleção não a troca nem é lembrada.
  if(hostSlug!==null||!storage||!applySlug)return
  const slug=selection.tenant.slug;setRemembered(slug);remember(storage,slug);applySlug(slug)
 },[hostSlug,storage,applySlug])
 const privateArea=isPrivateAreaPath(pathname)
 return {publicTenantSlug,privateArea,awaitSession:privateArea||SESSION_BOUND_PREFIXES.some(prefix=>within(pathname,prefix)),resolveHref:hostSlug!==null?identity:legacyResolveHref,onTenantSelected,internalRoutePrefix}
}
