import { createZohoMailConfiguration } from '@gb-locacoes/backend/communications'
export const {
  ZOHO_ACCOUNTS_BASE,
  ZOHO_MAIL_API_BASE,
  ZOHO_MAIL_SCOPES,
  getZohoAuthUrl,
  getZohoTokenUrl,
  getZohoMailBaseUrl,
} = createZohoMailConfiguration(process.env)
