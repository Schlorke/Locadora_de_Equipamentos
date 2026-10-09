import { useMemo } from "react";
import { useRouter } from "expo-router";
import { hostAuth } from "./auth/client";
import { createAreaExits } from "./area-exits";

export function useAreaExits() {
  const router = useRouter();
  return useMemo(() => createAreaExits({ router: { canGoBack: () => router.canGoBack(), back: () => router.back(), replace: (href) => router.replace(href) }, signOut: hostAuth.signOut }), [router]);
}
