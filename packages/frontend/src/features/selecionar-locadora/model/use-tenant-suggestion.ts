'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import type {TenantContext} from '../../../entities/organizacao'
import {readSuggestedTenantSlug} from './suggested-tenant'

export interface TenantSuggestion{
 /** Locadora sugerida pela URL, com vínculo do usuário e diferente da seleção atual; `null` sem nada a confirmar. */
 pending:TenantContext|null
 accept:()=>void
 dismiss:()=>void
}

/**
 * Confirmação do `?locadora=` no painel (D8). A sugestão só aparece quando o usuário tem vínculo com a locadora
 * sugerida e ela diverge da seleção atual; slug desconhecido é ignorado sem revelar nada. Confirmar seleciona pela
 * rota explícita (membership validada no servidor); dispensar mantém a seleção.
 *
 * Vida da sugestão:
 * - guardada até ser tratada: uma navegação para URL sem o parâmetro (ex.: o índice /admin trocando a URL pelo
 *   dashboard) não a apaga; só um `?locadora=` novo a substitui;
 * - tratada quando confirmada, dispensada ou quando a seleção chega à locadora sugerida por qualquer caminho (ex.: o
 *   próprio seletor): voltar depois a outra locadora não repete a pergunta;
 * - da conta da sessão: a lista de locadoras sumir (saída, outra conta) descarta a sugestão guardada e o que foi
 *   tratado; a conta seguinte só recebe a sugestão que a URL traz depois disso (a atual, quando a lista dela carrega).
 */
export function useTenantSuggestion({memberships,selection,loading,select,readKey}:{memberships:TenantContext[];selection:TenantContext|null;loading:boolean;select:(_tenantId:string)=>unknown;readKey?:string}):TenantSuggestion{
 const [slug,setSlug]=useState<string|null>(null),[handled,setHandled]=useState<string|null>(null)
 // Conta da sessão: a lista de locadoras carregada. `useTenantSelection` a esvazia na saída e na troca de conta.
 const accountLoaded=memberships.length>0,wasLoaded=useRef(accountLoaded)
 useEffect(()=>{
  if(wasLoaded.current===accountLoaded)return
  wasLoaded.current=accountLoaded
  if(!accountLoaded){setSlug(null);setHandled(null)}
  else setSlug(current=>current??readSuggestedTenantSlug())
 },[accountLoaded])
 // Lido depois da montagem (o servidor e o primeiro render do cliente saem iguais) e a cada rota (`readKey`).
 useEffect(()=>{const read=readSuggestedTenantSlug();if(read!==null)setSlug(read)},[readKey])
 const reached=slug!==null&&selection?.tenant.slug===slug
 useEffect(()=>{if(reached)setHandled(slug)},[reached,slug])
 const candidate=!loading&&slug!==null&&slug!==handled?memberships.find(item=>item.tenant.slug===slug)??null:null
 const pending=candidate&&selection?.tenant.id!==candidate.tenant.id?candidate:null
 const accept=useCallback(()=>{if(!pending)return;setHandled(pending.tenant.slug);void select(pending.tenant.id)},[pending,select])
 const dismiss=useCallback(()=>{if(slug!==null)setHandled(slug)},[slug])
 return {pending,accept,dismiss}
}
