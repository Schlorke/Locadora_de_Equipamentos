import { useMemo } from "react";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { createHostNavigation, type HostNavigation } from "./navigation";

/**
 * Navegação imperativa das telas do host (redirecionamentos de login/admin/callback). Usa o mesmo
 * adaptador do NavigationProvider do _layout, sem o resolvedor de locadora pública: o _layout já
 * restaura o tenantSlug lembrado quando a URL chega sem ele.
 */
export function useHostNavigation(): HostNavigation {
  const router = useRouter();
  return useMemo(() => createHostNavigation({ router, openURL: Linking.openURL }), [router]);
}
