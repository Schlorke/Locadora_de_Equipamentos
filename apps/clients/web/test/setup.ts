// next/experimental/testing/server carrega o armazenamento assíncrono do servidor do Next, que exige o
// AsyncLocalStorage global (o servidor do Next o define na inicialização).
import { AsyncLocalStorage } from 'node:async_hooks'

const globalWithStorage = globalThis as typeof globalThis & { AsyncLocalStorage?: typeof AsyncLocalStorage }
globalWithStorage.AsyncLocalStorage ??= AsyncLocalStorage
