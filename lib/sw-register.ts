/**
 * Registro do Service Worker para GB-Locações
 *
 * Responsável por:
 * 1. Registrar o Service Worker
 * 2. Gerenciar atualizações
 * 3. Fornecer funções utilitárias para comunicação
 *
 * @version 1.0.0
 */

/**
 * Registra o Service Worker
 * Deve ser chamado no client-side apenas (useEffect, etc.)
 */
export async function registerServiceWorker() {
  // Verifica se o navegador suporta Service Worker
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('[SW] Service Worker não suportado neste navegador')
    return null
  }

  // Verifica se está em desenvolvimento
  const isDev = process.env.NODE_ENV === 'development'

  try {
    // Registra o Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    console.log('[SW] Service Worker registrado com sucesso')

    // Verifica se há atualização disponível
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing

      if (!newWorker) return

      newWorker.addEventListener('statechange', () => {
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          // Nova versão disponível
          console.log('[SW] Nova versão disponível')

          if (isDev) {
            // Em desenvolvimento, atualiza automaticamente
            newWorker.postMessage({ type: 'SKIP_WAITING' })
          } else {
            // Em produção, pode notificar o usuário (opcional)
            console.log('[SW] Recarregue a página para obter a nova versão')
          }
        }
      })
    })

    // Escuta mensagens do Service Worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('[SW] Mensagem recebida:', event.data)
    })

    // Recarrega quando o novo Service Worker assume o controle
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      console.log('[SW] Novo Service Worker assumiu o controle')

      if (!isDev) {
        // Em produção, pode recarregar automaticamente (opcional)
        // window.location.reload()
      }
    })

    return registration
  } catch (error) {
    console.error('[SW] Erro ao registrar Service Worker:', error)
    return null
  }
}
