'use client'

import type { Release } from '@/lib/types'
import { formatDisplayDate } from '@/lib/text-utils'
import { ReleaseCard } from './ReleaseCard'

interface ReleaseListProps {
  releases: Release[]
  total: number
  workspace: string
  loading: boolean
  onUpdate: (id: string, updates: Partial<Release>) => void
  onDelete: (id: string) => void
  onLoadMore: () => void
  onError: (message: string) => void
  onMessage: (message: string) => void
}

function groupByDate(releases: Release[]): Record<string, Release[]> {
  return releases.reduce<Record<string, Release[]>>((acc, release) => {
    if (!release.date || release.date === 'null' || release.date === 'undefined') {
      return acc
    }

    if (!acc[release.date]) acc[release.date] = []
    acc[release.date].push(release)
    return acc
  }, {})
}

export function ReleaseList({
  releases,
  total,
  workspace,
  loading,
  onUpdate,
  onDelete,
  onLoadMore,
  onError,
  onMessage,
}: ReleaseListProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-purple-500 mb-4" />
        <p>Loading releases...</p>
      </div>
    )
  }

  if (releases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] text-gray-500">
        <svg
          className="w-12 h-12 mb-4 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="font-medium text-gray-900">No Releases Yet</p>
        <p className="text-sm mt-1 text-center max-w-xs">
          Sync messages and extract releases to see them here
        </p>
      </div>
    )
  }

  const groupedReleases = groupByDate(releases)
  const sortedDates = Object.keys(groupedReleases).sort((a, b) => b.localeCompare(a))
  const hasMore = releases.length < total

  return (
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
              {formatDisplayDate(date)}
            </h3>
            <div className="space-y-3">
              {groupedReleases[date].map((release) => (
                <ReleaseCard
                  key={release.id}
                  release={release}
                  workspace={workspace}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onError={onError}
                  onMessage={onMessage}
                />
              ))}
            </div>
          </div>
        ))}

        {hasMore && (
          <button
            onClick={onLoadMore}
            className="w-full mt-6 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Load more ({total - releases.length} remaining)
          </button>
        )}
      </div>
    </div>
  )
}
