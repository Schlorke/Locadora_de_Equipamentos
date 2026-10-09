// Medição e verificação da vitrine por locadora (onda 135, A11; decisão do dono D4 de 2026-10-08). A locadora informa
// no painel o ID do Google Analytics 4, o ID do Google Ads (conversões) e os códigos de verificação do Google Search
// Console e do domínio no Facebook/Meta. A vitrine só põe esses identificadores, já validados pelo contrato, num modelo
// fixo: a tag do Google (gtag.js) e as metas de verificação. Nunca código livre (R4 da ADR adr-tenant-hosts; o
// `customJs` do painel não é injetado); o host responde com CSP por host (allowlist das origens do Google).
import {
  SITE_MEASUREMENT_KEYS,
  parsePublicSiteContent,
  type SiteMeasurementKey,
} from '@gb-locacoes/contracts/settings'

/** Os identificadores válidos que a locadora informou; o que falta ou não passa no contrato fica de fora. */
export type MedicaoDaLocadora = Partial<Record<SiteMeasurementKey, string>>

/** Medição e verificação a partir do `siteContent` da leitura pública (lido chave a chave, como no backend). */
export function medicaoDaLocadora(siteContent: unknown): MedicaoDaLocadora {
  const { content } = parsePublicSiteContent(siteContent)
  const medicao: MedicaoDaLocadora = {}
  for (const chave of SITE_MEASUREMENT_KEYS) {
    const valor = content[chave]
    if (typeof valor === 'string') medicao[chave] = valor
  }
  return medicao
}

/** Origem do gtag.js (a mesma da allowlist da CSP do host web). */
const ORIGEM_DA_TAG_DO_GOOGLE = 'https://www.googletagmanager.com'

/** A tag do Google da locadora: o endereço do gtag.js e o script de configuração, montados só com os IDs dela. */
export interface TagDoGoogle {
  readonly src: string
  readonly configuracao: string
}

/**
 * Tag do Google (GA4 e Google Ads) da locadora, como a raiz legada fazia para a GB: o gtag.js com o ID do Ads (o teste
 * de conexão do Google Ads procura o `AW-` na URL) ou, sem ele, o do GA4, e um `config` por ID. Sem nenhum ID: `null`
 * (nada é injetado). Os IDs passam pelo formato do contrato de novo: nada fora dele chega ao script.
 */
export function tagDoGoogle(medicao: MedicaoDaLocadora): TagDoGoogle | null {
  const { googleAnalyticsId, googleAdsId } = medicaoDaLocadora(medicao)
  const ids = [googleAnalyticsId, googleAdsId].filter(
    (id): id is string => typeof id === 'string'
  )
  if (ids.length === 0) return null
  const principal = googleAdsId ?? googleAnalyticsId!
  return {
    src: `${ORIGEM_DA_TAG_DO_GOOGLE}/gtag/js?id=${encodeURIComponent(principal)}`,
    configuracao: [
      'window.dataLayer = window.dataLayer || [];',
      'function gtag(){dataLayer.push(arguments);}',
      "gtag('js', new Date());",
      ...ids.map((id) => `gtag('config', ${JSON.stringify(id)});`),
    ].join('\n'),
  }
}
