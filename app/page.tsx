'use client'

import { useState, useEffect, useCallback } from 'react'

interface MediaImage {
  id: string
  url: string
  thumb_url?: string
  width?: number
  height?: number
  name?: string
}

interface MediaVideo {
  id: string
  url: string
  mp4_url?: string
  thumb_url?: string
  duration_ms?: number
  name?: string
}

interface ReleaseMedia {
  images: MediaImage[]
  videos: MediaVideo[]
}

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
  message_timestamp?: string
  channel_id?: string
  marketing_title: string | null
  marketing_description: string | null
  marketing_why_this_matters: string | null
  shared: boolean
  media: ReleaseMedia | null
  include_media: boolean
  featured_image_url: string | null
}

type PresetKey = '7days' | '30days' | 'month'

const emojiMap: Record<string, string> = {
  rocket: '🚀',
  tada: '🎉',
  sparkles: '✨',
  bug: '🐛',
  fire: '🔥',
  package: '📦',
  wrench: '🔧',
  hammer: '🔨',
  construction: '🚧',
  warning: '⚠️',
  x: '❌',
  check: '✅',
  white_check_mark: '✅',
  heavy_check_mark: '✔️',
  arrow_up: '⬆️',
  arrow_down: '⬇️',
  art: '🎨',
  zap: '⚡',
  memo: '📝',
  pencil: '✏️',
  book: '📖',
  bookmark: '🔖',
  globe_with_meridians: '🌐',
  link: '🔗',
  lock: '🔒',
  unlock: '🔓',
  key: '🔑',
  mag: '🔍',
  bulb: '💡',
  bell: '🔔',
  loudspeaker: '📢',
  mega: '📣',
  chart_with_upwards_trend: '📈',
  chart_with_downwards_trend: '📉',
  bar_chart: '📊',
  calendar: '📅',
  hourglass: '⌛',
  hourglass_flowing_sand: '⏳',
  watch: '⌚',
  alarm_clock: '⏰',
  stopwatch: '⏱️',
  timer_clock: '⏲️',
  star: '⭐',
  star2: '🌟',
  dizzy: '💫',
  boom: '💥',
  collision: '💥',
  muscle: '💪',
  clap: '👏',
  pray: '🙏',
  handshake: '🤝',
  thumbsup: '👍',
  thumbsdown: '👎',
  ok_hand: '👌',
  point_right: '👉',
  point_left: '👈',
  point_up: '☝️',
  point_down: '👇',
  raised_hand: '✋',
  wave: '👋',
  eyes: '👀',
  brain: '🧠',
  heart: '❤️',
  broken_heart: '💔',
  green_heart: '💚',
  blue_heart: '💙',
  yellow_heart: '💛',
  purple_heart: '💜',
  black_heart: '🖤',
  white_heart: '🤍',
  orange_heart: '🧡',
  man_and_woman_holding_hands: '👫',
  woman_and_man_holding_hands: '👫',
  couple: '👫',
  two_men_holding_hands: '👬',
  two_women_holding_hands: '👭',
  busts_in_silhouette: '👥',
  family: '👪',
  man: '👨',
  woman: '👩',
  boy: '👦',
  girl: '👧',
  ladybug: '🐞',
  iphone: '📱',
  computer: '💻',
  phone: '📞',
  email: '📧',
  inbox_tray: '📥',
  outbox_tray: '📤',
}

function convertEmojis(text: string): string {
  return text.replace(/:([a-z0-9_+-]+):/g, (match, code) => {
    return emojiMap[code] || match
  })
}

function formatSlackText(text: string): JSX.Element[] {
  const lines = text.split('\n')
  const elements: JSX.Element[] = []

  lines.forEach((line, lineIdx) => {
    // Convert emoji codes to actual emojis first
    let formattedLine = convertEmojis(line)

    // Process the line to handle both links and bold text
    const parts: (string | JSX.Element)[] = []
    let lastIndex = 0
    let partKey = 0

    // Combined regex for Slack links and bold text
    // Matches: <url|label> or <url> or *bold*
    const combinedRegex = /<(https?:\/\/[^\s|>]+)(?:\|([^>]+))?>|\*([^*]+)\*/g
    let match

    while ((match = combinedRegex.exec(formattedLine)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(formattedLine.substring(lastIndex, match.index))
      }

      if (match[1]) {
        // This is a link: <url|label> or <url>
        const url = match[1]
        const label = match[2] || url
        parts.push(
          <a
            key={`link-${lineIdx}-${partKey++}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {label}
          </a>
        )
      } else if (match[3]) {
        // This is bold text: *text*
        parts.push(<strong key={`bold-${lineIdx}-${partKey++}`}>{match[3]}</strong>)
      }

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < formattedLine.length) {
      parts.push(formattedLine.substring(lastIndex))
    }

    elements.push(
      <div key={lineIdx} className={line.trim() === '' ? 'h-2' : ''}>
        {parts.length > 0 ? parts : line}
      </div>
    )
  })

  return elements
}

function buildSlackUrl(messageId: string, channelId: string, workspace: string): string {
  // Convert message timestamp to Slack permalink format: p{timestamp_without_dot}
  const permalink = 'p' + messageId.replace('.', '')
  return `https://${workspace}.slack.com/archives/${channelId}/${permalink}`
}

export default function Home() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null)
  const [loading, setLoading] = useState<'sync' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Releases state
  const [releases, setReleases] = useState<Release[]>([])
  const [releasesTotal, setReleasesTotal] = useState(0)
  const [releasesWorkspace, setReleasesWorkspace] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Release>>({})
  const [generatingMarketing, setGeneratingMarketing] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const fetchReleases = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('start', startDate)
      if (endDate) params.append('end', endDate)
      params.append('limit', '100')

      const res = await fetch(`/api/releases?${params}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setReleases(data.releases || [])
      setReleasesTotal(data.total || 0)
      setReleasesWorkspace(data.workspace || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch releases')
    }
  }, [startDate, endDate])

  const loadMoreReleases = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('start', startDate)
      if (endDate) params.append('end', endDate)
      params.append('limit', '100')
      params.append('offset', releases.length.toString())

      const res = await fetch(`/api/releases?${params}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setReleases(prev => [...prev, ...(data.releases || [])])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more releases')
    }
  }, [startDate, endDate, releases.length])

  // Fetch releases on mount
  useEffect(() => {
    setIsInitialized(true)
    fetchReleases()
  }, [fetchReleases])

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpenId) return
    const handleClick = () => setMenuOpenId(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [menuOpenId])


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

  const syncAndExtract = async () => {
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

      const res = await fetch(`/api/releases/sync?${params}`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      const parts = []
      if (data.fetched > 0) parts.push(`Fetched ${data.fetched} messages from Slack`)
      if (data.extracted > 0) parts.push(`Extracted ${data.extracted} releases`)
      if (data.edited > 0) parts.push(`Re-extracted ${data.edited} edited messages`)
      if (data.skipped > 0) parts.push(`Skipped ${data.skipped} non-release messages`)

      setMessage(parts.join('. ') + ` (prompt v${data.promptVersion})`)
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

      // Update local state instead of refetching
      setReleases(prev => prev.map(r =>
        r.id === id
          ? { ...r, published: !currentlyPublished, published_at: !currentlyPublished ? new Date().toISOString() : null }
          : r
      ))
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
      marketing_title: release.marketing_title || '',
      marketing_description: release.marketing_description || '',
      marketing_why_this_matters: release.marketing_why_this_matters || '',
      featured_image_url: release.featured_image_url || '',
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
          marketingTitle: editForm.marketing_title,
          marketingDescription: editForm.marketing_description,
          marketingWhyThisMatters: editForm.marketing_why_this_matters,
          featuredImageUrl: editForm.featured_image_url,
        }),
      })

      if (!res.ok) throw new Error('Failed to update release')

      // Update local state instead of refetching
      setReleases(prev => prev.map(r =>
        r.id === id
          ? {
              ...r,
              title: editForm.title || r.title,
              description: editForm.description || null,
              why_this_matters: editForm.why_this_matters || null,
              impact: editForm.impact || null,
              marketing_title: editForm.marketing_title || null,
              marketing_description: editForm.marketing_description || null,
              marketing_why_this_matters: editForm.marketing_why_this_matters || null,
              featured_image_url: editForm.featured_image_url || null,
            }
          : r
      ))
      setEditingId(null)
      setEditForm({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const deleteRelease = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return

    try {
      const res = await fetch(`/api/releases/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
      setReleases(prev => prev.filter(r => r.id !== id))
      setReleasesTotal(prev => prev - 1)
      setMessage('Release deleted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const [reextracting, setReextracting] = useState<Set<string>>(new Set())

  const reextractRelease = async (id: string) => {
    setReextracting(prev => new Set(prev).add(id))
    setError(null)

    try {
      const res = await fetch(`/api/releases/${id}/reextract`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to re-extract')
      }

      const releaseList = data.extractedReleases
        ?.map((r: { title: string; date: string }) => `• ${r.date}: ${r.title}`)
        .join('\n') || ''

      const summary = `Re-extract complete:
- Messages read: ${data.messagesRead}
- Messages skipped: ${data.messagesSkipped}
- Releases extracted: ${data.extracted}
${releaseList ? `\nExtracted releases:\n${releaseList}` : ''}`

      console.log(summary)
      setMessage(`Re-extracted: ${data.messagesRead} messages → ${data.extracted} releases (${data.messagesSkipped} skipped)`)
      // Refresh the list
      fetchReleases()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to re-extract')
    } finally {
      setReextracting(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const generateMarketing = async (releaseId: string) => {
    setGeneratingMarketing(releaseId)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch(`/api/releases/${releaseId}/marketing`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate marketing')
      }

      const { marketing } = await res.json()

      // Update local state instead of refetching
      setReleases(prev => prev.map(r =>
        r.id === releaseId
          ? {
              ...r,
              marketing_title: marketing.title,
              marketing_description: marketing.description,
              marketing_why_this_matters: marketing.whyThisMatters,
            }
          : r
      ))
      setMessage('Marketing content generated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Marketing generation failed')
    } finally {
      setGeneratingMarketing(null)
    }
  }

  const regenerateMarketing = async (releaseId: string) => {
    setGeneratingMarketing(releaseId)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch(`/api/releases/${releaseId}/marketing`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to regenerate marketing')
      }

      const { marketing } = await res.json()

      setReleases(prev => prev.map(r =>
        r.id === releaseId
          ? {
              ...r,
              marketing_title: marketing.title,
              marketing_description: marketing.description,
              marketing_why_this_matters: marketing.whyThisMatters,
            }
          : r
      ))
      setMessage('Marketing content regenerated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Marketing regeneration failed')
    } finally {
      setGeneratingMarketing(null)
    }
  }

  const toggleShare = async (releaseId: string, currentlyShared: boolean, hasMarketing: boolean) => {
    setGeneratingMarketing(releaseId)
    setError(null)

    try {
      // If no marketing content, generate it first
      if (!hasMarketing) {
        const res = await fetch(`/api/releases/${releaseId}/marketing`, {
          method: 'POST',
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to generate marketing')
        }
        const { marketing } = await res.json()

        // Set shared=true after generating
        await fetch(`/api/releases/${releaseId}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shared: true }),
        })

        setReleases(prev => prev.map(r =>
          r.id === releaseId
            ? {
                ...r,
                marketing_title: marketing.title,
                marketing_description: marketing.description,
                marketing_why_this_matters: marketing.whyThisMatters,
                shared: true,
              }
            : r
        ))
        setMessage('Share card created')
      } else {
        // Toggle shared state
        const newShared = !currentlyShared
        const res = await fetch(`/api/releases/${releaseId}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shared: newShared }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to toggle share')
        }

        setReleases(prev => prev.map(r =>
          r.id === releaseId ? { ...r, shared: newShared } : r
        ))
        setMessage(newShared ? 'Share card enabled' : 'Share card disabled')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle share')
    } finally {
      setGeneratingMarketing(null)
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
    // Skip releases with invalid dates
    if (!release.date || release.date === 'null' || release.date === 'undefined') {
      return acc
    }

    if (!acc[release.date]) acc[release.date] = []
    acc[release.date].push(release)
    return acc
  }, {})

  const sortedDates = Object.keys(groupedReleases).sort((a, b) => b.localeCompare(a))

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Changelog Manager</h1>
          <p className="text-gray-500 mt-1">Manage Slack messages and publish your changelog</p>
        </div>
        <button
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            window.location.href = '/login'
          }}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Header links */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8">
          <span className="pb-3 text-sm font-medium border-b-2 border-gray-900 text-gray-900">
            Release Notes
          </span>
          <a
            href="/changelog"
            target="_blank"
            rel="noopener noreferrer"
            className="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors inline-flex items-center gap-1"
          >
            Public Changelog
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </nav>
      </div>

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
              <button
                onClick={syncAndExtract}
                disabled={loading !== null || !startDate}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors"
              >
                {loading === 'sync' ? 'Syncing & Extracting...' : 'Sync & Extract'}
              </button>

            </div>
          </div>

          {/* Status Messages */}
          {(error || message) && (
            <div className={`rounded-lg p-4 ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {error || message}
            </div>
          )}
        </div>

        {/* Right Panel - Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 min-h-[500px]">
            {loading === 'sync' ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-purple-500 mb-4" />
                  <p>Loading releases...</p>
                </div>
              ) : releases.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-gray-500">
                  <svg className="w-12 h-12 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="font-medium text-gray-900">No Releases Yet</p>
                  <p className="text-sm mt-1 text-center max-w-xs">
                    Sync messages and extract releases to see them here
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
                    {sortedDates.map((date) => {
                      // Handle both YYYY-MM-DD and full ISO timestamp formats
                      const dateObj = new Date(date.includes('T') ? date : date + 'T00:00:00')
                      const isValidDate = !isNaN(dateObj.getTime())

                      return (
                        <div key={date}>
                          <h3 className="text-sm font-medium text-gray-500 mb-3">
                            {isValidDate
                              ? dateObj.toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })
                              : date}
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
                                      {release.message_timestamp && (
                                        <span className="text-xs text-gray-500">
                                          {new Date(release.message_timestamp).toLocaleString('en-GB', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                        </span>
                                      )}
                                      {releasesWorkspace && release.channel_id && (
                                        <a
                                          href={buildSlackUrl(release.message_id, release.channel_id, releasesWorkspace)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-gray-400 hover:text-blue-600 transition-colors"
                                          title="View in Slack"
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </a>
                                      )}
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

                                        {/* Featured Image */}
                                        <div className="border-t border-gray-200 pt-3 mt-3">
                                          <p className="text-xs font-medium text-purple-700 mb-2">Featured Image</p>
                                          <div>
                                            <label className="block text-xs text-gray-600 mb-1">Image URL (paste any public image/gif URL)</label>
                                            <input
                                              type="text"
                                              value={editForm.featured_image_url || ''}
                                              onChange={(e) => setEditForm({ ...editForm, featured_image_url: e.target.value })}
                                              placeholder="https://example.com/image.gif"
                                              className="w-full px-2 py-1 border border-purple-300 rounded text-sm"
                                            />
                                            {editForm.featured_image_url && (
                                              <img
                                                src={editForm.featured_image_url}
                                                alt="Preview"
                                                className="mt-2 max-h-32 rounded border border-gray-300"
                                                onError={(e) => (e.currentTarget.style.display = 'none')}
                                              />
                                            )}
                                          </div>
                                        </div>

                                        {/* Marketing fields */}
                                        <div className="border-t border-gray-200 pt-3 mt-3">
                                          <p className="text-xs font-medium text-teal-700 mb-2">Marketing Copy</p>
                                          <div className="space-y-3">
                                            <div>
                                              <label className="block text-xs text-gray-600 mb-1">Marketing Title</label>
                                              <input
                                                type="text"
                                                value={editForm.marketing_title || ''}
                                                onChange={(e) => setEditForm({ ...editForm, marketing_title: e.target.value })}
                                                className="w-full px-2 py-1 border border-teal-300 rounded text-sm"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-gray-600 mb-1">Marketing Description</label>
                                              <textarea
                                                value={editForm.marketing_description || ''}
                                                onChange={(e) => setEditForm({ ...editForm, marketing_description: e.target.value })}
                                                rows={2}
                                                className="w-full px-2 py-1 border border-teal-300 rounded text-sm"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-gray-600 mb-1">Marketing Why This Matters</label>
                                              <textarea
                                                value={editForm.marketing_why_this_matters || ''}
                                                onChange={(e) => setEditForm({ ...editForm, marketing_why_this_matters: e.target.value })}
                                                rows={2}
                                                className="w-full px-2 py-1 border border-teal-300 rounded text-sm"
                                              />
                                            </div>
                                          </div>
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
                                        <h4 className="font-medium text-gray-900">
                                          <a
                                            href={`/changelog/${release.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-blue-600 hover:underline"
                                          >
                                            {release.title}
                                          </a>
                                        </h4>
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

                                        {/* Featured Image */}
                                        {release.featured_image_url && (
                                          <div className="mt-3">
                                            <img
                                              src={release.featured_image_url}
                                              alt="Featured"
                                              className="max-h-48 rounded border border-gray-300"
                                            />
                                          </div>
                                        )}

                                        {/* Slack Media Info (if no featured image) */}
                                        {!release.featured_image_url && release.media && (release.media.images.length > 0 || release.media.videos.length > 0) && (
                                          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded">
                                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                              </svg>
                                              <span>
                                                {release.media.images.length} image{release.media.images.length !== 1 ? 's' : ''}, {release.media.videos.length} video{release.media.videos.length !== 1 ? 's' : ''} in Slack
                                              </span>
                                              {releasesWorkspace && release.channel_id && (
                                                <a
                                                  href={buildSlackUrl(release.message_id, release.channel_id, releasesWorkspace)}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-blue-600 hover:underline"
                                                >
                                                  View →
                                                </a>
                                              )}
                                              <span className="text-gray-400">•</span>
                                              <span className="text-gray-500">Edit to add a public image URL</span>
                                            </div>
                                          </div>
                                        )}

                                        {release.marketing_title && (
                                          <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded">
                                            <div className="text-xs font-medium text-teal-700 mb-2">Marketing Copy</div>
                                            <div className="space-y-1 text-sm">
                                              <div><span className="font-medium text-teal-800">Title:</span> <span className="text-teal-700">{release.marketing_title}</span></div>
                                              {release.marketing_description && (
                                                <div><span className="font-medium text-teal-800">Description:</span> <span className="text-teal-700">{release.marketing_description}</span></div>
                                              )}
                                              {release.marketing_why_this_matters && (
                                                <div><span className="font-medium text-teal-800">Why it matters:</span> <span className="text-teal-700">{release.marketing_why_this_matters}</span></div>
                                              )}
                                            </div>
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
                                            ? 'bg-green-500 text-white hover:bg-green-600'
                                            : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
                                        }`}
                                      >
                                        {release.published ? 'Published' : 'Publish'}
                                      </button>
                                      <button
                                        onClick={() => toggleShare(release.id, release.shared, !!release.marketing_title)}
                                        disabled={generatingMarketing !== null}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                                          release.shared
                                            ? 'bg-pink-500 text-white hover:bg-pink-600'
                                            : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
                                        }`}
                                      >
                                        {generatingMarketing === release.id
                                          ? 'Working...'
                                          : release.shared
                                          ? 'Shared'
                                          : 'Share'}
                                      </button>
                                      {release.shared && (
                                        <a
                                          href={`/release/${release.id}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="px-3 py-1 border border-pink-300 text-pink-600 rounded text-xs font-medium hover:bg-pink-50 text-center"
                                        >
                                          View card
                                        </a>
                                      )}
                                      <button
                                        onClick={() => startEdit(release)}
                                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => deleteRelease(release.id, release.title)}
                                        className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200"
                                      >
                                        Delete
                                      </button>
                                      <div className="relative">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setMenuOpenId(menuOpenId === release.id ? null : release.id)
                                          }}
                                          className="px-3 py-1 border border-gray-300 text-gray-600 rounded text-xs font-medium hover:bg-gray-100"
                                        >
                                          ⋯
                                        </button>
                                        {menuOpenId === release.id && (
                                          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                                            <button
                                              onClick={() => {
                                                setMenuOpenId(null)
                                                reextractRelease(release.id)
                                              }}
                                              disabled={reextracting.has(release.id)}
                                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                                            >
                                              {reextracting.has(release.id) ? '↻ Re-extracting...' : '↻ Re-extract'}
                                            </button>
                                            {release.marketing_title && (
                                              <button
                                                onClick={() => {
                                                  setMenuOpenId(null)
                                                  regenerateMarketing(release.id)
                                                }}
                                                disabled={generatingMarketing !== null}
                                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                                              >
                                                ↻ Regenerate marketing
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      )
                    })}

                    {releases.length < releasesTotal && (
                      <button
                        onClick={loadMoreReleases}
                        className="w-full mt-6 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Load more ({releasesTotal - releases.length} remaining)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
        </div>
      </div>

    </main>
  )
}
