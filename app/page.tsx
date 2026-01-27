'use client'

import { useState, useEffect } from 'react'
import type { DatePreset } from '@/lib/types'
import { useReleases } from './hooks/useReleases'
import { FilterPanel } from './components/FilterPanel'
import { ReleaseList } from './components/ReleaseList'

export default function Home() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activePreset, setActivePreset] = useState<DatePreset | null>(null)
  const [syncing, setSyncing] = useState(false)

  const {
    releases,
    total,
    workspace,
    loading,
    error,
    message,
    fetchReleases,
    loadMore,
    updateRelease,
    removeRelease,
    setError,
    setMessage,
  } = useReleases(startDate, endDate)

  useEffect(() => {
    fetchReleases()
  }, [fetchReleases])

  const handleStartDateChange = (date: string) => {
    setActivePreset(null)
    setStartDate(date)
  }

  const handleEndDateChange = (date: string) => {
    setActivePreset(null)
    setEndDate(date)
  }

  const syncAndExtract = async () => {
    if (!startDate) {
      setError('Please select a start date')
      return
    }

    setSyncing(true)
    setError(null)
    setMessage(null)

    try {
      const params = new URLSearchParams({ start: startDate })
      if (endDate) params.append('end', endDate)

      const res = await fetch(`/api/releases/sync?${params}`, { method: 'POST' })
      const json = await res.json()

      if (!json.success) throw new Error(json.error?.message || 'Sync failed')

      const { data } = json
      const parts = []
      parts.push(`Fetched ${data.fetched} messages`)
      if (data.alreadyExtracted > 0) parts.push(`${data.alreadyExtracted} already extracted`)
      if (data.newMessages > 0) parts.push(`${data.newMessages} new`)
      if (data.extracted > 0) parts.push(`created ${data.extracted} releases`)
      if (data.skipped > 0) parts.push(`skipped ${data.skipped} non-releases`)
      if (data.edited > 0) parts.push(`re-extracted ${data.edited} edited`)

      setMessage(parts.join(' · ') + ` (v${data.promptVersion})`)
      await fetchReleases()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <Header onLogout={handleLogout} />
      <Navigation />

      <div className="flex gap-6">
        <div className="w-80 flex-shrink-0 space-y-4">
          <FilterPanel
            startDate={startDate}
            endDate={endDate}
            activePreset={activePreset}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
            onPresetChange={setActivePreset}
          />

          <ActionsPanel
            syncing={syncing}
            disabled={!startDate}
            onSync={syncAndExtract}
          />

          <StatusMessage error={error} message={message} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 min-h-[500px]">
            <ReleaseList
              releases={releases}
              total={total}
              workspace={workspace}
              loading={loading || syncing}
              onUpdate={updateRelease}
              onDelete={removeRelease}
              onLoadMore={loadMore}
              onError={setError}
              onMessage={setMessage}
            />
          </div>
        </div>
      </div>
    </main>
  )
}

function Header({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Changelog Manager</h1>
        <p className="text-gray-500 mt-1">Manage Slack messages and publish your changelog</p>
      </div>
      <button
        onClick={onLogout}
        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}

function Navigation() {
  return (
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </nav>
    </div>
  )
}

function ActionsPanel({
  syncing,
  disabled,
  onSync,
}: {
  syncing: boolean
  disabled: boolean
  onSync: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <svg
          className="w-5 h-5 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        <span className="font-medium text-gray-900">Actions</span>
      </div>

      <div className="space-y-3">
        <button
          onClick={onSync}
          disabled={syncing || disabled}
          className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors"
        >
          {syncing ? 'Syncing & Extracting...' : 'Sync & Extract'}
        </button>
      </div>
    </div>
  )
}

function StatusMessage({
  error,
  message,
}: {
  error: string | null
  message: string | null
}) {
  if (!error && !message) return null

  return (
    <div
      className={`rounded-lg p-4 ${
        error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
      }`}
    >
      {error || message}
    </div>
  )
}
