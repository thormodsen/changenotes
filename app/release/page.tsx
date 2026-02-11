import Link from 'next/link'
import { getReleases, initializeSchema } from '@/lib/db/client'
import { ReleaseCardPreview } from './ReleaseCardPreview'

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
      <div className="inline-block min-w-0">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Marketing cards
          </h1>
          <p className="mt-1 text-white/70 text-sm sm:text-base">
            Click a card to open the full view. Scroll or zoom to see more.
          </p>
        </header>

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
          <ul
            className="grid gap-4 w-max"
            style={{
              gridTemplateColumns: 'repeat(5, 200px)',
            }}
          >
            {releases.map((release) => (
              <li key={release.id}>
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
        )}
      </div>
    </main>
  )
}
