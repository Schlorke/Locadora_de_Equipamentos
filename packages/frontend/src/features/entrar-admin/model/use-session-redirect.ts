"use client";

import { useEffect, useRef } from "react";
import { useSession } from "../../../entities/sessao";
import { resolveAdminIndexRedirect, resolveAdminLoginRedirect } from "./redirect";

/** Navegação de substituição fornecida pelo host (o destino não deve ficar no histórico). */
export type AdminRedirectNavigate = (href: string) => void | Promise<void>;

function useApplyRedirect(href: string | null, replace: AdminRedirectNavigate) {
  const applied = useRef<string | null>(null);
  useEffect(() => {
    if (!href || applied.current === href) return;
    applied.current = href;
    void replace(href);
  }, [href, replace]);
}

/** /admin: sessão do runtime → dashboard, login admin ou espera. Retorna o destino calculado. */
export function useAdminIndexRedirect(replace: AdminRedirectNavigate): string | null {
  const { status, data } = useSession();
  const href = resolveAdminIndexRedirect(status, Boolean(data?.user));
  useApplyRedirect(href, replace);
  return href;
}

/** /admin/login: espera a sessão do runtime e segue para o login universal. */
export function useAdminLoginRedirect(replace: AdminRedirectNavigate): string | null {
  const { status } = useSession();
  const href = resolveAdminLoginRedirect(status);
  useApplyRedirect(href, replace);
  return href;
}
