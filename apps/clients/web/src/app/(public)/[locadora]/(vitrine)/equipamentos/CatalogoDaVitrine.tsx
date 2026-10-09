"use client";

import {
  AdminFilterCard,
  CategoryBadge,
  EquipamentosPage,
} from "@gb-locacoes/frontend/pages/equipamentos";
import { SmartPagination } from "@gb-locacoes/ui";
import type * as LucideIcons from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function EquipamentosRoute() {
  const searchParams = useSearchParams();
  // A locadora é a do host (segmento [locadora] preenchido pelo proxy), nunca a query.
  const { locadora } = useParams<{ locadora: string }>();

  return (
    <EquipamentosPage
      categoria={searchParams.get("categoria")}
      tenantSlug={locadora}
      image={(props) => <Image {...props} />}
      link={({ href, children }) => <Link href={href}>{children}</Link>}
      filterCard={(props) => <AdminFilterCard {...props} />}
      pagination={(props) => <SmartPagination {...props} />}
      categoryBadge={(category) => (
        <CategoryBadge
          category={{
            name: category.name,
            icon: (category.icon ?? null) as keyof typeof LucideIcons | null,
            iconColor: category.iconColor,
            bgColor: category.bgColor,
            fontColor: category.fontColor,
            customIcon: category.customIcon ?? null,
          }}
          size="sm"
          hover={false}
        />
      )}
    />
  );
}

/**
 * Catálogo da vitrine (cliente: filtros pela query e componentes de interface do host). O `page.tsx` do segmento é de
 * servidor só para os metadados da locadora (onda 135, A4).
 */
export function CatalogoDaVitrine() {
  return (
    <Suspense fallback={null}>
      <EquipamentosRoute />
    </Suspense>
  );
}
