'use client'

import './release-card.css'
import { Newspaper, Star, CheckCircle, Zap, Rocket, PartyPopper, Share, X, ExternalLink } from 'lucide-react'
import { LightBulbs, CourtLines, TennisBall, TennisBallShadow } from '@/app/assets/icons'
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
  onCardClick?: () => void
  onClose?: () => void
  showDescription?: boolean
  variant?: 'card' | 'detail'
}

const typeConfig: Record<string, { icon: typeof Newspaper; label: string; color: string }> = {
  'New Feature': { icon: Rocket, label: 'New Feature', color: '#CCFF00' },
  'Improvement': { icon: Zap, label: 'Improvement', color: '#708FFF' },
  'Bug Fix': { icon: CheckCircle, label: 'Bug Fix', color: '#39C579' },
  'Update': { icon: Newspaper, label: 'Update', color: '#CCFF00' },
  'Deprecation': { icon: Star, label: 'Deprecation', color: '#9FA7AD' },
  'Rollback': { icon: PartyPopper, label: 'Rollback', color: '#FFB930' },
}

export function ReleaseCard({ releaseNote, onCardClick, onClose, showDescription = false, variant = 'card' }: ReleaseCardProps) {
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

  const hasEntranceAnimation = variant === 'card'
  const layoutId = `release-card-${releaseNote.id}`

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        layout
        layoutId={layoutId}
        ref={cardRef}
        transition={{ duration: 0.15, ease: [0.075, 0.82, 0.165, 1], layout: { duration: 0.3, ease: [0.075, 0.82, 0.165, 1] } }}
        whileTap={variant === 'card' ? { scale: 0.98 } : undefined}
        role={onCardClick ? 'button' : undefined}
        tabIndex={onCardClick ? 0 : undefined}
        onClick={onCardClick}
        onKeyDown={onCardClick ? (e) => e.key === 'Enter' && onCardClick() : undefined}
        initial={hasEntranceAnimation ? { opacity: 0, y: 15, filter: 'blur(10px)' } : false}
        animate={hasEntranceAnimation ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
        className={`relative bg-[#335FFF] overflow-hidden flex flex-col release-card 
        ${variant === 'detail' ? 'w-full min-w-0 min-h-dvh !rounded-none' : 'w-full min-w-[288px] max-[479px]:w-[350px] min-[480px]:min-w-[448px] min-[480px]:max-w-[448px] min-h-[50dvh]'} ${onCardClick ? 'cursor-pointer' : ''}`}
      >
        <div className={`flex-1 flex flex-col min-h-0 ${variant === 'detail' ? 'max-w-[672px] w-full mx-auto' : ''}`}>
          {/* 1. Header - Type badge, date, close (detail) and share */}
          <div
            className="flex items-center gap-4 flex-shrink-0 p-4 min-[480px]:p-7 pb-0 min-[480px]:pb-0"
          >
            <div
              className="rounded-full px-4 py-2 flex items-center gap-2"
              style={{ backgroundColor: config.color }}
            >
              <Icon className="w-4 h-4 text-[#0E2433]" />
              <span className="text-[#0E2433] text-sm font-normal">{config.label}</span>
            </div>
            {formattedDate && <span className="text-white text-sm font-normal">{formattedDate}</span>}
            <div className="ml-auto flex items-center gap-2">
              {variant === 'detail' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleShareCard()
                  }}
                  disabled={isSharing}
                  data-share-button="true"
                  className="share-button relative inline-flex items-center gap-2 max-[400px]:gap-0 rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span className="pointer-events-none absolute opacity-0 whitespace-nowrap">
                    <span ref={shareLabelRef}>Share</span>
                    <span ref={sharingLabelRef}>Sharing...</span>
                  </span>
                  <Share className="h-4 w-4" />
                  <motion.span
                    className="relative inline-flex overflow-hidden whitespace-nowrap max-[400px]:hidden"
                    initial={false}
                    animate={{ width: isSharing ? labelWidths.sharing : labelWidths.share }}
                    transition={{ duration: 0.1, ease: [0.075, 0.82, 0.165, 1] }}
                  >
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={isSharing ? 'sharing' : 'share'}
                        initial={{ y: 4, opacity: 0, filter: 'blur(10px)' }}
                        animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                        exit={{ y: -4, opacity: 0, filter: 'blur(10px)' }}
                        transition={{ duration: 0.12, ease: [0.075, 0.82, 0.165, 1] }}
                        className="inline-block"
                      >
                        {isSharing ? 'Sharing...' : 'Share'}
                      </motion.span>
                    </AnimatePresence>
                  </motion.span>
                </button>
              )}
              {variant === 'detail' && (
                <button
                  type="button"
                  aria-label="Close"
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose?.()
                  }}
                  className="inline-flex items-center justify-center rounded-full bg-white/20 p-2 text-white transition hover:bg-white/30"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          {variant === 'detail' && shareError && (
            <p className="px-4 min-[480px]:px-7 pt-2 text-sm text-red-100">{shareError}</p>
          )}

          {/* Middle content: Header, Description, Callout, CTA */}
          <div
            className="flex gap-6 flex-col px-4 min-[480px]:px-7 py-4 min-[480px]:py-6 flex-1 min-h-0 justify-between"
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4">
                {/* 2. Title - stays at top */}
                <h1
                  className="text-3xl font-extrabold text-white leading-tight min-[480px]:text-3xl flex-shrink-0"
                >
                  {releaseNote.title}
                </h1>
                {/* 4. Why It Matters - Callout - distributed in middle */}
                {releaseNote.whyItMatters && (
                  <div className="bg-[#294CCC] p-4 why-it-matters-card flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-[46px] h-[56px] min-w-[46px] min-h-[56px] overflow-hidden"
                      >
                        <LightBulbs className="w-full h-full" />
                      </div>
                      <p className="text-white opacity-85 text-base font-light min-[480px]:text-lg">
                        {releaseNote.whyItMatters}
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. Description - hidden in compact (opacity 0), visible in detail */}
                <motion.div
                  className="flex-shrink-0"
                  initial={false}
                  animate={{
                    opacity: showDescription && releaseNote.description ? 1 : 0,
                  }}
                  transition={{ duration: 0.35, ease: [0.075, 0.82, 0.165, 1] }}
                >
                  {releaseNote.description && (
                    <motion.p
                      className="text-base font-light text-white leading-relaxed min-[480px]:text-xl"
                      initial={showDescription ? { opacity: 0, y: 8 } : false}
                      animate={showDescription ? { opacity: 1, y: 0 } : { opacity: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.35, ease: [0.075, 0.82, 0.165, 1], delay: 0.08 }}
                    >
                      {releaseNote.description}
                    </motion.p>
                  )}
                </motion.div>
              </div>
            </div>

            {/* 5. CTA - only in detail */}
            {variant === 'detail' && (
              <div className="flex flex-col gap-3 flex-shrink-0">
                <motion.a
                  key="visit-changelog"
                  initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: 1, filter: 'blur(10px)' }}
                  transition={{ duration: 0.2, ease: [0.075, 0.82, 0.165, 1] }}
                  href={`/changelog/${releaseNote.id}`}
                  className="release-card-button block w-full text-center rounded-full py-3 bg-white text-[#0E2433] font-semibold text-xl"
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose?.()
                  }}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <span>Visit Changelog</span>
                    <ExternalLink className="w-5 h-5" />
                  </span>
                </motion.a>
              </div>
            )}
          </div>

        </div>

        {/* 6. Footer - bottom-anchored (court illustration) - full width, not constrained */}
        <motion.div className="relative w-full h-[120px] min-[480px]:h-[160px] overflow-hidden flex-shrink-0">
          <CourtLines className="absolute inset-0 w-full h-full" />
          {/* Shadow */}
          <div className="absolute bottom-[55px] left-[95px] w-[70px] h-[30px] min-[480px]:w-[80px] min-[480px]:h-[35px] overflow-visible">
            <TennisBallShadow className="w-full h-full" />
          </div>
          {/* Ball */}
          <div className="absolute bottom-[55px] left-[105px] w-[70px] h-[70px] min-[480px]:bottom-[60px] min-[480px]:w-[90px] min-[480px]:h-[90px]">
            <TennisBall className="w-full h-full" />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
