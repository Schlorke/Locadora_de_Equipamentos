'use client'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@gb-locacoes/ui'
import type { OnboardingCaptchaProps } from '@gb-locacoes/frontend/pages/onboarding'
type Turnstile = {
  render(
    element: HTMLElement,
    options: {
      sitekey: string
      action: 'onboarding'
      appearance: 'interaction-only'
      callback(token: string): void
      'expired-callback'(): void
      'error-callback'(): void
      'timeout-callback'(): void
    }
  ): string
  remove(id: string): void
}
declare global {
  interface Window {
    turnstile?: Turnstile
  }
}
let loading: Promise<Turnstile> | null = null
function load(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!loading) {
    loading = new Promise<Turnstile>((resolve, reject) => {
      const script = document.createElement('script')
      const failed = () => {
        script.remove()
        clearTimeout(timer)
        reject(new Error('Captcha unavailable'))
      }
      const timer = setTimeout(failed, 10_000)
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.onerror = failed
      script.onload = () => {
        clearTimeout(timer)
        if (window.turnstile) resolve(window.turnstile)
        else failed()
      }
      document.head.appendChild(script)
    }).catch((problem) => {
      loading = null
      throw problem
    })
  }
  return loading
}
/** Browser-only platform adapter. Tokens and provider errors never enter draft storage. */
export function OnboardingCaptcha({
  siteKey,
  attempt,
  onToken,
}: OnboardingCaptchaProps) {
  const element = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let disposed = false,
      id: string | undefined,
      sdk: Turnstile | undefined
    onToken(null)
    setFailed(false)
    const expired = () => {
      if (!disposed) {
        onToken(null)
        setFailed(true)
      }
    }
    void load()
      .then((loaded) => {
        if (disposed || !element.current) return
        sdk = loaded
        id = loaded.render(element.current, {
          sitekey: siteKey,
          action: 'onboarding',
          appearance: 'interaction-only',
          callback: (token) => {
            if (!disposed) {
              setFailed(false)
              onToken(token)
            }
          },
          'expired-callback': expired,
          'error-callback': expired,
          'timeout-callback': expired,
        })
      })
      .catch(expired)
    return () => {
      disposed = true
      if (id !== undefined) sdk?.remove(id)
    }
  }, [siteKey, attempt, onToken, retry])
  return (
    <div>
      <div ref={element} />
      {failed && (
        <div>
          <p role="alert">
            A verificação de segurança expirou ou está indisponível. Atualize as
            opções para tentar novamente.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Refazer verificação de segurança
          </Button>
        </div>
      )}
    </div>
  )
}
