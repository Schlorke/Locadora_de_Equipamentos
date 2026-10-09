import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'

/**
 * Transação por locadora da API pública de identity (`withTenantTransaction`
 * com `app.tenant_id` local), já ligada ao Prisma pela composição.
 */
export type TenantTransactionRunner = <T>(
  _context: TenantContext,
  _operation: (_tx: Prisma.TransactionClient) => Promise<T>
) => Promise<T>

/**
 * Transação de mutação de estoque/locação: `app.tenant_id` local, locadora
 * ativa e lock de mutação da locadora, nessa ordem, na mesma conexão.
 */
export type RentalTransaction = <T>(
  _context: TenantContext,
  _operation: (_tx: Prisma.TransactionClient) => Promise<T>
) => Promise<T>

/** Valor monetário Decimal (decimal.js); o módulo calcula com `Prisma.Decimal`. */
export type DecimalValue = Prisma.Decimal
