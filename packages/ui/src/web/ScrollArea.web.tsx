'use client'

import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import * as React from 'react'

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ScrollAreaViewportContext =
  React.createContext<React.RefObject<HTMLDivElement | null> | null>(null)

const SCROLL_STEP = 40

type ScrollAreaProps = React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Root
> & {
  scrollbarClassName?: string
  thumbClassName?: string
  arrowClassName?: string
  hoverOnly?: boolean
  /** Quando true, exibe scrollbar horizontal (ex.: conteúdo de e-mail largo) */
  maxHeight?: number
  horizontal?: boolean
}

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(
  (
    {
      className,
      children,
      scrollbarClassName,
      thumbClassName,
      arrowClassName,
      hoverOnly,
      horizontal,
      maxHeight,
      style,
      ...props
    },
    ref
  ) => {
    const viewportRef = React.useRef<HTMLDivElement>(null)

    return (
      <ScrollAreaViewportContext.Provider value={viewportRef}>
        <ScrollAreaPrimitive.Root
          ref={ref}
          style={{height:maxHeight,...style}}
          className={cn(
            'relative overflow-hidden',
            hoverOnly && 'group',
            className
          )}
          {...props}
        >
          <ScrollAreaPrimitive.Viewport
            ref={viewportRef}
            className="h-full w-full rounded-[inherit]"
          >
            {children}
          </ScrollAreaPrimitive.Viewport>
          <ScrollBar
            className={cn(
              hoverOnly &&
                'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity',
              scrollbarClassName
            )}
            thumbClassName={thumbClassName}
            arrowClassName={arrowClassName}
          />
          {horizontal && (
            <ScrollBar
              orientation="horizontal"
              className={cn(
                hoverOnly &&
                  'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity',
                scrollbarClassName
              )}
              thumbClassName={thumbClassName}
              arrowClassName={arrowClassName}
            />
          )}
          <ScrollAreaPrimitive.Corner />
        </ScrollAreaPrimitive.Root>
      </ScrollAreaViewportContext.Provider>
    )
  }
)
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<
    typeof ScrollAreaPrimitive.ScrollAreaScrollbar
  > & {
    thumbClassName?: string
    arrowClassName?: string
  }
>(
  (
    {
      className,
      orientation = 'vertical',
      thumbClassName,
      arrowClassName,
      ...props
    },
    ref
  ) => {
    const viewportRef = React.useContext(ScrollAreaViewportContext)
    const thumbThickness = '6px'
    const thumbStyle =
      orientation === 'vertical'
        ? { width: thumbThickness }
        : { height: thumbThickness }

    const scroll = React.useCallback(
      (delta: number, isHorizontal: boolean) => {
        const el = viewportRef?.current
        if (!el) return
        if (isHorizontal) el.scrollBy({ left: delta, behavior: 'smooth' })
        else el.scrollBy({ top: delta, behavior: 'smooth' })
      },
      [viewportRef]
    )

    return (
      <ScrollAreaPrimitive.ScrollAreaScrollbar
        ref={ref}
        orientation={orientation}
        forceMount
        className={cn(
          'flex touch-none select-none transition-colors',
          orientation === 'vertical' &&
            'h-full w-2 border-l-transparent py-2 rounded-full flex-col',
          orientation === 'horizontal' &&
            'h-2 w-full flex-row border-t border-t-transparent px-2',
          className
        )}
        {...props}
      >
        {orientation === 'vertical' && (
          <>
            <div className="flex flex-none w-full min-h-[6px] items-center justify-center shrink-0">
              <button
                type="button"
                aria-label="Rolar para cima"
                className={cn(
                  'scroll-area-arrow scroll-area-arrow-vertical-up',
                  arrowClassName
                )}
                onClick={() => scroll(-SCROLL_STEP, false)}
              />
            </div>
            <ScrollAreaPrimitive.ScrollAreaThumb
              style={thumbStyle}
              className={cn(
                'relative flex-none rounded-full bg-orange-600 hover:bg-orange-700 transition-colors duration-200 min-h-[20px]',
                thumbClassName
              )}
            />
            <div className="flex flex-none w-full min-h-[6px] items-center justify-center shrink-0">
              <button
                type="button"
                aria-label="Rolar para baixo"
                className={cn(
                  'scroll-area-arrow scroll-area-arrow-vertical-down',
                  arrowClassName
                )}
                onClick={() => scroll(SCROLL_STEP, false)}
              />
            </div>
          </>
        )}
        {orientation === 'horizontal' && (
          <>
            <div className="flex flex-none h-full min-w-[6px] shrink-0 items-center justify-center">
              <button
                type="button"
                aria-label="Rolar para esquerda"
                className={cn(
                  'scroll-area-arrow scroll-area-arrow-horizontal-left',
                  arrowClassName
                )}
                onClick={() => scroll(-SCROLL_STEP, true)}
              />
            </div>
            <ScrollAreaPrimitive.ScrollAreaThumb
              style={thumbStyle}
              className={cn(
                'relative flex-none rounded-full bg-orange-600 hover:bg-orange-700 transition-colors duration-200 min-w-[20px]',
                thumbClassName
              )}
            />
            <div className="flex flex-none h-full min-w-[6px] shrink-0 items-center justify-center">
              <button
                type="button"
                aria-label="Rolar para direita"
                className={cn(
                  'scroll-area-arrow scroll-area-arrow-horizontal-right',
                  arrowClassName
                )}
                onClick={() => scroll(SCROLL_STEP, true)}
              />
            </div>
          </>
        )}
      </ScrollAreaPrimitive.ScrollAreaScrollbar>
    )
  }
)
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
