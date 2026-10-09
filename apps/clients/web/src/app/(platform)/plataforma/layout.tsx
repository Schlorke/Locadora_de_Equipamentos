import type { ReactNode } from 'react'
import { PlatformProviders } from '../../../host/providers/PlatformProviders'

/** Páginas do apex (`<raiz>`). Alcançáveis só pelo rewrite do proxy (`/x` → `/plataforma/x`). */
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return <PlatformProviders>{children}</PlatformProviders>
}
