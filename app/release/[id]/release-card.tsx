'use client'

import './release-card.css'
import { Newspaper, Star, CheckCircle, Zap, Rocket, PartyPopper, Share } from 'lucide-react'
import { CourtLines, TennisBall, TennisBallShadow } from '@/app/assets/icons'
import { AnimatePresence, motion } from 'framer-motion'
import { toPng } from 'html-to-image'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface ReleaseNote {
  id: string
  title: string
  type: string
  description: string
  whyItMatters: string
  date: string | Date
}

interface ReleaseCardProps {
  releaseNote: ReleaseNote
}

const typeConfig: Record<string, { icon: typeof Newspaper; label: string; color: string }> = {
  'New Feature': { icon: Rocket, label: 'New Feature', color: '#CCFF00' },
  'Improvement': { icon: Zap, label: 'Improvement', color: '#708FFF' },
  'Bug Fix': { icon: CheckCircle, label: 'Bug Fix', color: '#39C579' },
  'Update': { icon: Newspaper, label: 'Update', color: '#CCFF00' },
  'Deprecation': { icon: Star, label: 'Deprecation', color: '#9FA7AD' },
  'Rollback': { icon: PartyPopper, label: 'Rollback', color: '#FFB930' },
}

export function ReleaseCard({ releaseNote }: ReleaseCardProps) {
  const config = typeConfig[releaseNote.type] || typeConfig['Update']
  const Icon = config.icon
  const cardRef = useRef<HTMLDivElement>(null)
  const shareLabelRef = useRef<HTMLSpanElement>(null)
  const sharingLabelRef = useRef<HTMLSpanElement>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [labelWidths, setLabelWidths] = useState({ share: 0, sharing: 0 })

  const dateValue = releaseNote.date instanceof Date
    ? releaseNote.date
    : new Date(typeof releaseNote.date === 'string' && releaseNote.date.includes('T')
      ? releaseNote.date
      : releaseNote.date + 'T00:00:00')
  const formattedDate = !isNaN(dateValue.getTime())
    ? dateValue.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    : ''

  useLayoutEffect(() => {
    const measureLabels = () => {
      const shareWidth = shareLabelRef.current?.offsetWidth ?? 0
      const sharingWidth = sharingLabelRef.current?.offsetWidth ?? 0
      setLabelWidths({ share: shareWidth, sharing: sharingWidth })
    }

    measureLabels()
    window.addEventListener('resize', measureLabels)
    return () => window.removeEventListener('resize', measureLabels)
  }, [])

  const handleShareCard = useCallback(async () => {
    if (!cardRef.current || isSharing) return

    setIsSharing(true)
    setShareError(null)

    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#335FFF',
        filter: (node) => {
          if (!(node instanceof HTMLElement)) return true
          return node.dataset.shareButton !== 'true'
        },
      })

      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const filename = `release-${releaseNote.id}.png`
      const file = new File([blob], filename, { type: 'image/png' })

      const sharePayload: ShareData = {
        title: releaseNote.title,
        text: releaseNote.title,
        files: [file],
      }

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share(sharePayload)
      } else {
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = filename
        link.click()
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareError('Could not share this card right now.')
    } finally {
      setIsSharing(false)
    }
  }, [isSharing, releaseNote.id, releaseNote.title])

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 15, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="relative bg-[#335FFF] overflow-hidden w-full min-w-[288px] min-[480px]:min-w-[448px] min-[480px]:max-w-[448px] min-h-[95dvh] flex flex-col release-card"
    >

      {/* 1. Header - Type badge and date (top-anchored) */}
      <div className="flex items-center gap-4 flex-shrink-0 p-4 min-[480px]:p-7 pb-0 min-[480px]:pb-0">
        <div
          className="rounded-full px-4 py-2 flex items-center gap-2"
          style={{ backgroundColor: config.color }}
        >
          <Icon className="w-4 h-4 text-[#0E2433]" />
          <span className="text-[#0E2433] text-sm font-normal">{config.label}</span>
        </div>
        {formattedDate && <span className="text-white text-sm font-normal">{formattedDate}</span>}
        <motion.button
          layout
          style={{ originX: 1 }}
          type="button"
          onClick={handleShareCard}
          disabled={isSharing}
          data-share-button="true"
          className="share-button relative ml-auto inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-70"
          transition={{ layout: { duration: 0.22, ease: 'easeOut' } }}
        >
          <span className="pointer-events-none absolute opacity-0 whitespace-nowrap">
            <span ref={shareLabelRef}>Share</span>
            <span ref={sharingLabelRef}>Sharing...</span>
          </span>
          <Share className="h-4 w-4" />
          <motion.span
            className="relative inline-flex overflow-hidden whitespace-nowrap"
            initial={false}
            animate={{ width: isSharing ? labelWidths.sharing : labelWidths.share }}
            transition={{ duration: 0.1, ease: 'easeInOut' }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isSharing ? 'sharing' : 'share'}
                initial={{ y: 4, opacity: 0, filter: 'blur(10px)' }}
                animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                exit={{ y: -4, opacity: 0, filter: 'blur(10px)' }}
                transition={{ duration: 0.12, ease: 'easeInOut' }}
                className="inline-block"
              >
                {isSharing ? 'Sharing...' : 'Share'}
              </motion.span>
            </AnimatePresence>
          </motion.span>
        </motion.button>
      </div>
      {shareError && (
        <p className="px-4 min-[480px]:px-7 pt-2 text-sm text-red-100">{shareError}</p>
      )}

      {/* Middle content: Header, Description, Callout, CTA */}
      <div className="flex gap-6 flex-col px-4 min-[480px]:px-7 py-4 min-[480px]:py-6 flex-1 min-h-0">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4">
            {/* 2. Title - stays at top */}
            <h1 className="text-3xl font-extrabold text-white leading-tight min-[480px]:text-4xl flex-shrink-0">
              {releaseNote.title}
            </h1>

            {/* 3. Description - distributed in middle */}
            {releaseNote.description && (
              <p className="text-base font-light text-white leading-relaxed min-[480px]:text-xl flex-shrink-0">
                {releaseNote.description}
              </p>
            )}
          </div>

        {/* 4. Why It Matters - Callout - distributed in middle */}
        {releaseNote.whyItMatters && (
          <div className="bg-[#294CCC] rounded-3xl p-4 why-it-matters-card flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0 overflow-visible" style={{ width: '46px', height: '56px' }}>
                <DotLottieReact
                  src="/lotties/LightBulb-10s.lottie"
                  loop
                  autoplay
                  speed={0.9}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <p className="text-white opacity-85 text-base font-light min-[480px]:text-lg">{releaseNote.whyItMatters}</p>
            </div>
          </div>
        )}
        </div>




        {/* 5. CTA - stays above footer */}
        <a
          href={`/changelog/${releaseNote.id}`}
          className="block bg-white w-full text-center rounded-full py-3 release-card-button flex-shrink-0"
        >
          <span className="text-[#0E2433] font-semibold text-xl">Learn more</span>
        </a>
      </div>

      {/* 6. Footer - bottom-anchored */}
      <div className="relative w-full h-[120px] min-[480px]:h-[160px] overflow-hidden flex-shrink-0 z-[-1]">
        <CourtLines className="absolute inset-0 w-full h-full" />
        {/* Shadow - slides in, no rotation */}
        <motion.div
          className="absolute bottom-[55px] left-[95px] w-[70px] h-[30px] min-[480px]:w-[80px] min-[480px]:h-[35px] overflow-visible"
          initial={{ x: -250 }}
          animate={{ x: 0 }}
          transition={{
            delay: 2,
            duration: 0.8,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          <TennisBallShadow className="w-full h-full" />
        </motion.div>
        {/* Ball - slides in with rotation */}
        <motion.div
          className="absolute bottom-[55px] left-[105px] w-[70px] h-[70px] min-[480px]:bottom-[60px] min-[480px]:w-[90px] min-[480px]:h-[90px]"
          initial={{ x: -250, rotate: 0 }}
          animate={{ x: 0, rotate: 450 }}
          transition={{
            delay: 2,
            duration: 0.8,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          <TennisBall className="w-full h-full" />
        </motion.div>
      </div>
    </motion.div>
  )
}
