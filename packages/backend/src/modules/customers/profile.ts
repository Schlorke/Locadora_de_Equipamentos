import type { TenantPrincipal } from '../identity/index'
import {
  createSubscriptionCommandAccess,
  SubscriptionCommandError,
} from '../entitlements/command-admission'
import { CustomerError } from './errors'
import type { TenantTransactionRunner } from './types'

/** Alteração do perfil comercial já validada pelo contrato do adaptador. */
export type CustomerProfileInput = {
  phone?: string
  cnpj?: string
  cpf?: string
  company?: string
}

function profileDto(profile: {
  userId: string | null
  name: string
  email: string | null
  phone: string | null
  document: string | null
  company: string | null
}) {
  return {
    id: profile.userId,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    cpf: profile.document?.length === 11 ? profile.document : null,
    cnpj: profile.document?.length === 14 ? profile.document : null,
    company: profile.company,
  }
}

const profileKey = (principal: TenantPrincipal) => ({
  tenantId_userId: { tenantId: principal.tenantId, userId: principal.userId },
})

/**
 * Perfil comercial (ClientProfile) do usuário na locadora selecionada. Não há
 * fallback para cadastro global nem criação implícita de perfil.
 */
export function createCustomerProfileService({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  return {
    async getCustomerProfile(principal: TenantPrincipal) {
      const profile = await withTenantTransaction(principal, (tx) =>
        tx.clientProfile.findUnique({ where: profileKey(principal) })
      )
      if (!profile)
        throw new CustomerError('Perfil da locadora não encontrado', 404)
      return profileDto(profile)
    },
    /** Aceita somente CPF (11 dígitos) ou CNPJ (14 dígitos), nunca ambos. */
    async updateCustomerProfile(
      principal: TenantPrincipal,
      data: CustomerProfileInput
    ) {
      const cpf = data.cpf?.replace(/\D/g, '')
      const cnpj = data.cnpj?.replace(/\D/g, '')
      if (
        (cpf && cpf.length !== 11) ||
        (cnpj && cnpj.length !== 14) ||
        (cpf && cnpj)
      )
        throw new CustomerError('Informe somente CPF ou CNPJ válido', 400)
      return withTenantTransaction(principal, async (tx) => {
        const where = profileKey(principal)
        const profile = await tx.clientProfile.findUnique({ where })
        if (!profile)
          throw new CustomerError('Perfil da locadora não encontrado', 404)
        try {
          await createSubscriptionCommandAccess()(tx, principal, {
            ownProfileUserId: principal.userId,
          })
        } catch (error) {
          if (!(error instanceof SubscriptionCommandError)) throw error
          throw new CustomerError(error.message, error.status, error.body)
        }
        const updated = await tx.clientProfile.update({
          where,
          data: {
            ...(data.phone !== undefined
              ? { phone: data.phone.replace(/\D/g, '') || null }
              : {}),
            ...(cpf || cnpj ? { document: cpf || cnpj } : {}),
            ...(data.company !== undefined
              ? { company: data.company.trim() || null }
              : {}),
          },
        })
        return profileDto(updated)
      })
    },
  }
}

export type CustomerProfileService = ReturnType<
  typeof createCustomerProfileService
>
