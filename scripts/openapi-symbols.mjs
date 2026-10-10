/**
 * Stabilize the three TypeScript well-known symbol names emitted by response inference.
 * Numeric suffixes are compiler allocation IDs; schema contents and required membership remain intact.
 * Only OpenAPI Schema Objects are visited. Payload examples, defaults, enums and other strings are data.
 * Returns a new document without mutating its input; a name collision fails instead of merging schemas.
 */
export function stabilizeOpenApiSymbols(document) {
  const record = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
  const map = (value, visit) =>
    record(value)
      ? Object.fromEntries(
          Object.entries(value).map(([name, item]) => [name, visit(item)])
        )
      : value
  const update = (value, visitors) =>
    record(value)
      ? Object.fromEntries(
          Object.entries(value).map(([name, item]) => [
            name,
            Object.hasOwn(visitors, name) ? visitors[name](item) : item,
          ])
        )
      : value
  const symbolName = (name) =>
    name.replace(/^__@(iterator|toPrimitive|unscopables)@[0-9]+$/, '__@$1')

  function schema(value) {
    if (!record(value)) return value
    const names = new Map()
    const result = update(value, {
      properties(properties) {
        if (!record(properties)) return properties
        const occupied = new Set()
        return Object.fromEntries(
          Object.entries(properties).map(([name, item]) => {
            const stable = symbolName(name)
            if (occupied.has(stable))
              throw new Error(`OpenAPI symbol property collision: ${stable}`)
            occupied.add(stable)
            names.set(name, stable)
            return [stable, schema(item)]
          })
        )
      },
      items: schema,
      additionalProperties: schema,
      not: schema,
      allOf: (items) => (Array.isArray(items) ? items.map(schema) : items),
      anyOf: (items) => (Array.isArray(items) ? items.map(schema) : items),
      oneOf: (items) => (Array.isArray(items) ? items.map(schema) : items),
      prefixItems: (items) =>
        Array.isArray(items) ? items.map(schema) : items,
    })
    if (Array.isArray(value.required))
      result.required = value.required.map((name) => {
        if (typeof name !== 'string') return name
        if (symbolName(name) !== name && !names.has(name))
          throw new Error(`OpenAPI symbol required property is absent: ${name}`)
        return names.get(name) ?? name
      })
    return result
  }

  const parameter = (value) => update(value, { schema, content })
  const headers = (value) => map(value, parameter)
  const content = (value) =>
    map(value, (media) =>
      update(media, {
        schema,
        encoding: (value) => map(value, (item) => update(item, { headers })),
      })
    )
  const response = (value) => update(value, { content, headers })
  const body = (value) => update(value, { content })
  const parameters = (value) =>
    Array.isArray(value) ? value.map(parameter) : value
  const callback = (value) => map(value, pathItem)
  const operation = (value) =>
    update(value, {
      parameters,
      requestBody: body,
      responses: (value) => map(value, response),
      callbacks: (value) => map(value, callback),
    })
  function pathItem(value) {
    return update(value, {
      parameters,
      get: operation,
      post: operation,
      put: operation,
      patch: operation,
      delete: operation,
      head: operation,
      options: operation,
    })
  }
  return update(document, {
    paths: (value) => map(value, pathItem),
    webhooks: (value) => map(value, pathItem),
    components: (value) =>
      update(value, {
        schemas: (value) => map(value, schema),
        parameters: (value) => map(value, parameter),
        headers,
        responses: (value) => map(value, response),
        requestBodies: (value) => map(value, body),
        callbacks: (value) => map(value, callback),
        pathItems: (value) => map(value, pathItem),
      }),
  })
}
