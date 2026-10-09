"use client";
import { useState } from "react";
import { useApiClient } from "../../../shared/api";

export function useResetPassword(token = "") {
  const client = useApiClient();
  const resetToken = token.trim();
  const hasToken = resetToken.length > 0;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (isLoading) return;
    setError(null);
    if (!hasToken) { setError("Link invalido ou expirado. Solicite um novo link."); return; }
    if (!password || !confirmPassword) { setError("Por favor, preencha todos os campos."); return; }
    if (password.length < 6) { setError("Senha deve ter pelo menos 6 caracteres."); return; }
    if (password !== confirmPassword) { setError("As senhas nao conferem."); return; }
    setIsLoading(true);
    try {
      await client.request("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resetToken, password }) });
      setIsSuccess(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Erro ao redefinir senha. Tente novamente.");
    } finally { setIsLoading(false); }
  };
  return { hasToken, password, setPassword, confirmPassword, setConfirmPassword, showPassword, setShowPassword, showConfirmPassword, setShowConfirmPassword, isLoading, isSuccess, error, submit };
}
