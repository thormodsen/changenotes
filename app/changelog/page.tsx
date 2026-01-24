import { getReleases } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export default async function ChangelogPage() {
  const releases = await getReleases({ published: true })

  const groupedReleases = releases.reduce<Record<string, typeof releases>>((acc, release) => {
    if (!acc[release.date]) acc[release.date] = []
    acc[release.date].push(release)
    return acc
  }, {})

  const sortedDates = Object.keys(groupedReleases).sort((a, b) => b.localeCompare(a))

  const typeColors: Record<string, string> = {
    'New Feature': 'bg-lime-100 text-lime-800',
    Improvement: 'bg-blue-100 text-blue-800',
    'Bug Fix': 'bg-red-100 text-red-800',
    Deprecation: 'bg-orange-100 text-orange-800',
    Rollback: 'bg-yellow-100 text-yellow-800',
    Update: 'bg-gray-100 text-gray-800',
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Changelog</h1>
          <p className="text-lg text-gray-600">Latest updates and improvements</p>
        </header>

        {sortedDates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No releases published yet.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {sortedDates.map((date) => (
              <div key={date}>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h2>

                <div className="space-y-6">
                  {groupedReleases[date].map((release) => (
                    <article
                      key={release.id}
                      id={`release-${release.id}`}
                      className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm scroll-mt-6"
                    >
                      <div className="mb-3">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                            typeColors[release.type] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {release.type}
                        </span>
                      </div>

                      <h3 className="text-xl font-semibold text-gray-900 mb-2">{release.title}</h3>

                      {release.description && (
                        <p className="text-gray-700 leading-relaxed mb-4">{release.description}</p>
                      )}

                      {release.why_this_matters && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                          <p className="text-sm font-medium text-blue-900 mb-1">Why this matters</p>
                          <p className="text-sm text-blue-800">{release.why_this_matters}</p>
                        </div>
                      )}

                      {release.impact && (
                        <div className="mt-3 p-4 bg-amber-50 rounded-lg border border-amber-100">
                          <p className="text-sm font-medium text-amber-900 mb-1">Impact</p>
                          <p className="text-sm text-amber-800">{release.impact}</p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
