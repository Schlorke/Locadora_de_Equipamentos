import { describe, expect, it } from 'vitest'
import { stabilizeOpenApiSymbols } from './openapi-symbols.mjs'

const document = (id: number, type = 'string') => {
  const item = {
    type: 'object',
    properties: {
      [`__@iterator@${id}`]: { type },
      [`__@toPrimitive@${id + 1}`]: { type: 'object' },
      [`__@unscopables@${id + 2}`]: { type: 'object' },
      payload: {
        type: 'string',
        title: '__@iterator@123',
        default: '__@toPrimitive@456',
        enum: ['__@unscopables@789'],
        example: { properties: { '__@iterator@123': 'payload text' } },
      },
    },
    required: [`__@iterator@${id}`, 'payload'],
  }
  return {
    openapi: '3.0.0',
    info: { title: '__@iterator@123', version: '1.0.0' },
    components: { schemas: { Example: item } },
    paths: {
      '/example': {
        get: {
          responses: {
            '200': {
              description: '__@toPrimitive@456',
              content: {
                'application/json': {
                  schema: { type: 'array', items: item },
                  example: {
                    properties: { '__@iterator@123': 'payload text' },
                    required: ['__@iterator@123'],
                  },
                },
              },
            },
          },
        },
      },
    },
  }
}

describe('OpenAPI TypeScript symbol names', () => {
  it('compiler IDs produce the same complete document while input and payload data stay intact', () => {
    const input = document(10)
    const before = structuredClone(input)
    const stable = stabilizeOpenApiSymbols(input)
    expect(stable).toEqual(stabilizeOpenApiSymbols(document(90)))
    expect(input).toEqual(before)
    expect(stable.components.schemas.Example.properties).toEqual({
      '__@iterator': { type: 'string' },
      '__@toPrimitive': { type: 'object' },
      '__@unscopables': { type: 'object' },
      payload: before.components.schemas.Example.properties.payload,
    })
    expect(stable.components.schemas.Example.required).toEqual([
      '__@iterator',
      'payload',
    ])
    expect(stable.info).toEqual(before.info)
    expect(
      stable.paths['/example'].get.responses['200'].content['application/json']
        .example
    ).toEqual(
      before.paths['/example'].get.responses['200'].content['application/json']
        .example
    )
    expect(stabilizeOpenApiSymbols(stable)).toEqual(stable)
  })

  it('a real property type difference remains different after stabilizing IDs', () => {
    expect(stabilizeOpenApiSymbols(document(10, 'string'))).not.toEqual(
      stabilizeOpenApiSymbols(document(90, 'number'))
    )
    expect(
      stabilizeOpenApiSymbols(document(90, 'number')).components.schemas.Example
        .properties['__@iterator']
    ).toEqual({ type: 'number' })
  })

  it('refuses colliding symbol names and an opaque required name without its property', () => {
    const schemaDocument = (
      properties: Record<string, unknown>,
      required?: string[]
    ) => ({
      components: { schemas: { Example: { properties, required } } },
    })
    expect(() =>
      stabilizeOpenApiSymbols(
        schemaDocument({ '__@iterator@10': {}, '__@iterator@90': {} })
      )
    ).toThrow('OpenAPI symbol property collision: __@iterator')
    expect(() =>
      stabilizeOpenApiSymbols(
        schemaDocument({ '__@iterator@10': {}, '__@iterator': {} })
      )
    ).toThrow('OpenAPI symbol property collision: __@iterator')
    expect(() =>
      stabilizeOpenApiSymbols(schemaDocument({}, ['__@iterator@10']))
    ).toThrow('OpenAPI symbol required property is absent: __@iterator@10')
  })
})
