'use client'

import { useState, useEffect, useCallback } from 'react'

interface Release {
  id: string
  message_id: string
  date: string
  title: string
  description: string | null
  type: string
  why_this_matters: string | null
  impact: string | null
  marketing_title: string | null
  message_timestamp?: string
  shared: boolean
}

function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = date instanceof Date
    ? date
    : new Date(typeof date === 'string' && !date.includes('T') ? date + 'T00:00:00' : date)

  if (isNaN(dateObj.getTime())) return ''

  return dateObj.toLocaleDateString('en-US', options || {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getDateKey(date: string | Date): string {
  // Parse date as local time to match formatDate behavior
  const dateObj = date instanceof Date
    ? date
    : new Date(typeof date === 'string' && !date.includes('T') ? date + 'T12:00:00' : date)
  if (isNaN(dateObj.getTime())) return 'unknown'
  // Format in local timezone
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const typeColors: Record<string, string> = {
  'New Feature': 'bg-lime-100 text-lime-800',
  Improvement: 'bg-blue-100 text-blue-800',
  'Bug Fix': 'bg-red-100 text-red-800',
  Deprecation: 'bg-orange-100 text-orange-800',
  Rollback: 'bg-yellow-100 text-yellow-800',
  Update: 'bg-gray-100 text-gray-800',
}

export default function ChangelogPage() {
  const [releases, setReleases] = useState<Release[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchReleases = useCallback(async (offset = 0) => {
    const params = new URLSearchParams({
      published: 'true',
      limit: '50',
      offset: offset.toString(),
    })
    const res = await fetch(`/api/releases?${params}`)
    const json = await res.json()
    if (!json.success) return { releases: [], total: 0 }
    return json.data
  }, [])

  useEffect(() => {
    fetchReleases(0).then((data) => {
      setReleases(data.releases || [])
      setTotal(data.total || 0)
      setLoading(false)
    })
  }, [fetchReleases])

  // Scroll to anchor after releases load
  useEffect(() => {
    if (!loading && window.location.hash) {
      const id = window.location.hash.slice(1)
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [loading])

  const loadMore = async () => {
    const data = await fetchReleases(releases.length)
    setReleases((prev) => [...prev, ...(data.releases || [])])
  }

  const groupedReleases = releases.reduce<Record<string, Release[]>>((acc, release) => {
    const key = getDateKey(release.date)
    if (!acc[key]) acc[key] = []
    acc[key].push(release)
    return acc
  }, {})

  const sortedDates = Object.keys(groupedReleases).sort((a, b) => b.localeCompare(a))

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      </main>
    )
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
                  {formatDate(date, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }) || date}
                </h2>

                <div className="space-y-6">
                  {groupedReleases[date].map((release) => (
                    <article
                      key={release.id}
                      id={`release-${release.id}`}
                      className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm scroll-mt-6 hover:border-gray-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                            typeColors[release.type] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {release.type}
                        </span>
                        {release.message_timestamp && (
                          <span className="text-sm text-gray-500">
                            {formatDate(release.message_timestamp, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>

                      <a href={`/changelog/${release.id}`} className="block group">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{release.title}</h3>
                      </a>

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

                      {release.shared && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <a
                            href={`/release/${release.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-pink-100 text-pink-700 rounded-lg text-sm font-medium hover:bg-pink-200 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            Share
                          </a>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ))}

            {releases.length < total && (
              <div className="text-center pt-4">
                <button
                  onClick={loadMore}
                  className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Load more ({total - releases.length} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
