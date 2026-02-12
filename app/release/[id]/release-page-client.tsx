'use client'

import { useCallback } from 'react'
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
      />
    </main>
  )
}
