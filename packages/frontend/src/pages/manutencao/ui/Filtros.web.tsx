'use client'

import { Button } from '@gb-locacoes/ui'
import { Card, CardContent } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { FilterSelectGroup } from '@gb-locacoes/ui'
import { FilterResetButton } from '@gb-locacoes/ui'
import { ViewToggle } from '@gb-locacoes/ui'
import { motion } from 'framer-motion'
import { Search, List, LayoutGrid, CalendarPlus } from 'lucide-react'
import { toast } from 'sonner'

interface MaintenanceFilterBarProps {
  searchTerm: string
  setSearchTerm: (_value: string) => void
  statusFilter: string
  setStatusFilter: (_value: string) => void
  typeFilter: string
  setTypeFilter: (_value: string) => void
  viewMode: 'list' | 'calendar'
  setViewMode: (_value: 'list' | 'calendar') => void
}

export function MaintenanceFilterBar({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  viewMode,
  setViewMode,
}: MaintenanceFilterBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mb-6"
    >
      <Card className="relative overflow-visible border-0 shadow-xl bg-white backdrop-blur-sm">
        <CardContent className="relative z-10 p-4 md:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
              <div className="relative w-full lg:flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por equipamento ou técnico..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex flex-col lg:flex-row items-center gap-3 w-full lg:w-auto">
                <FilterSelectGroup
                  filters={[
                    {
                      label: 'Status',
                      value: statusFilter,
                      onValueChange: setStatusFilter,
                      placeholder: 'Filtrar por status',
                      options: [
                        { value: 'all', label: 'Todos' },
                        { value: 'SCHEDULED', label: 'Agendada' },
                        { value: 'IN_PROGRESS', label: 'Em Andamento' },
                        { value: 'COMPLETED', label: 'Concluída' },
                        { value: 'CANCELLED', label: 'Cancelada' },
                      ],
                    },
                    {
                      label: 'Tipo',
                      value: typeFilter,
                      onValueChange: setTypeFilter,
                      placeholder: 'Filtrar por tipo',
                      options: [
                        { value: 'all', label: 'Todos' },
                        { value: 'PREVENTIVE', label: 'Preventiva' },
                        { value: 'CORRECTIVE', label: 'Corretiva' },
                        { value: 'INSPECTION', label: 'Inspeção' },
                      ],
                    },
                  ]}
                  gap="sm"
                />
                <FilterResetButton
                  onClick={() => {
                    setStatusFilter('all')
                    setTypeFilter('all')
                    setSearchTerm('')
                  }}
                  title="Resetar filtros"
                  size="md"
                />
              </div>

              <div className="w-full lg:w-auto flex justify-center lg:justify-start">
                <Button
                  className="border border-slate-700 shadow-md hover:border-slate-600 bg-slate-700 text-primary-foreground hover:bg-slate-600 hover:scale-105 hover:shadow-lg transition-all duration-300 h-10 px-4"
                  onClick={() => {
                    toast.info('Funcionalidade em desenvolvimento')
                  }}
                >
                  <CalendarPlus className="w-4 h-4 mr-2" />
                  Agendar Preventiva
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-center w-full">
              <ViewToggle
                options={[
                  { value: 'list', label: 'Lista', icon: List },
                  {
                    value: 'calendar',
                    label: 'Calendário',
                    icon: LayoutGrid,
                  },
                ]}
                value={viewMode}
                onValueChange={(value) =>
                  setViewMode(value as 'list' | 'calendar')
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
