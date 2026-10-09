import { ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { LoginPage } from "@gb-locacoes/frontend/pages/login";
import { SocialDivider, SocialLoginButtons } from "@gb-locacoes/ui";
import { hostAuth } from "../../host/auth/client";
import { useMembershipSession } from "../../host/auth/use-membership-session";
import { useHostNavigation } from "../../host/use-host-navigation";

export default function LoginScreen() {
  const { replace } = useHostNavigation();
  const getSession = useMembershipSession();
  const params = useLocalSearchParams<{ callbackUrl?: string; error?: string }>();
  return <ScrollView keyboardShouldPersistTaps="handled"><LoginPage
    callbackUrl={params.callbackUrl} errorParam={params.error} replace={replace}
    getSession={getSession} signInCredentials={hostAuth.signInCredentials}
    social={hostAuth.supportsSocial ? ({ isLoading, onError, callbackUrl }) => <><SocialDivider>Ou continue com</SocialDivider><SocialLoginButtons isLoading={isLoading} onError={onError} callbackUrl={callbackUrl} onSignIn={hostAuth.signInProvider} /></> : undefined}
  /></ScrollView>;
}
