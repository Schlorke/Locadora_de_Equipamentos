import type { PlatformEnvSource } from '@gb-locacoes/contracts/platform'
export function createZohoMailConfiguration(env: PlatformEnvSource) {
  /**
   * Constantes para integração Zoho Mail API
   * @see https://www.zoho.com/mail/help/api/
   */

  const configuredDC = env.ZOHO_MAIL_DATACENTER || 'com'
  const DC = ['com', 'eu', 'in', 'com.au', 'jp', 'ca', 'com.cn', 'sa'].includes(
    configuredDC
  )
    ? configuredDC
    : (() => {
        throw new Error('INVALID_ZOHO_DATACENTER')
      })()

  /** Base para OAuth (accounts) */
  const ZOHO_ACCOUNTS_BASE = `https://accounts.zoho.${DC}`

  /** Base para Mail API */
  const ZOHO_MAIL_API_BASE = `https://mail.zoho.${DC}/api`

  /** Escopos OAuth necessários para ler e gerenciar e-mails */
  const ZOHO_MAIL_SCOPES = [
    'ZohoMail.accounts.READ',
    'ZohoMail.folders.READ',
    'ZohoMail.messages.READ',
    'ZohoMail.messages.CREATE',
    'ZohoMail.messages.UPDATE',
    'ZohoMail.messages.DELETE',
  ].join(',')

  /** URL de autorização OAuth */
  function getZohoAuthUrl(): string {
    return `${ZOHO_ACCOUNTS_BASE}/oauth/v2/auth`
  }

  /** URL do endpoint de tokens OAuth */
  function getZohoTokenUrl(): string {
    return `${ZOHO_ACCOUNTS_BASE}/oauth/v2/token`
  }

  /** URL base da Mail API */
  function getZohoMailBaseUrl(): string {
    return ZOHO_MAIL_API_BASE
  }

  return {
    ZOHO_ACCOUNTS_BASE,
    ZOHO_MAIL_API_BASE,
    ZOHO_MAIL_SCOPES,
    getZohoAuthUrl,
    getZohoTokenUrl,
    getZohoMailBaseUrl,
  }
}
