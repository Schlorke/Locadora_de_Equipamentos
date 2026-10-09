import { cancelAttempt } from '../../../packages/backend/src/modules/billing/cancel-attempt'
import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import {
  createAsaasHttpClient,
  parseAsaasAccountCreation,
  parseAsaasAccountStatus,
  sameAmount,
  toAsaasAmount,
  type AsaasEnvironment,
  type AsaasFetch,
  type CancellationState,
  type ChargeRequest,
  type ProviderCharge,
} from '@gb-locacoes/backend/billing'
import { BillingProviderError } from '../../../packages/backend/src/modules/billing/asaas-http'
import { createAsaasGateway } from '../../../packages/backend/src/modules/billing/asaas'
import {
  issuePayment,
  type IssuanceAttempt,
} from '../../../packages/backend/src/modules/billing/issue-payment'

import { alphanumericCnpjFor, SAMPLE_DOCUMENTS } from './documents'

/**
 * Alvo da suíte de contrato: o dublê (sempre) ou o sandbox do Asaas (lote S15, com
 * `ASAAS_SANDBOX_CONTRACT=1`). A suíte usa só a API pública do adapter, então a mesma prova vale
 * para os dois alvos.
 */
export interface AsaasContractTarget {
  readonly name: string
  readonly environment: AsaasEnvironment
  readonly rootApiKey: string
  /** Transporte do alvo; ausente = `fetch` global (sandbox real). */
  readonly fetch?: AsaasFetch
  /** Sufixo único por execução, para referências externas que não colidem entre execuções. */
  readonly uniqueSuffix: () => string
  /** Vencimento válido (hoje ou futuro, fuso de São Paulo). */
  readonly dueDate: () => string
  /** Se o alvo permite criar subcontas (o sandbox só com BaaS liberado pelo suporte). */
  readonly subaccounts: boolean
}

type Json = Record<string, unknown>

function counted(target: AsaasContractTarget) {
  const calls: string[] = []
  const transport =
    target.fetch ??
    ((url: string, init: RequestInit) => globalThis.fetch(url, init))
  const fetch: AsaasFetch = (url, init) => {
    calls.push(
      (init.method ?? 'GET') + ' ' + new URL(url).pathname.replace(/^\/v3/, '')
    )
    return transport(url, init)
  }
  return { calls, fetch }
}

function memoryIssuance(request: ChargeRequest) {
  // FAILED: recusa definitiva gravada por `reject`; a aplicação nunca entrega essa tentativa à emissão.
  const state = {
    value: 'QUEUED' as IssuanceAttempt['state'] | 'FAILED',
    issued: null as ProviderCharge | null,
    details: null as unknown,
  }
  return {
    state,
    repository: {
      load: async () => ({
        id: 'attempt-' + request.reference,
        state: state.value as IssuanceAttempt['state'],
        request,
      }),
      claim: async () => {
        if (state.value !== 'QUEUED') return false
        state.value = 'PROCESSING'
        return true
      },
      unknown: async () => {
        state.value = 'UNKNOWN'
      },
      release: async () => {
        if (state.value === 'PROCESSING') state.value = 'QUEUED'
      },
      reject: async () => {
        if (state.value === 'PROCESSING') state.value = 'FAILED'
      },
      // Sem `unknownSince` a conciliação nunca é pedida aqui; ainda assim só UNKNOWN volta à fila.
      requeue: async () => {
        if (state.value !== 'UNKNOWN') return false
        state.value = 'QUEUED'
        return true
      },
      issued: async (_id: string, charge: ProviderCharge, details: unknown) => {
        state.value = 'ISSUED'
        state.issued = charge
        state.details = details
      },
    },
  }
}

export function defineAsaasContractSuite(target: AsaasContractTarget): void {
  const root = (fetch?: AsaasFetch) => {
    const transport = fetch ?? target.fetch
    return createAsaasHttpClient({
      credential: target.rootApiKey,
      environment: target.environment,
      ...(transport ? { fetch: transport } : {}),
    })
  }
  // CNPJ alfanumérico próprio da execução, com máscara: execuções repetidas no sandbox não colidem.
  const runCnpj = alphanumericCnpjFor(target.uniqueSuffix())
  const maskedRunCnpj = runCnpj.replace(
    /^(.{2})(.{3})(.{3})(.{4})(.{2})$/,
    '$1.$2.$3/$4-$5'
  )
  const chargeRequest = (
    method: 'PIX' | 'BOLETO',
    amount: string
  ): ChargeRequest => ({
    reference: 'contract:' + method.toLowerCase() + ':' + target.uniqueSuffix(),
    amount: new Prisma.Decimal(amount),
    dueDate: target.dueDate(),
    description: 'Contrato Asaas ' + method,
    method,
    customer: {
      name: 'Cliente Contrato',
      email: 'contrato@example.test',
      document: maskedRunCnpj,
    },
  })

  describe('contrato Asaas (' + target.name + ')', () => {
    it('clientes: CNPJ alfanumérico e numérico chegam intactos e são encontrados por cpfCnpj', async () => {
      const client = root()
      for (const cpfCnpj of [
        SAMPLE_DOCUMENTS.alphanumericCnpj,
        SAMPLE_DOCUMENTS.cnpj,
      ]) {
        const created = (await client.request({
          method: 'POST',
          path: '/customers',
          body: {
            name: 'Cliente Contrato',
            cpfCnpj,
            email: 'contrato@example.test',
            notificationDisabled: true,
            externalReference: 'contract:customer:' + target.uniqueSuffix(),
          },
        })) as Json
        expect(created).toMatchObject({
          cpfCnpj,
          personType: 'JURIDICA',
          notificationDisabled: true,
          deleted: false,
        })
        const found = (await client.request({
          method: 'GET',
          path: '/customers',
          query: { cpfCnpj },
        })) as Json
        expect((found.data as Json[]).map((row) => row.id)).toContain(
          created.id
        )
      }
    })

    it('cobrança PIX: busca antes de criar, um único POST e QR lido do Asaas; valor em Decimal', async () => {
      const { calls, fetch } = counted(target)
      const gateway = createAsaasGateway({
        apiKey: target.rootApiKey,
        environment: target.environment,
        fetch,
      })
      const request = chargeRequest('PIX', '149.90')
      const issuance = memoryIssuance(request)
      await issuePayment(issuance.repository, gateway)
      await issuePayment(issuance.repository, gateway)
      expect(issuance.state.value).toBe('ISSUED')
      expect(calls.filter((call) => call === 'POST /payments')).toHaveLength(1)
      expect(calls.indexOf('GET /payments')).toBeLessThan(
        calls.indexOf('POST /payments')
      )
      expect(
        sameAmount(issuance.state.issued!.value, new Prisma.Decimal('149.90'))
      ).toBe(true)
      expect(issuance.state.details).toMatchObject({
        pixCode: expect.any(String),
        pixQrCode: expect.stringMatching(/^data:image\/png;base64,/),
      })
      expect(await gateway.find(request.reference)).toMatchObject({
        id: issuance.state.issued!.id,
        externalReference: request.reference,
      })
    })

    it('boleto: linha digitável na emissão e cancelamento com GET antes do único DELETE', async () => {
      const { calls, fetch } = counted(target)
      const gateway = createAsaasGateway({
        apiKey: target.rootApiKey,
        environment: target.environment,
        fetch,
      })
      const request = chargeRequest('BOLETO', '120.10')
      const issuance = memoryIssuance(request)
      await issuePayment(issuance.repository, gateway)
      expect(issuance.state.details).toMatchObject({
        digitableLine: expect.any(String),
      })
      const charge = issuance.state.issued!
      let state: CancellationState = 'REQUESTED'
      await cancelAttempt(
        {
          load: async () => ({
            id: 'cancel-1',
            externalId: charge.id,
            reference: request.reference,
            amount: new Prisma.Decimal('120.10'),
            state,
          }),
          claim: async () => {
            if (state !== 'REQUESTED') return false
            state = 'PROCESSING'
            return true
          },
          unknown: async () => {
            state = 'UNKNOWN'
          },
          release: async () => {
            if (state === 'PROCESSING') state = 'REQUESTED'
          },
          confirmed: async () => {
            state = 'CONFIRMED'
          },
          paid: async () => {
            throw new Error('unexpected paid')
          },
        },
        gateway
      )
      expect(state).toBe('CONFIRMED')
      expect(calls.filter((call) => call.startsWith('DELETE'))).toEqual([
        'DELETE /payments/' + charge.id,
      ])
      expect(calls.lastIndexOf('GET /payments/' + charge.id)).toBeLessThan(
        calls.indexOf('DELETE /payments/' + charge.id)
      )
      // VERIFICAR-SANDBOX: GET de cobrança removida devolve `deleted: true`.
      expect(await gateway.get(charge.id)).toMatchObject({
        id: charge.id,
        deleted: true,
      })
    })

    // A proibição de DELETE /subscriptions é política da plataforma, provada contra o dublê
    // (tests/contract/asaas-fake.test.ts); aqui só o que o Asaas faz com PUT INACTIVE.
    it('assinatura: UNDEFINED sem multa nem juros, busca por externalReference e PUT INACTIVE inativa sem remover', async () => {
      const client = root()
      const customer = (await client.request({
        method: 'POST',
        path: '/customers',
        body: {
          name: 'Locadora Contrato',
          cpfCnpj: SAMPLE_DOCUMENTS.cnpj,
          email: 'contrato@example.test',
          notificationDisabled: true,
        },
      })) as Json
      const externalReference = 'sub:' + target.uniqueSuffix()
      const created = (await client.request({
        method: 'POST',
        path: '/subscriptions',
        body: {
          customer: customer.id,
          billingType: 'UNDEFINED',
          value: toAsaasAmount(new Prisma.Decimal('149.90')),
          cycle: 'MONTHLY',
          nextDueDate: target.dueDate(),
          externalReference,
          description: 'Plataforma - Plano Contrato',
          fine: { value: 0 },
          interest: { value: 0 },
        },
      })) as Json
      expect(created).toMatchObject({
        status: 'ACTIVE',
        billingType: 'UNDEFINED',
        cycle: 'MONTHLY',
        externalReference,
      })
      expect(sameAmount(created.value, new Prisma.Decimal('149.90'))).toBe(true)
      const found = (await client.request({
        method: 'GET',
        path: '/subscriptions',
        query: { externalReference },
      })) as Json
      expect((found.data as Json[]).map((row) => row.id)).toEqual([created.id])
      const payments = (await client.request({
        method: 'GET',
        path: '/subscriptions/' + String(created.id) + '/payments',
      })) as Json
      // VERIFICAR-SANDBOX: a primeira fatura existe logo após a criação e tem invoiceUrl hospedado.
      expect((payments.data as Json[])[0]).toMatchObject({
        subscription: created.id,
        invoiceUrl: expect.stringMatching(/^https:\/\//),
      })
      const inactive = (await client.request({
        method: 'PUT',
        path: '/subscriptions/' + String(created.id),
        body: { status: 'INACTIVE' },
      })) as Json
      expect(inactive).toMatchObject({ id: created.id, status: 'INACTIVE' })
      // Inativar não é remover: a assinatura continua legível, inativa e não apagada.
      expect(
        await client.request({
          method: 'GET',
          path: '/subscriptions/' + String(created.id),
        })
      ).toMatchObject({ id: created.id, status: 'INACTIVE', deleted: false })
    })

    it('webhook: authToken aceito e nunca devolvido', async () => {
      const client = root()
      const authToken = 'ContratoToken' + 'x'.repeat(30)
      const created = (await client.request({
        method: 'POST',
        path: '/webhooks',
        body: {
          name: 'Contrato ' + target.uniqueSuffix(),
          url: 'https://app.plataforma.example.test/api/webhooks/asaas/platform',
          email: 'ops@example.test',
          enabled: true,
          interrupted: false,
          apiVersion: 3,
          authToken,
          sendType: 'SEQUENTIALLY',
          events: ['PAYMENT_RECEIVED', 'SUBSCRIPTION_CREATED'],
        },
      })) as Json
      expect(created).toMatchObject({
        hasAuthToken: true,
        enabled: true,
        interrupted: false,
        sendType: 'SEQUENTIALLY',
      })
      const read = await client.request({
        method: 'GET',
        path: '/webhooks/' + String(created.id),
      })
      expect(JSON.stringify([created, read])).not.toContain(authToken)
      await client.request({
        method: 'DELETE',
        path: '/webhooks/' + String(created.id),
      })
    })

    it.runIf(target.subaccounts)(
      'subconta: criação com webhooks[], chave devolvida autentica a própria subconta',
      async () => {
        const client = root()
        const body = await client.request({
          method: 'POST',
          path: '/accounts',
          body: {
            name: 'Locadora Contrato LTDA',
            email: 'locadora+' + target.uniqueSuffix() + '@example.test',
            cpfCnpj: SAMPLE_DOCUMENTS.cnpj,
            companyType: 'LIMITED',
            mobilePhone: '11900000000',
            incomeValue: 50000,
            address: 'Rua Exemplo',
            addressNumber: '100',
            province: 'Centro',
            postalCode: '01001000',
            site: 'https://contrato.plataforma.example.test',
            webhooks: [
              {
                name: 'Recebimentos',
                url: 'https://app.plataforma.example.test/api/webhooks/asaas/integration-contrato',
                email: 'ops@example.test',
                enabled: true,
                interrupted: false,
                apiVersion: 3,
                authToken: 'SubcontaToken' + 'y'.repeat(30),
                sendType: 'SEQUENTIALLY',
                events: [
                  'PAYMENT_RECEIVED',
                  'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
                ],
              },
            ],
          },
        })
        const account = parseAsaasAccountCreation(body)
        expect(account.credential).not.toBeNull()
        const sub = createAsaasHttpClient({
          credential: account.credential!.apiKey,
          environment: target.environment,
          ...(target.fetch ? { fetch: target.fetch } : {}),
        })
        const status = parseAsaasAccountStatus(
          await sub.request({ method: 'GET', path: '/myAccount/status' })
        )
        expect(status.general).toEqual(expect.any(String))
        const hooks = (await sub.request({
          method: 'GET',
          path: '/webhooks',
        })) as Json
        expect((hooks.data as Json[]).map((row) => row.url)).toContain(
          'https://app.plataforma.example.test/api/webhooks/asaas/integration-contrato'
        )
      }
    )

    it('erros: 400 traz só o código do Asaas; chave errada dá 401', async () => {
      const client = root()
      const invalid = await client
        .request({
          method: 'POST',
          path: '/customers',
          body: { name: 'Cliente Contrato', cpfCnpj: '11111111111' },
        })
        .catch((error: unknown) => error)
      expect(invalid).toBeInstanceOf(BillingProviderError)
      // VERIFICAR-SANDBOX: código `invalid_cpfCnpj` para documento inválido.
      expect(invalid).toMatchObject({
        code: 'REJECTED',
        reason: 'VALIDATION',
        status: 400,
        providerCodes: ['invalid_cpfCnpj'],
        message: 'REJECTED',
      })
      const wrong = createAsaasHttpClient({
        credential: '$aact_hmlg_FAKE_WRONG_KEY_000000000000',
        environment: target.environment,
        ...(target.fetch ? { fetch: target.fetch } : {}),
      })
      await expect(
        wrong.request({ method: 'GET', path: '/customers' })
      ).rejects.toMatchObject({
        code: 'REJECTED',
        reason: 'AUTHENTICATION',
        status: 401,
      })
    })
  })
}
