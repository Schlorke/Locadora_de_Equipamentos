// Política de corte da sessão da aplicação (E27a da onda 135): depois do corte (`AUTH_MODE=better-auth`) nenhum JWT do
// NextAuth volta a valer, nem quando o Better Auth não acha sessão, nem quando ele falha (configuração ou banco). Antes
// do corte (`legacy`), o NextAuth continua sendo a fonte, e a identidade nova só entra quando está ligada e responde.
// O teste é do comportamento da fábrica que os dois hosts usam (`apps/services/api/src/host/session.ts` e a raiz
// legada), não de um arquivo de borda.
import { describe, expect, it, vi } from 'vitest'
import { createApplicationSessionReader } from './application-session'
import type { IdentityMode } from './configuration'

type Session = { user: { id: string } }
type Options = { marker: string }

const identitySession: Session = { user: { id: 'identity-user' } }
const noSession = async (): Promise<Session | null> => null
const unavailable = (message: string) => async (): Promise<Session | null> => {
  throw new Error(message)
}
const legacySession: Session = { user: { id: 'legacy-user' } }

function reader(
  mode: IdentityMode | (() => IdentityMode),
  {
    enabled = true,
    identity = async () => null as Session | null,
  }: { enabled?: boolean; identity?: () => Promise<Session | null> } = {}
) {
  const readers = {
    mode: vi.fn(typeof mode === 'function' ? mode : () => mode),
    identityEnabled: vi.fn(() => enabled),
    identity: vi.fn(identity),
    legacy: vi.fn(
      async (_options?: Options) => legacySession as Session | null
    ),
  }
  return {
    readers,
    read: createApplicationSessionReader<Session, Options>(readers),
  }
}

describe('createApplicationSessionReader depois do corte (better-auth)', () => {
  it.each([
    ['sem sessão no Better Auth', noSession],
    ['Better Auth indisponível', unavailable('storage unavailable')],
  ] as const)(
    '%s: devolve null e nunca consulta o NextAuth',
    async (_case, identity) => {
      const { readers, read } = reader('better-auth', { identity })
      expect(await read({ marker: 'custom' })).toBeNull()
      expect(readers.identity).toHaveBeenCalledOnce()
      expect(readers.legacy).not.toHaveBeenCalled()
    }
  )

  it('com a identidade desligada por configuração, também não há volta ao NextAuth', async () => {
    const { readers, read } = reader('better-auth', { enabled: false })
    expect(await read()).toBeNull()
    expect(readers.identity).not.toHaveBeenCalled()
    expect(readers.legacy).not.toHaveBeenCalled()
  })

  it('a sessão do Better Auth é a resposta', async () => {
    const { readers, read } = reader('better-auth', {
      identity: async () => identitySession,
    })
    expect(await read()).toBe(identitySession)
    expect(readers.legacy).not.toHaveBeenCalled()
  })
})

describe('createApplicationSessionReader antes do corte (legacy)', () => {
  it('identidade desligada: só o NextAuth, com as opções de quem chamou', async () => {
    const { readers, read } = reader('legacy', { enabled: false })
    const options = { marker: 'custom' }
    expect(await read(options)).toBe(legacySession)
    expect(readers.identity).not.toHaveBeenCalled()
    expect(readers.legacy).toHaveBeenCalledExactlyOnceWith(options)
  })

  it.each([
    ['sem sessão na identidade nova', noSession],
    ['identidade nova indisponível', unavailable('engine unavailable')],
  ] as const)('coexistência, %s: cai no NextAuth', async (_case, identity) => {
    const { readers, read } = reader('legacy', { identity })
    expect(await read()).toBe(legacySession)
    expect(readers.legacy).toHaveBeenCalledOnce()
  })

  it('coexistência com sessão na identidade nova: o NextAuth não é lido', async () => {
    const { readers, read } = reader('legacy', {
      identity: async () => identitySession,
    })
    expect(await read()).toBe(identitySession)
    expect(readers.legacy).not.toHaveBeenCalled()
  })
})

describe('createApplicationSessionReader: o modo vale por requisição', () => {
  it('lê o modo a cada chamada; o corte no meio da execução já recusa o JWT na chamada seguinte', async () => {
    let mode: IdentityMode = 'legacy'
    const { readers, read } = reader(() => mode)
    expect(await read()).toBe(legacySession)
    mode = 'better-auth'
    expect(await read()).toBeNull()
    expect(readers.mode).toHaveBeenCalledTimes(2)
    expect(readers.legacy).toHaveBeenCalledOnce()
  })

  it('modo inválido falha antes de ler qualquer motor', async () => {
    const { readers, read } = reader(() => {
      throw new Error('Invalid AUTH_MODE')
    })
    await expect(read()).rejects.toThrow('Invalid AUTH_MODE')
    expect(readers.identity).not.toHaveBeenCalled()
    expect(readers.legacy).not.toHaveBeenCalled()
  })
})
