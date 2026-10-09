'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import type {TenantContext} from '../../../entities/organizacao'
import {HttpError,useApiClient} from '../../../shared/api'

/** Rota do vínculo com a locadora do host: nunca lista os vínculos com outras locadoras. */
export const CURRENT_MEMBERSHIP_PATH='/api/auth/organizations/current'

/**
 * Vínculo com a locadora do host (modo host, ADR adr-tenant-hosts D9). A locadora vem do host; não há seletor.
 * - `member`: vínculo ativo; `no-membership` (404): falta o vínculo explícito (tela de vínculo);
 * - `forbidden` (403): vínculo suspenso ou revogado; `error`: falha ao consultar.
 */
export type HostMembershipStatus='idle'|'loading'|'member'|'no-membership'|'forbidden'|'error'
export interface HostTenantMembership{membership:TenantContext|null;status:HostMembershipStatus;error:string|null;refresh:()=>Promise<void>}
type State={userId:string|null;membership:TenantContext|null;status:HostMembershipStatus;error:string|null}
const IDLE:State={userId:null,membership:null,status:'idle',error:null}

/** `revision` muda quando o host pede nova consulta (`update()` da sessão, ex.: depois do vínculo). */
export function useHostTenantMembership(userId:string|null,{revision=0}:{revision?:number}={}):HostTenantMembership{
 const api=useApiClient(),version=useRef(0),[state,setState]=useState<State>(IDLE)
 const refresh=useCallback(async()=>{const current=++version.current
  if(!userId){setState(IDLE);return}
  // Revalida mantendo o que já se sabe do mesmo usuário: a área aberta não fecha a cada navegação.
  setState(previous=>previous.userId===userId&&previous.status!=='loading'?previous:{userId,membership:null,status:'loading',error:null})
  try{const result=await api.request<{membership:TenantContext}>(CURRENT_MEMBERSHIP_PATH);if(current===version.current)setState({userId,membership:result.membership,status:'member',error:null})}
  catch(e){if(current!==version.current)return
   const status=e instanceof HttpError?e.status:0,message=e instanceof Error?e.message:null
   if(status===404)setState({userId,membership:null,status:'no-membership',error:null})
   else if(status===403)setState({userId,membership:null,status:'forbidden',error:message})
   // Falha transitória numa revalidação não derruba um vínculo já confirmado.
   else setState(previous=>previous.userId===userId&&previous.status==='member'?previous:{userId,membership:null,status:'error',error:message??'Não foi possível verificar seu vínculo com esta locadora.'})}
 },[api,userId])
 useEffect(()=>{void refresh();return()=>{version.current++}},[refresh,revision])
 const fresh=state.userId===userId
 return {membership:fresh?state.membership:null,status:!userId?'idle':fresh?state.status:'loading',error:fresh?state.error:null,refresh}
}
