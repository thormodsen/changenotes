'use client'

import { useState, useCallback } from 'react'
import type { Release } from '@/lib/types'
import { RELEASES_PAGE_SIZE } from '@/lib/constants'

interface UseReleasesReturn {
  releases: Release[]
  total: number
  workspace: string
  loading: boolean
  error: string | null
  message: string | null
  fetchReleases: () => Promise<void>
  loadMore: () => Promise<void>
  updateRelease: (id: string, updates: Partial<Release>) => void
  removeRelease: (id: string) => void
  replaceRelease: (oldId: string, newReleases: Release[]) => void
  setError: (error: string | null) => void
  setMessage: (message: string | null) => void
}

export function useReleases(startDate: string, endDate: string): UseReleasesReturn {
  const [releases, setReleases] = useState<Release[]>([])
  const [total, setTotal] = useState(0)
  const [workspace, setWorkspace] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const fetchReleases = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (startDate) params.append('start', startDate)
      if (endDate) params.append('end', endDate)
      params.append('limit', String(RELEASES_PAGE_SIZE))

      const res = await fetch(`/api/releases?${params}`)
      const json = await res.json()

      if (!json.success) throw new Error(json.error?.message || 'Unknown error')

      setReleases(json.data.releases || [])
      setTotal(json.data.total || 0)
      setWorkspace(json.data.workspace || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch releases')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  const loadMore = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('start', startDate)
      if (endDate) params.append('end', endDate)
      params.append('limit', String(RELEASES_PAGE_SIZE))
      params.append('offset', releases.length.toString())

      const res = await fetch(`/api/releases?${params}`)
      const json = await res.json()

      if (!json.success) throw new Error(json.error?.message || 'Unknown error')

      setReleases(prev => [...prev, ...(json.data.releases || [])])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more releases')
    }
  }, [startDate, endDate, releases.length])

  const updateRelease = useCallback((id: string, updates: Partial<Release>) => {
    setReleases(prev => prev.map(r => (r.id === id ? { ...r, ...updates } : r)))
  }, [])

  const removeRelease = useCallback((id: string) => {
    setReleases(prev => prev.filter(r => r.id !== id))
    setTotal(prev => prev - 1)
  }, [])

  const replaceRelease = useCallback((oldId: string, newReleases: Release[]) => {
    setReleases(prev => {
      const idx = prev.findIndex(r => r.id === oldId)
      if (idx === -1) return [...newReleases, ...prev]
      return [...prev.slice(0, idx), ...newReleases, ...prev.slice(idx + 1)]
    })
    setTotal(prev => prev - 1 + newReleases.length)
  }, [])

  return {
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
    replaceRelease,
    setError,
    setMessage,
  }
}
