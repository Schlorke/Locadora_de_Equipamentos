/** Financial/provider receipts survive commercial suspension; no request authorization is granted here. */
export function isInboundIntegrationStatus(status: string): boolean {
  return ['ACTIVE', 'PROVISIONING', 'INBOUND_ONLY'].includes(status)
}
