import Link from 'next/link'
import { Suspense } from 'react'
import { getReleases, initializeSchema } from '@/lib/db/client'
import { MomentumScrollArea } from './MomentumScrollArea'
import { ReleaseGridWithModal } from './ReleaseGridWithModal'

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
    <main className="h-dvh bg-[#0E2433]">
      <Suspense fallback={null}>
        <MomentumScrollArea>
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
              <ReleaseGridWithModal releases={releases} />
            )}
          </div>
        </MomentumScrollArea>
      </Suspense>
    </main>
  )
}
