// Neutral JSON contract for unknown endpoints, without identity or data access.
export function GET() {
  return Response.json(
    {
      error: 'Not Found',
      message: 'Endpoint não encontrado não encontrado',
      code: 'NOT_FOUND',
    },
    { status: 404 }
  )
}

export function POST() {
  return Response.json(
    {
      error: 'Not Found',
      message: 'Endpoint não encontrado não encontrado',
      code: 'NOT_FOUND',
    },
    { status: 404 }
  )
}

export function PUT() {
  return Response.json(
    {
      error: 'Not Found',
      message: 'Endpoint não encontrado não encontrado',
      code: 'NOT_FOUND',
    },
    { status: 404 }
  )
}

export function PATCH() {
  return Response.json(
    {
      error: 'Not Found',
      message: 'Endpoint não encontrado não encontrado',
      code: 'NOT_FOUND',
    },
    { status: 404 }
  )
}

export function DELETE() {
  return Response.json(
    {
      error: 'Not Found',
      message: 'Endpoint não encontrado não encontrado',
      code: 'NOT_FOUND',
    },
    { status: 404 }
  )
}
