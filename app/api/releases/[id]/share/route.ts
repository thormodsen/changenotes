import { NextRequest } from 'next/server'
import { setReleaseShared } from '@/lib/db/client'
import { apiSuccess, apiError, apiServerError } from '@/lib/api-response'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { shared } = await request.json()

    const success = await setReleaseShared(id, shared)

    if (!success) {
      return apiError('Failed to update share status', 500)
    }

    return apiSuccess({ shared })
  } catch (err) {
    return apiServerError(err)
  }
}
