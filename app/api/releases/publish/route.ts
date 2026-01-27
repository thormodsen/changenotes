import { NextRequest } from 'next/server'
import { publishReleases, unpublishReleases } from '@/lib/db/client'
import { apiSuccess, apiBadRequest, apiServerError } from '@/lib/api-response'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, unpublish } = body as { ids?: string[]; unpublish?: boolean }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return apiBadRequest('ids array is required')
    }

    const count = unpublish ? await unpublishReleases(ids) : await publishReleases(ids)

    return apiSuccess({ count })
  } catch (err) {
    return apiServerError(err)
  }
}
