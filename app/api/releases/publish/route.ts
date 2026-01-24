import { NextRequest, NextResponse } from 'next/server'
import { publishReleases, unpublishReleases } from '@/lib/db/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, unpublish } = body as { ids?: string[]; unpublish?: boolean }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
    }

    const count = unpublish ? await unpublishReleases(ids) : await publishReleases(ids)

    return NextResponse.json({
      success: true,
      count,
    })
  } catch (err) {
    console.error('Publish error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
