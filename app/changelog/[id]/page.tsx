import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getReleaseById } from '@/lib/db/client'

interface PageProps {
  params: Promise<{ id: string }>
}

function formatDate(date: string | Date): string {
  const dateObj = date instanceof Date
    ? date
    : new Date(typeof date === 'string' && !date.includes('T') ? date + 'T00:00:00' : date)

  if (isNaN(dateObj.getTime())) return ''

  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const typeColors: Record<string, string> = {
  'New Feature': 'bg-lime-100 text-lime-800',
  Improvement: 'bg-blue-100 text-blue-800',
  'Bug Fix': 'bg-red-100 text-red-800',
  Deprecation: 'bg-orange-100 text-orange-800',
  Rollback: 'bg-yellow-100 text-yellow-800',
  Update: 'bg-gray-100 text-gray-800',
}

export default async function ReleaseDetailPage({ params }: PageProps) {
  const { id } = await params
  const release = await getReleaseById(id)

  if (!release) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/changelog"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          See all changes
        </Link>

        <article className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                typeColors[release.type] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {release.type}
            </span>
            <span className="text-gray-500">{formatDate(release.date)}</span>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">{release.title}</h1>

          {release.description && (
            <p className="text-lg text-gray-700 leading-relaxed mb-6">{release.description}</p>
          )}

          {release.why_this_matters && (
            <div className="p-5 bg-blue-50 rounded-lg border border-blue-100 mb-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">Why this matters</p>
              <p className="text-blue-800">{release.why_this_matters}</p>
            </div>
          )}

          {release.impact && (
            <div className="p-5 bg-amber-50 rounded-lg border border-amber-100 mb-4">
              <p className="text-sm font-semibold text-amber-900 mb-2">Impact</p>
              <p className="text-amber-800">{release.impact}</p>
            </div>
          )}

          {release.marketing_title && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <Link
                href={`/release/${release.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-pink-100 text-pink-700 rounded-lg text-sm font-medium hover:bg-pink-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share the news
              </Link>
            </div>
          )}
        </article>
      </div>
    </main>
  )
}
