"use client";

import { CredentialsFields } from "../../../features/entrar";
import { Button, Card, Link, Stack, Text } from "../../../shared/ui";
import { useEntrarModel, type EntrarPageProps } from "../model/use-entrar-model";
import { useMarcaDoAcesso } from "../../../entities/organizacao";

export function EntrarPage(props: EntrarPageProps) {
  const model = useEntrarModel(props);
  // Marca e rodapé da própria locadora (cartão público), nunca os da GB (achado 143).
  const marca = useMarcaDoAcesso();
  return (
    <Stack padding="lg">
      <Card>
        <Stack gap="lg">
          <Text size="xl" heading={1}>{marca.sigla}</Text>
          <Text size="lg" heading={2}>Entrar</Text>
          <Text tone="muted">Faça login com suas credenciais ou redes sociais</Text>
          <CredentialsFields model={model} />
          {(props.socialProviders ?? ["google", "facebook"]).map((provider) => <Button key={provider} variant="outline" disabled={model.isLoading} onClick={() => { void model.handleSocialLogin(provider); }}>{provider === "google" ? "Google" : "Facebook"}</Button>)}
          <Text tone="muted">Não tem uma conta?</Text>
          <Link href="/cadastro">Cadastre-se</Link>
          <Link href="/recuperar-senha">Esqueceu sua senha?</Link>
          <Text size="sm" tone="muted">{marca.rodape}</Text>
        </Stack>
      </Card>
    </Stack>
  );
}
