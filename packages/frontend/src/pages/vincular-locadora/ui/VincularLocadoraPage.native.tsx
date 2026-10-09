import { Stack, Text } from "../../../shared/ui";

export interface VincularLocadoraPageProps {
  tenantName?: string | null;
}

/**
 * No app, o vínculo não acontece: a API só vincula pelo host da locadora (o app fala com o host `app`, que responde
 * 409 `TENANT_REQUIRED`). A tela diz isso em vez de oferecer um botão que não funcionaria; o fluxo do app depende do
 * desenho do Lote 7b.
 */
export function VincularLocadoraPage({ tenantName }: VincularLocadoraPageProps) {
  const name = tenantName?.trim() || "a locadora";
  return (
    <Stack padding="md" gap="sm">
      <Text heading={2}>Vincular sua conta</Text>
      <Text>{`O vínculo com ${name} é feito pelo site da locadora, com o seu consentimento. No aplicativo, esta etapa ainda não está disponível.`}</Text>
    </Stack>
  );
}
