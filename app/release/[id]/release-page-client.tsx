'use client'

import { useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MarkReleaseSeen } from '@/app/releasegrid/MarkReleaseSeen'
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
  const [screenshotMode, setScreenshotMode] = useState(false)

  useEffect(() => {
    const checkHash = () => {
      setScreenshotMode(window.location.hash === '#share')
    }
    checkHash()
    window.addEventListener('hashchange', checkHash)
    return () => window.removeEventListener('hashchange', checkHash)
  }, [])

  const handleClose = useCallback(() => {
    router.push(`/releasegrid?card=${releaseId}`)
  }, [router, releaseId])

  return (
    <main className="bg-[#0E2433] min-h-dvh flex items-center justify-center w-full relative">
      <MarkReleaseSeen id={releaseId} />
      <ReleaseDetailModal
        releaseId={releaseId}
        releaseNote={releaseNote}
        isOpen={true}
        onClose={handleClose}
        screenshotMode={screenshotMode}
      />
    </main>
  )
}
