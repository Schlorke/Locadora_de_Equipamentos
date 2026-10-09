'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import type {TenantContext,OrganizationsResponse} from '../../../entities/organizacao'
import {useApiClient} from '../../../shared/api'
import {keyValueStorage} from '../../../shared/storage'
const selectionKey=(userId:string)=>'selected-tenant:'+encodeURIComponent(userId)
export function useTenantSelection(userId:string|null,{persistSelection=false}:{persistSelection?:boolean}={}){
 const api=useApiClient(),revision=useRef(0),[selection,setSelection]=useState<TenantContext|null>(null),[memberships,setMemberships]=useState<TenantContext[]>([]),[loadedUser,setLoadedUser]=useState<string|null>(null),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(false),busy=useRef(false)
 const previousUser=useRef<string|null>(userId)
 useEffect(()=>{const previous=previousUser.current;previousUser.current=userId;if(persistSelection&&previous&&previous!==userId)void keyValueStorage.removeItem(selectionKey(previous))},[userId,persistSelection])
 const refresh=useCallback(async()=>{const version=++revision.current;setSelection(null);setMemberships([]);setError(null);setLoadedUser(null);if(!userId){setLoading(false);return}setLoading(true)
 try{const [list,current]=await Promise.all([api.request<OrganizationsResponse>('/api/auth/organizations'),api.request<{selection:TenantContext|null}>('/api/auth/organizations/selection')]);let validated=current.selection
 if(!validated&&persistSelection){const saved=await keyValueStorage.getItem(selectionKey(userId));if(saved){try{validated=(await api.request<{selection:TenantContext}>('/api/auth/organizations/selection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId:saved})})).selection}catch{await keyValueStorage.removeItem(selectionKey(userId))}}}
 if(version!==revision.current)return;setMemberships(list.memberships);setSelection(validated);setLoadedUser(userId)
 }catch(e){if(version===revision.current){setError(e instanceof Error?e.message:'Não foi possível carregar suas locadoras.');setLoadedUser(userId)}}finally{if(version===revision.current)setLoading(false)}
 },[api,userId,persistSelection])
 useEffect(()=>{void refresh();return()=>{revision.current++}},[refresh])
 const select=useCallback(async(tenantId:string)=>{if(!userId||busy.current)return null;busy.current=true;setLoading(true);setError(null);const version=++revision.current;setSelection(null)
 try{const result=await api.request<{selection:TenantContext}>('/api/auth/organizations/selection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId})});if(version!==revision.current)return null;if(persistSelection)await keyValueStorage.setItem(selectionKey(userId),result.selection.tenant.id);if(version!==revision.current)return null;setSelection(result.selection);setLoadedUser(userId);return result.selection
 }catch(e){if(version===revision.current)setError(e instanceof Error?e.message:'Não foi possível selecionar a locadora.');return null}finally{busy.current=false;if(version===revision.current)setLoading(false)}},[api,userId,persistSelection])
 const clear=useCallback(async()=>{++revision.current;setSelection(null);if(userId&&persistSelection)await keyValueStorage.removeItem(selectionKey(userId));await api.request('/api/auth/organizations/selection',{method:'DELETE'})},[api,userId,persistSelection])
 return {selection:loadedUser===userId?selection:null,memberships:loadedUser===userId?memberships:[],loading:loading||!!userId&&loadedUser!==userId,error,refresh,select,clear}
}
