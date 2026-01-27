import { NextRequest } from 'next/server'
import { updateRelease, deleteReleaseById, getReleaseById } from '@/lib/db/client'
import { apiSuccess, apiError, apiServerError } from '@/lib/api-response'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
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
    } = body

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
      return apiError('Failed to update release', 500)
    }

    return apiSuccess({ updated: true })
  } catch (err) {
    return apiServerError(err)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const release = await getReleaseById(id)
    const success = await deleteReleaseById(id)

    if (!success) {
      return apiError('Failed to delete release', 500)
    }

    if (release) {
      console.log(`Deleted release: ${release.date}: ${release.title}`)
    }

    return apiSuccess({ deleted: true })
  } catch (err) {
    return apiServerError(err)
  }
}
