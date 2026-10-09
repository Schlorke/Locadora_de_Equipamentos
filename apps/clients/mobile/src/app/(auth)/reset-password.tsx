import { ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ResetPasswordPage } from "@gb-locacoes/frontend/pages/reset-password";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  return <ScrollView keyboardShouldPersistTaps="handled"><ResetPasswordPage token={params.token} /></ScrollView>;
}
