"use client";

import { Alert, AlertDescription, AlertTitle, Button, Input, Label, Stack } from "../../../shared/ui";
import type { CredentialsSignInModel } from "../model/use-credentials-sign-in";

export function CredentialsFields({ model }: { model: CredentialsSignInModel }) {
  return (
    <Stack gap="md">
      {model.error ? <Alert><AlertTitle>Erro de Login</AlertTitle><AlertDescription>{model.error}</AlertDescription></Alert> : null}
      <Stack gap="sm">
        <Label>E-mail</Label>
        <Input type="email" placeholder="seu@email.com" value={model.email} onChangeText={model.setEmail} disabled={model.isLoading} />
      </Stack>
      <Stack gap="sm">
        <Label>Senha</Label>
        <Input type={model.showPassword ? "text" : "password"} placeholder="Digite sua senha" value={model.password} onChangeText={model.setPassword} disabled={model.isLoading} />
        <Button variant="ghost" disabled={model.isLoading} onClick={() => model.setShowPassword(!model.showPassword)}>
          {model.showPassword ? "Ocultar senha" : "Mostrar senha"}
        </Button>
      </Stack>
      <Button disabled={model.isLoading} onClick={() => { void model.submit(); }}>
        {model.isLoading ? "Entrando..." : "Entrar no Sistema"}
      </Button>
    </Stack>
  );
}
