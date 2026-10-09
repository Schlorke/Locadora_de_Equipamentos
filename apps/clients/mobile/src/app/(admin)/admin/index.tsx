import { ScrollView } from "react-native";
import { AdminIndexPage } from "@gb-locacoes/frontend/pages/admin-entrada";
import { useHostNavigation } from "../../../host/use-host-navigation";

export default function AdminIndexScreen() {
  const { replace } = useHostNavigation();
  return (
    <ScrollView>
      <AdminIndexPage replace={replace} />
    </ScrollView>
  );
}
