'use client'

import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { FOCUS_RING } from '@gb-locacoes/ui'
import { cn } from '../../../shared/lib/cn.web'

interface ImageZoomModalProps {
  images: string[]
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onNext: () => void
  onPrev: () => void
}

export function ImageZoomModal({
  images,
  currentIndex,
  isOpen,
  onClose,
  onNext,
  onPrev,
}: ImageZoomModalProps) {
  if (!isOpen || images.length === 0) return null

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
        <Image
          src={images[currentIndex] || ''}
          alt={`Equipamento - Imagem ${currentIndex + 1}`}
          fill
          className="object-contain"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onPrev()
              }}
              title="Imagem anterior"
              aria-label="Navegar para imagem anterior"
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 rounded-full p-3 shadow-lg hover:scale-110 transition-all duration-200"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onNext()
              }}
              title="Próxima imagem"
              aria-label="Navegar para próxima imagem"
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 rounded-full p-3 shadow-lg hover:scale-110 transition-all duration-200"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Image counter indicator */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
          {currentIndex + 1} de {images.length}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          title="Fechar"
          aria-label="Fechar visualização"
          className={cn(
            'absolute top-4 right-4 bg-white/90 hover:bg-white text-gray-700 rounded-full p-2 shadow-lg hover:scale-110 transition-all duration-200 focus:shadow-none',
            FOCUS_RING
          )}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
