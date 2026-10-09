"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from '../../../entities/sessao';
import {
  ADMIN_AGING_URL,
  ADMIN_BADGES_INVALIDATE_EVENT,
  ADMIN_BADGES_POLLING_MS,
  ADMIN_BADGE_URL,
  DEFAULT_ADMIN_BADGES,
  mergeAdminBadgePayloads,
  sumAdminBadges,
  type AdminBadges,
} from "./contagem";

interface UseAdminBadgesOptions {
  pollingInterval?: number;
  disablePolling?: boolean;
}

export function useAdminBadges(options?: UseAdminBadgesOptions) {
  const { pollingInterval = ADMIN_BADGES_POLLING_MS, disablePolling = false } = options ?? {};
  const { data: session, status } = useSession();

  const [badges, setBadges] = useState<AdminBadges>(DEFAULT_ADMIN_BADGES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBadges = useCallback(async () => {
    if (status !== "authenticated") {
      setIsLoading(false);
      return;
    }

    if (session?.user?.role === "FINANCIAL") {
      try {
        setError(null);
        const agingRes = await fetch(ADMIN_AGING_URL);
        if (agingRes.ok) {
          const agingData = await agingRes.json();
          setBadges(
            mergeAdminBadgePayloads({
              role: "FINANCIAL",
              badgesOk: false,
              badgesBody: null,
              agingOk: true,
              agingBody: agingData,
            }),
          );
        } else {
          setBadges(
            mergeAdminBadgePayloads({
              role: "FINANCIAL",
              badgesOk: false,
              badgesBody: null,
              agingOk: false,
              agingBody: null,
            }),
          );
        }
      } catch {
        setBadges(DEFAULT_ADMIN_BADGES);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      setError(null);
      const [response, agingRes] = await Promise.all([fetch(ADMIN_BADGE_URL), fetch(ADMIN_AGING_URL)]);

      const badgesBody = response.ok ? await response.json() : null;
      const agingBody = agingRes.ok ? await agingRes.json() : null;
      setBadges(
        mergeAdminBadgePayloads({
          role: session?.user?.role ?? undefined,
          badgesOk: response.ok,
          badgesBody,
          agingOk: agingRes.ok,
          agingBody,
        }),
      );
    } catch (err) {
      console.error("[useAdminBadges] Erro ao carregar:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.role, status]);

  useEffect(() => {
    if (status === "unauthenticated") {
      fetchedRef.current = false;
    }
  }, [status]);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      setIsLoading(false);
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchBadges();
  }, [status, fetchBadges]);

  useEffect(() => {
    if (disablePolling || status !== "authenticated") return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      fetchBadges();
    }, pollingInterval);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [disablePolling, pollingInterval, status, fetchBadges]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchBadges();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [status, fetchBadges]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const onInvalidate = () => {
      fetchBadges();
    };
    window.addEventListener(ADMIN_BADGES_INVALIDATE_EVENT, onInvalidate);
    return () => window.removeEventListener(ADMIN_BADGES_INVALIDATE_EVENT, onInvalidate);
  }, [status, fetchBadges]);

  const refresh = useCallback(() => {
    fetchedRef.current = false;
    setIsLoading(true);
    fetchBadges();
  }, [fetchBadges]);

  return {
    badges,
    totalCount: sumAdminBadges(badges),
    isLoading,
    error,
    refresh,
  };
}

export type { AdminBadges };
