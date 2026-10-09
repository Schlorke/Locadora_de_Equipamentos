'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Download, Maximize2, Minimize2 } from 'lucide-react'
import { ReactNode, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'

interface ChartCardProps {
  id?: string
  title: string | ReactNode
  children: ReactNode
  actions?: ReactNode
  className?: string
  expanded?: boolean
  onExpand?: () => void
  onCollapse?: () => void
}

function ChartCardInner({
  id: _id,
  title,
  children,
  actions,
  className,
  expanded,
  onExpand,
  onCollapse,
}: ChartCardProps) {
  return (
    <Card
      className={`relative h-full overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm flex flex-col ${className || ''}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base sm:text-xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3 min-w-0">
            {title}
          </CardTitle>
          {actions || (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Exportar"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={expanded ? 'Recolher' : 'Expandir'}
                onClick={expanded ? onCollapse : onExpand}
              >
                {expanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative z-10 flex-1 flex items-center justify-center">
        {children}
      </CardContent>
    </Card>
  )
}

export function ChartCard(props: ChartCardProps) {
  const { id } = props
  if (!id) {
    return <ChartCardInner {...props} />
  }

  return (
    <motion.div layoutId={`chart-card-${id}`} className="h-full">
      <ChartCardInner {...props} />
    </motion.div>
  )
}

interface ExpandedCardOverlayProps {
  id: string
  title: string | ReactNode
  children: ReactNode
  onClose: () => void
}

export function ExpandedCardOverlay({
  id,
  title,
  children,
  onClose,
}: ExpandedCardOverlayProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [handleEscape])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-24 pb-20 lg:py-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        layoutId={`chart-card-${id}`}
        className="relative z-10 w-full max-w-5xl max-h-full"
      >
        <Card className="relative overflow-hidden border-0 shadow-2xl bg-white backdrop-blur-sm flex flex-col max-h-full">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
          <CardHeader className="relative z-10 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3 min-w-0">
                {title}
              </CardTitle>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Exportar"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Recolher"
                  onClick={onClose}
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 flex-1 flex items-center justify-center min-h-0 overflow-y-auto lg:min-h-[500px]">
            {children}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
