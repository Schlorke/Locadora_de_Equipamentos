'use client'

import { cn } from '../../../shared/lib/cn.web'
import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import { memo, useEffect, useState } from 'react'

type HeroBackgroundCarouselProps = {
  images: string[]
  overlayOffsetClasses: string
  shouldShowWhite: boolean
  shouldRevealBackground: boolean
  currentImage: number
}

export const HeroBackgroundCarousel = memo(function HeroBackgroundCarousel({
  images,
  overlayOffsetClasses,
  shouldShowWhite,
  shouldRevealBackground,
  currentImage,
}: HeroBackgroundCarouselProps) {
  const hasImages = images.length > 0
  const isPrimarySlide = currentImage === 0
  // 🚀 Defer animações para reduzir TBT - renderiza HTML estático no SSR
  // Animações só inicializam após hydration para evitar hydration mismatch
  const [shouldAnimate, setShouldAnimate] = useState(false)

  useEffect(() => {
    // Defer animações após hydration completa
    setShouldAnimate(true)
  }, [])

  return (
    <>
      {!shouldShowWhite && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={shouldRevealBackground ? { opacity: 1 } : { opacity: 0 }}
          transition={
            shouldAnimate
              ? { duration: 1.2, delay: 0.2, ease: 'easeInOut' }
              : { duration: 0 }
          }
          className={cn(
            'absolute inset-x-0 top-0 pointer-events-none z-0 bg-gradient-to-br from-orange-600 via-orange-700 to-orange-800',
            overlayOffsetClasses
          )}
        />
      )}

      {hasImages && (
        <div
          className={cn(
            'absolute inset-x-0 top-0 z-0 pointer-events-none',
            overlayOffsetClasses
          )}
        >
          <div className="relative h-full overflow-hidden">
            <AnimatePresence initial={false}>
              <motion.div
                key={currentImage}
                initial={{ opacity: 0 }}
                animate={
                  shouldRevealBackground ? { opacity: 1 } : { opacity: 0 }
                }
                exit={{ opacity: 0 }}
                transition={
                  shouldAnimate
                    ? { duration: 1.2, delay: 0.2, ease: 'easeInOut' }
                    : { duration: 0 }
                }
                className="absolute inset-0"
              >
                <Image
                  src={images[currentImage] || '/placeholder.svg'}
                  alt={`Slide ${currentImage + 1}`}
                  fill
                  className="object-cover"
                  priority={isPrimarySlide}
                  fetchPriority={isPrimarySlide ? 'high' : 'auto'}
                  sizes="100vw"
                />
              </motion.div>
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0 }}
              animate={shouldRevealBackground ? { opacity: 1 } : { opacity: 0 }}
              transition={
                shouldAnimate
                  ? { duration: 1.2, delay: 0.2, ease: 'easeInOut' }
                  : { duration: 0 }
              }
              className="absolute inset-0 bg-gradient-to-br from-black/40 via-gray-900/30 to-black/20"
            />
          </div>
        </div>
      )}
    </>
  )
})
