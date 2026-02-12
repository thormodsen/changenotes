'use client'

import './release-card.css'
import { Newspaper, Star, CheckCircle, Zap, Rocket, PartyPopper, Share, X } from 'lucide-react'
import { LightBulbs } from '@/app/assets/icons'
import { getReleaseCardTheme } from '@/app/assets/illustrations/release-card-footers'
import { AnimatePresence, motion } from 'framer-motion'
import { toPng } from 'html-to-image'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

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
  /** Show date instead of type badge in mini card header */
  showDateInHeader?: boolean
  /** Hide share button, close button, and CTA for screenshot purposes */
  screenshotMode?: boolean
}

const typeConfig: Record<string, { icon: typeof Newspaper; label: string; color: string }> = {
  'New Feature': { icon: Rocket, label: 'New Feature', color: '#CCFF00' },
  'Improvement': { icon: Zap, label: 'Improvement', color: '#708FFF' },
  'Bug Fix': { icon: CheckCircle, label: 'Bug Fix', color: '#39C579' },
  'Update': { icon: Newspaper, label: 'Update', color: '#CCFF00' },
  'Deprecation': { icon: Star, label: 'Deprecation', color: '#9FA7AD' },
  'Rollback': { icon: PartyPopper, label: 'Rollback', color: '#FFB930' },
}

export function ReleaseCard({ releaseNote, onCardClick, onClose, showDescription = false, variant = 'card', showDateInHeader = false, screenshotMode = false }: ReleaseCardProps) {
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

  const theme = getReleaseCardTheme(releaseNote.id)

  const handleShareCard = useCallback(async () => {
    if (!cardRef.current || isSharing) return

    setIsSharing(true)
    setShareError(null)

    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: theme.background,
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
  }, [isSharing, releaseNote.id, releaseNote.title, theme.background])

  const hasEntranceAnimation = variant === 'card'
  const layoutId = `release-card-${releaseNote.id}`

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={layoutId}
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
        style={{ backgroundColor: theme.background }}
        className={`relative overflow-hidden flex flex-col release-card ${variant === 'detail' ? 'release-card--detail' : ''}
        ${variant === 'detail' ? 'w-full max-w-[448px] aspect-[448/960] rounded-[32px]' : 'w-full max-w-[230px] aspect-[448/796] min-[480px]:release-card--figma'} ${onCardClick ? 'cursor-pointer' : ''}`}
      >
        {/* 1. Header - Type badge or date */}
        <div className={variant === 'detail' ? 'p-4 min-[480px]:p-6' : 'px-2 pt-2'}>
          <div className="flex items-center gap-2">
            {/* Mini card: show date if showDateInHeader, otherwise show type badge */}
            {variant === 'card' && showDateInHeader ? (
              <span className="text-white/70 text-[11px] font-medium leading-[1.4]">
                {formattedDate}
              </span>
            ) : (
              <div
                className={`rounded-full flex items-center ${variant === 'detail' ? 'px-4 py-2 gap-2' : 'px-2 py-1 gap-1'}`}
                style={{ backgroundColor: config.color }}
              >
                <Icon className={variant === 'detail' ? 'w-4 h-4 text-[#0E2433]' : 'w-4 h-4 text-[#0E2433]'} />
                <span className={`text-[#0E2433] font-medium leading-[1.4] ${variant === 'detail' ? 'text-[16px]' : 'text-[14px]'}`}>{config.label}</span>
              </div>
            )}
            {formattedDate && variant === 'detail' && <span className="text-white text-[16px] font-medium leading-[1.4] px-4 py-2">{formattedDate}</span>}
            {variant === 'detail' && !screenshotMode && (
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleShareCard()
                  }}
                  disabled={isSharing}
                  data-share-button="true"
                  className="share-button relative inline-flex items-center gap-2 max-[400px]:gap-0 rounded-full bg-[#708FFF] px-4 py-2 text-[16px] font-medium leading-[1.4] text-white transition hover:bg-[#5A7AE6] disabled:cursor-not-allowed disabled:opacity-70"
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
              </div>
            )}
          </div>
        </div>

        {variant === 'detail' && shareError && (
          <p className="px-4 min-[480px]:px-7 pt-2 text-sm text-red-100">{shareError}</p>
        )}

        {/* 2. Title */}
        <div className={variant === 'detail' ? 'px-4 min-[480px]:px-6 pt-4 min-[480px]:pt-0' : 'px-3 pt-2'}>
          <h1
            className={`font-extrabold text-white leading-[1.2] ${
              variant === 'detail'
                ? 'text-[28px] min-[480px]:text-[40px]'
                : 'text-[22px] h-[80px] line-clamp-3'
            }`}
          >
            {releaseNote.title}
          </h1>
        </div>

        {/* 3. Description - only for detail */}
        {variant === 'detail' && (
          <motion.div
            className="px-4 min-[480px]:px-6 pt-4"
            initial={false}
            animate={{
              opacity: showDescription && releaseNote.description ? 1 : 0,
            }}
            transition={{ duration: 0.35, ease: [0.075, 0.82, 0.165, 1] }}
          >
            {releaseNote.description && (
              <motion.p
                className="text-[20px] font-normal text-white leading-[1.4]"
                initial={showDescription ? { opacity: 0, y: 8 } : false}
                animate={showDescription ? { opacity: 1, y: 0 } : { opacity: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.35, ease: [0.075, 0.82, 0.165, 1], delay: 0.08 }}
              >
                {releaseNote.description}
              </motion.p>
            )}
          </motion.div>
        )}

        {/* 4. Why It Matters callout */}
        {releaseNote.whyItMatters && (
          <div className={variant === 'detail' ? 'px-4 min-[480px]:px-6 pt-8' : 'px-3 pt-3'}>
            <div
              className={`overflow-hidden ${
                variant === 'detail' ? 'rounded-[24px] p-4' : 'rounded-[12px] p-2.5'
              }`}
              style={{ backgroundColor: theme.calloutBg }}
            >
              <div className={variant === 'detail' ? 'flex items-start gap-4' : 'flex items-start gap-2'}>
                <LightBulbs 
                  width={variant === 'detail' ? 48 : 26} 
                  height={variant === 'detail' ? 48 : 26} 
                  className="flex-shrink-0"
                />
                <p
                  className={`font-normal leading-[1.3] ${
                    variant === 'detail' ? 'text-[20px]' : 'text-[13px]'
                  }`}
                  style={{ color: theme.calloutTextColor ?? 'white' }}
                >
                  {releaseNote.whyItMatters}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 5. CTA - only for detail, hidden in screenshot mode */}
        {variant === 'detail' && !screenshotMode && (
          <div className="px-4 min-[480px]:px-6 pt-8 pb-4 min-[480px]:pb-8">
            <motion.a
              key="learn-more"
              initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 1, filter: 'blur(10px)' }}
              transition={{ duration: 0.2, ease: [0.075, 0.82, 0.165, 1] }}
              href={`/changelog/${releaseNote.id}`}
              className="release-card-button block w-full text-center rounded-full px-4 py-3 bg-white text-[#0E2433] font-semibold text-[20px] leading-[1.4]"
              onClick={(e) => {
                e.stopPropagation()
                onClose?.()
              }}
            >
              Learn more
            </motion.a>
          </div>
        )}

        {/* 6. Footer illustration */}
        <motion.div className={`relative w-full overflow-hidden flex-shrink-0 mt-auto ${
          variant === 'detail' ? 'h-[140px] min-[480px]:h-[207px]' : 'h-[115px]'
        }`}>
          {(() => {
            const Footer = theme.Footer
            return <Footer />
          })()}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
