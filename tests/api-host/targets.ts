import { expect } from 'vitest'
import type { ApiParityContext } from './global-setup'

/**
 * Hosts de uma rodada de paridade (onda 135, E1). Com `API_LEGACY_MODE=absent` só a API compartilhada sobe e
 * `context.legacy` é `null`: os arquivos percorrem os hosts por estes helpers, nunca por uma lista escrita à mão com
 * `context.legacy`. Comparar um host com outro exige dois alvos reais e fica com quem compara (bloco B2); aqui só se
 * diz quais hosts existem.
 */
type Hosts = Pick<ApiParityContext, 'legacy' | 'api'>

/** A raiz legada roda nesta rodada (`API_LEGACY_MODE` = `production` ou dev). */
export function legacyRunning(
  context: Hosts
): context is Hosts & { legacy: string } {
  return typeof context.legacy === 'string' && context.legacy !== ''
}

/** Origens de todos os hosts no ar, a raiz legada primeiro quando existe. */
export function parityTargets(context: Hosts): string[] {
  return legacyRunning(context) ? [context.legacy, context.api] : [context.api]
}

/** Pares `[rótulo, origem]` para `describe.each`/`it.each`, só com os hosts no ar. */
export function namedParityTargets<L extends string, A extends string>(
  context: Hosts,
  labels: { legacy: L; api: A }
): Array<[L | A, string]> {
  return legacyRunning(context)
    ? [
        [labels.legacy, context.legacy],
        [labels.api, context.api],
      ]
    : [[labels.api, context.api]]
}

/**
 * Duas requisições reais em sequência para provar idempotência ou consumo único: da raiz para a API quando as duas
 * rodam (o efeito é único entre hosts que coexistem) e da API para ela mesma sem a raiz. Nunca uma requisição só.
 */
export function sequentialTargets(context: Hosts): [string, string] {
  return legacyRunning(context)
    ? [context.legacy, context.api]
    : [context.api, context.api]
}

/**
 * Igualdade entre os hosts da rodada (um host como gabarito do outro). Só prova algo com dois ou mais alvos: com um alvo
 * só (sem a raiz) a comparação seria vazia, então ela é recusada com erro em vez de passar (E25 da onda 135). O bloco
 * B2 troca cada uso por uma expectativa explícita da fixture, que vale com ou sem a raiz.
 */
export function compareAcrossTargets<T>(
  values: readonly T[],
  message?: string
) {
  if (values.length < 2)
    throw new Error(
      `compareAcrossTargets needs at least two running hosts (got ${values.length})${message ? `: ${message}` : ''}. ` +
        'Without the legacy root (API_LEGACY_MODE=absent) a cross-host comparison proves nothing; assert the explicit expected value instead (wave 135, B2).'
    )
  for (const value of values.slice(1)) expect(value, message).toEqual(values[0])
}

/** O outro alvo de uma prova de consumo único: o outro host quando existe, senão o mesmo (segunda chamada real). */
export function otherTarget(context: Hosts, origin: string): string {
  if (!legacyRunning(context)) return context.api
  return origin === context.legacy ? context.api : context.legacy
}

/** O alvo da i-ésima requisição de uma rajada concorrente: alterna entre os hosts no ar (todas na API sem a raiz). */
export function rotatingTarget(context: Hosts, index: number): string {
  const targets = parityTargets(context)
  return targets[index % targets.length]!
}
