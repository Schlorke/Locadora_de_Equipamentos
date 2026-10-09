export interface DashboardStats {
  totalEquipments: number
  availableEquipments: number
  totalCategories: number
  totalQuotes: number
  pendingQuotes: number
  approvedQuotes: number
  rejectedQuotes: number
  completedQuotes: number
  totalRevenue: number
  monthlyRevenue: number
  quotesTrend?: Array<{
    date: string
    fullDate: string
    count: number
  }>
  equipmentByCategory?: Array<{
    categoryName: string
    count: number
    available: number
    categoryId: string
    bgColor: string
    fontColor: string
  }>
  topEquipments?: Array<{
    id: string
    name: string
    requestCount: number
    category: string
  }>
  utilizationRate?: number
  conversionRate?: number
  averageTicket?: number
  equipmentROI?: Array<{
    equipmentId: string
    equipmentName: string
    purchasePrice: number
    totalRevenue: number
    totalMaintenanceCost: number
    roi: number
  }>
  averageRevenuePerEquipment?: number
  financialMetrics?: {
    metrics: {
      mrr: number
      fleetUtilization: number
      overdueAmount: number
      averageTicket: number
      netProfit: number
    }
    trends: {
      mrr: number
      fleetUtilization: number
      overdueAmount: number
      averageTicket: number
      netProfit: number
    }
    sparklines: {
      mrr: number[]
      fleetUtilization: number[]
      overdueAmount: number[]
      averageTicket: number[]
      netProfit: number[]
    }
  }
}

export interface RecentQuote {
  id: string
  customerName: string
  customerEmail: string
  customerCompany?: string
  customerImage?: string | null
  totalAmount?: number
  status: string
  createdAt: string
  itemsCount: number
}

export interface RevenueData {
  revenueHistory: Array<{ month: string; revenue: number }>
  revenueByCategory: Array<{ categoryName: string; revenue: number }>
}

export interface AgingData {
  agingData: Array<{
    range: string
    amount: number
    count: number
    status: 'onTime' | 'slightDelay' | 'severeDelay'
  }>
  topDebtors: Array<{
    clientName: string
    overdueAmount: number
    daysOverdue: number
    status: 'overdue' | 'attention' | 'critical'
  }>
}
