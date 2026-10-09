import { z } from 'zod'
import { CompanyTypeSchema } from '@gb-locacoes/contracts/onboarding'
import { BrazilianMobilePhoneSchema } from '@gb-locacoes/contracts/payment-account'
import { normalizarCnpj, validarCnpj } from '@gb-locacoes/domain/documento'
import { asaasAccountWebhookBody } from './asaas-account-webhooks'
import { parseAsaasAccountCreation } from './asaas'
import { toAsaasAmount, type Money } from './asaas-amount'
import {
  asaasPath,
  BillingProviderError,
  createAsaasHttpClient,
  type AsaasHttpClientConfig,
  type AsaasSecret,
} from './asaas-http'

export type AsaasSubaccountReference = {
  id: string
  document: string
  walletId: string | null
}
export type AsaasSubaccountInput = {
  name: string
  cpfCnpj: string
  email: string
  loginEmail: string
  companyType: z.infer<typeof CompanyTypeSchema>
  mobilePhone: string
  site: string
  incomeValue: Money
  address: string
  addressNumber: string
  complement?: string
  province: string
  postalCode: string
  webhook: { name: string; url: string; email: string; token: AsaasSecret }
}
/** Company part of the creation body, validated before the owner confirms it and again before the POST. */
export type AsaasSubaccountCompany = Omit<
  AsaasSubaccountInput,
  'mobilePhone' | 'incomeValue' | 'webhook'
>
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const referenceSchema = z.object({
  id: idSchema,
  cpfCnpj: z.string(),
  walletId: idSchema.nullable().optional(),
})
const companySchema = z.strictObject({
  name: z.string().trim().min(1).max(128),
  cpfCnpj: z.string(),
  email: z.email().max(254),
  loginEmail: z.email().max(254),
  companyType: CompanyTypeSchema,
  site: z.string().url().max(2048),
  address: z.string().trim().min(1).max(200),
  addressNumber: z.string().trim().min(1).max(32),
  complement: z.string().trim().max(100).optional(),
  province: z.string().trim().min(1).max(100),
  postalCode: z.string().regex(/^\d{8}$/),
})
const reject = (
  reason: 'INVALID_REQUEST' | 'UNEXPECTED_SHAPE' | 'AMBIGUOUS_MATCH',
  remote = false
): never => {
  throw new BillingProviderError(remote ? 'INVALID_RESPONSE' : 'REJECTED', {
    reason,
  })
}
function documentOf(value: string, remote = false) {
  if (!validarCnpj(value))
    return reject(remote ? 'UNEXPECTED_SHAPE' : 'INVALID_REQUEST', remote)
  return normalizarCnpj(value)
}
/**
 * Local validation of the company data sent on creation (no provider I/O): the registration as the owner sees it
 * and as POST /accounts sends it. Throws `REJECTED`/`INVALID_REQUEST` without echoing any value.
 */
export function checkSubaccountCompany(values: AsaasSubaccountCompany) {
  const parsed = companySchema.safeParse(values)
  if (!parsed.success) return reject('INVALID_REQUEST')
  const cpfCnpj = documentOf(parsed.data.cpfCnpj),
    site = new URL(parsed.data.site)
  if (
    site.protocol !== 'https:' ||
    site.username ||
    site.password ||
    site.pathname !== '/' ||
    site.search ||
    site.hash
  )
    return reject('INVALID_REQUEST')
  return { ...parsed.data, cpfCnpj, site: site.origin }
}

/**
 * The exact POST /accounts body, built and validated without I/O. The creation worker calls it before recording
 * its durable intent, so an invalid body never becomes an uncertain creation. Never log the result: it carries the
 * webhook token.
 */
export function checkSubaccountInput(input: AsaasSubaccountInput) {
  const { incomeValue, webhook, mobilePhone, ...company } = input
  const checked = checkSubaccountCompany(company)
  const phone = BrazilianMobilePhoneSchema.safeParse(mobilePhone)
  if (!phone.success) return reject('INVALID_REQUEST')
  return {
    ...checked,
    mobilePhone: phone.data,
    incomeValue: toAsaasAmount(incomeValue),
    webhooks: [
      {
        ...asaasAccountWebhookBody(webhook),
        email: webhook.email,
        apiVersion: 3,
      },
    ],
  }
}

function reference(value: unknown, document: string): AsaasSubaccountReference {
  const parsed = referenceSchema.safeParse(value)
  if (!parsed.success) return reject('UNEXPECTED_SHAPE', true)
  const actual = documentOf(parsed.data.cpfCnpj, true)
  if (actual !== document) return reject('AMBIGUOUS_MATCH')
  return {
    id: parsed.data.id,
    document: actual,
    walletId: parsed.data.walletId ?? null,
  }
}

/** Root configuration is injected. No environment lookup, automatic retry or fallback to a tenant credential. */
export function createAsaasSubaccounts(config: AsaasHttpClientConfig) {
  const http = createAsaasHttpClient(config)
  return {
    async find(cpfCnpj: string): Promise<AsaasSubaccountReference | null> {
      const document = documentOf(cpfCnpj)
      const page = await http.request({
        method: 'GET',
        path: '/accounts',
        query: { cpfCnpj: document, offset: 0, limit: 2 },
      })
      const parsed = z
        .object({
          data: z.array(referenceSchema),
          hasMore: z.boolean(),
          totalCount: z.number().int().min(0).optional(),
        })
        .safeParse(page)
      if (!parsed.success) return reject('UNEXPECTED_SHAPE', true)
      if (
        parsed.data.hasMore ||
        parsed.data.data.length > 1 ||
        (parsed.data.totalCount != null &&
          parsed.data.totalCount !== parsed.data.data.length)
      )
        return reject('AMBIGUOUS_MATCH')
      const row = parsed.data.data[0]
      if (!row) return null
      reference(row, document)
      const found = reference(
        await http.request({
          method: 'GET',
          path: asaasPath`/accounts/${row.id}`,
        }),
        document
      )
      if (found.id !== row.id) return reject('AMBIGUOUS_MATCH')
      if (row.walletId && found.walletId !== row.walletId)
        return reject('AMBIGUOUS_MATCH')
      return found
    },
    async create(input: AsaasSubaccountInput) {
      const body = checkSubaccountInput(input)
      // The caller must persist its creation intent before this POST and immediately seal the returned credential.
      const response = await http.request({
        method: 'POST',
        path: '/accounts',
        body,
        timeoutMs: 60_000,
      })
      try {
        const account = parseAsaasAccountCreation(response)
        if (
          !idSchema.safeParse(account.id).success ||
          (account.walletId && !idSchema.safeParse(account.walletId).success)
        )
          return reject('UNEXPECTED_SHAPE', true)
        return account
      } catch (error) {
        if (error instanceof BillingProviderError)
          throw new BillingProviderError('INVALID_RESPONSE', {
            reason: error.reason ?? 'UNEXPECTED_SHAPE',
            maybeApplied: true,
          })
        throw new BillingProviderError('INVALID_RESPONSE', {
          reason: 'UNEXPECTED_SHAPE',
          maybeApplied: true,
        })
      }
    },
  }
}
