import { notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { getReleaseById, getLinkedReleases, type RelatedRelease } from '@/lib/db/client'
import { formatDisplayDate } from '@/lib/text-utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

const typeColors: Record<string, string> = {
  'New Feature': 'bg-[#CCFF00] text-[#0E2433]',
  Improvement: 'bg-[#335FFF]/20 text-[#335FFF]',
  'Bug Fix': 'bg-red-100 text-red-800',
  Deprecation: 'bg-orange-100 text-orange-800',
  Rollback: 'bg-yellow-100 text-yellow-800',
  Update: 'bg-gray-100 text-[#0E2433]',
}

function RelatedReleaseCard({ release }: { release: RelatedRelease }) {
  return (
    <article className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:border-[#335FFF]/50 hover:shadow-md transition-all">
      <div className="flex items-center gap-3 mb-3">
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
            typeColors[release.type] || 'bg-gray-100 text-[#0E2433]'
          }`}
        >
          {release.type}
        </span>
        <span className="text-sm text-gray-500">{formatDisplayDate(release.date)}</span>
      </div>
      <Link href={`/changelog/${release.id}`} className="block group">
        <h3 className="text-xl font-semibold text-[#0E2433] mb-2 group-hover:text-[#335FFF] transition-colors">
          {release.title}
        </h3>
      </Link>
      {release.description && (
        <p className="text-gray-700 leading-relaxed mb-4">{release.description}</p>
      )}
      {release.why_this_matters && (
        <div className="mt-4 p-4 bg-[#335FFF]/10 rounded-lg border border-[#335FFF]/20">
          <p className="text-sm font-medium text-[#0E2433] mb-1">Why this matters</p>
          <p className="text-sm text-[#0E2433]/80">{release.why_this_matters}</p>
        </div>
      )}
      {release.impact && (
        <div className="mt-3 p-4 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-sm font-medium text-amber-900 mb-1">Impact</p>
          <p className="text-sm text-amber-800">{release.impact}</p>
        </div>
      )}
    </article>
  )
}

export default async function ReleaseDetailPage({ params }: PageProps) {
  noStore()
  const { id } = await params

  const [release, linked] = await Promise.all([
    getReleaseById(id),
    getLinkedReleases(id),
  ])

  if (!release || !release.published) {
    notFound()
  }

  const hasLinkedReleases = linked.parent || linked.siblings.length > 0 || linked.related.length > 0

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/changelog"
          className="inline-flex items-center gap-2 text-[#0E2433]/60 hover:text-[#335FFF] mb-8"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          See all changes
        </Link>

        {/* Parent release banner */}
        {linked.parent && (
          <div className="mb-6 p-4 bg-[#335FFF]/10 rounded-lg border border-[#335FFF]/20">
            <p className="text-sm text-[#0E2433]/70 mb-2">This is a rollout update for:</p>
            <Link
              href={`/changelog/${linked.parent.id}`}
              className="font-semibold text-[#0E2433] hover:text-[#335FFF] transition-colors"
            >
              {linked.parent.title} →
            </Link>
          </div>
        )}

        <article className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                typeColors[release.type] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {release.type}
            </span>
            <span className="text-gray-500">{formatDisplayDate(release.date)}</span>
          </div>

          <h1 className="text-3xl font-bold text-[#0E2433] mb-4">{release.title}</h1>

          {release.description && (
            <p className="text-lg text-gray-700 leading-relaxed mb-6">{release.description}</p>
          )}

          {release.why_this_matters && (
            <div className="p-5 bg-[#335FFF]/10 rounded-lg border border-[#335FFF]/20 mb-4">
              <p className="text-sm font-semibold text-[#0E2433] mb-2">Why this matters</p>
              <p className="text-[#0E2433]/80">{release.why_this_matters}</p>
            </div>
          )}

          {release.impact && (
            <div className="p-5 bg-amber-50 rounded-lg border border-amber-100 mb-4">
              <p className="text-sm font-semibold text-amber-900 mb-2">Impact</p>
              <p className="text-amber-800">{release.impact}</p>
            </div>
          )}

          {release.shared && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <Link
                href={`/releasegrid/${release.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#CCFF00] text-[#0E2433] rounded-lg text-sm font-medium hover:bg-[#CCFF00]/80 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share the news
              </Link>
            </div>
          )}
        </article>

        {/* Linked releases section */}
        {hasLinkedReleases && (
          <div className="mt-8">
            {/* Siblings (rollout updates in same thread) */}
            {linked.siblings.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-[#0E2433] mb-4">Rollout updates</h3>
                <div className="grid gap-3">
                  {linked.siblings.map((sibling) => (
                    <RelatedReleaseCard key={sibling.id} release={sibling} />
                  ))}
                </div>
              </div>
            )}

            {/* Related releases (keyword match) */}
            {linked.related.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-[#0E2433] mb-4">Related releases</h3>
                <div className="grid gap-3">
                  {linked.related.map((related) => (
                    <RelatedReleaseCard key={related.id} release={related} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
