import { ScrollView } from "react-native";
import { AdminLoginPage } from "@gb-locacoes/frontend/pages/admin-login";
import { useHostNavigation } from "../../../host/use-host-navigation";

export default function AdminLoginScreen() {
  const { replace } = useHostNavigation();
  return (
    <ScrollView>
      <AdminLoginPage replace={replace} />
    </ScrollView>
  );
}
