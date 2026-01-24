'use client'

import { useState, useEffect, useCallback } from 'react'

interface SlackMessage {
  id: string
  channel_id: string
  text: string
  timestamp: string
  user_id: string | null
  username: string | null
  thread_replies: Array<{
    id: string
    text: string
    timestamp: string
    user_id: string
    username?: string
  }> | null
  skip_extraction: boolean
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
}

type PresetKey = '7days' | '30days' | 'month'
type Tab = 'messages' | 'releases' | 'public'

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
  const [activeTab, setActiveTab] = useState<Tab>('messages')
  const [isInitialized, setIsInitialized] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null)
  const [loading, setLoading] = useState<'sync' | 'extract' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Messages state
  const [messages, setMessages] = useState<SlackMessage[]>([])
  const [messagesTotal, setMessagesTotal] = useState(0)
  const [slackWorkspace, setSlackWorkspace] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{
    messageId: string
    releases: Release[]
  } | null>(null)

  // Releases state
  const [releases, setReleases] = useState<Release[]>([])
  const [releasesWorkspace, setReleasesWorkspace] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Release>>({})
  const [generatingMarketing, setGeneratingMarketing] = useState<string | null>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/messages?limit=100')
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages)
        setMessagesTotal(data.total)
        setSlackWorkspace(data.workspace || '')
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err)
    }
  }, [])

  const fetchReleases = useCallback(async () => {
    setLoading('extract')
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('start', startDate)
      if (endDate) params.append('end', endDate)

      const res = await fetch(`/api/releases?${params}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setReleases(data.releases || [])
      setReleasesWorkspace(data.workspace || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch releases')
    } finally {
      setLoading(null)
    }
  }, [startDate, endDate])

  // Restore active tab from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('activeTab')
    if (saved && (saved === 'messages' || saved === 'releases' || saved === 'public')) {
      setActiveTab(saved as Tab)
    }
    setIsInitialized(true)
  }, [])

  // Fetch data when tab changes, save to localStorage only after initialization
  useEffect(() => {
    if (!isInitialized) return

    if (activeTab === 'messages') fetchMessages()
    else if (activeTab === 'releases') fetchReleases()

    localStorage.setItem('activeTab', activeTab)
  }, [activeTab, isInitialized, fetchMessages, fetchReleases])


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
      await fetchMessages()
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
      await fetchReleases()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setLoading(null)
    }
  }

  const toggleSkipExtraction = async (id: string, currentSkip: boolean) => {
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipExtraction: !currentSkip }),
      })

      if (!res.ok) throw new Error('Failed to update message')

      await fetchMessages()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const confirmDeleteMessage = async (messageId: string) => {
    try {
      // Fetch releases for this message
      const res = await fetch(`/api/messages/${messageId}/releases`)
      if (res.ok) {
        const data = await res.json()
        setDeleteConfirm({ messageId, releases: data.releases })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch releases')
    }
  }

  const deleteMessage = async () => {
    if (!deleteConfirm) return

    try {
      const res = await fetch(`/api/messages/${deleteConfirm.messageId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete message')

      setDeleteConfirm(null)
      await fetchMessages()
      setMessage('Message and related releases deleted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
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

      // Update local state instead of refetching
      setReleases(prev => prev.map(r =>
        r.id === id
          ? {
              ...r,
              title: editForm.title || r.title,
              description: editForm.description || null,
              why_this_matters: editForm.why_this_matters || null,
              impact: editForm.impact || null,
            }
          : r
      ))
      setEditingId(null)
      setEditForm({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const reextractMessage = async (messageId: string) => {
    if (!confirm('Re-extract this message? This will delete all existing releases for this message and create new ones.')) {
      return
    }

    setLoading('extract')
    setError(null)
    setMessage(null)

    try {
      const res = await fetch(`/api/messages/${messageId}/reextract`, {
        method: 'POST',
      })

      if (!res.ok) throw new Error('Failed to re-extract')

      const data = await res.json()
      setMessage(`Re-extracted ${data.extracted} releases (prompt v${data.promptVersion})`)
      await fetchReleases()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-extraction failed')
    } finally {
      setLoading(null)
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

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8">
          {(['messages', 'releases', 'public'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'messages' ? 'Slack Messages' : tab === 'releases' ? 'Release Notes' : 'Public Changelog'}
            </button>
          ))}
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

        {/* Right Panel - Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'messages' && (
            <div className="bg-white rounded-xl border border-gray-200 min-h-[500px]">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-medium text-gray-900">
                    {messagesTotal} message{messagesTotal !== 1 ? 's' : ''}
                  </h2>
                </div>

                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-gray-500">
                    <p>No messages synced yet. Select a date range and click "Sync & Extract".</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-4 rounded-lg border ${
                          msg.skip_extraction ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-200'
                        }`}
                      >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-gray-500">
                                  {new Date(msg.timestamp).toLocaleString()}
                                </span>
                                {slackWorkspace && (
                                  <a
                                    href={buildSlackUrl(msg.id, msg.channel_id, slackWorkspace)}
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
                                {msg.username && (
                                  <span className="text-xs text-gray-500">@{msg.username}</span>
                                )}
                                {msg.skip_extraction && (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">
                                    Skipped
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-900">{formatSlackText(msg.text)}</div>

                              {msg.thread_replies && msg.thread_replies.length > 0 && (
                                <div className="mt-2 pl-4 border-l-2 border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">
                                    {msg.thread_replies.length} {msg.thread_replies.length === 1 ? 'reply' : 'replies'}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => toggleSkipExtraction(msg.id, msg.skip_extraction)}
                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                  msg.skip_extraction
                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                {msg.skip_extraction ? 'Include' : 'Skip'}
                              </button>
                              <button
                                onClick={() => confirmDeleteMessage(msg.id)}
                                className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'releases' && (
            <div className="bg-white rounded-xl border border-gray-200 min-h-[500px]">
              {loading === 'extract' ? (
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
                                          {new Date(release.message_timestamp).toLocaleString('en-US', {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit',
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
                                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            : 'bg-green-500 text-white hover:bg-green-600'
                                        }`}
                                      >
                                        {release.published ? 'Unpublish' : 'Publish'}
                                      </button>
                                      <a
                                        href={`/release/${release.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1 bg-pink-100 text-pink-700 rounded text-xs font-medium hover:bg-pink-200 text-center"
                                      >
                                        Share
                                      </a>
                                      <button
                                        onClick={() => startEdit(release)}
                                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => reextractMessage(release.message_id)}
                                        disabled={loading !== null}
                                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium hover:bg-purple-200 disabled:opacity-50"
                                      >
                                        Re-extract
                                      </button>
                                      <button
                                        onClick={() => generateMarketing(release.id)}
                                        disabled={generatingMarketing !== null}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                                          release.marketing_title
                                            ? 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                                            : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                        }`}
                                      >
                                        {generatingMarketing === release.id
                                          ? 'Generating...'
                                          : release.marketing_title
                                          ? 'Regenerate'
                                          : 'Marketing'}
                                      </button>
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
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'public' && (
            <div className="bg-white rounded-xl border border-gray-200 min-h-[500px]">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-medium text-gray-900">Public Changelog Preview</h2>
                  <a
                    href="/changelog"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    Open in New Tab
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                <iframe
                  src="/changelog"
                  className="w-full h-[600px] border border-gray-200 rounded-lg"
                  title="Public Changelog Preview"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Delete Message?</h3>

            {deleteConfirm.releases.length > 0 ? (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  This will also delete {deleteConfirm.releases.length}{' '}
                  {deleteConfirm.releases.length === 1 ? 'release' : 'releases'} associated with this message:
                </p>
                <div className="max-h-48 overflow-y-auto mb-4 space-y-2">
                  {deleteConfirm.releases.map((release) => (
                    <div key={release.id} className="p-2 bg-gray-50 rounded text-sm">
                      <div className="font-medium text-gray-900">{release.title}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {release.type} · {release.date}
                        {release.published && (
                          <span className="ml-2 px-2 py-0.5 rounded bg-green-100 text-green-700">
                            Published
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-600 mb-4">
                This message has no associated releases.
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={deleteMessage}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
