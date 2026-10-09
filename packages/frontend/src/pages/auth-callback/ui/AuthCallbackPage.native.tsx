import { Stack, Text } from "../../../shared/ui";

export function AuthCallbackPage() {
  return <Stack padding="xl"><Text size="lg">Entrando...</Text><Text tone="muted">Aguarde enquanto redirecionamos você</Text></Stack>;
}
export function AuthCallbackLoading() {
  return <Stack padding="xl"><Text size="lg">Carregando...</Text></Stack>;
}
