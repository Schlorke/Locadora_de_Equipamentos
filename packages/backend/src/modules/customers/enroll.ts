import { Prisma } from '@prisma/client'
import type { TenantTransactionRunner } from './types'

/**
 * Vínculo explícito de um usuário como CLIENTE da locadora do host
 * (docs/architecture/adr-tenant-hosts.md, D9 e "Identidade (Lote 6)").
 *
 * - A locadora chega já resolvida pela BORDA (host de locadora); nada do
 *   cliente escolhe a locadora nem o papel.
 * - Cria `Membership(CLIENT, ACTIVE)` e o `ClientProfile` com os dados de
 *   cadastro do usuário, com o consentimento registrado em `AuditLog`, tudo na
 *   mesma `withTenantTransaction`.
 * - Nunca cria nem promove papel de equipe; um vínculo existente e ativo é
 *   devolvido como está (qualquer papel).
 * - Vínculo suspenso ou revogado NÃO é reativado: 403 sem nenhuma escrita.
 */

export type EnrollmentFailureCode =
  | 'TENANT_UNAVAILABLE'
  | 'USER_NOT_FOUND'
  | 'MEMBERSHIP_INACTIVE'
  | 'PROFILE_CONFLICT'

export class EnrollmentError extends Error {
  readonly status: 401 | 403 | 404 | 409
  readonly code: EnrollmentFailureCode
  constructor(
    message: string,
    status: 401 | 403 | 404 | 409,
    code: EnrollmentFailureCode
  ) {
    super(message)
    this.name = 'EnrollmentError'
    this.status = status
    this.code = code
  }
}

export type EnrollmentInput = {
  /** Locadora da borda (host de locadora), já validada como ACTIVE. */
  tenantId: string
  userId: string
  /** IP informado pela borda, guardado com o registro do consentimento. */
  clientIp?: string | null
  userAgent?: string | null
}

export type Enrollment = {
  /** `true` quando este pedido criou o vínculo. */
  created: boolean
  membership: {
    membershipId: string
    role: 'ADMIN' | 'FINANCIAL' | 'OPERATOR' | 'CLIENT'
    tenant: {
      id: string
      slug: string
      name: string
      status: 'ACTIVE' | 'SUSPENDED'
    }
  }
}

const MEMBERSHIP_SELECT = {
  id: true,
  role: true,
  status: true,
  tenantId: true,
  userId: true,
} as const

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

function digits(value: string | null | undefined): string | null {
  const only = value?.replace(/\D/g, '') ?? ''
  return only ? only : null
}

export function createCustomerEnrollmentService({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  const attempt = (input: EnrollmentInput) =>
    withTenantTransaction({ tenantId: input.tenantId }, async (tx) => {
      const organization = await tx.organization.findUnique({
        where: { id: input.tenantId },
        select: { id: true, slug: true, name: true, status: true },
      })
      if (!organization || organization.status !== 'ACTIVE')
        throw new EnrollmentError(
          'Locadora não encontrada',
          404,
          'TENANT_UNAVAILABLE'
        )
      const tenant = {
        id: organization.id,
        slug: organization.slug,
        name: organization.name,
        status: organization.status,
      }
      const key = {
        tenantId_userId: { tenantId: input.tenantId, userId: input.userId },
      }
      const existing = await tx.membership.findUnique({
        where: key,
        select: MEMBERSHIP_SELECT,
      })
      if (existing) {
        if (existing.status !== 'ACTIVE')
          throw new EnrollmentError(
            'Vínculo com esta locadora indisponível',
            403,
            'MEMBERSHIP_INACTIVE'
          )
        return {
          created: false,
          membership: {
            membershipId: existing.id,
            role: existing.role,
            tenant,
          },
        } satisfies Enrollment
      }

      const user = await tx.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          cpf: true,
          cnpj: true,
          company: true,
        },
      })
      if (!user)
        throw new EnrollmentError(
          'Authentication required',
          401,
          'USER_NOT_FOUND'
        )
      const document = digits(user.cpf) ?? digits(user.cnpj)
      const profile = await tx.clientProfile.findUnique({ where: key })
      if (!profile && document) {
        // Documento já cadastrado nesta locadora para outra pessoa: nunca
        // assume o perfil alheio.
        const holder = await tx.clientProfile.findUnique({
          where: {
            tenantId_document: { tenantId: input.tenantId, document },
          },
          select: { userId: true },
        })
        if (holder && holder.userId !== user.id)
          throw new EnrollmentError(
            'Não foi possível concluir o vínculo. Fale com a locadora.',
            409,
            'PROFILE_CONFLICT'
          )
      }

      const membership = await tx.membership.create({
        data: {
          tenantId: input.tenantId,
          userId: user.id,
          // Papel fixo: o vínculo pelo site da locadora é sempre de cliente.
          role: 'CLIENT',
          status: 'ACTIVE',
        },
        select: MEMBERSHIP_SELECT,
      })
      if (!profile) {
        await tx.clientProfile.create({
          data: {
            tenantId: input.tenantId,
            userId: user.id,
            name: user.name?.trim() || user.email,
            email: user.email,
            phone: digits(user.phone),
            document,
            company: user.company?.trim() || null,
          },
        })
      }
      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          userId: user.id,
          action: 'CLIENT_ENROLLED',
          entity: 'Membership',
          entityId: membership.id,
          changes: { role: 'CLIENT', consent: true },
          ipAddress: input.clientIp ?? null,
          userAgent: input.userAgent?.slice(0, 512) ?? null,
        },
      })
      return {
        created: true,
        membership: {
          membershipId: membership.id,
          role: membership.role,
          tenant,
        },
      } satisfies Enrollment
    })

  return {
    async enrollClient(input: EnrollmentInput): Promise<Enrollment> {
      try {
        return await attempt(input)
      } catch (error) {
        if (!isUniqueViolation(error)) throw error
        // Corrida entre dois pedidos: o vínculo já existe (ou o documento
        // passou a pertencer a outro perfil). Relê sem escrever de novo.
        try {
          return await attempt(input)
        } catch (second) {
          if (isUniqueViolation(second))
            throw new EnrollmentError(
              'Não foi possível concluir o vínculo. Fale com a locadora.',
              409,
              'PROFILE_CONFLICT'
            )
          throw second
        }
      }
    },
  }
}

export type CustomerEnrollmentService = ReturnType<
  typeof createCustomerEnrollmentService
>
