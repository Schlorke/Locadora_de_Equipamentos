"use client";

import { useCallback } from "react";
import { resolveEntrarSessionRedirect, resolveEntrarSubmitRedirect, useCredentialsSignIn, type AuthSession, type CredentialsAdapter } from "../../../features/entrar";

export interface EntrarPageProps extends CredentialsAdapter {
  socialProviders?: Array<"google" | "facebook">;
  signInProvider: (provider: "google" | "facebook") => Promise<void>;
  push: (href: string) => void;
  refresh?: () => void;
  errorParam?: string | null;
}

export function useEntrarModel(props: EntrarPageProps) {
  const { push, refresh, signInProvider } = props;
  const onAuthenticated = useCallback((session: AuthSession, email: string, phase: "session" | "submit") => {
    push(phase === "session"
      ? resolveEntrarSessionRedirect(email, session?.user?.role)
      : resolveEntrarSubmitRedirect(email));
    if (phase === "submit") refresh?.();
  }, [push, refresh]);
  const model = useCredentialsSignIn({ ...props, onAuthenticated });
  const handleSocialLogin = async (provider: "google" | "facebook") => {
    model.setIsLoading(true);
    model.setError(null);
    try {
      await signInProvider(provider);
    } catch {
      model.setError("Falha ao fazer login com " + provider);
    } finally {
      model.setIsLoading(false);
    }
  };
  return { ...model, handleSocialLogin };
}
