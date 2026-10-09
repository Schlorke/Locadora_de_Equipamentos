"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { TenantContext } from "@gb-locacoes/contracts";

const TenantSelection = createContext<TenantContext | null | undefined>(undefined);

export function TenantProvider({ value, children }: { value: TenantContext | null; children: ReactNode }) {
  return <TenantSelection.Provider value={value}>{children}</TenantSelection.Provider>;
}

export function useTenantContext(): TenantContext | null {
  const context = useContext(TenantSelection);
  if (context === undefined) throw new Error("TenantProvider deve receber a seleção validada ou null explicitamente.");
  return context;
}
