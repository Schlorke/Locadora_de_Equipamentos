import { useRef, useState } from 'react'
import { Button, Stack, Text } from '@gb-locacoes/ui'
import type { PublicarSiteProps } from '../model/contract'

export function PublicarSite(props: PublicarSiteProps) {
  return <OpenSetupPanel {...props} key={props.scope} />
}
function OpenSetupPanel({ openPanel, tenantSlug }: PublicarSiteProps) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const busy = useRef(false)
  async function open() {
    if (!openPanel || !tenantSlug || busy.current) return
    busy.current = true
    setPending(true)
    setFailed(false)
    try {
      await openPanel(tenantSlug)
    } catch {
      setFailed(true)
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  return (
    <Stack gap="sm">
      <Text>
        Continue a configuração e confirme a publicação no painel web. O
        navegador pode solicitar seu login.
      </Text>
      {openPanel && tenantSlug ? (
        <Button disabled={pending} onClick={() => void open()}>
          {pending ? 'Abrindo painel...' : 'Continuar no painel web'}
        </Button>
      ) : null}
      {failed ? (
        <Text tone="danger">
          Não foi possível abrir o painel. Tente novamente.
        </Text>
      ) : null}
    </Stack>
  )
}
