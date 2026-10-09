'use client'
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@gb-locacoes/ui'
import type { AccountRecoveryView } from '@gb-locacoes/contracts/payment-account'
import { useAccountRecovery } from '../model/use-account-recovery'

const descriptions: Record<AccountRecoveryView['state'], string> = {
  WAITING: 'A conferência dos pagamentos aguarda processamento.',
  CHECKING: 'Os pagamentos estão sendo conferidos em etapas.',
  REVIEW_REQUIRED: 'Existem divergências que precisam de revisão pelo suporte.',
  SNAPSHOT_COMPLETE:
    'A conferência dos pagamentos registrados terminou. Isso não confirma que a comunicação foi recuperada.',
  ACCESS_REQUIRED:
    'O acesso à instituição de pagamentos precisa ser revisado antes da conferência.',
}
export function AccountRecovery({
  scope,
  reauthenticationUrl,
}: {
  scope: string
  reauthenticationUrl: string
}) {
  const recovery = useAccountRecovery(scope)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperação dos recebimentos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {recovery.loading ? (
          <p role="status">Consultando a conferência dos pagamentos...</p>
        ) : null}
        {recovery.failed ? (
          <Alert>
            <AlertDescription>
              Não foi possível consultar a conferência dos pagamentos.
            </AlertDescription>
          </Alert>
        ) : null}
        {recovery.view ? (
          <>
            <p>{descriptions[recovery.view.state]}</p>
            <p>{recovery.view.checked} pagamentos conferidos.</p>
            {recovery.view.lastCheckedAt ? (
              <p>
                Último registro da conferência:{' '}
                {new Intl.DateTimeFormat('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(recovery.view.lastCheckedAt))}
              </p>
            ) : null}
            <Alert>
              <AlertDescription>
                Os recebimentos continuam restritos até a revisão e a
                confirmação de novas entregas. Este pedido não libera
                pagamentos.
              </AlertDescription>
            </Alert>
            {recovery.view.requestPending && !recovery.view.canRequest ? (
              <p role="status">
                Uma conferência já está aguardando ou em processamento.
              </p>
            ) : null}
            {recovery.view.requestPending && recovery.view.canRequest ? (
              <p>
                A próxima inspeção já está agendada. Uma nova conferência usará
                essa agenda, respeitando o tempo de espera.
              </p>
            ) : null}
            {recovery.action === 'confirmation' ? (
              <Alert>
                <AlertDescription>
                  {recovery.view.state === 'SNAPSHOT_COMPLETE'
                    ? 'Solicitar uma nova conferência para consultar novamente os pagamentos desta locadora? A conferência anterior será mantida no histórico.'
                    : 'Solicitar uma nova conferência dos pagamentos desta locadora?'}
                </AlertDescription>
                <Button onClick={recovery.submit}>Confirmar conferência</Button>
                <Button variant="outline" onClick={recovery.cancel}>
                  Cancelar
                </Button>
              </Alert>
            ) : null}
            {recovery.view.canRequest && recovery.action === 'idle' ? (
              <Button variant="outline" onClick={recovery.confirm}>
                Solicitar nova conferência
              </Button>
            ) : null}
          </>
        ) : null}
        {recovery.action === 'pending' ? (
          <p role="status">Enviando o pedido de conferência...</p>
        ) : null}
        {recovery.action === 'accepted' ? (
          <p role="status">
            Conferência solicitada. Atualize a consulta para acompanhar.
          </p>
        ) : null}
        {recovery.action === 'reauthentication' ||
        recovery.action === 'session' ? (
          <a href={reauthenticationUrl}>Entrar novamente para confirmar</a>
        ) : null}
        {recovery.action === 'owner' || recovery.action === 'review' ? (
          <p role="alert">
            Esta conferência precisa de revisão pelo dono ou pelo suporte.
          </p>
        ) : null}
        {recovery.action === 'uncertain' ? (
          <p role="alert">
            Não foi possível confirmar o pedido. Atualize a consulta antes de
            solicitar novamente.
          </p>
        ) : null}
        <Button
          variant="outline"
          disabled={recovery.loading || recovery.action === 'pending'}
          onClick={recovery.reload}
        >
          Atualizar conferência
        </Button>
      </CardContent>
    </Card>
  )
}
