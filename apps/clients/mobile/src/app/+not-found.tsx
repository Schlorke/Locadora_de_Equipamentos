import { useRouter } from "expo-router";
import { HOME_HREF } from "../host/area-exits";
import { UnavailableArea } from "../host/unavailable-area";

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <UnavailableArea
      title="Página não encontrada"
      description="Este endereço não existe no aplicativo."
      actions={[{ label: "Ir para o início", run: () => router.replace(HOME_HREF) }]}
    />
  );
}
