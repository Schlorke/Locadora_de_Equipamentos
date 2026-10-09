"use client";
import { PLATFORM } from "@gb-locacoes/contracts/platform";
import { Alert, AlertDescription, Button, Card, Input, Label, Link, Stack, Text } from "../../../shared/ui";
import { useMarcaDoAcesso } from "../../../entities/organizacao";
import { useResetPassword } from "../model/use-reset-password";
import type { ResetPasswordPageProps } from "./contract";

export function ResetPasswordPage({ token = "", shell = "storefront" }: ResetPasswordPageProps) {
  const model = useResetPassword(token);
  // Vitrine: sigla da própria locadora (cartão público), nunca a de outra locadora (achados 143 e 146).
  const marca = useMarcaDoAcesso();
  return <Stack padding="lg"><Card><Stack gap="lg">
    <Text size="xl" heading={1}>{shell === "platform" ? PLATFORM.displayName : marca.sigla}</Text>
    <Text size="lg" heading={2}>{!model.hasToken ? "Link invalido" : model.isSuccess ? "Senha redefinida" : "Redefinir Senha"}</Text>
    {!model.hasToken ? <>
      <Text>Este link nao e valido ou expirou. Solicite um novo link de recuperacao.</Text>
      <Link href="/recuperar-senha">Solicitar novo link</Link>
    </> : model.isSuccess ? <Text>Sua senha foi atualizada com sucesso. Voce ja pode fazer login novamente.</Text> : <>
      {model.error ? <Alert><AlertDescription>{model.error}</AlertDescription></Alert> : null}
      <Label>Nova Senha</Label>
      <Input type={model.showPassword ? "text" : "password"} value={model.password} onChangeText={model.setPassword} disabled={model.isLoading} placeholder="Digite sua nova senha" />
      <Button variant="ghost" disabled={model.isLoading} onClick={() => model.setShowPassword(!model.showPassword)}>{model.showPassword ? "Ocultar senha" : "Mostrar senha"}</Button>
      <Label>Confirmar Senha</Label>
      <Input type={model.showConfirmPassword ? "text" : "password"} value={model.confirmPassword} onChangeText={model.setConfirmPassword} disabled={model.isLoading} placeholder="Confirme sua nova senha" />
      <Button variant="ghost" disabled={model.isLoading} onClick={() => model.setShowConfirmPassword(!model.showConfirmPassword)}>{model.showConfirmPassword ? "Ocultar confirmação" : "Mostrar confirmação"}</Button>
      <Button disabled={model.isLoading} onClick={() => { void model.submit(); }}>{model.isLoading ? "Redefinindo..." : "Redefinir Senha"}</Button>
    </>}
    <Link href="/login">Voltar ao Login</Link>
  </Stack></Card></Stack>;
}
