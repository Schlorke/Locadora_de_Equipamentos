'use client'
import {createContext,useContext,type ReactNode} from 'react'
export type Navigate=(href:string)=>void|Promise<void>
const Context=createContext<{navigate:Navigate;resolveHref?:(href:string)=>string}|undefined>(undefined)
export function NavigationProvider({navigate,resolveHref,children}:{navigate:Navigate;resolveHref?:(href:string)=>string;children:ReactNode}){return <Context.Provider value={{navigate,resolveHref}}>{children}</Context.Provider>}
export function useNavigate(){return useContext(Context)?.navigate}
export function useResolvedHref(href:string){return useContext(Context)?.resolveHref?.(href)??href}
