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
  prompt_version: string | null
  extracted_at: string
  published: boolean
  published_at: string | null
}

interface Stats {
  totalMessages: number
  totalReleases: number
  publishedReleases: number
  messagesWithoutReleases: number
}

type PresetKey = '7days' | '30days' | 'month'

export default function Home() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [releases, setReleases] = useState<Release[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState<'sync' | 'extract' | 'releases' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null)
  const [dbInitialized, setDbInitialized] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Release>>({})

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
        setDbInitialized(true)
      }
    } catch {
      // Stats not available yet
    }
  }, [])

  const fetchReleases = useCallback(async () => {
    setLoading('releases')
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('start', startDate)
      if (endDate) params.append('end', endDate)

      const res = await fetch(`/api/releases?${params}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setReleases(data.releases || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch releases')
    } finally {
      setLoading(null)
    }
  }, [startDate, endDate])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Load releases on mount
  useEffect(() => {
    const loadInitialReleases = async () => {
      setLoading('releases')
      try {
        const res = await fetch('/api/releases')
        const data = await res.json()
        if (res.ok) setReleases(data.releases || [])
      } catch {
        // Silent fail on initial load
      } finally {
        setLoading(null)
      }
    }
    loadInitialReleases()
  }, [])

  const initDb = async () => {
    try {
      const res = await fetch('/api/init', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to initialize database')
      setDbInitialized(true)
      setMessage('Database initialized')
      await fetchStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize')
    }
  }

  const applyPreset = (preset: PresetKey) => {
    const today = new Date()
    const formatDate = (d: Date) => d.toISOString().split('T')[0]

    setActivePreset(preset)
    setEndDate(formatDate(today))

    switch (preset) {
      case '7days':
        setStartDate(formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)))
        break
      case '30days':
        setStartDate(formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)))
        break
      case 'month':
        setStartDate(formatDate(new Date(today.getFullYear(), today.getMonth(), 1)))
        break
    }
  }

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    setActivePreset(null)
    if (type === 'start') setStartDate(value)
    else setEndDate(value)
  }

  const syncMessages = async () => {
    if (!startDate) {
      setError('Please select a start date')
      return
    }

    setLoading('sync')
    setError(null)
    setMessage(null)

    try {
      const params = new URLSearchParams({ start: startDate })
      if (endDate) params.append('end', endDate)

      const res = await fetch(`/api/messages/sync?${params}`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      const msg = `Synced ${data.inserted} new messages (${data.skipped} already existed).`
      const extractMsg = data.extracted > 0 ? ` Extracted ${data.extracted} releases.` : ''
      setMessage(msg + extractMsg)
      await fetchStats()
      await fetchReleases()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setLoading(null)
    }
  }

  const extractReleases = async (reextract = false) => {
    setLoading('extract')
    setError(null)
    setMessage(null)

    try {
      const params = reextract ? '?reextract=true' : ''
      const res = await fetch(`/api/releases/extract${params}`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setMessage(
        `Extracted ${data.extracted} releases from ${data.messagesProcessed} messages (prompt v${data.promptVersion})`
      )
      await fetchStats()
      await fetchReleases()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setLoading(null)
    }
  }

  const togglePublish = async (id: string, currentlyPublished: boolean) => {
    try {
      const res = await fetch('/api/releases/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], unpublish: currentlyPublished }),
      })

      if (!res.ok) throw new Error('Failed to update publish status')

      await fetchReleases()
      await fetchStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const startEdit = (release: Release) => {
    setEditingId(release.id)
    setEditForm({
      title: release.title,
      description: release.description || '',
      why_this_matters: release.why_this_matters || '',
      impact: release.impact || '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/releases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          whyThisMatters: editForm.why_this_matters,
          impact: editForm.impact,
        }),
      })

      if (!res.ok) throw new Error('Failed to update release')

      setEditingId(null)
      setEditForm({})
      await fetchReleases()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const typeColors: Record<string, string> = {
    'New Feature': 'bg-lime-100 text-lime-800',
    Improvement: 'bg-blue-100 text-blue-800',
    'Bug Fix': 'bg-red-100 text-red-800',
    Deprecation: 'bg-orange-100 text-orange-800',
    Rollback: 'bg-yellow-100 text-yellow-800',
    Update: 'bg-gray-100 text-gray-800',
  }

  const groupedReleases = releases.reduce<Record<string, Release[]>>((acc, release) => {
    if (!acc[release.date]) acc[release.date] = []
    acc[release.date].push(release)
    return acc
  }, {})

  const sortedDates = Object.keys(groupedReleases).sort((a, b) => b.localeCompare(a))

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Changelog Viewer</h1>
          <p className="text-gray-500 mt-1">
            Sync messages from Slack and publish your changelog
          </p>
        </div>
        <a
          href="/changelog"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          View Public Changelog
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-semibold text-gray-900">{stats.totalMessages}</div>
            <div className="text-sm text-gray-500">Messages Synced</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-semibold text-gray-900">{stats.messagesWithoutReleases}</div>
            <div className="text-sm text-gray-500">Pending Extraction</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-semibold text-gray-900">{stats.totalReleases}</div>
            <div className="text-sm text-gray-500">Releases Extracted</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-semibold text-lime-600">{stats.publishedReleases}</div>
            <div className="text-sm text-gray-500">Published</div>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Left Panel - Controls */}
        <div className="w-80 flex-shrink-0 space-y-4">
          {/* Date Range */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="font-medium text-gray-900">Date Range</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleDateChange('start', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 rounded-lg border-0 text-gray-900 focus:ring-2 focus:ring-gray-300"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleDateChange('end', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 rounded-lg border-0 text-gray-900 focus:ring-2 focus:ring-gray-300"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Quick Presets</label>
                <div className="flex flex-wrap gap-2">
                  {(['7days', '30days', 'month'] as const).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => applyPreset(preset)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        activePreset === preset
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {preset === '7days' ? 'Last 7 days' : preset === '30days' ? 'Last 30 days' : 'This month'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-medium text-gray-900">Actions</span>
            </div>

            <div className="space-y-3">
              {!dbInitialized && (
                <button
                  onClick={initDb}
                  className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors"
                >
                  Initialize Database
                </button>
              )}

              <button
                onClick={syncMessages}
                disabled={loading !== null || !startDate}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors"
              >
                {loading === 'sync' ? 'Syncing & Extracting...' : 'Sync & Extract'}
              </button>

              <button
                onClick={() => extractReleases(false)}
                disabled={loading !== null}
                className="w-full py-2.5 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white rounded-lg font-medium transition-colors"
              >
                {loading === 'extract' ? 'Extracting...' : 'Extract Pending'}
              </button>

              <hr className="my-2" />

              <button
                onClick={() => extractReleases(true)}
                disabled={loading !== null}
                className="w-full py-2 text-sm bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg transition-colors"
              >
                Re-extract All (update prompt)
              </button>
            </div>
          </div>

          {/* Messages */}
          {(error || message) && (
            <div className={`rounded-lg p-4 ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {error || message}
            </div>
          )}
        </div>

        {/* Right Panel - Results */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 min-h-[500px]">
            {loading === 'releases' || loading === 'extract' ? (
              <div className="flex flex-col items-center justify-center h-[500px] text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-purple-500 mb-4" />
                <p>{loading === 'extract' ? 'Extracting releases with Claude...' : 'Loading releases...'}</p>
                <p className="text-sm text-gray-400 mt-1">This may take a moment</p>
              </div>
            ) : releases.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[500px] text-gray-500">
                <svg className="w-12 h-12 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="font-medium text-gray-900">No Releases Yet</p>
                <p className="text-sm mt-1 text-center max-w-xs">
                  Select a date range and click "Sync & Extract" to fetch messages from Slack and extract releases using Claude
                </p>
              </div>
            ) : (
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-medium text-gray-900">
                    {releases.length} release{releases.length !== 1 ? 's' : ''}
                  </h2>
                </div>

                <div className="space-y-6">
                  {sortedDates.map((date) => (
                    <div key={date}>
                      <h3 className="text-sm font-medium text-gray-500 mb-3">
                        {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </h3>
                      <div className="space-y-3">
                        {groupedReleases[date].map((release) => {
                          const isEditing = editingId === release.id
                          return (
                            <div
                              key={release.id}
                              className={`p-4 rounded-lg border ${
                                release.published
                                  ? 'bg-green-50 border-green-200'
                                  : 'bg-gray-50 border-gray-100'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span
                                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        typeColors[release.type] || 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      {release.type}
                                    </span>
                                    {release.published && (
                                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        Published
                                      </span>
                                    )}
                                    {release.prompt_version && (
                                      <span className="text-xs text-gray-400">v{release.prompt_version}</span>
                                    )}
                                  </div>

                                  {isEditing ? (
                                    <div className="space-y-3">
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-1">Title</label>
                                        <input
                                          type="text"
                                          value={editForm.title || ''}
                                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-1">Description</label>
                                        <textarea
                                          value={editForm.description || ''}
                                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                          rows={2}
                                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-1">Why this matters</label>
                                        <textarea
                                          value={editForm.why_this_matters || ''}
                                          onChange={(e) => setEditForm({ ...editForm, why_this_matters: e.target.value })}
                                          rows={2}
                                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-1">Impact</label>
                                        <textarea
                                          value={editForm.impact || ''}
                                          onChange={(e) => setEditForm({ ...editForm, impact: e.target.value })}
                                          rows={2}
                                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => saveEdit(release.id)}
                                          className="px-3 py-1 bg-gray-900 text-white rounded text-sm hover:bg-gray-800"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={cancelEdit}
                                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <h4 className="font-medium text-gray-900">{release.title}</h4>
                                      {release.description && (
                                        <p className="text-sm text-gray-600 mt-1">{release.description}</p>
                                      )}

                                      {release.why_this_matters && (
                                        <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                                          <span className="font-medium text-blue-800">Why this matters: </span>
                                          <span className="text-blue-700">{release.why_this_matters}</span>
                                        </div>
                                      )}

                                      {release.impact && (
                                        <div className="mt-2 p-2 bg-amber-50 rounded text-sm">
                                          <span className="font-medium text-amber-800">Impact: </span>
                                          <span className="text-amber-700">{release.impact}</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>

                                {!isEditing && (
                                  <div className="flex flex-col gap-2">
                                    <button
                                      onClick={() => togglePublish(release.id, release.published)}
                                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                        release.published
                                          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                          : 'bg-green-500 text-white hover:bg-green-600'
                                      }`}
                                    >
                                      {release.published ? 'Unpublish' : 'Publish'}
                                    </button>
                                    <button
                                      onClick={() => startEdit(release)}
                                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
