import pino, { type DestinationStream } from 'pino'
import { redactSecretFields } from '../modules/secrets/index'
export function createApplicationLogger(
  env: Readonly<Record<string, string | undefined>>,
  destination?: DestinationStream
) {
  return pino(
    {
      level: env.LOG_LEVEL || 'info',
      formatters: {
        log: (object) => redactSecretFields(object) as Record<string, unknown>,
      },
    },
    destination
  )
}
