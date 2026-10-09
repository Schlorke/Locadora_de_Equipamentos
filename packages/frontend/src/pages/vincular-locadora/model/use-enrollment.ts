"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TenantContext } from "../../../entities/organizacao";
import { useSession } from "../../../entities/sessao";
import { CURRENT_MEMBERSHIP_PATH } from "../../../features/selecionar-locadora";
import { HttpError, useApiClient } from "../../../shared/api";

/** Cria o vínculo com a locadora do host (a locadora vem do host, nunca do cliente). */
export const ENROLL_PATH = "/api/client/enroll";

export type EnrollmentStatus =
  | "checking"
  | "signed-out"
  | "ready"
  | "submitting"
  | "enrolled"
  | "already-member"
  | "forbidden"
  | "error";

/**
 * Tela de vínculo (ADR adr-tenant-hosts D9): o cliente logado consente e vira CLIENTE da locadora do host.
 * Já vinculado: nada a fazer. Vínculo suspenso ou revogado: não é reativado por aqui. Depois do vínculo, a sessão é
 * revalidada para a área do cliente enxergar o vínculo novo.
 */
export function useEnrollment() {
  const api = useApiClient();
  const session = useSession();
  const userId = session.data?.user?.id ?? null;
  const [status, setStatus] = useState<EnrollmentStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (session.status === "loading") {
      setStatus("checking");
      return;
    }
    if (!userId) {
      setStatus("signed-out");
      return;
    }
    let active = true;
    setStatus((current) => (current === "enrolled" ? current : "checking"));
    setError(null);
    api
      .request<{ membership: TenantContext }>(CURRENT_MEMBERSHIP_PATH)
      .then(() => {
        if (active) setStatus((current) => (current === "enrolled" ? current : "already-member"));
      })
      .catch((e: unknown) => {
        if (!active) return;
        const code = e instanceof HttpError ? e.status : 0;
        if (code === 404) setStatus("ready");
        else if (code === 403) setStatus("forbidden");
        else if (code === 401) setStatus("signed-out");
        else {
          setStatus("error");
          setError(e instanceof Error ? e.message : "Não foi possível verificar seu vínculo.");
        }
      });
    return () => {
      active = false;
    };
  }, [api, session.status, userId, attempt]);

  const submit = useCallback(async () => {
    if (busy.current || status !== "ready") return;
    if (!consent) {
      setError("Marque a autorização para vincular sua conta.");
      return;
    }
    busy.current = true;
    setStatus("submitting");
    setError(null);
    try {
      await api.request(ENROLL_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true }),
      });
      setStatus("enrolled");
      // Revalida a sessão: o host consulta o vínculo de novo e a área do cliente abre.
      await session.update().catch(() => null);
    } catch (e) {
      const code = e instanceof HttpError ? e.status : 0;
      if (code === 403) setStatus("forbidden");
      else if (code === 401) setStatus("signed-out");
      else {
        setStatus("ready");
        setError(e instanceof Error ? e.message : "Não foi possível vincular sua conta.");
      }
    } finally {
      busy.current = false;
    }
  }, [api, consent, session, status]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { status, error, consent, setConsent, submit, retry };
}
