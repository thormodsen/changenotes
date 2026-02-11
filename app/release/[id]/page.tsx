import Link from 'next/link'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getReleaseById } from '@/lib/db/client'
import { ReleaseCard } from './release-card'

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

  // Prefer marketing fields when available
  const displayTitle = release.marketing_title || release.title
  const displayDescription = release.marketing_description || release.description || ''
  const displayWhyItMatters = release.marketing_why_this_matters || release.why_this_matters || ''

  return (
    <main className="bg-[#0E2433] min-h-dvh flex flex-col items-center justify-center p-4 relative">
      <Link
        href={`/release?card=${id}`}
        className="absolute top-4 left-4 text-sm font-medium text-white/80 hover:text-white transition"
      >
        ← All cards
      </Link>
      <ReleaseCard
        releaseNote={{
          id: release.id,
          title: displayTitle,
          type: release.type,
          description: displayDescription,
          whyItMatters: displayWhyItMatters,
          date: release.date,
        }}
      />
    </main>
  )
}
