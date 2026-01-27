import { NextRequest, NextResponse } from 'next/server'
import { updateRelease, deleteReleaseById, getReleaseById } from '@/lib/db/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, type, whyThisMatters, impact, marketingTitle, marketingDescription, marketingWhyThisMatters, includeMedia, featuredImageUrl } = body

    const success = await updateRelease(id, {
      title,
      description,
      type,
      whyThisMatters,
      impact,
      marketingTitle,
      marketingDescription,
      marketingWhyThisMatters,
      includeMedia,
      featuredImageUrl,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get release details before deleting for logging
    const release = await getReleaseById(id)

    const success = await deleteReleaseById(id)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete release' }, { status: 500 })
    }

    // Log deleted release
    if (release) {
      console.log(`Deleted release:`)
      console.log(`  • ${release.date}: ${release.title}`)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
