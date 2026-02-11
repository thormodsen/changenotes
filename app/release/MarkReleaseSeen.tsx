'use client'

import { useEffect } from 'react'

const STORAGE_KEY = 'release-seen'

export function MarkReleaseSeen({ id }: { id: string }) {
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      const seen: string[] = raw ? JSON.parse(raw) : []
      if (!seen.includes(id)) {
        seen.push(id)
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(seen))
      }
    } catch {
      // ignore
    }
  }, [id])
  return null
}
