'use client'

import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../../shared/lib/cn.web'
import { Button } from '@gb-locacoes/ui'
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  Archive,
  AlertCircle,
  Folder,
  ChevronRight,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'

const CURSOR_OFFSET_PX = 14

export type { EmailFolder } from '../model/tipos'
import type { EmailFolder } from '../model/tipos'

interface EmailFolderListProps {
  folders: EmailFolder[]
  selectedFolderId?: string
  onSelectFolder: (_folderId: string) => void
  loading?: boolean
  onRefresh?: () => void
  refreshLoading?: boolean
  className?: string
}

function getFolderIcon(name: string): LucideIcon {
  const normalized = name.toLowerCase()
  if (normalized.includes('inbox') || normalized.includes('entrada'))
    return Inbox
  if (normalized.includes('sent') || normalized.includes('enviado')) return Send
  if (normalized.includes('draft') || normalized.includes('rascunho'))
    return FileText
  if (normalized.includes('trash') || normalized.includes('lixeira'))
    return Trash2
  if (normalized.includes('archive') || normalized.includes('arquivado'))
    return Archive
  if (normalized.includes('spam')) return AlertCircle
  return Folder
}

export function EmailFolderList({
  folders,
  selectedFolderId,
  onSelectFolder,
  loading,
  onRefresh,
  refreshLoading,
  className,
}: EmailFolderListProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const handlePointerEnter = useCallback(() => setTooltipVisible(true), [])
  const handlePointerLeave = useCallback(() => setTooltipVisible(false), [])
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    setTooltipPos({
      x: e.clientX + CURSOR_OFFSET_PX,
      y: e.clientY,
    })
  }, [])

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex w-full items-center gap-2 border-b border-slate-200/70 px-4 py-3">
        <Folder className="w-4 h-4 shrink-0 text-orange-600" />
        <span className="text-sm font-semibold text-slate-900">Pastas</span>
        {onRefresh && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshLoading}
              className="ml-auto h-7 shrink-0 px-2 text-xs shadow-sm hover:shadow-md [&_svg]:size-3.5"
              aria-label="Sincronizar emails"
              onPointerEnter={handlePointerEnter}
              onPointerLeave={handlePointerLeave}
              onPointerMove={handlePointerMove}
            >
              <RefreshCw
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  refreshLoading && 'animate-spin'
                )}
              />
            </Button>
            {typeof document !== 'undefined' &&
              tooltipVisible &&
              createPortal(
                <div
                  className="fixed z-[100] rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-md animate-in fade-in-0"
                  style={{
                    left: tooltipPos.x,
                    top: tooltipPos.y,
                    transform: 'translateY(-50%)',
                  }}
                  role="tooltip"
                  aria-hidden
                >
                  Sincronizar emails
                </div>,
                document.body
              )}
          </>
        )}
      </div>
      {loading ? (
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-9 bg-slate-100 rounded-md animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto admin-scrollbar">
          <nav className="space-y-1 p-4">
            {folders.map((folder) => {
              const Icon = getFolderIcon(folder.folderName)
              const isSelected = folder.folderId === selectedFolderId
              return (
                <button
                  key={folder.folderId}
                  onClick={() => onSelectFolder(folder.folderId)}
                  className={cn(
                    'group/item w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-xl transition-colors duration-200',
                    isSelected
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-orange-600'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        'h-5 w-5 transition-colors duration-200',
                        isSelected
                          ? 'text-white'
                          : 'text-gray-500 group-hover/item:text-orange-600'
                      )}
                    />
                    <span>{folder.folderName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {folder.unreadCount !== undefined &&
                      folder.unreadCount > 0 && (
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-semibold',
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-gray-200 text-gray-700'
                          )}
                        >
                          {folder.unreadCount}
                        </span>
                      )}
                    <ChevronRight
                      className={cn(
                        'h-4 w-4 transition-colors duration-200',
                        isSelected
                          ? 'text-white'
                          : 'text-gray-400 group-hover/item:text-orange-600'
                      )}
                    />
                  </div>
                </button>
              )
            })}
          </nav>
        </div>
      )}
    </div>
  )
}
