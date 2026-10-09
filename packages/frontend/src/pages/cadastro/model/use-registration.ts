"use client";
import { useState } from "react";
import { formatCEP, formatCNPJ, formatCPF, formatPhoneNumber, registrationLoginUrl, registrationOAuthCallback } from "../../../features/cadastrar";
import { useApiClient } from "../../../shared/api";

export interface CadastroPageProps {
  callbackUrl?: string | null;
  push: (href: string) => void;
  socialProviders?: Array<"google" | "facebook">;
  signInProvider: (provider: "google" | "facebook", callbackUrl: string) => Promise<void>;
}
const initialForm = { name: "", email: "", password: "", confirmPassword: "", phone: "", cpf: "", cnpj: "", cep: "" };
export type RegistrationField = keyof typeof initialForm;

export function useRegistration({ callbackUrl = null, push, signInProvider }: CadastroPageProps) {
  const client = useApiClient();
  const [formData, setFormData] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const changeField = (name: RegistrationField, value: string) => {
    const formatted = name === "phone" ? formatPhoneNumber(value) : name === "cpf" ? formatCPF(value) : name === "cnpj" ? formatCNPJ(value) : name === "cep" ? formatCEP(value) : value;
    setFormData((previous) => ({ ...previous, [name]: formatted }));
  };
  const submit = async () => {
    if (isLoading) return;
    setError(null);
    if (!formData.name || !formData.email || !formData.password || !formData.phone) { setError("Por favor, preencha todos os campos obrigatórios."); return; }
    if (!formData.cpf && !formData.cnpj) { setError("Por favor, preencha o CPF ou CNPJ."); return; }
    if (formData.password !== formData.confirmPassword) { setError("As senhas não coincidem."); return; }
    if (formData.password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres."); return; }
    setIsLoading(true);
    try {
      await client.request("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name, email: formData.email, password: formData.password, phone: formData.phone, cpf: formData.cpf || undefined, cnpj: formData.cnpj || undefined, cep: formData.cep || undefined }),
      });
      push(registrationLoginUrl(callbackUrl));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Erro ao criar conta. Tente novamente.");
    } finally { setIsLoading(false); }
  };
  const handleSocialLogin = async (provider: "google" | "facebook") => {
    setIsLoading(true);
    setError(null);
    try { await signInProvider(provider, registrationOAuthCallback(callbackUrl)); }
    catch { setError("Falha ao fazer login com " + provider); }
    finally { setIsLoading(false); }
  };
  return { formData, changeField, showPassword, setShowPassword, showConfirmPassword, setShowConfirmPassword, error, isLoading, submit, handleSocialLogin };
}
