import {
  EquipamentoDetalhePage,
  StructuredData,
  buildEquipmentBreadcrumbs,
  buildEquipmentProductStructuredData,
  buildEquipmentSeo,
  getLocalBusinessData,
} from "@gb-locacoes/frontend/pages/equipamento-detalhe";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPublicEquipment,
  getPublicSettings,
  getPublicSite,
} from "../../../../../../host/server/public-api";
import { getLojaDaVitrine } from "../../loja";

interface Props {
  params: Promise<{ locadora: string; id: string }>;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const [equipment, site, loja] = await Promise.all([
    getPublicEquipment(params.locadora, params.id),
    getPublicSite(params.locadora),
    getLojaDaVitrine(params.locadora),
  ]);
  // Autoria, nome do site e canonical da própria locadora (T12; achado 143): nunca um nome ou domínio fixo.
  const owner = loja ? { authors: [{ name: loja.name }], creator: loja.name, publisher: loja.name } : {};

  if (!equipment) {
    return {
      title: loja ? `Equipamento não encontrado | ${loja.name}` : "Equipamento não encontrado",
      description:
        "O equipamento solicitado não foi encontrado. Confira nosso catálogo completo de equipamentos para locação.",
    };
  }

  const seo = buildEquipmentSeo(equipment, params.id, loja);

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    ...owner,
    alternates: {
      canonical: seo.canonicalUrl,
    },
    openGraph: {
      title: seo.openGraphTitle,
      description: seo.openGraphDescription,
      url: seo.canonicalUrl,
      ...(loja ? { siteName: loja.name } : {}),
      images: [
        {
          url: seo.imageUrl,
          width: 1200,
          height: 630,
          alt: seo.imageAlt,
          type: "image/jpeg",
        },
      ],
      locale: "pt_BR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.openGraphTitle,
      description: seo.openGraphDescription,
      images: [
        {
          url: seo.imageUrl,
          alt: seo.imageAlt,
        },
      ],
    },
    // Site ainda não indexável (S13: noindex até a 1ª fatura paga) não pode reabrir a indexação nesta página.
    robots: !site?.indexable
      ? { index: false, follow: false }
      : {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

// Fase 1 (D11): detalhe dinâmico, como no host anterior. O Lote 9 troca por generateStaticParams com ISR.
export const dynamic = "force-dynamic";

export default async function EquipmentDetailPage(props: Props) {
  const params = await props.params;

  // Equipamento de outra locadora ou inexistente: o backend responde 404 e a página também.
  // Configurações ausentes ficam de fora do JSON-LD (nenhum padrão de outra locadora, T12).
  const [equipment, settings, loja] = await Promise.all([
    getPublicEquipment(params.locadora, params.id),
    getPublicSettings(params.locadora),
    getLojaDaVitrine(params.locadora),
  ]);

  if (!equipment) {
    notFound();
  }

  // LocalBusiness com o cartão e as configurações públicas da locadora do host
  const localBusinessData = getLocalBusinessData(settings, loja && {
    name: loja.name,
    url: loja.origin,
    city: loja.city,
    state: loja.state,
    logoUrl: loja.logoUrl,
  });

  const pricePerDay = equipment.pricePerDay;
  const structuredDataProduct = buildEquipmentProductStructuredData(
    {
      id: equipment.id,
      name: equipment.name,
      description: equipment.description,
      images: equipment.images,
      available: equipment.isAvailable,
      pricePerDay,
      category: equipment.category,
    },
    params.id,
    loja
  );
  const breadcrumbs = buildEquipmentBreadcrumbs(
    equipment,
    params.id,
    equipment.category?.slug,
    loja?.origin
  );

  return (
    <EquipamentoDetalhePage
      name={equipment.name}
      description={equipment.description}
      categoryName={equipment.category.name}
      pricePerDay={pricePerDay}
      available={equipment.isAvailable}
      structuredData={
        <StructuredData
          localBusiness={localBusinessData}
          product={structuredDataProduct}
          breadcrumbs={breadcrumbs}
        />
      }
      categorySlug={equipment.category?.slug}
      images={equipment.images || []}
      categoryIcon={equipment.category.icon}
      categoryIconColor={equipment.category.iconColor}
      categoryBgColor={equipment.category.bgColor}
      categoryFontColor={equipment.category.fontColor}
      categoryCustomIcon={equipment.category.customIcon}
      equipmentId={equipment.id}
      dailyDiscount={equipment.dailyDiscount || 0}
      weeklyDiscount={equipment.weeklyDiscount || 0}
      biweeklyDiscount={equipment.biweeklyDiscount || 0}
      monthlyDiscount={equipment.monthlyDiscount || 0}
      popularPeriod={equipment.popularPeriod || "weekly"}
      maxStock={equipment.maxStock || undefined}
      dailyDirectValue={Number(equipment.dailyDirectValue) || 0}
      weeklyDirectValue={Number(equipment.weeklyDirectValue) || 0}
      biweeklyDirectValue={Number(equipment.biweeklyDirectValue) || 0}
      monthlyDirectValue={Number(equipment.monthlyDirectValue) || 0}
      dailyUseDirectValue={equipment.dailyUseDirectValue || false}
      weeklyUseDirectValue={equipment.weeklyUseDirectValue || false}
      biweeklyUseDirectValue={equipment.biweeklyUseDirectValue || false}
      monthlyUseDirectValue={equipment.monthlyUseDirectValue || false}
      dailyRentalEnabled={equipment.dailyRentalEnabled ?? true}
      weeklyRentalEnabled={equipment.weeklyRentalEnabled ?? true}
      biweeklyRentalEnabled={equipment.biweeklyRentalEnabled ?? true}
      monthlyRentalEnabled={equipment.monthlyRentalEnabled ?? true}
    />
  );
}
