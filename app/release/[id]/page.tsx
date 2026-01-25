import { notFound } from 'next/navigation'
import { getReleaseById } from '@/lib/db/client'
import { ReleaseCard } from './release-card'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ReleasePage({ params }: PageProps) {
  const { id } = await params
  const release = await getReleaseById(id)

  if (!release || !release.shared) {
    notFound()
  }

  // Prefer marketing fields when available
  const displayTitle = release.marketing_title || release.title
  const displayDescription = release.marketing_description || release.description || ''
  const displayWhyItMatters = release.marketing_why_this_matters || release.why_this_matters || ''

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
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
