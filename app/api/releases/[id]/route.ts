import { NextRequest } from 'next/server'
import { updateRelease, deleteReleaseById, getReleaseById, getLinkedReleases } from '@/lib/db/client'
import { apiSuccess, apiError, apiServerError, apiNotFound } from '@/lib/api-response'

function serializeRelease(release: Awaited<ReturnType<typeof getReleaseById>>) {
  if (!release) return null
  return {
    ...release,
    date:
      typeof release.date === 'object' && release.date !== null
        ? (release.date as Date).toISOString().split('T')[0]
        : release.date,
    message_timestamp:
      release.message_timestamp instanceof Date
        ? release.message_timestamp.toISOString()
        : release.message_timestamp,
    extracted_at:
      release.extracted_at instanceof Date
        ? release.extracted_at.toISOString()
        : release.extracted_at,
    published_at:
      release.published_at instanceof Date
        ? release.published_at.toISOString()
        : release.published_at,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [release, linked] = await Promise.all([
      getReleaseById(id),
      getLinkedReleases(id),
    ])

    if (!release || !release.published || !release.shared) {
      return apiNotFound('Release not found')
    }

    return apiSuccess({
      release: serializeRelease(release),
      linked: {
        parent: linked.parent,
        siblings: linked.siblings,
        related: linked.related,
      },
    })
  } catch (err) {
    return apiServerError(err)
  }
}

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
