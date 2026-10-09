import { ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { EntrarPage } from "@gb-locacoes/frontend/pages/entrar";
import { hostAuth } from "../../host/auth/client";
import { useMembershipSession } from "../../host/auth/use-membership-session";
import { useHostNavigation } from "../../host/use-host-navigation";

export default function EntrarScreen() {
  const { push } = useHostNavigation();
  const getSession = useMembershipSession();
  const params = useLocalSearchParams<{ error?: string }>();
  return <ScrollView keyboardShouldPersistTaps="handled"><EntrarPage
    errorParam={params.error} push={push} getSession={getSession}
    signInCredentials={hostAuth.signInCredentials} signInProvider={hostAuth.signInProvider}
    socialProviders={hostAuth.supportsSocial ? ["google", "facebook"] : []}
  /></ScrollView>;
}
