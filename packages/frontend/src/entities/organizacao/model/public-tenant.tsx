"use client";
import {createContext,useContext,type ReactNode} from "react";
const PublicTenant=createContext<string|null>(null);
export function PublicTenantProvider({value,children}:{value:string|null;children:ReactNode}) {return <PublicTenant.Provider value={value?.trim()||null}>{children}</PublicTenant.Provider>;}
export function usePublicTenantSlug(){return useContext(PublicTenant);}
