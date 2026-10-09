import { describe, expect, it } from 'vitest'
import {
  OwnerRegistrationSchema,
  OwnerAccountResponseSchema,
} from './credentials'

describe('owner account contracts', () => {
  it.each([
    ['x'.repeat(72), true],
    ['x'.repeat(73), false],
    ['é'.repeat(36), true],
    ['é'.repeat(37), false],
  ] as const)(
    'does not silently truncate bcrypt input %s',
    (password, valid) => {
      expect(
        OwnerRegistrationSchema.safeParse({
          name: 'Ana',
          email: 'owner@example.test',
          password,
        }).success
      ).toBe(valid)
    }
  )
  it('accepts only the minimal access data and normalizes email', () => {
    expect(
      OwnerRegistrationSchema.parse({
        name: ' Ana ',
        email: ' OWNER@Example.test ',
        password: 'long-fixture-password',
      })
    ).toEqual({
      name: 'Ana',
      email: 'owner@example.test',
      password: 'long-fixture-password',
    })
  })
  it.each(['123456789', 'x'.repeat(129)])(
    'rejects an unsuitable password length',
    (password) => {
      expect(
        OwnerRegistrationSchema.safeParse({
          name: 'Ana',
          email: 'owner@example.test',
          password,
        }).success
      ).toBe(false)
    }
  )
  it.each([
    'phone',
    'cpf',
    'cnpj',
    'emailVerified',
    'role',
    'tenantId',
    'callbackURL',
  ])('rejects supplied %s', (field) => {
    expect(
      OwnerRegistrationSchema.safeParse({
        name: 'Ana',
        email: 'owner@example.test',
        password: 'long-fixture-password',
        [field]: 'forged',
      }).success
    ).toBe(false)
  })
  it('keeps verification as a strict server fact', () => {
    expect(
      OwnerAccountResponseSchema.safeParse({
        userId: 'user',
        emailVerified: false,
      }).success
    ).toBe(true)
    expect(
      OwnerAccountResponseSchema.safeParse({
        userId: 'user',
        emailVerified: 'true',
      }).success
    ).toBe(false)
    expect(
      OwnerAccountResponseSchema.safeParse({
        userId: 'user',
        emailVerified: true,
        email: 'private@example.test',
      }).success
    ).toBe(false)
  })
})
