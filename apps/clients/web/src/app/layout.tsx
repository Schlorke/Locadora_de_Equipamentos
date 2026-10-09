import type { ReactNode } from 'react'
import { Inter, Jost } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import dynamic from 'next/dynamic'
import { themes } from '@gb-locacoes/design-tokens'
import '@gb-locacoes/frontend/app/styles.css'
// Medição da plataforma, por projeto (Vercel Analytics e Speed Insights), sem dado de locadora: volta como a raiz legada
// fazia, carregada sob demanda para não pesar no carregamento inicial (onda 135, A11; decisão do dono D4). A medição de
// cada locadora (GA4, Google Ads) fica no layout [locadora], só com os IDs dela.
const Analytics = dynamic(() => import('@vercel/analytics/next').then((mod) => ({ default: mod.Analytics })))
const SpeedInsights = dynamic(() => import('@vercel/speed-insights/next').then((mod) => ({ default: mod.SpeedInsights })))
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter', preload: true, fallback: ['system-ui', 'arial'] })
const jost = Jost({ subsets: ['latin'], display: 'swap', variable: '--font-jost', preload: false, fallback: ['Georgia', 'serif'], adjustFontFallback: false })
export const metadata: Metadata = { title: 'Locação de equipamentos', description: 'Catálogo e gestão de locação de equipamentos' }
export const viewport: Viewport = { themeColor: themes.light.surface, width: 'device-width', initialScale: 1, viewportFit: 'cover' }
// Layout raiz único (navegação suave entre grupos): só documento, fontes e CSS, sem providers e sem dados.
// Os providers ficam no layout de cada host: (public)/[locadora] (locadora), (auth)/(admin)/(labs) (host app) e
// (platform)/plataforma (apex). Sem Suspense aqui: o notFound() do layout [locadora] sai com status 404.
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="pt-BR" className={`${inter.variable} ${jost.variable}`} suppressHydrationWarning><body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>{children}<SpeedInsights /><Analytics /></body></html>
}
