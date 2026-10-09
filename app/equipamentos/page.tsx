'use client'

import { AdminFilterCard } from '../../packages/frontend/src/widgets/filtro-admin'
import { SmartPagination } from '@gb-locacoes/ui'
import { EquipamentosPage } from '@gb-locacoes/frontend/pages/equipamentos'
import type { CustomIconConfig } from '@/lib/category-design'
import { getCategoryBadgePreview } from '@/lib/utils/category-helpers'
import type * as LucideIcons from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function Page() {
  const searchParams = useSearchParams()

  return (
    <EquipamentosPage
      categoria={searchParams.get('categoria')}
      image={(props) => <Image {...props} />}
      link={({ href, children }) => <Link href={href}>{children}</Link>}
      filterCard={(props) => <AdminFilterCard {...props} />}
      pagination={(props) => <SmartPagination {...props} />}
      categoryBadge={(category) =>
        getCategoryBadgePreview(
          {
            name: category.name,
            icon: (category.icon ?? null) as keyof typeof LucideIcons | null,
            iconColor: category.iconColor,
            bgColor: category.bgColor,
            fontColor: category.fontColor,
            customIcon: (category.customIcon ?? null) as CustomIconConfig | null,
          },
          'sm',
          false
        )
      }
    />
  )
}
