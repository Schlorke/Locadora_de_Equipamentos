'use client'

import { isAbortError } from '../../../shared/api'
import { useSettingsApi } from '../api/use-settings-api'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

interface SettingsContextType {
  settings: Record<string, unknown> | null
  loading: boolean
  refresh: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { getSettings, isCurrent } = useSettingsApi()
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const result = await getSettings()
      if (result.success && result.data) {
        setSettings(result.data)
      }
    } catch (error) {
      if (isAbortError(error) || !isCurrent()) return
      console.error('Erro ao carregar configurações:', error)
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }, [getSettings, isCurrent])

  useEffect(() => {
    setSettings(null)
    loadSettings()
  }, [loadSettings])

  const refresh = async () => {
    await loadSettings()
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings deve ser usado dentro de um SettingsProvider')
  }
  return context
}

// Hook para configurações específicas
export function useCompanyInfo() {
  const { settings } = useSettings()

  return {
    companyPhone: settings?.companyPhone || '',
    companyAddress: settings?.companyAddress || '',
    contactEmail: settings?.contactEmail || '',
    marketingEmail: settings?.marketingEmail || '',
    whatsappNumber: settings?.whatsappNumber || '',
    aboutUsText: settings?.aboutUsText || '',
  }
}

export function useSocialLinks() {
  const { settings } = useSettings()

  return settings?.socialLinks || {}
}

export function useSEOSettings() {
  const { settings } = useSettings()

  return {
    seoTitle: settings?.seoTitle || 'Locação de Equipamentos para Construção',
    seoDescription:
      settings?.seoDescription ||
      'Locação de equipamentos para construção civil',
    favicon: settings?.favicon || '',
  }
}

export function useThemeSettings() {
  const { settings } = useSettings()

  return {
    themeColorPrimary: settings?.themeColorPrimary || '#ea580c', // token-check-allow: laranja primário padrão das settings
    logoSecondary: settings?.logoSecondary || '',
  }
}

export function useMaintenanceMode() {
  const { settings } = useSettings()

  return {
    maintenanceMode: settings?.maintenanceMode || false,
    maintenanceMessage:
      settings?.maintenanceMessage || 'Site em manutenção. Voltamos em breve!',
  }
}
