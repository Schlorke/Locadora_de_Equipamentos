export function generatePeriodOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [
    { value: 'all', label: 'Todos os períodos' },
  ]
  const now = new Date()
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${months[d.getMonth()]} ${d.getFullYear()}`
    options.push({ value, label })
  }
  return options
}

export function getPeriodDateRange(period: string): {
  startDate: string | null
  endDate: string | null
} {
  if (period === 'all') return { startDate: null, endDate: null }
  const [yearStr, monthStr] = period.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr) - 1
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  }
}
