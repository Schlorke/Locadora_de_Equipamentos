import { Toaster } from '@gb-locacoes/ui'
import { useCallback,useEffect,useMemo,useState,type ReactElement } from 'react'
import { Stack, useRouter, useGlobalSearchParams,usePathname } from 'expo-router'
import * as Linking from 'expo-linking'
import { AppProviders, PrivateAreaGate, createHttpClient,withPublicTenant,type TenantContext } from '@gb-locacoes/frontend/app'

import { deviceActions } from '../host/device'
import { hostAuth, authMode, apiBaseUrl } from '../host/auth/client'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createHostNavigation, isPrivateAreaPath } from '../host/navigation'

const apiClient = createHttpClient({
  baseUrl: apiBaseUrl,
  credentials: authMode === 'legacy' ? 'include' : 'omit',
  getHeaders: hostAuth.getApiHeaders,
  requireBaseUrl: true,
})

/** Nome de rota do expo-router ("(admin)/admin/dashboard") → caminho da URL ("/admin/dashboard"): grupos e index não entram. */
function routePathOf(routeName: string): string {
  const segments = routeName.split('/').filter((segment) => !/^\(.+\)$/.test(segment))
  if (segments[segments.length - 1] === 'index') segments.pop()
  return '/' + segments.join('/')
}

/**
 * O portão de área privada fica DENTRO de cada tela: o <Stack/> nunca é desmontado pelo bootstrap (desmontá-lo zera o
 * estado de navegação e perde a rota privada). Cada tela decide pela própria rota, não pela rota atual.
 */
function gatedScreen({ route, children }: { route: { name: string }; children: ReactElement }) {
  return <PrivateAreaGate privateArea={isPrivateAreaPath(routePathOf(route.name))}>{children}</PrivateAreaGate>
}

export default function RootLayout() {
  const router = useRouter()
  const { tenantSlug } = useGlobalSearchParams<{ tenantSlug?: string }>()
  const pathname=usePathname(),[remembered,setRemembered]=useState<string|null>(null),slug=tenantSlug??remembered
  useEffect(()=>{let active=true;if(tenantSlug){setRemembered(tenantSlug);void AsyncStorage.setItem('public-tenant-slug',tenantSlug)}else{void AsyncStorage.getItem('public-tenant-slug').then(saved=>{if(active&&saved){setRemembered(saved);router.setParams({tenantSlug:saved})}})}return()=>{active=false}},[tenantSlug,router])
  const resolveHref=useCallback((href:string)=>withPublicTenant(href,slug),[slug])
  const selected=useCallback((selection:TenantContext)=>{setRemembered(selection.tenant.slug);router.setParams({tenantSlug:selection.tenant.slug});void AsyncStorage.setItem('public-tenant-slug',selection.tenant.slug)},[router])
  const navigation = useMemo(
    () => createHostNavigation({ router, openURL: Linking.openURL, resolveHref }),
    [router,resolveHref]
  )

  return (
    <AppProviders
      deviceActions={deviceActions}
      apiClient={apiClient}
      navigate={navigation.push}
      publicTenantSlug={slug}
      auth={hostAuth}
      resolveHref={resolveHref}
      privateArea={isPrivateAreaPath(pathname)}
      refreshKey={pathname}
      persistSelection
      onTenantSelected={selected}
    >
      <Stack screenOptions={{ headerShown: false }} screenLayout={gatedScreen} />
      <Toaster />
    </AppProviders>
  )
}
