import { expect, it } from 'vitest'
import {
  clearDraft,
  emptyCompany,
  readDraft,
  writeDraft,
  type DraftStorage,
} from './draft'
function memory(): DraftStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}
const draft = {
  version: 1 as const,
  company: { ...emptyCompany, tradeName: 'Rascunho' },
  slug: 'rascunho',
  planVersionId: '',
  pending: null,
}
it('scopes drafts to the owner and clears only that owner', () => {
  const storage = memory()
  expect(writeDraft(storage, 'owner-a', draft)).toBe(true)
  expect(readDraft(storage, 'owner-b')).toBeNull()
  expect(readDraft(storage, 'owner-a')?.company.tradeName).toBe('Rascunho')
  writeDraft(storage, 'owner-b', draft)
  clearDraft(storage, 'owner-a')
  expect(readDraft(storage, 'owner-a')).toBeNull()
  expect(readDraft(storage, 'owner-b')).toBeTruthy()
})
it.each([
  'not-json',
  'x'.repeat(16385),
  JSON.stringify({ ...draft, password: 'forged' }),
])('ignores invalid or secret-bearing storage', (raw) => {
  expect(readDraft({ ...memory(), getItem: () => raw }, 'owner')).toBeNull()
})
it('handles unavailable storage without creating a record or leaking raw input', () => {
  const storage = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
    removeItem: () => {
      throw new Error('blocked')
    },
  }
  expect(readDraft(storage, 'owner')).toBeNull()
  expect(writeDraft(storage, 'owner', draft)).toBe(false)
  expect(() => clearDraft(storage, 'owner')).not.toThrow()
})
