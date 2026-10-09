/**
 * Name and URL of the account webhook (ADR SaaS B.7.2). The receiving-account creation embeds it in the POST and the
 * health worker later finds it by the same name and URL, so both sides must derive it from one rule.
 */
export function accountWebhookTarget(origin: URL, integrationId: string) {
  return {
    name: 'Locadora-' + integrationId,
    url: origin.origin + '/api/webhooks/asaas/' + integrationId,
  }
}
