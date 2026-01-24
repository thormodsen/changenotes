import { NextRequest, NextResponse } from 'next/server'
import { updateRelease } from '@/lib/db/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, type, whyThisMatters, impact, marketingTitle, marketingDescription, marketingWhyThisMatters } = body

    const success = await updateRelease(id, {
      title,
      description,
      type,
      whyThisMatters,
      impact,
      marketingTitle,
      marketingDescription,
      marketingWhyThisMatters,
    })

    if (!success) {
      return NextResponse.json({ error: 'Failed to update release' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Update error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
