'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { MarkReleaseSeen } from '../MarkReleaseSeen'
import { ReleaseCard } from './release-card'
import { ReleaseDetailModal } from './release-detail-modal'

interface ReleaseNote {
  id: string
  title: string
  type: string
  description: string
  whyItMatters: string
  date: string | Date
}

interface ReleasePageClientProps {
  releaseId: string
  releaseNote: ReleaseNote
}

export function ReleasePageClient({
  releaseId,
  releaseNote,
}: ReleasePageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [detailOpen, setDetailOpen] = useState(false)

  const updateHash = useCallback(
    (open: boolean) => {
      const url = new URL(pathname, window.location.origin)
      if (open) {
        url.hash = 'detail'
      } else {
        url.hash = ''
      }
      window.history.replaceState(null, '', url.toString())
    },
    [pathname]
  )

  const handleOpen = useCallback(() => {
    setDetailOpen(true)
    updateHash(true)
  }, [updateHash])

  const handleClose = useCallback(() => {
    router.push(`/release?card=${releaseId}`)
  }, [router, releaseId])

  useEffect(() => {
    const checkHash = () => {
      setDetailOpen(window.location.hash === '#detail')
    }
    checkHash()
    window.addEventListener('hashchange', checkHash)
    return () => window.removeEventListener('hashchange', checkHash)
  }, [])

  return (
    <main className={`bg-[#0E2433] min-h-dvh flex items-center justify-center w-full relative ${!detailOpen ? 'p-4' : ''}`}>
      <MarkReleaseSeen id={releaseId} />
      <Link
        href={`/release?card=${releaseId}`}
        className="absolute top-4 left-4 z-10 text-sm font-medium text-white/80 hover:text-white transition"
      >
        ← All cards
      </Link>
    <div className="flex items-center justify-center w-full min-h-dvh relative">
      <AnimatePresence mode="popLayout">
        {!detailOpen ? (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.15, ease: [0.075, 0.82, 0.165, 1] }}
            className="flex items-center justify-center w-full"
          >
            <ReleaseCard releaseNote={releaseNote} onCardClick={handleOpen} />
          </motion.div>
        ) : (
          <motion.div
            key="detail"
            initial={false}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.15, ease: [0.075, 0.82, 0.165, 1] }}
            className="fixed inset-0 z-40 flex"
            style={{ width: '100dvw', height: '100dvh' }}
          >
            <div
              className="absolute inset-0 bg-[#0E2433]"
              onClick={handleClose}
              aria-hidden
            />
            <ReleaseDetailModal
              releaseId={releaseId}
              releaseNote={releaseNote}
              isOpen={detailOpen}
              onClose={handleClose}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </main>
  )
}
