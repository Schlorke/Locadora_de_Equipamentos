import type { AcessoDaOrganizacao } from './estado'
import type { FiscalizacaoDaAssinatura } from './site'

/**
 * Área do cliente final no host da locadora (`{slug}.<raiz>`: entrada, cadastro,
 * vínculo e `/area-cliente`), lote S13 da ADR
 * `docs/architecture/adr-saas-subscription.md` (B.5, linha "Área do cliente
 * final"; D1 e D23). É separada da vitrine: não depende da publicação do site
 * (B.8), então uma locadora com o site desligado por não estar publicada
 * continua atendendo os clientes que já tem.
 *
 * - FULL: sim; RESTRICTED: sim (ver contratos e pagar cobranças existentes);
 * - SETUP: não existe ("—"); ARCHIVED: não (os links de fatura do Asaas
 *   continuam válidos fora daqui);
 * - bloqueio administrativo (`Organization.status` diferente de `ACTIVE`): não,
 *   o mesmo 404 neutro do D10, em qualquer fiscalização.
 */
export interface FatosDaAreaDoCliente {
  /** `Organization.status` diferente de `ACTIVE` (D1). */
  readonly bloqueioAdministrativo: boolean
  /** `Organization.access`, a projeção do estado da assinatura (D6). */
  readonly acesso: AcessoDaOrganizacao
}

export interface DecisaoDaAreaDoCliente {
  /** Aplicada, já com a fiscalização. */
  readonly disponivel: boolean
  /** Com o acesso real, o que a fiscalização `on` aplicaria (registrado em `shadow`). */
  readonly calculado: boolean
}

function pelaMatriz(
  fatos: FatosDaAreaDoCliente,
  acesso: AcessoDaOrganizacao
): boolean {
  if (fatos.bloqueioAdministrativo) return false
  switch (acesso) {
    case 'FULL':
    case 'RESTRICTED':
      return true
    case 'SETUP':
    case 'ARCHIVED':
      return false
  }
}

/**
 * Regra única da área do cliente. O bloqueio administrativo vale em qualquer
 * fiscalização; `off` e `shadow` tratam o acesso como FULL (D23), e `shadow`
 * devolve em `calculado` o que `on` aplicaria. Sempre que o site está no ar ou em
 * pausa (`decidirModoDoSite` diferente de OFF), a área do cliente está disponível.
 */
export function decidirAreaDoCliente(
  fatos: FatosDaAreaDoCliente,
  fiscalizacao: FiscalizacaoDaAssinatura
): DecisaoDaAreaDoCliente {
  const calculado = pelaMatriz(fatos, fatos.acesso)
  return {
    disponivel: fiscalizacao === 'on' ? calculado : pelaMatriz(fatos, 'FULL'),
    calculado,
  }
}
