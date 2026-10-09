'use client'
import {createContext,useContext,type ReactNode} from 'react'
export type ApplicationSession={user:{id?:string;name?:string|null;email?:string|null;role?:string|null;image?:string|null};expires?:string}|null
/** Sessão como o provedor de identidade a entrega (getSession no cliente ou leitura feita pelo host no servidor). */
export type SessionSnapshot=Omit<NonNullable<ApplicationSession>,"user"> & {user?:NonNullable<ApplicationSession>["user"]}|null
export interface SessionAdapter {getSession():Promise<SessionSnapshot>;signOut():Promise<unknown>}
export interface SessionState {data:ApplicationSession;status:'loading'|'authenticated'|'unauthenticated';update:(data?:unknown)=>Promise<ApplicationSession>;signOut:(options?:{callbackUrl?:string})=>Promise<void>}
/** Normaliza o snapshot do provedor: sem usuário significa visitante. */
export function toApplicationSession(snapshot:SessionSnapshot|undefined):ApplicationSession{return snapshot?.user?{...snapshot,user:snapshot.user}:null}
/** Só há sessão autenticada quando o provedor identifica o usuário. */
export function sessionStatusOf(session:ApplicationSession):Exclude<SessionState['status'],'loading'>{return session?.user?.id?'authenticated':'unauthenticated'}
const Context=createContext<SessionState|null>(null)
export function ApplicationSessionProvider({value,children}:{value:SessionState;children:ReactNode}){return <Context.Provider value={value}>{children}</Context.Provider>}
export function useSession(){const state=useContext(Context);if(!state)throw new Error('A sessão precisa ser fornecida pelo bootstrap do host.');return state}
export function useSignOut(){return useSession().signOut}
