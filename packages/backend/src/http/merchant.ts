/** Quarantined legacy integration; this response does not activate a provider. */
export function merchantUnavailableResponse() {
  return Response.json(
    {
      success: false,
      configured: false,
      error: 'Configure uma integração Merchant isolada por locadora',
      code: 'TENANT_MERCHANT_ADAPTER_UNAVAILABLE',
    },
    { status: 503 }
  )
}
