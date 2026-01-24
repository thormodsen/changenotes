import { NextRequest, NextResponse } from 'next/server'
import { getReleasesByMessageId } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const releases = await getReleasesByMessageId(id)

    return NextResponse.json({ releases })
  } catch (err) {
    console.error('Get releases by message error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
