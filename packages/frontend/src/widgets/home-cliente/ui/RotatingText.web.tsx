'use client'

import {
  AnimatePresence,
  motion,
  type HTMLMotionProps,
  type TargetAndTransition,
  type Transition,
} from 'framer-motion'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { cn } from '../../../shared/lib/cn.web'
export interface RotatingTextHandle {
  next: () => void
  previous: () => void
  jumpTo: (_index: number) => void
  reset: () => void
}

type SplitStrategy = 'characters' | 'words' | 'lines' | string
type StaggerStrategy = 'first' | 'last' | 'center' | 'random' | number
type AnimatePresenceMode = 'sync' | 'wait' | 'popLayout'

interface WordChunk {
  characters: string[]
  needsSpace: boolean
}

export interface RotatingTextProps extends Omit<
  HTMLMotionProps<'span'>,
  'children'
> {
  texts: string[]
  transition?: Transition
  initial?: TargetAndTransition
  animate?: TargetAndTransition
  exit?: TargetAndTransition
  animatePresenceMode?: AnimatePresenceMode
  animatePresenceInitial?: boolean
  rotationInterval?: number
  staggerDuration?: number
  staggerFrom?: StaggerStrategy
  loop?: boolean
  auto?: boolean
  splitBy?: SplitStrategy
  onNext?: (_index: number) => void
  mainClassName?: string
  splitLevelClassName?: string
  elementLevelClassName?: string
}

export const RotatingText = forwardRef<RotatingTextHandle, RotatingTextProps>(
  (props, ref) => {
    const {
      texts,
      transition = { type: 'spring', damping: 25, stiffness: 300 },
      initial = { y: '100%', opacity: 0 },
      animate = { y: 0, opacity: 1 },
      exit = { y: '-120%', opacity: 0 },
      animatePresenceMode = 'wait',
      animatePresenceInitial = false,
      rotationInterval = 2000,
      staggerDuration = 0,
      staggerFrom: staggerStrategy = 'first',
      loop = true,
      auto = true,
      splitBy = 'characters',
      onNext,
      mainClassName,
      splitLevelClassName,
      elementLevelClassName,
      className,
      ...rest
    } = props

    const [currentIndex, setCurrentIndex] = useState(0)
    const containerRef = useRef<HTMLSpanElement>(null)
    const [isReady, setIsReady] = useState(false)

    // Garantir que o elemento seja medido antes de animar valores percentuais
    useLayoutEffect(() => {
      if (containerRef.current) {
        // Forçar reflow para garantir que o elemento seja medido
        void containerRef.current.offsetHeight
        setIsReady(true)
      }
    }, [currentIndex, texts])

    useEffect(() => {
      if (!texts.length) {
        setCurrentIndex(0)
        return
      }
      setCurrentIndex((prev) => Math.min(prev, texts.length - 1))
    }, [texts])

    const splitIntoCharacters = useCallback((text: string) => {
      const hasSegmenter =
        typeof Intl !== 'undefined' &&
        typeof (Intl as typeof Intl & { Segmenter?: typeof Intl.Segmenter })
          .Segmenter === 'function'

      if (hasSegmenter) {
        const Segmenter = (
          Intl as typeof Intl & { Segmenter: typeof Intl.Segmenter }
        ).Segmenter
        const segmenter = new Segmenter('pt-BR', { granularity: 'grapheme' })
        return Array.from(segmenter.segment(text), (segment) => segment.segment)
      }

      return Array.from(text)
    }, [])

    const elements = useMemo<WordChunk[]>(() => {
      if (!texts.length) {
        return []
      }

      const currentText = texts[currentIndex] ?? ''

      if (splitBy === 'characters') {
        const words = currentText.split(' ')
        return words.map((word, wordIndex) => ({
          characters: splitIntoCharacters(word),
          needsSpace: wordIndex !== words.length - 1,
        }))
      }

      if (splitBy === 'words') {
        return currentText.split(' ').map((word, wordIndex, array) => ({
          characters: [word],
          needsSpace: wordIndex !== array.length - 1,
        }))
      }

      if (splitBy === 'lines') {
        return currentText.split('\n').map((line, lineIndex, array) => ({
          characters: [line],
          needsSpace: lineIndex !== array.length - 1,
        }))
      }

      return currentText.split(splitBy).map((chunk, chunkIndex, array) => ({
        characters: [chunk],
        needsSpace: chunkIndex !== array.length - 1,
      }))
    }, [texts, currentIndex, splitBy, splitIntoCharacters])

    const totalCharacters = useMemo(
      () => elements.reduce((sum, word) => sum + word.characters.length, 0),
      [elements]
    )

    const getStaggerDelay = useCallback(
      (index: number, total: number) => {
        if (staggerStrategy === 'first') return index * staggerDuration
        if (staggerStrategy === 'last')
          return (total - 1 - index) * staggerDuration
        if (staggerStrategy === 'center') {
          const center = Math.floor(total / 2)
          return Math.abs(center - index) * staggerDuration
        }
        if (staggerStrategy === 'random') {
          const randomIndex = Math.floor(Math.random() * total)
          return Math.abs(randomIndex - index) * staggerDuration
        }
        if (typeof staggerStrategy === 'number') {
          return Math.abs(staggerStrategy - index) * staggerDuration
        }
        return index * staggerDuration
      },
      [staggerStrategy, staggerDuration]
    )

    const handleIndexChange = useCallback(
      (nextIndex: number) => {
        setCurrentIndex(nextIndex)
        onNext?.(nextIndex)
      },
      [onNext]
    )

    const next = useCallback(() => {
      if (!texts.length) return

      const lastIndex = texts.length - 1
      const nextIndex =
        currentIndex === lastIndex
          ? loop
            ? 0
            : currentIndex
          : currentIndex + 1

      if (nextIndex !== currentIndex) {
        handleIndexChange(nextIndex)
      }
    }, [currentIndex, texts, loop, handleIndexChange])

    const previous = useCallback(() => {
      if (!texts.length) return

      const lastIndex = texts.length - 1
      const prevIndex =
        currentIndex === 0
          ? loop
            ? lastIndex
            : currentIndex
          : currentIndex - 1

      if (prevIndex !== currentIndex) {
        handleIndexChange(prevIndex)
      }
    }, [currentIndex, texts, loop, handleIndexChange])

    const jumpTo = useCallback(
      (index: number) => {
        if (!texts.length) return

        const lastIndex = texts.length - 1
        const validIndex = Math.max(0, Math.min(index, lastIndex))

        if (validIndex !== currentIndex) {
          handleIndexChange(validIndex)
        }
      },
      [texts, currentIndex, handleIndexChange]
    )

    const reset = useCallback(() => {
      if (!texts.length) return

      if (currentIndex !== 0) {
        handleIndexChange(0)
      }
    }, [texts, currentIndex, handleIndexChange])

    useImperativeHandle(
      ref,
      () => ({
        next,
        previous,
        jumpTo,
        reset,
      }),
      [next, previous, jumpTo, reset]
    )

    useEffect(() => {
      if (!auto || !texts.length) return

      const intervalId = window.setInterval(next, rotationInterval)
      return () => window.clearInterval(intervalId)
    }, [auto, next, rotationInterval, texts])

    // Normalizar valores percentuais para evitar NaN
    // Usar valores absolutos se o elemento ainda não foi medido
    // IMPORTANTE: Hooks devem ser chamados antes de qualquer early return
    const safeInitial = useMemo(() => {
      if (
        !isReady &&
        typeof initial?.y === 'string' &&
        initial.y.includes('%')
      ) {
        // Usar valor absoluto temporário até o elemento ser medido
        return { ...initial, y: 20, opacity: 0 }
      }
      return initial
    }, [isReady, initial])

    const safeAnimate = useMemo(() => {
      if (
        !isReady &&
        typeof animate?.y === 'string' &&
        animate.y.includes('%')
      ) {
        return { ...animate, y: 0, opacity: 1 }
      }
      return animate
    }, [isReady, animate])

    const safeExit = useMemo(() => {
      if (!isReady && typeof exit?.y === 'string' && exit.y.includes('%')) {
        return { ...exit, y: -20, opacity: 0 }
      }
      return exit
    }, [isReady, exit])

    if (!texts.length) {
      return null
    }

    let characterOffset = 0

    return (
      <motion.span
        ref={containerRef}
        className={cn(
          'relative inline-flex flex-wrap whitespace-pre-wrap',
          mainClassName,
          className
        )}
        layout
        transition={transition}
        {...rest}
      >
        <span className="sr-only">{texts[currentIndex]}</span>
        <AnimatePresence
          mode={animatePresenceMode}
          initial={animatePresenceInitial}
        >
          <motion.span
            key={currentIndex}
            className={cn(
              splitBy === 'lines'
                ? 'flex w-full flex-col'
                : 'inline-flex flex-wrap'
            )}
            layout
            aria-hidden="true"
          >
            {elements.map((word, wordIndex) => {
              const currentWordOffset = characterOffset
              characterOffset += word.characters.length

              return (
                <span
                  key={wordIndex}
                  className={cn('inline-flex', splitLevelClassName)}
                >
                  {word.characters.map((character, characterIndex) => {
                    const charKey = currentWordOffset + characterIndex

                    return (
                      <motion.span
                        key={charKey}
                        initial={safeInitial}
                        animate={safeAnimate}
                        exit={safeExit}
                        transition={{
                          ...transition,
                          delay: getStaggerDelay(charKey, totalCharacters),
                        }}
                        className={cn('inline-block', elementLevelClassName)}
                      >
                        {character}
                      </motion.span>
                    )
                  })}
                  {word.needsSpace && <span className="whitespace-pre"> </span>}
                </span>
              )
            })}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    )
  }
)

RotatingText.displayName = 'RotatingText'

export default RotatingText
