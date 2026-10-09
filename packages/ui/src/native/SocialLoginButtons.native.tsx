import { useState } from "react";
import { Text, View } from "react-native";
import { space } from "@gb-locacoes/design-tokens";
import { Button } from "./Button.native";
import type { SocialDividerProps, SocialLoginButtonsProps } from "../contract/social-login-buttons";

export function SocialLoginButtons({ isLoading = false, variant = "default", onSignIn, callbackUrl, onError }: SocialLoginButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const signIn = async (provider: "google" | "facebook") => {
    setLoadingProvider(provider);
    try { await onSignIn(provider, callbackUrl); }
    catch { onError?.("Falha ao fazer login com " + (provider === "google" ? "Google" : "Facebook")); }
    finally { setLoadingProvider(null); }
  };
  return <View style={{ gap: space.md }}>
    <Button variant="outline" disabled={isLoading || loadingProvider !== null} onClick={() => { void signIn("google"); }}>{loadingProvider === "google" ? "Entrando..." : variant === "compact" ? "G" : "Google"}</Button>
    <Button variant="outline" disabled={isLoading || loadingProvider !== null} onClick={() => { void signIn("facebook"); }}>{loadingProvider === "facebook" ? "Entrando..." : variant === "compact" ? "F" : "Facebook"}</Button>
  </View>;
}
export function SocialDivider({ children }: SocialDividerProps) {
  return <View><Text>{children}</Text></View>;
}
