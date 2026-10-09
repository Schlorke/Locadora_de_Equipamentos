import { integrationCredentialReference } from '../../runtime/index'
import type { Prisma } from '@prisma/client'
import {
  ChargeRequestRejected,
  issuePayment,
  isSettledUnknown,
  ReconciliationRequired,
  UNKNOWN_ISSUANCE_SETTLE_MS,
  type IssuanceAttempt,
  type IssuanceRepository,
} from './issue-payment'
import { createAsaasGateway, isChargePaid } from './asaas'
import { PermanentDeliveryError, enqueueOutbox } from '../outbox/index'
import type {
  RentalTransaction,
  TenantTransactionRunner,
} from '../rentals/index'
import type { BillingCredentialResolver } from './payment-obligation'
export function createPaymentIssuance({
  withRentalTransaction,
  withTenantTransaction,
  resolveIntegrationCredential,
}: {
  withRentalTransaction: RentalTransaction
  withTenantTransaction: TenantTransactionRunner
  resolveIntegrationCredential: BillingCredentialResolver
}) {
  async function issueTenantPayment(
    context: { tenantId: string },
    paymentId: string
  ) {
    const prepared = await withRentalTransaction(context, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.tenantId + ':issue:' + paymentId}, 0))`
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, tenantId: context.tenantId },
        include: { quote: true, rental: { include: { quote: true } } },
      })
      if (
        !payment ||
        ['PAID', 'CANCELLED', 'REFUNDED'].includes(payment.status)
      )
        return null
      if (payment.method !== 'PIX' && payment.method !== 'BOLETO')
        throw new PermanentDeliveryError('UNSUPPORTED_PAYMENT_METHOD')
      let attempt = await tx.paymentAttempt.findFirst({
        where: { tenantId: context.tenantId, paymentId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
      if (payment.transactionId && !attempt)
        throw new PermanentDeliveryError('LEGACY_PAYMENT_REQUIRES_MAPPING')
      const integrations = await tx.tenantIntegration.findMany({
        where: {
          tenantId: context.tenantId,
          provider: 'ASAAS',
          status: 'ACTIVE',
          ...(attempt?.integrationId ? { id: attempt.integrationId } : {}),
        },
      })
      if (integrations.length !== 1)
        throw new Error('BILLING_INTEGRATION_UNAVAILABLE')
      const integration = integrations[0]!
      if (!attempt)
        attempt = await tx.paymentAttempt.create({
          data: {
            tenantId: context.tenantId,
            paymentId,
            integrationId: integration.id,
            provider: 'ASAAS',
            idempotencyKey:
              context.tenantId + ':payment:' + paymentId + ':initial',
            amount: payment.amount,
            dueDate: payment.dueDate,
          },
        })
      if (['PAID', 'CANCELLED', 'REFUNDED'].includes(attempt.status))
        return null
      if (
        !payment.amount.equals(attempt.amount) ||
        attempt.cancellationStatus !== 'NONE'
      )
        throw new PermanentDeliveryError('ATTEMPT_REQUIRES_REVIEW')
      if (
        !['QUEUED', 'PROCESSING', 'UNKNOWN', 'ISSUED'].includes(attempt.status)
      )
        throw new PermanentDeliveryError('ATTEMPT_REQUIRES_REVIEW')
      const quote = payment.quote ?? payment.rental?.quote
      const userId = payment.rental?.userid ?? quote?.userId
      const customer = userId
        ? await tx.clientProfile.findFirst({
            where: { tenantId: context.tenantId, userId },
          })
        : null
      const name = customer?.name ?? quote?.name
      const email = customer?.email ?? quote?.email
      const document = customer?.document ?? quote?.cpf ?? quote?.cnpj
      if (!name || !email || !document)
        throw new Error('TENANT_CUSTOMER_INCOMPLETE')
      return {
        payment,
        attempt,
        integration,
        customer: { name, email, document },
      }
    })
    if (!prepared) return
    const credential = await resolveIntegrationCredential(
      integrationCredentialReference(prepared.integration)
    )
    if (
      !credential?.apiKey ||
      (credential.environment !== 'sandbox' &&
        credential.environment !== 'production')
    ) {
      throw new Error('BILLING_INTEGRATION_UNAVAILABLE')
    }
    const state = prepared.attempt.status as IssuanceAttempt['state']
    // `updatedAt` marca o início do episódio incerto: a entrada em UNKNOWN (`unknown` não regrava uma
    // tentativa já UNKNOWN) ou a reserva (nada regrava uma tentativa PROCESSING sem mudar o estado).
    const unknownSince =
      state === 'UNKNOWN' || state === 'PROCESSING'
        ? prepared.attempt.updatedAt
        : null
    // Um relógio só: a emissão decide pela janela no mesmo instante em que `reconciling` foi medido.
    const now = new Date()
    const reconciling = isSettledUnknown({ state, unknownSince }, now)
    const repository: IssuanceRepository = {
      load: async () => ({
        id: prepared.attempt.id,
        state,
        unknownSince,
        request: {
          reference: prepared.attempt.idempotencyKey,
          amount: prepared.attempt.amount.toNumber(),
          dueDate: prepared.attempt.dueDate.toISOString().slice(0, 10),
          customer: prepared.customer,
          method: prepared.payment.method as 'PIX' | 'BOLETO',
          description: 'Locação de equipamentos ' + prepared.payment.id,
        },
      }),
      claim: (id) =>
        withRentalTransaction(context, async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.tenantId + ':issue:' + paymentId}, 0))`
          const current = await tx.payment.findFirst({
            where: {
              id: paymentId,
              tenantId: context.tenantId,
              status: { in: ['PENDING', 'OVERDUE'] },
              transactionId: null,
            },
          })
          if (!current || !current.amount.equals(prepared.attempt.amount))
            return false
          const updated = await tx.paymentAttempt.updateMany({
            where: {
              id,
              tenantId: context.tenantId,
              status: 'QUEUED',
              cancellationStatus: 'NONE',
            },
            data: { status: 'PROCESSING' },
          })
          return updated.count === 1
        }),
      // Já UNKNOWN fica como está: regravar mudaria `updatedAt`, o início do episódio que a conciliação mede.
      unknown: async (id) => {
        await withRentalTransaction(context, (tx) =>
          tx.paymentAttempt.updateMany({
            where: {
              id,
              tenantId: context.tenantId,
              status: { in: ['QUEUED', 'PROCESSING'] },
            },
            data: { status: 'UNKNOWN' },
          })
        )
      },
      // Conciliação (janela vencida, nada no Asaas com a referência): o mesmo episódio incerto (UNKNOWN
      // ou reserva abandonada, no mesmo `updatedAt` que foi lido) volta à fila.
      requeue: (id) =>
        withRentalTransaction(context, async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.tenantId + ':issue:' + paymentId}, 0))`
          const current = await tx.payment.findFirst({
            where: {
              id: paymentId,
              tenantId: context.tenantId,
              status: { in: ['PENDING', 'OVERDUE'] },
              transactionId: null,
            },
          })
          if (!current || !current.amount.equals(prepared.attempt.amount))
            return false
          if (state !== 'UNKNOWN' && state !== 'PROCESSING') return false
          const updated = await tx.paymentAttempt.updateMany({
            where: {
              id,
              tenantId: context.tenantId,
              status: state,
              externalId: null,
              cancellationStatus: 'NONE',
              updatedAt: prepared.attempt.updatedAt,
            },
            data: { status: 'QUEUED' },
          })
          return updated.count === 1
        }),
      // Falha que provou que o Asaas não criou nada (429, 401, 400, interruptor): a reserva volta à fila.
      release: async (id) => {
        await withRentalTransaction(context, (tx) =>
          tx.paymentAttempt.updateMany({
            where: {
              id,
              tenantId: context.tenantId,
              status: 'PROCESSING',
              cancellationStatus: 'NONE',
            },
            data: { status: 'QUEUED' },
          })
        )
      },
      // Pedido recusado (400 do Asaas, pedido inválido), nada criado: a reserva encerra em FAILED, fora da
      // religação, com os códigos da recusa (só `errors[].code` do Asaas, nunca a descrição) para a revisão.
      reject: async (id, rejection) => {
        await withRentalTransaction(context, (tx) =>
          tx.paymentAttempt.updateMany({
            where: {
              id,
              tenantId: context.tenantId,
              status: 'PROCESSING',
              cancellationStatus: 'NONE',
            },
            data: {
              status: 'FAILED',
              response: {
                rejection: {
                  reason: rejection.reason,
                  status: rejection.status,
                  providerCodes: [...rejection.providerCodes],
                },
              },
            },
          })
        )
      },
      issued: async (id, charge, details) => {
        await withRentalTransaction(context, async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.tenantId + ':issue:' + paymentId}, 0))`
          const payment = await tx.payment.findFirst({
            where: { id: paymentId, tenantId: context.tenantId },
          })
          if (!payment || ['CANCELLED', 'REFUNDED'].includes(payment.status))
            throw new Error('PAYMENT_RECONCILIATION_REQUIRED')
          if (
            !payment.amount.equals(prepared.attempt.amount) ||
            (payment.status === 'PAID' && payment.transactionId !== charge.id)
          )
            throw new Error('PAYMENT_RECONCILIATION_REQUIRED')
          if (payment.transactionId && payment.transactionId !== charge.id)
            throw new Error('PAYMENT_RECONCILIATION_REQUIRED')
          const latest = await tx.paymentAttempt.findFirst({
            where: { paymentId, tenantId: context.tenantId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          })
          if (
            !latest ||
            latest.id !== id ||
            latest.cancellationStatus !== 'NONE'
          )
            throw new PermanentDeliveryError('ATTEMPT_SUPERSEDED')
          if (
            payment.status === 'PAID' &&
            latest.status === 'PAID' &&
            latest.externalId === charge.id
          )
            return
          const metadata: Prisma.InputJsonObject =
            payment.metadata &&
            typeof payment.metadata === 'object' &&
            !Array.isArray(payment.metadata)
              ? { ...payment.metadata }
              : {}
          const registry = await tx.externalResourceTenant.upsert({
            where: {
              integrationId_resourceType_externalId: {
                integrationId: prepared.integration.id,
                resourceType: 'PAYMENT',
                externalId: charge.id,
              },
            },
            create: {
              integrationId: prepared.integration.id,
              tenantId: context.tenantId,
              provider: 'ASAAS',
              resourceType: 'PAYMENT',
              externalId: charge.id,
              resourceId: paymentId,
            },
            update: {},
          })
          if (
            registry.tenantId !== context.tenantId ||
            registry.resourceId !== paymentId ||
            registry.provider !== 'ASAAS'
          )
            throw new Error('PROVIDER_REFERENCE_CONFLICT')
          const recorded = await tx.paymentAttempt.updateMany({
            where: {
              id,
              tenantId: context.tenantId,
              cancellationStatus: 'NONE',
              status: { in: ['QUEUED', 'PROCESSING', 'UNKNOWN', 'ISSUED'] },
            },
            data: {
              externalId: charge.id,
              status: 'ISSUED',
              response: { ...details },
            },
          })
          if (recorded.count !== 1)
            throw new PermanentDeliveryError('ATTEMPT_SUPERSEDED')
          await tx.payment.updateMany({
            where: { id: paymentId, tenantId: context.tenantId },
            data: {
              transactionId: charge.id,
              pixCode: details.pixCode,
              pixQrCode: details.pixQrCode,
              metadata: { ...metadata, ...details },
              ...(prepared.payment.method === 'BOLETO'
                ? { boletoIssuedAt: new Date() }
                : {}),
            },
          })
          if (isChargePaid(charge.status))
            await enqueueOutbox(tx, {
              tenantId: context.tenantId,
              topic: 'payment.provider.confirmed',
              aggregateId: paymentId,
              payload: { paymentId, externalId: charge.id },
              dedupeKey: 'payment.provider.confirmed:' + id,
            })
        })
      },
    }
    try {
      await issuePayment(
        repository,
        createAsaasGateway({
          apiKey: credential.apiKey,
          environment: credential.environment,
        }),
        () => now
      )
    } catch (error) {
      // Pedido recusado (validação local, ou 400 do Asaas na criação, antes de a cobrança existir):
      // repetir dá sempre a mesma recusa, então o evento termina com o código já na primeira entrega.
      // Recusado depois da reserva, a tentativa já encerrou em FAILED (`reject`) e sai da religação;
      // recusado antes dela, a tentativa não mudou, e a religação que a retomar termina do mesmo jeito,
      // sem ganhar outra rodada (`nextRound`). Só o domínio sabe em que chamada a recusa aconteceu: um
      // `BillingProviderError` com a mesma forma (400 na busca pela referência, ou nos dados do PIX/boleto
      // de uma cobrança que o Asaas já aceitou) é passageiro e segue como falha comum, para a rodada
      // seguinte conciliar pela referência em vez de largar a cobrança no Asaas sem vínculo.
      if (error instanceof ChargeRequestRejected)
        throw new PermanentDeliveryError('PAYMENT_REQUEST_REJECTED')
      // Na conciliação de um episódio incerto (UNKNOWN ou PROCESSING abandonada), `ReconciliationRequired`
      // não passa esperando: a cobrança remota diverge (revisão manual) ou o episódio já mudou (outra
      // conciliação o levou adiante). O evento termina com o código, e `scheduleIssuanceReconciliation`
      // não agenda esse episódio de novo.
      if (reconciling && error instanceof ReconciliationRequired)
        throw new PermanentDeliveryError('PAYMENT_RECONCILIATION_REQUIRED')
      throw error
    }
  }

  /** Prefixo das chaves dos `payment.issue` de conciliação (`enqueueOutbox` põe o da locadora na frente). */
  const RECONCILIATION_KEY = 'payment.issue:reconcile:'
  /** Prefixo das chaves dos `payment.issue` que religam uma tentativa QUEUED sem evento de emissão vivo. */
  const RESUME_KEY = 'payment.issue:resume:'
  /** Prefixo das chaves dos `payment.issue` que religam uma cobrança aberta que nunca ganhou tentativa. */
  const OPEN_KEY = 'payment.issue:open:'
  /** Tópicos cujo consumidor emite a tentativa vigente da cobrança (`issueTenantPayment`). */
  const ISSUANCE_TOPICS = ['payment.issue', 'payment.boleto.issue']
  /** Candidatas lidas por vez: o agendador percorre todas, nunca só as mais antigas. */
  const RECONCILIATION_PAGE = 200
  /** Teto da espera entre duas rodadas do mesmo episódio. */
  const RECONCILIATION_MAX_WAIT_MS = 6 * 3600_000
  /** Código que `dispatchOutbox` grava num evento que esgotou as entregas por falha transitória. */
  const EXHAUSTED_DELIVERY = 'DELIVERY_FAILED'

  type StuckAttempt = {
    id: string
    paymentId: string
    status: string
    updatedAt: Date
  }

  /**
   * Chave da primeira rodada de uma tentativa parada. Episódio incerto (UNKNOWN ou PROCESSING
   * abandonada): tentativa + instante em que ele começou (`updatedAt`), porque cada episódio exige a
   * sua conciliação. QUEUED: só a tentativa; as religações numeram por toda a vida dela, para a espera
   * continuar dobrando mesmo quando cada rodada mexe na tentativa (reserva e volta à fila).
   */
  const chainKey = (attempt: StuckAttempt) =>
    attempt.status === 'QUEUED'
      ? RESUME_KEY + attempt.id
      : RECONCILIATION_KEY + attempt.id + ':' + attempt.updatedAt.getTime()

  type Round = {
    dedupeKey: string
    status: string
    lastError: string | null
    createdAt: Date
  }

  /**
   * Próxima rodada da cadeia cuja chave (com o prefixo da locadora) é `key`, ou `null` se nenhuma
   * agora. Sem rodada: a primeira (0, a própria chave). Com rodadas, a última decide. Viva: nenhuma.
   * Esgotada por falha transitória (Asaas fora do ar, chave revogada, integração indisponível…): a
   * seguinte (chave `key:n`), depois de uma espera que começa na janela, dobra a cada rodada e para no
   * teto. Concluída ou encerrada com código (revisão manual, episódio já mudado): nenhuma, a não ser
   * que a tentativa tenha mudado depois dela (`changedAt`, só nas religações de QUEUED, cuja chave não
   * muda com a tentativa); aí o que encerrou a rodada já não vale, e a seguinte vem sem espera.
   */
  function nextRound(
    key: string,
    events: readonly Round[],
    now: Date,
    changedAt: Date | null
  ): number | null {
    const rounds = events
      .filter(
        (event) =>
          event.dedupeKey === key || event.dedupeKey.startsWith(key + ':')
      )
      .map((event) => ({
        event,
        round:
          event.dedupeKey === key
            ? 0
            : Number(event.dedupeKey.slice(key.length + 1)),
      }))
    if (!rounds.length) return 0
    if (rounds.some(({ round }) => !Number.isSafeInteger(round))) return null
    const last = rounds.reduce((latest, current) =>
      current.round > latest.round ? current : latest
    )
    const next = last.round + 1
    if (!Number.isSafeInteger(next)) return null
    const { status, lastError, createdAt } = last.event
    if (status === 'FAILED' && lastError === EXHAUSTED_DELIVERY) {
      const wait = Math.min(
        RECONCILIATION_MAX_WAIT_MS,
        UNKNOWN_ISSUANCE_SETTLE_MS * 2 ** last.round
      )
      return now.getTime() - createdAt.getTime() >= wait ? next : null
    }
    if (status !== 'COMPLETED' && status !== 'FAILED') return null
    return changedAt !== null && changedAt.getTime() > createdAt.getTime()
      ? next
      : null
  }

  /**
   * Próxima rodada de uma cobrança aberta sem tentativa nenhuma, pelos eventos de emissão dela
   * (`events`), ou `null` se nenhuma agora. Com evento de emissão vivo: nenhuma (a entrega dele emite).
   * Com religações (cadeia `key`): `nextRound`, sem `changedAt` (a rodada que chega à emissão cria a
   * tentativa, e a cobrança sai das candidatas; a que termina com código não volta). Sem religação: só
   * a cobrança cuja emissão foi pedida e cujo último pedido esgotou as entregas por falha transitória,
   * há pelo menos a janela desde que foi feito. Sem pedido nenhum (cobrança que ninguém mandou emitir,
   * como o PIX da taxa de extensão) ou com o pedido encerrado com código: nada.
   */
  function openRound(
    key: string,
    events: readonly Round[],
    now: Date
  ): number | null {
    if (
      events.some(
        (event) => event.status === 'PENDING' || event.status === 'PROCESSING'
      )
    )
      return null
    const chain = events.filter(
      (event) =>
        event.dedupeKey === key || event.dedupeKey.startsWith(key + ':')
    )
    if (chain.length) return nextRound(key, chain, now, null)
    const requested = events.reduce<Round | null>(
      (latest, event) =>
        !latest || event.createdAt.getTime() > latest.createdAt.getTime()
          ? event
          : latest,
      null
    )
    if (
      !requested ||
      requested.status !== 'FAILED' ||
      requested.lastError !== EXHAUSTED_DELIVERY
    )
      return null
    return now.getTime() - requested.createdAt.getTime() >=
      UNKNOWN_ISSUANCE_SETTLE_MS
      ? 0
      : null
  }

  /**
   * Religação das emissões paradas (sem cobrança vinculada, de cobranças em aberto), cada uma parada
   * há pelo menos a janela (`UNKNOWN_ISSUANCE_SETTLE_MS`). Só banco (nenhuma rede): roda a cada
   * passada da outbox, antes da entrega.
   * - Episódio incerto (UNKNOWN, ou PROCESSING abandonada pelo processo que a reservou): um
   *   `payment.issue` de conciliação por episódio. A emissão (`issueTenantPayment`) consulta o Asaas
   *   pela referência da tentativa antes de qualquer POST: cobrança remota → vincula; nada remoto →
   *   volta a QUEUED e emite; cobrança divergente → o evento termina com PAYMENT_RECONCILIATION_REQUIRED
   *   e a tentativa fica UNKNOWN para revisão manual, sem nova rodada desse episódio.
   * - QUEUED sem evento de emissão vivo da cobrança (o `payment.issue` esgotou as entregas, e a chave
   *   dele impede reenfileirar; ou a conciliação a devolveu à fila e a falha veio depois): um
   *   `payment.issue` de religação. A emissão também busca pela referência antes de reservar.
   * - Cobrança aberta (PIX/boleto, sem vínculo) que nunca ganhou tentativa: o pedido de emissão
   *   (`payment.boleto.issue` da locação, `payment.issue` do orçamento) esgotou as entregas antes de
   *   criar a tentativa (integração indisponível ou cadastro do cliente incompleto desfazem a criação),
   *   e nenhum evento de emissão dela está vivo. Um `payment.issue` de religação por cobrança
   *   (`openRound`), passada a janela desde o pedido. A emissão cria a tentativa com a referência de
   *   sempre (`:initial`) e busca por ela antes de qualquer POST: nunca uma cobrança duplicada.
   * Uma rodada que esgota as entregas por falha transitória ganha outra depois da espera (`nextRound`).
   * Pedido recusado (validação local, ou 400 do Asaas na criação) não é falha transitória: a rodada
   * termina com PAYMENT_REQUEST_REJECTED e, recusada depois da reserva, a tentativa encerra em FAILED,
   * fora das candidatas. Repetir o pedido recusado só gastaria a cota da chave da locadora. Um 400 numa
   * leitura (busca pela referência, dados de uma cobrança que já existe) é falha transitória.
   * Percorre as candidatas em páginas até achar `limit` rodadas a agendar, para as paradas nunca
   * esconderem as novas.
   */
  async function scheduleIssuanceReconciliation(
    context: { tenantId: string },
    now: Date = new Date(),
    limit = 20
  ) {
    return withTenantTransaction(context, async (tx) => {
      // `enqueueOutbox` guarda a chave com o prefixo da locadora.
      const stored = (key: string) => context.tenantId + ':' + key
      const select = {
        dedupeKey: true,
        status: true,
        lastError: true,
        createdAt: true,
      } as const
      const due: Array<{ paymentId: string; dedupeKey: string }> = []
      let after: { id: string; updatedAt: Date } | null = null
      while (due.length < limit) {
        const page: StuckAttempt[] = await tx.paymentAttempt.findMany({
          where: {
            tenantId: context.tenantId,
            status: { in: ['QUEUED', 'PROCESSING', 'UNKNOWN'] },
            externalId: null,
            cancellationStatus: 'NONE',
            updatedAt: {
              lte: new Date(now.getTime() - UNKNOWN_ISSUANCE_SETTLE_MS),
            },
            payment: {
              tenantId: context.tenantId,
              status: { in: ['PENDING', 'OVERDUE'] },
              transactionId: null,
            },
            ...(after
              ? {
                  OR: [
                    { updatedAt: { gt: after.updatedAt } },
                    { updatedAt: after.updatedAt, id: { gt: after.id } },
                  ],
                }
              : {}),
          },
          orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
          take: RECONCILIATION_PAGE,
          select: { id: true, paymentId: true, status: true, updatedAt: true },
        })
        if (!page.length) break
        // QUEUED só está parada sem evento de emissão vivo da cobrança: com um, a entrega dele emite.
        const queued = [
          ...new Set(
            page
              .filter((attempt) => attempt.status === 'QUEUED')
              .map((attempt) => attempt.paymentId)
          ),
        ]
        const live = new Set(
          queued.length
            ? (
                await tx.outboxEvent.findMany({
                  where: {
                    tenantId: context.tenantId,
                    topic: { in: ISSUANCE_TOPICS },
                    aggregateId: { in: queued },
                    status: { in: ['PENDING', 'PROCESSING'] },
                  },
                  select: { aggregateId: true },
                })
              ).map((event) => event.aggregateId)
            : []
        )
        const stuck = page.filter(
          (attempt) =>
            attempt.status !== 'QUEUED' || !live.has(attempt.paymentId)
        )
        const firstRounds = stuck.length
          ? await tx.outboxEvent.findMany({
              where: {
                tenantId: context.tenantId,
                dedupeKey: {
                  in: stuck.map((attempt) => stored(chainKey(attempt))),
                },
              },
              select,
            })
          : []
        // Rodadas seguintes só existem depois da primeira.
        const started = stuck.filter((attempt) =>
          firstRounds.some(
            (event) => event.dedupeKey === stored(chainKey(attempt))
          )
        )
        const laterRounds = started.length
          ? await tx.outboxEvent.findMany({
              where: {
                tenantId: context.tenantId,
                topic: 'payment.issue',
                aggregateId: {
                  in: [...new Set(started.map((attempt) => attempt.paymentId))],
                },
                OR: started.map((attempt) => ({
                  dedupeKey: { startsWith: stored(chainKey(attempt)) + ':' },
                })),
              },
              select,
            })
          : []
        const events = [...firstRounds, ...laterRounds]
        for (const attempt of stuck) {
          if (due.length === limit) break
          const key = chainKey(attempt)
          const round = nextRound(
            stored(key),
            events,
            now,
            attempt.status === 'QUEUED' ? attempt.updatedAt : null
          )
          if (round !== null)
            due.push({
              paymentId: attempt.paymentId,
              dedupeKey: key + (round === 0 ? '' : ':' + round),
            })
        }
        if (page.length < RECONCILIATION_PAGE) break
        after = page[page.length - 1]!
      }
      // Cobranças abertas sem tentativa nenhuma: a religação acima só enxerga tentativas.
      let afterPayment: string | null = null
      while (due.length < limit) {
        const page: Array<{ id: string }> = await tx.payment.findMany({
          where: {
            tenantId: context.tenantId,
            status: { in: ['PENDING', 'OVERDUE'] },
            method: { in: ['PIX', 'BOLETO'] },
            transactionId: null,
            attempts: { none: {} },
            ...(afterPayment ? { id: { gt: afterPayment } } : {}),
          },
          orderBy: { id: 'asc' },
          take: RECONCILIATION_PAGE,
          select: { id: true },
        })
        if (!page.length) break
        const byPayment = new Map<string, Round[]>()
        for (const event of await tx.outboxEvent.findMany({
          where: {
            tenantId: context.tenantId,
            topic: { in: ISSUANCE_TOPICS },
            aggregateId: { in: page.map((payment) => payment.id) },
          },
          select: { aggregateId: true, ...select },
        }))
          byPayment.set(event.aggregateId, [
            ...(byPayment.get(event.aggregateId) ?? []),
            event,
          ])
        for (const payment of page) {
          if (due.length === limit) break
          const round = openRound(
            stored(OPEN_KEY + payment.id),
            byPayment.get(payment.id) ?? [],
            now
          )
          if (round !== null)
            due.push({
              paymentId: payment.id,
              dedupeKey:
                OPEN_KEY + payment.id + (round === 0 ? '' : ':' + round),
            })
        }
        if (page.length < RECONCILIATION_PAGE) break
        afterPayment = page[page.length - 1]!.id
      }
      for (const attempt of due)
        await enqueueOutbox(tx, {
          tenantId: context.tenantId,
          topic: 'payment.issue',
          aggregateId: attempt.paymentId,
          payload: { paymentId: attempt.paymentId },
          dedupeKey: attempt.dedupeKey,
        })
      return { scheduled: due.length }
    })
  }

  return { issueTenantPayment, scheduleIssuanceReconciliation }
}
