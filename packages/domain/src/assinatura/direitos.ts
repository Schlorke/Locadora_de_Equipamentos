import type { AcessoDaOrganizacao } from './estado'

/**
 * Limites e módulos de uma versão de plano, na forma de `EntitlementsV1`
 * (`@gb-locacoes/contracts/entitlements`). O domínio é genérico nas chaves
 * para não duplicar a lista do contrato. `null` num limite = ilimitado.
 */
export interface DireitosDoPlano<
  Limite extends string = string,
  Recurso extends string = string,
> {
  readonly limits: Readonly<Record<Limite, number | null>>
  readonly features: Readonly<Record<Recurso, boolean>>
}

export interface AvaliacaoDeCota {
  /** Pode criar mais `acrescimo` itens. */
  readonly permitido: boolean
  readonly limite: number | null
  readonly usado: number
  /** Quanto ainda cabe; `null` quando ilimitado. Nunca negativo. */
  readonly restante: number | null
}

function inteiroNaoNegativo(nome: string, valor: number): void {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new RangeError(
      `${nome} precisa ser inteiro não negativo; recebido ${valor}.`
    )
  }
}

/**
 * Cota de um recurso contado (equipamentos, assentos). Criar `acrescimo`
 * itens é permitido quando o limite é `null` ou `usado + acrescimo ≤ limite`.
 * Com uso acima do limite (depois de um downgrade) nada é apagado: só a
 * criação fica bloqueada (402 `PLAN_LIMIT_REACHED` com `limit` e `used`).
 */
export function avaliarCota(
  limite: number | null,
  usado: number,
  acrescimo = 1
): AvaliacaoDeCota {
  if (limite !== null) inteiroNaoNegativo('limite', limite)
  inteiroNaoNegativo('usado', usado)
  if (!Number.isInteger(acrescimo) || acrescimo < 1) {
    throw new RangeError(
      `acrescimo precisa ser inteiro positivo; recebido ${acrescimo}.`
    )
  }
  if (limite === null) return { permitido: true, limite, usado, restante: null }
  return {
    permitido: usado + acrescimo <= limite,
    limite,
    usado,
    restante: Math.max(0, limite - usado),
  }
}

/** O módulo está no plano. Recurso ausente ou falso = fora do plano (402 `MODULE_NOT_IN_PLAN` nas mutações). */
export function recursoNoPlano<Recurso extends string>(
  direitos: Pick<DireitosDoPlano<string, Recurso>, 'features'>,
  recurso: Recurso
): boolean {
  return (
    Object.prototype.hasOwnProperty.call(direitos.features, recurso) &&
    direitos.features[recurso] === true
  )
}

/**
 * Onde uma escrita da locadora pode acontecer além do acesso FULL:
 *
 * - `configuracao`: está na lista de configuração que vale em SETUP (catálogo
 *   dentro do limite, marca, recebimentos, assinatura);
 * - `restrito`: está na `RESTRICTED_MUTATION_ALLOWLIST` (vale em RESTRICTED);
 * - `arquivado`: faturas, reativar e exportar do dono (vale em ARCHIVED).
 */
export interface ExcecaoDeEscrita {
  readonly configuracao?: boolean
  readonly restrito?: boolean
  readonly arquivado?: boolean
}

/**
 * Uma escrita (método diferente de GET e HEAD) é permitida em FULL e, nos
 * outros acessos, só quando a rota declara a exceção correspondente.
 */
export function permiteEscrita(
  acesso: AcessoDaOrganizacao,
  excecao: ExcecaoDeEscrita = {}
): boolean {
  switch (acesso) {
    case 'FULL':
      return true
    case 'SETUP':
      return excecao.configuracao === true
    case 'RESTRICTED':
      return excecao.restrito === true
    case 'ARCHIVED':
      return excecao.arquivado === true
  }
}

/** Linha de `EntitlementOverride` relevante para o cálculo. */
export interface AjusteDeDireito {
  /** `limits.<nome>` ou `features.<nome>`. */
  readonly key: string
  readonly value: unknown
  readonly createdAt: Date
  readonly expiresAt: Date | null
  readonly revokedAt: Date | null
}

export type MotivoDeAjusteIgnorado =
  'CHAVE_DESCONHECIDA' | 'VALOR_INVALIDO' | 'EXPIRADO' | 'REVOGADO'

export interface DireitosEfetivos<D> {
  readonly direitos: D
  readonly ignorados: readonly {
    readonly key: string
    readonly motivo: MotivoDeAjusteIgnorado
  }[]
}

function possui(objeto: object, chave: string): boolean {
  return Object.prototype.hasOwnProperty.call(objeto, chave)
}

function limiteValido(valor: unknown): valor is number | null {
  return (
    valor === null ||
    (typeof valor === 'number' && Number.isInteger(valor) && valor >= 0)
  )
}

/**
 * Aplica os ajustes da equipe (`EntitlementOverride`) sobre os direitos da
 * versão do plano. Vale o ajuste não revogado e não expirado em `agora`; entre
 * ajustes da mesma chave vale o mais recente. Chave fora do plano ou valor de
 * tipo errado é ignorado e listado em `ignorados`, nunca aplicado.
 */
export function direitosEfetivos<D extends DireitosDoPlano>(
  base: D,
  ajustes: readonly AjusteDeDireito[],
  agora: Date
): DireitosEfetivos<D> {
  const instante = agora.getTime()
  if (Number.isNaN(instante)) throw new RangeError('Data inválida.')
  const limits: Record<string, number | null> = { ...base.limits }
  const features: Record<string, boolean> = { ...base.features }
  const ignorados: { key: string; motivo: MotivoDeAjusteIgnorado }[] = []

  const emOrdem = [...ajustes].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )
  for (const ajuste of emOrdem) {
    if (ajuste.revokedAt !== null && ajuste.revokedAt.getTime() <= instante) {
      ignorados.push({ key: ajuste.key, motivo: 'REVOGADO' })
      continue
    }
    if (ajuste.expiresAt !== null && ajuste.expiresAt.getTime() <= instante) {
      ignorados.push({ key: ajuste.key, motivo: 'EXPIRADO' })
      continue
    }
    const [grupo, nome, ...resto] = ajuste.key.split('.')
    if (nome === undefined || resto.length > 0) {
      ignorados.push({ key: ajuste.key, motivo: 'CHAVE_DESCONHECIDA' })
    } else if (grupo === 'limits' && possui(base.limits, nome)) {
      if (limiteValido(ajuste.value)) limits[nome] = ajuste.value
      else ignorados.push({ key: ajuste.key, motivo: 'VALOR_INVALIDO' })
    } else if (grupo === 'features' && possui(base.features, nome)) {
      if (typeof ajuste.value === 'boolean') features[nome] = ajuste.value
      else ignorados.push({ key: ajuste.key, motivo: 'VALOR_INVALIDO' })
    } else {
      ignorados.push({ key: ajuste.key, motivo: 'CHAVE_DESCONHECIDA' })
    }
  }

  return { direitos: { ...base, limits, features }, ignorados }
}
