import { View, Text, ActivityIndicator } from "react-native";
import { useTheme } from "@gb-locacoes/ui";
import { space } from "@gb-locacoes/design-tokens";
import { useAdminIndexRedirect, type AdminRedirectNavigate } from "../../../features/entrar-admin";

export interface AdminIndexPageProps {
  /** Navegação de substituição do host; recebe o destino calculado pela sessão do runtime. */
  replace: AdminRedirectNavigate;
}

export function AdminIndexPage({ replace }: AdminIndexPageProps) {
  const theme = useTheme();
  useAdminIndexRedirect(replace);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, backgroundColor: theme.background }}>
      <ActivityIndicator color={theme.primary} />
      <Text accessibilityRole="status" style={{ color: theme.textMuted }}>Redirecionando...</Text>
    </View>
  );
}
