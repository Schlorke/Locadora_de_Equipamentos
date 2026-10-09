import type { PublicPlan } from '@gb-locacoes/contracts/subscription'
import type { HttpClient } from '../../../shared/api'
import { readPublicMonthlyPlans } from '../../../entities/plano'

/** O catálogo é público; identidade/locadora continuam pertencendo ao ciclo da tela. */
export async function readReactivationOffers(
  client: HttpClient
): Promise<PublicPlan[]> {
  return readPublicMonthlyPlans(client)
}
