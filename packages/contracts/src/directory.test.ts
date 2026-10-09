import { describe, expect, it } from 'vitest'
import {
  DIRECTORY_SEARCH_MAX_RESULTS,
  DIRECTORY_SEARCH_MIN_QUERY_LENGTH,
  DirectorySearchItemSchema,
  DirectorySearchQuerySchema,
  DirectorySearchResponseSchema,
  PublicTenantCardSchema,
} from './directory'

// Campos de contato e identificação fiscal que nunca saem no diretório público.
const FORBIDDEN_FIELDS = {
  document: '00.000.000/0000-00',
  cnpj: '00000000000000',
  phone: '+55 00 0000-0000',
  companyPhone: '+55 00 0000-0000',
  whatsappNumber: '+55 00 0000-0000',
  email: 'contato@locadora.example',
  contactEmail: 'contato@locadora.example',
  postalCode: '00000-000',
  zipCode: '00000-000',
  cep: '00000-000',
} as const

const item = {
  slug: 'acme',
  name: 'Acme Locações',
  city: 'Curitiba',
  state: 'PR',
}
const card = { ...item, logoUrl: 'https://cdn.example/acme/logo.png' }

describe('busca do diretório', () => {
  it('exige q com 3 caracteres ou mais, após trim', () => {
    expect(DIRECTORY_SEARCH_MIN_QUERY_LENGTH).toBe(3)
    expect(DirectorySearchQuerySchema.safeParse({ q: 'ab' }).success).toBe(
      false
    )
    expect(DirectorySearchQuerySchema.safeParse({ q: '  ab  ' }).success).toBe(
      false
    )
    expect(DirectorySearchQuerySchema.parse({ q: '  abc ' })).toEqual({
      q: 'abc',
    })
    expect(
      DirectorySearchQuerySchema.safeParse({ q: 'a'.repeat(81) }).success
    ).toBe(false)
    expect(DirectorySearchQuerySchema.safeParse({}).success).toBe(false)
    expect(DirectorySearchQuerySchema.safeParse({ q: 123 }).success).toBe(false)
  })

  it('recusa caracteres de controle em q, mesmo com 3 caracteres ou mais (o PostgreSQL recusa NUL no ILIKE)', () => {
    for (const q of [
      '\u0000\u0000\u0000',
      '\u0000acme',
      'acme\u0000',
      'ac\u0001me',
      'ac\u001fme',
      'acme\u007f',
      'ac\u0085me',
      'ac\u009fme',
      'ac\nme',
      'ac\tme',
    ]) {
      expect(
        DirectorySearchQuerySchema.safeParse({ q }).success,
        JSON.stringify(q)
      ).toBe(false)
    }
    // Espaço, acento e símbolos continuam valendo; o trim tira a quebra de linha das pontas.
    expect(DirectorySearchQuerySchema.parse({ q: 'São José 50%_off' })).toEqual(
      { q: 'São José 50%_off' }
    )
    expect(DirectorySearchQuerySchema.parse({ q: '\n acme \t' })).toEqual({
      q: 'acme',
    })
  })

  it('não aceita paginação nem outros parâmetros', () => {
    for (const extra of [
      { page: '2' },
      { cursor: 'x' },
      { limit: '50' },
      { tenantSlug: 'acme' },
    ]) {
      expect(
        DirectorySearchQuerySchema.safeParse({ q: 'acme', ...extra }).success
      ).toBe(false)
    }
  })

  it('item só tem slug, nome, cidade e UF; nunca logo, CNPJ, telefone, e-mail ou CEP', () => {
    expect(Object.keys(DirectorySearchItemSchema.shape).sort()).toEqual([
      'city',
      'name',
      'slug',
      'state',
    ])
    expect(DirectorySearchItemSchema.parse(item)).toEqual(item)
    expect(
      DirectorySearchItemSchema.parse({ ...item, city: null, state: null })
    ).toMatchObject({
      city: null,
      state: null,
    })
    expect(DirectorySearchItemSchema.safeParse(card).success).toBe(false)
    for (const [key, value] of Object.entries(FORBIDDEN_FIELDS)) {
      expect(
        DirectorySearchItemSchema.safeParse({ ...item, [key]: value }).success
      ).toBe(false)
    }
  })

  it('item recusa slug reservado ou fora da política', () => {
    for (const slug of ['admin', 'app', 'a--b', 'x', 'Acme', 'acme.evil']) {
      expect(
        DirectorySearchItemSchema.safeParse({ ...item, slug }).success
      ).toBe(false)
    }
    expect(
      DirectorySearchItemSchema.safeParse({ ...item, state: 'pr' }).success
    ).toBe(false)
    expect(
      DirectorySearchItemSchema.safeParse({ ...item, name: '   ' }).success
    ).toBe(false)
  })

  it('resposta tem no máximo 10 resultados e nenhum outro campo', () => {
    expect(DIRECTORY_SEARCH_MAX_RESULTS).toBe(10)
    const results = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...item,
        slug: `acme${index}`,
      }))
    expect(
      DirectorySearchResponseSchema.safeParse({ results: results(10) }).success
    ).toBe(true)
    expect(
      DirectorySearchResponseSchema.safeParse({ results: results(11) }).success
    ).toBe(false)
    expect(
      DirectorySearchResponseSchema.safeParse({
        results: results(1),
        nextCursor: 'x',
      }).success
    ).toBe(false)
  })
})

describe('cartão público por slug', () => {
  it('só tem slug, nome, cidade, UF e logo', () => {
    expect(Object.keys(PublicTenantCardSchema.shape).sort()).toEqual([
      'city',
      'logoUrl',
      'name',
      'slug',
      'state',
    ])
    expect(PublicTenantCardSchema.parse(card)).toEqual(card)
    expect(
      PublicTenantCardSchema.parse({ ...card, logoUrl: null }).logoUrl
    ).toBeNull()
  })

  it('nunca carrega CNPJ, telefone, e-mail ou CEP', () => {
    for (const [key, value] of Object.entries(FORBIDDEN_FIELDS)) {
      expect(
        PublicTenantCardSchema.safeParse({ ...card, [key]: value }).success
      ).toBe(false)
    }
  })

  it('logo só em https', () => {
    for (const logoUrl of [
      'http://cdn.example/logo.png',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      '/logo.png',
      '',
      `https://cdn.example/${'a'.repeat(2048)}`,
    ]) {
      expect(
        PublicTenantCardSchema.safeParse({ ...card, logoUrl }).success
      ).toBe(false)
    }
  })
})
