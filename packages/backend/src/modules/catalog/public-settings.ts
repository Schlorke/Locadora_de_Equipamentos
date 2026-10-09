/**
 * Leitura pública das configurações da vitrine (`GET /api/settings/public`; contrato em
 * `@gb-locacoes/contracts/settings`). Além do contato, do texto, das redes e dos destaques que já eram públicos, traz
 * o horário de funcionamento das configurações e a identificação legal da organização (nome empresarial e CNPJ), que
 * o rodapé e o contato da vitrine mostram (achado 147; Decreto 7.962/2013, art. 2º, I e II).
 *
 * Regras: só os dias conhecidos, com hora `HH:MM` válida ou fechados (o resto fica de fora, sem valor padrão); só um
 * CNPJ válido, formatado, nunca um CPF nem o documento cru; nome empresarial aparado. Locadora sem o dado: `null`.
 * O cartão do diretório (`modules/directory/card.ts`) continua sem CNPJ.
 *
 * Onda 134 (lote vitrine-conteúdo): também o conteúdo institucional da locadora (`siteContent`, leitura tolerante por
 * chave do contrato) e quais textos legais ela publicou (`legalDocuments`, pelas datas da publicação, sem ler os
 * textos, que saem só pela rota própria).
 */
import {
  BUSINESS_DAYS,
  BUSINESS_TIME_FORMAT,
  PUBLIC_SETTINGS_FIELDS,
  PublicBusinessHoursSchema,
  PublicLegalIdentitySchema,
  parsePublicSiteContent,
  type BusinessDay,
  type PublicBusinessDay,
  type PublicBusinessHours,
  type PublicLegalAvailability,
  type PublicLegalIdentity,
  type PublicSettingsField,
  type SiteContent,
} from '@gb-locacoes/contracts/settings'
import { formatarCnpj, validarCnpj } from '@gb-locacoes/domain/documento'

const LEGAL_NAME_MAX = 200

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const time = (value: unknown): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return BUSINESS_TIME_FORMAT.test(trimmed) ? trimmed : null
}

/**
 * Horário público a partir do JSON `settings.businessHours` (o formato do painel e do script da GB:
 * `{ monday: { open: '08:00', close: '18:00', closed: false }, sunday: { closed: true } }`). Dia fechado vence as
 * horas; dia aberto sem abertura ou fechamento válidos fica de fora. Nenhum dia válido: `null`.
 */
export function publicBusinessHours(raw: unknown): PublicBusinessHours | null {
  if (!isRecord(raw)) return null
  const days: Partial<Record<BusinessDay, PublicBusinessDay>> = {}
  for (const day of BUSINESS_DAYS) {
    const value = raw[day]
    if (!isRecord(value)) continue
    if (value.closed === true) {
      days[day] = { closed: true }
      continue
    }
    const open = time(value.open)
    const close = time(value.close)
    if (open && close) days[day] = { closed: false, open, close }
  }
  const parsed = PublicBusinessHoursSchema.safeParse(days)
  return parsed.success && Object.keys(parsed.data).length > 0
    ? parsed.data
    : null
}

/** Colunas da organização que a identificação legal lê (nada além delas sai da consulta). */
export const LEGAL_IDENTITY_SELECT = {
  legalName: true,
  documentNormalized: true,
  document: true,
} as const

export type LegalIdentitySource = {
  legalName: string | null
  documentNormalized: string | null
  document: string | null
}

/**
 * Identificação legal pública: o nome empresarial aparado e o primeiro CNPJ válido da organização (o normalizado do
 * cadastro da plataforma, depois o legado), formatado. Documento que não é CNPJ válido (CPF, incompleto) não sai.
 */
export function publicLegalIdentity(
  organization: LegalIdentitySource | null
): PublicLegalIdentity {
  const name = organization?.legalName?.trim()
  const document = [organization?.documentNormalized, organization?.document]
    .map((value) => value?.trim() ?? '')
    .find((value) => value !== '' && validarCnpj(value))
  const identity = PublicLegalIdentitySchema.safeParse({
    legalName: name ? name.slice(0, LEGAL_NAME_MAX) : null,
    cnpj: document ? formatarCnpj(document) : null,
  })
  return identity.success ? identity.data : { legalName: null, cnpj: null }
}

/**
 * Controles C0/C1, DEL, separadores de linha e parágrafo e controles de direção (os mesmos que o contrato recusa no
 * texto da locadora, `plainText` de `@gb-locacoes/contracts/settings`).
 */
const isSeoControl = (code: number) =>
  code <= 0x1f ||
  (code >= 0x7f && code <= 0x9f) ||
  code === 0x2028 ||
  code === 0x2029 ||
  (code >= 0x202a && code <= 0x202e) ||
  (code >= 0x2066 && code <= 0x2069)

/**
 * Título e descrição SEO da locadora (onda 135, A4): o texto que ela gravou no painel, numa linha só (controle vira
 * espaço, espaços seguidos viram um) e aparado. Vazio, só espaço ou que não é texto: `null`, e a vitrine monta o
 * título com o nome do cartão dela (nunca um padrão de outra locadora).
 */
export function publicSeoText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let line = ''
  for (const char of raw) line += isSeoControl(char.charCodeAt(0)) ? ' ' : char
  const text = line.replace(/\s+/g, ' ').trim()
  return text === '' ? null : text
}

/**
 * Corpo público das configurações: só os campos do contrato (`PUBLIC_SETTINGS_FIELDS`), na ordem dele. Uma coluna que
 * entrar na consulta sem estar no contrato não sai na resposta.
 */
export function publicSettingsBody(
  source: Record<string, unknown>
): Record<PublicSettingsField, unknown> {
  return Object.fromEntries(
    PUBLIC_SETTINGS_FIELDS.map((field) => [field, source[field]])
  ) as Record<PublicSettingsField, unknown>
}

/**
 * Conteúdo institucional público (`settings.siteContent`): cada chave pelo esquema dela; a inválida sai e só o nome dela
 * vai para `report` (nunca o valor); a desconhecida é ignorada. O padrão `{}` do banco dá `{}`.
 */
export function publicSiteContent(
  raw: unknown,
  report: (_invalidKeys: string[]) => void
): SiteContent {
  const { content, invalidKeys } = parsePublicSiteContent(raw)
  if (invalidKeys.length > 0) report(invalidKeys)
  return content
}

/** Colunas que dizem se cada texto legal está publicado (o documento e a data andam juntos, por CHECK). */
export const LEGAL_AVAILABILITY_SELECT = {
  termsPublishedAt: true,
  privacyPublishedAt: true,
  returnPolicyPublishedAt: true,
} as const

export type LegalAvailabilitySource = {
  termsPublishedAt: Date | null
  privacyPublishedAt: Date | null
  returnPolicyPublishedAt: Date | null
}

/** Quais textos legais a locadora publicou, pelas datas da publicação (índice barato: os textos não são lidos). */
export function publicLegalAvailability(
  row: LegalAvailabilitySource
): PublicLegalAvailability {
  return {
    terms: Boolean(row.termsPublishedAt),
    privacy: Boolean(row.privacyPublishedAt),
    returnPolicy: Boolean(row.returnPolicyPublishedAt),
  }
}
