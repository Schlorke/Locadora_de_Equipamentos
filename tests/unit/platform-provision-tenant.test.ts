import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import {
  parseProvisionArguments,
  runProvisionCli,
} from '../../tools/platform-provision-tenant.mjs'
import { onboardingInput } from '../helpers/onboarding-data'

const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'locadora-provision-cli-')
)
const file = path.join(directory, 'input.json')
const input = onboardingInput('synthetic-plan-version', 'synthetic-rental')
fs.writeFileSync(file, JSON.stringify(input))
const args = [
  '--input-file=' + file,
  '--owner=owner-test',
  '--operator=staff-test',
  '--key=synthetic-idempotency-key',
]
afterAll(() => {
  fs.unlinkSync(file)
  fs.rmdirSync(directory)
})

describe('assisted organization CLI', () => {
  it.each(
    [
      [],
      [...args, '--apply', '--apply'],
      [...args, '--owner=another'],
      [...args, '--unknown=true'],
      args.map((arg) =>
        arg.startsWith('--input-file=') ? '--input-file=relative.json' : arg
      ),
      args.map((arg) => (arg.startsWith('--key=') ? '--key=short' : arg)),
    ].map((values) => ({ values }))
  )('rejects missing, duplicate or unknown arguments: %#', ({ values }) => {
    expect(() => parseProvisionArguments(values)).toThrow(
      'ONBOARDING_ARGUMENTS_INVALID'
    )
  })
  it('defaults to payload preview without database, provider, env mutation or consent fabrication', async () => {
    const execute = vi.fn(),
      write = vi.fn()
    expect(await runProvisionCli(args, {}, write, execute)).toBe(0)
    expect(execute).not.toHaveBeenCalled()
    expect(JSON.parse(write.mock.calls[0]![0])).toEqual({
      applied: false,
      scope: 'payload-only',
      ownerId: 'owner-test',
      slug: input.slug,
      planVersionId: input.planVersionId,
    })
    expect(write.mock.calls[0]![0]).not.toContain(input.company.cnpj)
  })
  it('only --apply passes the named owner, operator, input and stable key to the sole case', async () => {
    const execute = vi.fn(async () => ({ organization: { id: 'accepted' } })),
      write = vi.fn()
    expect(
      await runProvisionCli([...args, '--apply'], {}, write, execute)
    ).toBe(0)
    expect(execute).toHaveBeenCalledExactlyOnceWith(
      { userId: 'owner-test', staffUserId: 'staff-test' },
      input,
      'synthetic-idempotency-key',
      {}
    )
    expect(JSON.parse(write.mock.calls[0]![0])).toEqual({
      organization: { id: 'accepted' },
    })
  })
  it.each([
    'postgresql://private:password@host/database',
    'ONBOARDING_SYNTHETIC_SECRET',
    'SECRET_VALUE',
  ])(
    'never emits arbitrary filesystem/database/secret error text: %s',
    async (message) => {
      const write = vi.fn()
      expect(
        await runProvisionCli([...args, '--apply'], {}, write, async () => {
          throw new Error(message)
        })
      ).toBe(1)
      expect(write.mock.calls[0]![0]).toBe('{"error":"ONBOARDING_UNAVAILABLE"}')
    }
  )
})
