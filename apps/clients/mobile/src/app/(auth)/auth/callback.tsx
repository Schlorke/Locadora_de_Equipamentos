import { useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import { AuthCallbackPage, resolveAuthCallbackRedirect } from "@gb-locacoes/frontend/pages/auth-callback";
import { useMembershipSession } from "../../../host/auth/use-membership-session";
import { useHostNavigation } from "../../../host/use-host-navigation";

/** Destino do deep link de login social (Linking.createURL("/auth/callback")). */
export default function AuthCallbackScreen() {
  const { replace } = useHostNavigation();
  const getSession = useMembershipSession();
  const params = useLocalSearchParams<{ callbackUrl?: string }>();
  useEffect(() => {
    let active = true;
    void getSession().then((session) => {
      const href = resolveAuthCallbackRedirect({ status: session?.user ? "authenticated" : "unauthenticated", hasUser: Boolean(session?.user), role: session?.user?.role, callbackUrl: params.callbackUrl || null });
      if (active && href) void replace(href);
    }).catch(() => { if (active) void replace("/login"); });
    return () => { active = false; };
  }, [getSession, replace, params.callbackUrl]);
  return <AuthCallbackPage />;
}
