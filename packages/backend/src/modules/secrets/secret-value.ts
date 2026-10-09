/** Plaintext leaves this holder only through an explicit server-side callback. */
export class SecretValue {
  readonly #value: string
  constructor(value: string) {
    this.#value = value
  }
  use<T>(fn: (value: string) => T): T {
    return fn(this.#value)
  }
  toJSON() {
    return '[REDACTED]'
  }
  toString() {
    return '[REDACTED]'
  }
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return 'SecretValue([REDACTED])'
  }
}
