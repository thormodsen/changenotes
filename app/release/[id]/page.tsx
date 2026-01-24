import { notFound } from 'next/navigation'
import { getReleaseById } from '@/lib/db/client'
import { ReleaseCard } from './release-card'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ReleasePage({ params }: PageProps) {
  const { id } = await params
  const release = await getReleaseById(id)

  if (!release) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <ReleaseCard
        releaseNote={{
          title: release.title,
          type: release.type,
          description: release.description || '',
          whyItMatters: release.why_this_matters || '',
          date: release.date,
        }}
      />
    </main>
  )
}
