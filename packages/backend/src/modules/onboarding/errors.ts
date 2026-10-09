export class OnboardingError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 409 | 413 | 415 | 422 | 429 | 503,
    readonly code: string,
    readonly retryAfter?: number,
    readonly suggestions?: readonly string[]
  ) {
    super(code)
  }
}
