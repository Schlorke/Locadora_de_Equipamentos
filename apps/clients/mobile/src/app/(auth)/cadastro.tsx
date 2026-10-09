import { ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { CadastroPage } from "@gb-locacoes/frontend/pages/cadastro";
import { hostAuth } from "../../host/auth/client";
import { useHostNavigation } from "../../host/use-host-navigation";

export default function CadastroScreen() {
  const { push } = useHostNavigation();
  const params = useLocalSearchParams<{ callbackUrl?: string }>();
  return <ScrollView keyboardShouldPersistTaps="handled"><CadastroPage
    callbackUrl={params.callbackUrl} push={push} signInProvider={hostAuth.signInProvider}
    socialProviders={hostAuth.supportsSocial ? ["google", "facebook"] : []}
  /></ScrollView>;
}
