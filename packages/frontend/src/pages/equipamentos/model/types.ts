import type { ReactNode } from 'react';
import type { CustomIconConfig } from '../../../shared/lib/category-design';
export type EquipamentoImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority: boolean;
  className: string;
  style: { width: "auto"; height: "auto" };
};

export interface Review {
  id: string
  rating: number
  comment?: string | null
  createdAt: string
}

export interface Equipment {
  id: string
  name: string
  description: string
  pricePerDay: number
  images: string[]
  category: {
    id: string
    name: string
    color?: string
    bgColor?: string
    fontColor?: string
    icon?: string
    iconColor?: string
    customIcon?: CustomIconConfig | null
  }
  isAvailable: boolean
  reviews?: Review[]
}

export interface Category {
  id: string
  name: string
  slug: string
  bgColor?: string
  fontColor?: string
  icon?: string
  iconColor?: string
  customIcon?: CustomIconConfig | null
}
export type EquipamentosPageProps = {
  categoria: string | null;
  tenantSlug?: string | null;
  image: (props: EquipamentoImageProps) => ReactNode;
  link: (props: { href: string; children: ReactNode }) => ReactNode;
  filterCard: (props: {
    searchPlaceholder: string;
    searchValue: string;
    onSearchChange: (value: string) => void;
    filters: Array<{
      label: string;
      value: string;
      onValueChange: (value: string) => void;
      placeholder: string;
      options: Array<{ value: string; label: string }>;
    }>;
  }) => ReactNode;
  pagination: (props: { currentPage: number; totalPages: number; onPageChange: (page: number) => void }) => ReactNode;
  categoryBadge: (category: {
    name: string;
    icon?: string | null;
    iconColor?: string;
    bgColor?: string;
    fontColor?: string;
    customIcon?: CustomIconConfig | null;
  }) => ReactNode;
};
