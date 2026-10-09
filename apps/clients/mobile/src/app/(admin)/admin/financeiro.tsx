import { useCallback } from 'react'
import { Alert } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { AdminFinanceiroPageWrapper } from '@gb-locacoes/frontend/pages/financeiro'
import { shareDownloadedContract } from '../../../host/contract-share'
import { useHostNavigation } from '../../../host/use-host-navigation'
const requestRegeneration: Parameters<
  typeof AdminFinanceiroPageWrapper
>[0]['requestRegeneration'] = (message) =>
  new Promise<boolean>((resolve) => {
    Alert.alert(
      'Reemissão de boleto',
      message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Confirmar', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    )
  })
export default function FinancialRoute() {
  const params = useLocalSearchParams<{
    search?: string
    status?: string
    quoteId?: string
  }>()
  const navigation = useHostNavigation()
  const navigate = useCallback(
    (path: string) => navigation.push(path),
    [navigation]
  )
  const value = (input: string | string[] | undefined) =>
    Array.isArray(input) ? input[0] : input
  return (
    <AdminFinanceiroPageWrapper
      initialSearch={value(params.search)}
      initialStatus={value(params.status)}
      requestedQuoteId={value(params.quoteId)}
      navigate={navigate}
      requestRegeneration={requestRegeneration}
      shareDocument={shareDownloadedContract}
    />
  )
}
