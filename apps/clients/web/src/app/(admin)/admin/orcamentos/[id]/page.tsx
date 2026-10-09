import { QuoteDetailPage } from "@gb-locacoes/frontend/pages/orcamentos-admin";

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <QuoteDetailPage params={params} />;
}
