import { NextResponse } from 'next/server'

export interface ApiSuccessResponse<T> {
  success: true
  data: T
}

export interface ApiErrorResponse {
  success: false
  error: {
    message: string
    code?: string
  }
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status })
}

export function apiError(
  message: string,
  status = 500,
  code?: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: { message, code },
    },
    { status }
  )
}

export function apiNotFound(message = 'Resource not found'): NextResponse<ApiErrorResponse> {
  return apiError(message, 404, 'NOT_FOUND')
}

export function apiBadRequest(message: string): NextResponse<ApiErrorResponse> {
  return apiError(message, 400, 'BAD_REQUEST')
}

export function apiUnauthorized(message = 'Unauthorized'): NextResponse<ApiErrorResponse> {
  return apiError(message, 401, 'UNAUTHORIZED')
}

export function apiServerError(err: unknown): NextResponse<ApiErrorResponse> {
  const message = err instanceof Error ? err.message : 'Unknown error'
  console.error('API error:', err)
  return apiError(message, 500, 'INTERNAL_ERROR')
}
