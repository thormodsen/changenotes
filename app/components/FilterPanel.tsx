'use client'

import type { DatePreset } from '@/lib/types'
import { formatDate } from '@/lib/text-utils'

interface FilterPanelProps {
  startDate: string
  endDate: string
  activePreset: DatePreset | null
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  onPresetChange: (preset: DatePreset) => void
}

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: '7days', label: 'Last 7 days' },
  { key: '30days', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
]

export function FilterPanel({
  startDate,
  endDate,
  activePreset,
  onStartDateChange,
  onEndDateChange,
  onPresetChange,
}: FilterPanelProps) {
  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      onStartDateChange(value)
    } else {
      onEndDateChange(value)
    }
  }

  const applyPreset = (preset: DatePreset) => {
    const today = new Date()
    const end = formatDate(today)

    let start: string
    switch (preset) {
      case '7days':
        start = formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000))
        break
      case '30days':
        start = formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000))
        break
      case 'month':
        start = formatDate(new Date(today.getFullYear(), today.getMonth(), 1))
        break
    }

    onStartDateChange(start)
    onEndDateChange(end)
    onPresetChange(preset)
  }

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
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
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
            {PRESETS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  activePreset === key
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
