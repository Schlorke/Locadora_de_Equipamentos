export function successResponse<T>(
  data: T,
  status = 200,
  message?: string
): Response {
  return Response.json(
    {
      success: true,
      data,
      ...(message && { message }),
    },
    { status }
  )
}
