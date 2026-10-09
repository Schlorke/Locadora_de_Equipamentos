import type { AcessoDaOrganizacao } from './estado'

/**
 * Modo do site público de uma locadora (vitrine em `{slug}.<raiz>`), lote S13
 * da ADR `docs/architecture/adr-saas-subscription.md` (B.5, linha "Site
 * público"; B.10, linha "Público"; D1 e D23):
 *
 * - `LIVE`: no ar; indexável só com `siteIndexable` (falso até a 1ª fatura paga);
 * - `PAUSED`: página neutra "temporariamente indisponível", HTTP 503, sem
 *   catálogo, carrinho e orçamento; a área do cliente continua, e as páginas
 *   legais (Termos, Privacidade, Devolução e Cookies) seguem no ar com 200,
 *   noindex e sem cache (decisão do dono de 2026-10-06, item 4; onda 134);
 * - `OFF`: o mesmo 404 neutro de locadora desconhecida (D10 da ADR de hosts).
 */
export type ModoDoSite = 'LIVE' | 'PAUSED' | 'OFF'

/** `PLATFORM_SUBSCRIPTION_ENFORCEMENT` (D23). */
export type FiscalizacaoDaAssinatura = 'off' | 'shadow' | 'on'

export interface FatosDoSite {
  /** `Organization.status` diferente de `ACTIVE`: bloqueio administrativo (D1), sempre 404. */
  readonly bloqueioAdministrativo: boolean
  /** `Organization.access`, a projeção do estado da assinatura (D6). */
  readonly acesso: AcessoDaOrganizacao
  /** `Organization.sitePublishedAt`: publicar é ato explícito do dono (B.8). */
  readonly publicadoEm: Date | null
  /** `Organization.siteIndexable`. */
  readonly indexavel: boolean
}

export interface DecisaoDoSite {
  /** Modo aplicado, já com a fiscalização. */
  readonly modo: ModoDoSite
  /** Indexável: só `LIVE` com `siteIndexable`. */
  readonly indexavel: boolean
  /** Modo com o acesso real, o que a fiscalização `on` aplicaria (registrado em `shadow`). */
  readonly calculado: ModoDoSite
}

function modoPeloAcesso(
  fatos: FatosDoSite,
  acesso: AcessoDaOrganizacao
): ModoDoSite {
  if (fatos.bloqueioAdministrativo || fatos.publicadoEm === null) return 'OFF'
  switch (acesso) {
    case 'FULL':
      return 'LIVE'
    case 'RESTRICTED':
      return 'PAUSED'
    case 'SETUP':
    case 'ARCHIVED':
      return 'OFF'
  }
}

/**
 * Regra única do modo do site. A publicação e o bloqueio administrativo valem
 * em qualquer fiscalização. `off` e `shadow` tratam o acesso como FULL (D23),
 * então nunca pausam; `shadow` devolve em `calculado` o que `on` aplicaria.
 */
export function decidirModoDoSite(
  fatos: FatosDoSite,
  fiscalizacao: FiscalizacaoDaAssinatura
): DecisaoDoSite {
  const calculado = modoPeloAcesso(fatos, fatos.acesso)
  const modo = fiscalizacao === 'on' ? calculado : modoPeloAcesso(fatos, 'FULL')
  return { modo, indexavel: modo === 'LIVE' && fatos.indexavel, calculado }
}
