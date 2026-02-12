'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ReleaseCard } from '@/app/release/[id]/release-card'
import { ReleaseDetailModal } from '@/app/release/[id]/release-detail-modal'
import { MarkReleaseSeen } from '@/app/releasegrid/MarkReleaseSeen'
import type { Release } from '@/lib/db/client'

function toReleaseNote(release: Release) {
  return {
    id: release.id,
    title: release.marketing_title || release.title,
    type: release.type,
    description: release.marketing_description || release.description || '',
    whyItMatters: release.marketing_why_this_matters || release.why_this_matters || '',
    date: release.date,
  }
}

interface TimelineWithModalProps {
  releases: Release[]
}

export function TimelineWithModal({ releases }: TimelineWithModalProps) {
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleOpen = useCallback((id: string) => {
    setSelectedReleaseId(id)
    window.history.pushState(null, '', `/release/${id}`)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedReleaseId(null)
    window.history.replaceState(null, '', '/timeline')
  }, [])

  useEffect(() => {
    const onPopState = () => {
      setSelectedReleaseId(null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  if (releases.length === 0) return null

  const selectedRelease = selectedReleaseId
    ? releases.find((r) => r.id === selectedReleaseId)
    : null

  // Sort releases by date (newest first on the left)
  const sortedReleases = [...releases].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  return (
    <>
      <div className="flex items-center h-full px-8 gap-6">
        {/* Timeline hint at start */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center w-[160px] h-full">
          <p className="text-white/40 text-sm font-light text-center">
            ← Newest
          </p>
        </div>

        {/* Release cards */}
        {sortedReleases.map((release) => (
          <div
            key={release.id}
            id={`card-${release.id}`}
            className="flex-shrink-0"
          >
            <div
              className="block cursor-pointer"
              onClick={() => handleOpen(release.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleOpen(release.id)
                }
              }}
            >
              <ReleaseCard releaseNote={toReleaseNote(release)} showDateInHeader />
            </div>
          </div>
        ))}

        {/* Timeline hint at end */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center w-[160px] h-full">
          <p className="text-white/40 text-sm font-light text-center">
            Older →
          </p>
        </div>
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence mode="popLayout">
            {selectedRelease && (
              <motion.div
                key="detail-modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: [0.075, 0.82, 0.165, 1] }}
                className="fixed inset-0 z-50 flex"
                style={{ width: '100dvw', height: '100dvh' }}
              >
                <MarkReleaseSeen id={selectedRelease.id} />
                <ReleaseDetailModal
                  releaseId={selectedRelease.id}
                  releaseNote={toReleaseNote(selectedRelease)}
                  isOpen
                  onClose={handleClose}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  )
}
