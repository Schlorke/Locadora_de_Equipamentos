"use client";
import { PLATFORM } from "@gb-locacoes/contracts/platform";
import { Alert, AlertDescription, Button, Card, Input, Label, Link, Stack, Text } from "../../../shared/ui";
import { useMarcaDoAcesso } from "../../../entities/organizacao";
import { useRecovery } from "../model/use-recovery";
import type { RecuperarSenhaPageProps } from "./contract";

export function RecuperarSenhaPage({ shell = "storefront" }: RecuperarSenhaPageProps) {
  const model = useRecovery();
  // Vitrine: sigla da própria locadora (cartão público), nunca a de outra locadora (achados 143 e 146).
  const marca = useMarcaDoAcesso();
  return <Stack padding="lg"><Card><Stack gap="lg">
    <Text size="xl" heading={1}>{shell === "platform" ? PLATFORM.displayName : marca.sigla}</Text>
    <Text size="lg" heading={2}>{model.isSuccess ? "Email Enviado!" : "Recuperar Senha"}</Text>
    {model.isSuccess ? <>
      <Text>Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.</Text>
      <Text>{["Enviamos um link de recuperação para ", model.email]}</Text>
      <Text size="sm" tone="muted">O link expira em 1 hora. Se você não receber o email, verifique sua pasta de spam.</Text>
      <Button variant="outline" onClick={() => { model.setIsSuccess(false); model.setEmail(""); }}>Enviar Novamente</Button>
    </> : <>
      <Text tone="muted">Digite seu email para receber instruções de recuperação</Text>
      {model.error ? <Alert><AlertDescription>{model.error}</AlertDescription></Alert> : null}
      <Label>E-mail</Label>
      <Input type="email" value={model.email} onChangeText={model.setEmail} placeholder="seu@email.com" disabled={model.isLoading} />
      <Button disabled={model.isLoading} onClick={() => { void model.submit(); }}>{model.isLoading ? "Enviando..." : "Enviar Link de Recuperação"}</Button>
    </>}
    <Link href="/login">Voltar ao Login</Link>
  </Stack></Card></Stack>;
}
