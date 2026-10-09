'use client'

import { cn } from '../../../shared/lib/cn.web'
import { motion } from 'framer-motion'
import { memo, useEffect, useState } from 'react'

type HeroCarouselDotsProps = {
  images: string[]
  currentImage: number
  onDotClick: (_index: number) => void
}

export const HeroCarouselDots = memo(function HeroCarouselDots({
  images,
  currentImage,
  onDotClick,
}: HeroCarouselDotsProps) {
  // 🚀 Defer animações para reduzir TBT - renderiza HTML estático no SSR
  // Animações só inicializam após hydration para evitar hydration mismatch
  const [shouldAnimate, setShouldAnimate] = useState(false)

  useEffect(() => {
    // Defer animações após hydration completa
    setShouldAnimate(true)
  }, [])

  if (images.length <= 1) {
    return null
  }

  return (
    <div className="absolute bottom-0 -translate-x-1/2 left-1/2 z-10">
      <div className="flex justify-center space-x-3">
        {images.map((_image, index) => (
          <motion.button
            key={`hero-carousel-dot-${index}`}
            className={cn(
              'h-3 w-3 rounded-full transition-all duration-500',
              currentImage === index
                ? 'scale-125 bg-orange-500 shadow-lg'
                : 'bg-white/60 hover:bg-white/80'
            )}
            onClick={() => onDotClick(index)}
            aria-label={`Ir para imagem ${index + 1}`}
            whileHover={shouldAnimate ? { scale: 1.2 } : undefined}
            whileTap={shouldAnimate ? { scale: 0.9 } : undefined}
          />
        ))}
      </div>
    </div>
  )
})
