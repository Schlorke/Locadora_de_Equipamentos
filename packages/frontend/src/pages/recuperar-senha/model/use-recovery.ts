"use client";
import { useState } from "react";
import { useApiClient } from "../../../shared/api";

export function useRecovery() {
  const client = useApiClient();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (isLoading) return;
    setError(null);
    if (!email) { setError("Por favor, digite seu email."); return; }
    setIsLoading(true);
    try {
      await client.request("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      setIsSuccess(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Erro ao enviar email de recuperação. Tente novamente.");
    } finally { setIsLoading(false); }
  };
  return { email, setEmail, isLoading, isSuccess, setIsSuccess, error, submit };
}
