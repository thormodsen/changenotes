import { NextRequest, NextResponse } from 'next/server'
import { publishReleases } from '@/lib/db/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids } = body as { ids?: string[] }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
    }

    const published = await publishReleases(ids)

    return NextResponse.json({
      success: true,
      published,
    })
  } catch (err) {
    console.error('Publish error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
