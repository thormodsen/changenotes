import { NextRequest, NextResponse } from 'next/server'
import { setReleaseShared } from '@/lib/db/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { shared } = await request.json()

    const success = await setReleaseShared(id, shared)

    if (!success) {
      return NextResponse.json({ error: 'Failed to update share status' }, { status: 500 })
    }

    return NextResponse.json({ success: true, shared })
  } catch (err) {
    console.error('Share toggle error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
