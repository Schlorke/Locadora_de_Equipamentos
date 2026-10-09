/**
 * Registrador da bateria de paridade (onda 135, B3 e B11), carregado por `vitest.api.config.ts` depois do
 * `no-network`. Grava fora do repositório, na pasta que o global-setup abriu para a rodada:
 * - cada requisição deste processo a um host da rodada (`api` ou `legacy`): método, caminho e status;
 * - cada caso: estado final e `expect.getState().assertionCalls`;
 * - cada arquivo de teste que rodou.
 * Hosts de fixtures isoladas (ex.: `startReceivingAccountFixture`) entram por `markParityHost`.
 */
import { beforeAll, beforeEach, expect, inject, onTestFinished } from 'vitest'
import {
  appendRecord,
  caseName,
  hostOfRequest,
  markParityHost,
} from './parity-record'

const context = inject('apiParity')
const record = inject('apiParityRecord')
const file = (expect.getState().testPath ?? '')
  .replaceAll('\\', '/')
  .replace(/^.*\/tests\/api-host\//, '')

markParityHost(context.api, 'api')
if (context.legacy) markParityHost(context.legacy, 'legacy')

const previous = globalThis.fetch
globalThis.fetch = async function recordedFetch(
  input: Parameters<typeof fetch>[0],
  init?: RequestInit
) {
  const response = await previous(input, init)
  const host = hostOfRequest(input)
  if (host)
    appendRecord(record.directory, 'hits.jsonl', {
      file,
      target: host.target,
      method: (
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      ).toUpperCase(),
      path: host.url.pathname,
      status: response.status,
      via: 'fetch',
    })
  return response
} as typeof fetch

beforeAll(() => {
  appendRecord(record.directory, 'files.jsonl', { file })
})

beforeEach(() => {
  onTestFinished(({ task }) => {
    appendRecord(record.directory, 'cases.jsonl', {
      file,
      // Nome estável entre rodadas: origens, sufixo da rodada e UUIDs da fixture viram marcadores.
      name: caseName(task.fullName, context),
      state: task.result?.state ?? 'unknown',
      assertions: expect.getState().assertionCalls,
    })
  })
})
