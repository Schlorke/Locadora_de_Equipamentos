import { useState } from "react";
import { ScrollView } from "react-native";
import { Alert, AlertDescription, Button, Card, Stack, Text } from "@gb-locacoes/ui";

export interface UnavailableAreaAction {
  label: string;
  variant?: "default" | "outline";
  run: () => void | Promise<void>;
}

/**
 * Destino que o app ainda não implementa. Diz isso com clareza e oferece saídas reais; não
 * simula dados nem funcionalidade da área. Composição de componentes do design system.
 */
export function UnavailableArea({ title, description, actions }: { title: string; description: string; actions: UnavailableAreaAction[] }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: UnavailableAreaAction) => {
    setError(null);
    setBusy(true);
    try {
      await action.run();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a ação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Stack padding="lg">
        <Card>
          <Stack gap="lg">
            <Text size="lg" heading={1}>{title}</Text>
            <Text tone="muted">{description}</Text>
            {error ? <Alert><AlertDescription>{error}</AlertDescription></Alert> : null}
            {actions.map((action) => (
              <Button key={action.label} variant={action.variant ?? "default"} disabled={busy} onClick={() => { void run(action); }}>
                {action.label}
              </Button>
            ))}
          </Stack>
        </Card>
      </Stack>
    </ScrollView>
  );
}
