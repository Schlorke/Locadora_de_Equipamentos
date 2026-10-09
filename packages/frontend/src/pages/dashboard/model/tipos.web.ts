import {
  BarChart3,
  Package,
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
} from 'lucide-react'

import type { DashboardStats } from './types'

export const dashboardStatusConfig = {
  pending: {
    label: 'Pendente',
    color:
      'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200',
    icon: Clock,
  },
  approved: {
    label: 'Aprovado',
    color:
      'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Rejeitado',
    color:
      'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200',
    icon: XCircle,
  },
  completed: {
    label: 'Concluído',
    color:
      'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200',
    icon: CheckCircle,
  },
}

export const mainStatsCards = [
  {
    title: 'Total de Equipamentos',
    value: (stats: DashboardStats | null) => stats?.totalEquipments || 0,
    subtitle: (stats: DashboardStats | null) =>
      `${stats?.availableEquipments || 0} disponíveis`,
    icon: Package,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    title: 'Categorias',
    value: (stats: DashboardStats | null) => stats?.totalCategories || 0,
    subtitle: () => 'Organizadas',
    icon: BarChart3,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
  },
  {
    title: 'Orçamentos',
    value: (stats: DashboardStats | null) => stats?.totalQuotes || 0,
    subtitle: (stats: DashboardStats | null) =>
      `${stats?.pendingQuotes || 0} pendentes`,
    icon: FileText,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    title: 'Receita Mensal',
    value: (stats: DashboardStats | null) => {
      const revenue = Number(stats?.monthlyRevenue || 0)
      return `R$ ${revenue.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    },
    subtitle: () => 'Este mês',
    icon: DollarSign,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
  },
]

export const statusStatsCards = [
  {
    title: 'Pendentes',
    value: (stats: DashboardStats | null) => stats?.pendingQuotes || 0,
    icon: Clock,
    borderColor: 'bg-orange-500',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    valueColor: 'text-orange-600',
  },
  {
    title: 'Aprovados',
    value: (stats: DashboardStats | null) => stats?.approvedQuotes || 0,
    icon: CheckCircle,
    borderColor: 'bg-green-500',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    valueColor: 'text-green-600',
  },
  {
    title: 'Rejeitados',
    value: (stats: DashboardStats | null) => stats?.rejectedQuotes || 0,
    icon: XCircle,
    borderColor: 'bg-red-500',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    valueColor: 'text-red-600',
  },
  {
    title: 'Concluídos',
    value: (stats: DashboardStats | null) => stats?.completedQuotes || 0,
    icon: CheckCircle,
    borderColor: 'bg-blue-500',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    valueColor: 'text-blue-600',
  },
]

export const quickActionButtons = [
  {
    title: 'Adicionar Equipamento',
    subtitle: 'Cadastrar novo equipamento no sistema',
    href: '/admin/equipamentos/novo',
    icon: Plus,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
  },
  {
    title: 'Gerenciar Categorias',
    subtitle: 'Organizar equipamentos por categoria',
    href: '/admin/categorias',
    icon: BarChart3,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
  },
  {
    title: 'Ver Orçamentos',
    subtitle: 'Gerenciar solicitações de orçamento',
    href: '/admin/orcamentos',
    icon: FileText,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
  },
]
