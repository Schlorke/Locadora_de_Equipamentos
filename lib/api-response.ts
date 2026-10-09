import { NextResponse } from 'next/server'

/**
 * Padronizar respostas de API com status codes e mensagens apropriadas
 */

export interface ApiError {
  error: string
  message: string
  code?: string
  details?: unknown
}

export interface ApiSuccess<T = unknown> {
  success: true
  data: T
  message?: string
}

/**
 * Resposta de erro padronizada
 */
export function errorResponse(
  message: string,
  status: number,
  code?: string,
  details?: unknown
): NextResponse<ApiError> {
  const error: ApiError = {
    error: getErrorTypeByStatus(status),
    message,
    ...(code && { code }),
    ...(details && process.env.NODE_ENV === 'development' ? { details } : {}),
  }

  return NextResponse.json(error, { status })
}

/**
 * Resposta de sucesso padronizada
 */
export function successResponse<T>(
  data: T,
  status: number = 200,
  message?: string
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message }),
    },
    { status }
  )
}

/**
 * Obter tipo de erro baseado no status code
 */
function getErrorTypeByStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Bad Request'
    case 401:
      return 'Unauthorized'
    case 403:
      return 'Forbidden'
    case 404:
      return 'Not Found'
    case 409:
      return 'Conflict'
    case 422:
      return 'Unprocessable Entity'
    case 429:
      return 'Too Many Requests'
    case 500:
      return 'Internal Server Error'
    default:
      return 'Error'
  }
}

/**
 * Resposta para recurso não encontrado
 */
export function notFoundResponse(
  resource: string = 'Recurso'
): NextResponse<ApiError> {
  return errorResponse(`${resource} não encontrado`, 404, 'NOT_FOUND')
}
