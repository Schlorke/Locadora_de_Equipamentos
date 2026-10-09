import { useCallback, useEffect, useRef, useState } from 'react'
import { Text } from 'react-native'
import { Button, Dialog, useTheme } from '@gb-locacoes/ui'
export function useEquipmentConfirmation() {
  const [message, setMessage] = useState<string | null>(null)
  const pending = useRef<((value: boolean) => void) | null>(null)
  const requestConfirmation = useCallback(
    (text: string) =>
      new Promise<boolean>((resolve) => {
        pending.current?.(false)
        pending.current = resolve
        setMessage(text)
      }),
    []
  )
  const finish = useCallback((value: boolean) => {
    const resolve = pending.current
    pending.current = null
    setMessage(null)
    resolve?.(value)
  }, [])
  useEffect(
    () => () => {
      pending.current?.(false)
      pending.current = null
    },
    []
  )
  return { message, requestConfirmation, finish }
}
export function EquipmentConfirmation({
  message,
  finish,
}: {
  message: string | null
  finish: (value: boolean) => void
}) {
  const theme = useTheme()
  return (
    <Dialog.Root
      open={message !== null}
      onOpenChange={(open) => {
        if (!open) finish(false)
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Confirmar Exclusão</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text style={{ color: theme.text }}>{message}</Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={() => finish(false)}>
                Cancelar Exclusão
              </Button>
              <Button onClick={() => finish(true)}>Confirmar Exclusão</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
