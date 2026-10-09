/**
 * Tipos para os custom elements do Google Maps Extended Component Library
 * (Store Locator / gmpx-api-loader, gmpx-store-locator).
 */
import type { HTMLAttributes } from 'react'

declare module 'react' {
  interface IntrinsicElements {
    'gmpx-api-loader': HTMLAttributes<HTMLElement> & {
      'solution-channel'?: string
    }
    'gmpx-store-locator': HTMLAttributes<HTMLElement> & {
      'map-id'?: string
    }
  }
}
