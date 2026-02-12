import Link from 'next/link'
import { Suspense } from 'react'
import { getReleases, initializeSchema } from '@/lib/db/client'
import { HorizontalScrollArea } from './HorizontalScrollArea'
import { TimelineWithModal } from './TimelineWithModal'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function TimelinePage() {
  await initializeSchema()
  const { releases } = await getReleases({
    published: true,
    shared: true,
    limit: 100,
  })

  return (
    <main className="h-dvh bg-[#0E2433]">
      <Suspense fallback={null}>
        <HorizontalScrollArea>
          {releases.length === 0 ? (
            <div className="flex items-center justify-center h-full px-8">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                <p className="text-white/80">No shared cards yet.</p>
                <Link
                  href="/changelog"
                  className="mt-3 inline-block text-sm font-medium text-[#335FFF] hover:underline"
                >
                  View changelog
                </Link>
              </div>
            </div>
          ) : (
            <TimelineWithModal releases={releases} />
          )}
        </HorizontalScrollArea>
      </Suspense>
    </main>
  )
}
