import { useEffect, useMemo, useRef } from "react";
import { useTenantContext, type MembershipRole } from "@gb-locacoes/frontend/app";
import { hostAuth } from "./client";
import { withMembershipRole } from "./membership-session";

/**
 * getSession estável para as páginas de entrada, com o papel da locadora selecionada no runtime.
 * O papel é lido no momento da chamada para não reexecutar os efeitos das páginas quando a seleção
 * chega depois.
 */
export function useMembershipSession() {
  const selectedRole = useTenantContext()?.role ?? null;
  const role = useRef<MembershipRole | null>(selectedRole);
  useEffect(() => {
    role.current = selectedRole;
  }, [selectedRole]);
  return useMemo(() => withMembershipRole(hostAuth.getSession, () => role.current), []);
}
