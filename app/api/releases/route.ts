import { NextRequest } from 'next/server'
import { getReleases, initializeSchema } from '@/lib/db/client'
import { apiSuccess, apiServerError } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    await initializeSchema()
    const { searchParams } = new URL(request.url)

    const { releases, total } = await getReleases({
      startDate: searchParams.get('start') ?? undefined,
      endDate: searchParams.get('end') ?? undefined,
      published: searchParams.has('published')
        ? searchParams.get('published') === 'true'
        : undefined,
      promptVersion: searchParams.get('promptVersion') ?? undefined,
      limit: searchParams.has('limit')
        ? parseInt(searchParams.get('limit')!, 10)
        : undefined,
      offset: searchParams.has('offset')
        ? parseInt(searchParams.get('offset')!, 10)
        : undefined,
    })

    const workspace = process.env.SLACK_WORKSPACE || ''

    return apiSuccess({ releases, total, workspace })
  } catch (err) {
    return apiServerError(err)
  }
}
