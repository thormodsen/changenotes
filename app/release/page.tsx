import Link from 'next/link'
import { Suspense } from 'react'
import { getReleases, initializeSchema } from '@/lib/db/client'
import { ReleaseCardPreview } from './ReleaseCardPreview'
import { ScrollToCard } from './ScrollToCard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ReleaseOverviewPage() {
  await initializeSchema()
  const { releases } = await getReleases({
    published: true,
    shared: true,
    limit: 100,
  })

  return (
    <main className="h-dvh bg-[#0E2433] p-4 sm:p-6 overflow-auto">
      <Suspense fallback={null}>
        <ScrollToCard />
      </Suspense>
      <div className="inline-block min-w-0">
        {releases.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-white/80">No shared cards yet.</p>
            <Link
              href="/changelog"
              className="mt-3 inline-block text-sm font-medium text-[#335FFF] hover:underline"
            >
              View changelog
            </Link>
          </div>
        ) : (
          <div
            className="w-max"
            style={{
              paddingLeft: 400,
              paddingRight: 400,
              paddingTop: 712,
              paddingBottom: 712,
            }}
          >
            <ul
              className="grid gap-4 w-max"
              style={{
                gridTemplateColumns: 'repeat(5, 200px)',
              }}
            >
            {releases.map((release) => (
              <li key={release.id} id={`card-${release.id}`}>
                <ReleaseCardPreview
                  id={release.id}
                  title={release.marketing_title || release.title}
                  date={
                    typeof release.date === 'string'
                      ? release.date
                      : (release.date as Date).toISOString().split('T')[0]
                  }
                />
              </li>
            ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  )
}
