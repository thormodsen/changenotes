import { NextRequest, NextResponse } from 'next/server'
import { updateMessageSkipExtraction } from '@/lib/db/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { skipExtraction } = body

    if (typeof skipExtraction !== 'boolean') {
      return NextResponse.json({ error: 'skipExtraction must be a boolean' }, { status: 400 })
    }

    const success = await updateMessageSkipExtraction(id, skipExtraction)

    if (!success) {
      return NextResponse.json({ error: 'Failed to update message' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Update message error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
