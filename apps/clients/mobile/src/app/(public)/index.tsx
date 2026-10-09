import { ScrollView } from "react-native";
import { CatalogPage } from "@gb-locacoes/frontend/pages/catalog";

export default function HomeScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <CatalogPage />
    </ScrollView>
  );
}
