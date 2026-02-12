'use client'

import { useRef } from 'react'
import { motion, useDragControls, useMotionValue, animate } from 'framer-motion'
import { ReleaseCard } from './release-card'

interface ReleaseNote {
  id: string
  title: string
  type: string
  description: string
  whyItMatters: string
  date: string | Date
}

interface ReleaseDetailModalProps {
  releaseId: string
  releaseNote: ReleaseNote
  isOpen: boolean
  onClose: () => void
  screenshotMode?: boolean
}

const DRAG_THRESHOLD = 80
const VELOCITY_THRESHOLD = 300

export function ReleaseDetailModal({
  releaseId,
  releaseNote,
  isOpen,
  onClose,
  screenshotMode = false,
}: ReleaseDetailModalProps) {
  const y = useMotionValue(0)
  const dragControls = useDragControls()
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ width: '100dvw', height: '100dvh' }}
      onClick={onClose}
    >
      <motion.div
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        style={{ y }}
        onDragEnd={(_, info) => {
          if (info.offset.y > DRAG_THRESHOLD || info.velocity.y > VELOCITY_THRESHOLD) {
            onClose()
          } else {
            animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 })
          }
        }}
        className="flex-1 min-h-0 w-full flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none"
      >
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center touch-auto"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => {
            if (scrollRef.current?.scrollTop === 0) {
              dragControls.start(e)
            }
          }}
          aria-label="Arrastra hacia abajo para cerrar"
        >
          <div className="w-full flex items-center justify-center min-[480px]:p-4">
            <ReleaseCard
              releaseNote={releaseNote}
              showDescription
              variant="detail"
              onClose={onClose}
              screenshotMode={screenshotMode}
            />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
