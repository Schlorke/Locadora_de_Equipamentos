export { listCustomerNotifications } from './client-notifications'
export { readCustomerNotificationStats } from './client-notification-stats'
export {
  markCustomerNotificationRead,
  deleteCustomerNotification,
  markAllCustomerNotificationsRead,
} from './client-notification-mutations'

export {
  createTenantBranding,
  TenantBrandingError,
  escapeEmailHtml,
} from './tenant-branding'
export type { EmailBranding } from './tenant-branding'

export { createAdminAlertSync } from './admin-alerts'
export { createAdminBadges } from './admin-badges'
export { createZohoMailClient } from './zoho-client'
export { createZohoMailConfiguration } from './zoho-constants'
export { createZohoMailTokenReader } from './zoho-tokens'
export { createWhatsAppReader } from './whatsapp-read'
export { createWhatsAppClient } from './whatsapp-client'
export { createWhatsAppWebhookConsumer } from './whatsapp-webhook'

export { createNotificationJob } from './send-notifications'

export { createQuoteStatusEffects } from './quote-status-effects'

export { createQuoteCreatedEffects } from './quote-created-effects'

export { createQuoteAdjustmentEffects } from './quote-adjustment-effects'

export { createPaymentMailEffects } from './payment-mail-effects'
export { subscriptionEmail } from './subscription-email'
export { platformEmail, platformMailEnvelopeSchema } from './platform-mail'
export type { PlatformMailEnvelope } from './platform-mail'
