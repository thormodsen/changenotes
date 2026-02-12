'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { ReleaseCard } from './[id]/release-card'
import { ReleaseDetailModal } from './[id]/release-detail-modal'
import { MarkReleaseSeen } from './MarkReleaseSeen'
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

interface ReleaseGridWithModalProps {
  releases: Release[]
}

export function ReleaseGridWithModal({ releases }: ReleaseGridWithModalProps) {
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
    window.history.replaceState(null, '', '/release')
  }, [])

  useEffect(() => {
    const onPopState = () => {
      setSelectedReleaseId(null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  if (releases.length === 0) return null

  const mid = Math.floor(releases.length / 2)
  const first = releases.slice(0, mid)
  const second = releases.slice(mid)
  const selectedRelease = selectedReleaseId
    ? releases.find((r) => r.id === selectedReleaseId)
    : null

  return (
    <>
      <div
        className="w-max"
        style={{
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 16,
          paddingBottom: 16,
        }}
      >
        <ul
          className="grid gap-8 w-max"
          style={{
            gridTemplateColumns: 'repeat(5, auto)',
          }}
        >
          {first.map((release) => (
            <li key={release.id} id={`card-${release.id}`}>
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
                <ReleaseCard releaseNote={toReleaseNote(release)} />
              </div>
            </li>
          ))}
          <li
            key="drag-hint"
            id="drag-hint"
            className="flex items-center justify-center max-w-[200px]"
          >
            <p className="text-white/40 text-base font-light text-center">
              Drag to discover our new updates
            </p>
          </li>
          {second.map((release) => (
            <li key={release.id} id={`card-${release.id}`}>
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
                <ReleaseCard releaseNote={toReleaseNote(release)} />
              </div>
            </li>
          ))}
        </ul>
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
