/**
 * Falha de regra do catálogo. O adaptador HTTP responde `{ error: message }`
 * com `status`; qualquer outro erro segue o tratamento genérico da rota.
 */
export class CatalogError extends Error {
  readonly status: 400 | 402 | 403 | 404 | 409 | 503
  constructor(
    message: string,
    status: CatalogError['status'],
    readonly body: { error: string } = { error: message }
  ) {
    super(message)
    this.name = 'CatalogError'
    this.status = status
  }
}
