import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getReleaseById } from '@/lib/db/client'
import { ReleasePageClient } from './release-page-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const release = await getReleaseById(id)

  if (!release || !release.published || !release.shared) {
    return { title: 'Not Found' }
  }

  const title = release.marketing_title || release.title
  const description = release.marketing_description || release.description || ''

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `/release/${id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function ReleasePage({ params }: PageProps) {
  noStore()
  const { id } = await params
  const release = await getReleaseById(id)

  if (!release || !release.published || !release.shared) {
    notFound()
  }

  const displayTitle = release.marketing_title || release.title
  const displayDescription = release.marketing_description || release.description || ''
  const displayWhyItMatters = release.marketing_why_this_matters || release.why_this_matters || ''

  return (
    <ReleasePageClient
        releaseId={release.id}
        releaseNote={{
          id: release.id,
          title: displayTitle,
          type: release.type,
          description: displayDescription,
          whyItMatters: displayWhyItMatters,
          date: release.date,
        }}
      />
  )
}
