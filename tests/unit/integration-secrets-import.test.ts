import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  parseImportArguments,
  runSecretImportCli,
} from '../../tools/integration-secrets-import.mjs'

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'locadora-import-cli-'))
const file = path.join(directory, 'operator.env')
fs.writeFileSync(
  file,
  'LOCADORA_INTEGRATION_TEST_SECRET="synthetic $value #literal"\n'
)
const args = [
  '--integration=gateway_test',
  '--reference=env:LOCADORA_INTEGRATION_TEST',
  '--env-file=' + file,
]
afterAll(() => {
  fs.unlinkSync(file)
  fs.rmdirSync(directory)
})
describe('secret importer operator CLI', () => {
  it('requires explicit absolute file, validated ids and paired apply/confirmation', () => {
    expect(parseImportArguments(args).apply).toBe(false)
    for (const invalid of [
      [],
      [...args, '--apply'],
      [...args, '--confirm=' + '0'.repeat(64)],
      [...args, '--apply', '--confirm=no'],
      [...args, '--integration=other'],
      [
        '--integration=valid',
        '--reference=env:LOCADORA_INTEGRATION_TEST',
        '--env-file=relative.env',
      ],
      [...args, '--unknown=true'],
    ])
      expect(() => parseImportArguments(invalid)).toThrow(
        'SECRET_IMPORT_ARGUMENTS_INVALID'
      )
  })
  it('reads only the named file without expanding values, defaults to planning, emits only safe report', async () => {
    const output: string[] = []
    let called = false
    const exit = await runSecretImportCli(
      args,
      { LOCADORA_INTEGRATION_TEST_SECRET: 'wrong implicit value' },
      (s: string) => output.push(s),
      async (
        input: { variables: Record<string, string> },
        confirmation: unknown
      ) => {
        called = true
        expect(confirmation).toBeUndefined()
        expect(input.variables.LOCADORA_INTEGRATION_TEST_SECRET).toBe(
          'synthetic $value #literal'
        )
        return { integrationId: 'gateway_test', planHash: '0'.repeat(64) }
      }
    )
    expect(exit).toBe(0)
    expect(called).toBe(true)
    expect(output.join('')).not.toContain('synthetic')
  })
  it.each([
    'postgres://sensitive@real-host:5432/private synthetic secret',
    'SECRET_IMPORT_SYNTHETIC_SECRET_VALUE',
  ])(
    'does not expose filesystem, database or provider error text: %s',
    async (message) => {
      const output: string[] = []
      expect(
        await runSecretImportCli(
          [...args, '--apply', '--confirm=' + '0'.repeat(64)],
          {},
          (s: string) => output.push(s),
          async () => {
            throw new Error(message)
          }
        )
      ).toBe(1)
      expect(output).toEqual(['{"error":"SECRET_IMPORT_UNAVAILABLE"}'])
    }
  )
})
