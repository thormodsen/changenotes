'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'

interface MinimapProps {
  /** Total number of items in the timeline */
  itemCount: number
  /** Current scroll position (0 to maxScroll) */
  scrollX: number
  /** Maximum scroll value */
  maxScrollX: number
  /** Callback when user clicks/drags on minimap to navigate */
  onNavigate: (scrollX: number) => void
  /** Optional: Array of item types for color coding */
  itemTypes?: string[]
  /** Optional: Array of dates for each item (for date display) */
  itemDates?: string[]
}

// Color mapping for different release types
const TYPE_COLORS: Record<string, string> = {
  feature: '#22C55E',      // green
  improvement: '#3B82F6',  // blue
  fix: '#EF4444',          // red
  update: '#8B5CF6',       // purple
  announcement: '#F59E0B', // amber
  default: '#64748B',      // slate
}

function getTypeColor(type?: string): string {
  if (!type) return TYPE_COLORS.default
  const normalizedType = type.toLowerCase()
  return TYPE_COLORS[normalizedType] || TYPE_COLORS.default
}

// Padding for the bars area (in pixels)
const PADDING_PX = 20

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

export function Minimap({
  itemCount,
  scrollX,
  maxScrollX,
  onNavigate,
  itemTypes = [],
  itemDates = [],
}: MinimapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Update container width when mounted
  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth)
    }
  }, [mounted, itemCount])

  // Calculate scroll progress (0 to 1)
  const scrollProgress = maxScrollX > 0 ? scrollX / maxScrollX : 0

  // Calculate the track width (container width minus padding on both sides)
  const trackWidth = containerWidth - PADDING_PX * 2

  // Bars layout: same as render logic
  const totalBars = Math.max(itemCount * 2, 60)
  const BAR_WIDTH_PX = 1.5
  const GAP_PX = 2
  const barsTotalWidth = totalBars * BAR_WIDTH_PX + (totalBars - 1) * GAP_PX
  const barsStartPx = PADDING_PX + (trackWidth - barsTotalWidth) / 2
  const barsEndPx = barsStartPx + barsTotalWidth

  // Handle click/drag on minimap - map to bars area, not full track
  const handleInteraction = useCallback(
    (clientX: number) => {
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const trackWidthRect = rect.width - PADDING_PX * 2
      const barsTotalWidthRect = totalBars * BAR_WIDTH_PX + (totalBars - 1) * GAP_PX
      const barsStartRect = PADDING_PX + (trackWidthRect - barsTotalWidthRect) / 2

      const relativeX = clientX - rect.left - barsStartRect
      const percentage = Math.max(0, Math.min(1, relativeX / barsTotalWidthRect))

      const targetScrollX = percentage * maxScrollX
      onNavigate(targetScrollX)
    },
    [maxScrollX, onNavigate, totalBars]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsDragging(true)
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      handleInteraction(e.clientX)
    },
    [handleInteraction]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      handleInteraction(e.clientX)
    },
    [isDragging, handleInteraction]
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false)
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
  }, [])

  // Calculate indicator position - align with actual bars start/end
  const indicatorLeftPx = Math.max(
    barsStartPx,
    Math.min(barsEndPx, barsStartPx + scrollProgress * barsTotalWidth)
  )

  // Calculate current item index based on scroll progress
  const currentItemIndex = Math.round(scrollProgress * Math.max(0, itemCount - 1))
  const currentDate = itemDates[currentItemIndex] || ''
  const formattedDate = currentDate ? formatDate(currentDate) : ''

  const minimapContent = (
    <div 
      style={{
        position: 'fixed',
        bottom: '32px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Minimap container - styled like Rauno's design */}
        <div
          ref={containerRef}
          className="relative h-14 rounded-2xl bg-[#e8e8e8]/95 backdrop-blur-xl overflow-hidden cursor-pointer shadow-lg"
          style={{ 
            // Fixed width like Rauno's design
            width: '320px',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Items representation (vertical bars) - like Rauno's design */}
          <div 
            className="absolute inset-y-0 flex items-center justify-center gap-[2px]"
            style={{ left: PADDING_PX, right: PADDING_PX }}
          >
            {(() => {
              // Create more bars for visual density (like Rauno's design)
              // Use a multiplier to have more visual bars than actual items
              const totalBars = Math.max(itemCount * 2, 60)
              const bars = []
              
              for (let i = 0; i < totalBars; i++) {
                const barProgress = totalBars > 1 ? i / (totalBars - 1) : 0
                const distanceFromPlayhead = Math.abs(barProgress - scrollProgress)
                
                const isActive = distanceFromPlayhead < 0.02
                const isNearby = distanceFromPlayhead < 0.08
                const isMedium = distanceFromPlayhead < 0.15
                
                // Vary heights like Rauno's design - taller near the playhead
                let height: number
                if (isActive) {
                  height = 24 + (i % 3) * 2
                } else if (isNearby) {
                  height = 18 + (i % 4) * 2
                } else if (isMedium) {
                  height = 12 + (i % 3) * 3
                } else {
                  height = 8 + (i % 4) * 2
                }
                
                // Color based on proximity to playhead
                let opacity: number
                if (isActive) {
                  opacity = 1
                } else if (isNearby) {
                  opacity = 0.5
                } else if (isMedium) {
                  opacity = 0.3
                } else {
                  opacity = 0.18
                }
                
                bars.push(
                  <div
                    key={i}
                    className="flex items-center justify-center"
                    style={{ height: '100%' }}
                  >
                    <motion.div
                      className="w-[1.5px] rounded-full bg-black"
                      animate={{
                        height: height,
                        opacity: opacity,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 25,
                        mass: 0.5,
                      }}
                    />
                  </div>
                )
              }
              
              return bars
            })()}
          </div>

          {/* Current position indicator (playhead) - positioned to align with bars */}
          <div
            className="absolute top-1 pointer-events-none"
            style={{
              left: indicatorLeftPx,
              transform: 'translateX(-50%)',
            }}
          >
            {/* Playhead dot */}
            <div
              className="w-[5px] h-[5px] bg-[#FF6B35] rounded-full"
              style={{
                boxShadow: '0 0 4px rgba(255, 107, 53, 0.5)',
                transform: isDragging ? 'scale(1.2)' : 'scale(1)',
              }}
            />
            {/* Playhead line */}
            <div 
              className="absolute top-[5px] left-1/2 -translate-x-1/2 w-[1.5px] bg-[#FF6B35] rounded-full"
              style={{
                height: '38px',
                boxShadow: '0 0 3px rgba(255, 107, 53, 0.3)',
              }}
            />
          </div>
        </div>

        {/* Date indicator - always visible, animates when changing */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <motion.div
            key={formattedDate}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ 
              type: 'spring',
              stiffness: 500,
              damping: 30,
            }}
            className="text-sm text-white font-medium whitespace-nowrap"
          >
            {formattedDate}
          </motion.div>
          
          {/* Item count - always visible */}
          <motion.div
            key={currentItemIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] text-white/40 whitespace-nowrap mt-0.5"
          >
            {currentItemIndex + 1} of {itemCount}
          </motion.div>
        </div>
      </motion.div>
    </div>
  )

  // Use portal to render outside the scroll container
  if (!mounted) return null
  return createPortal(minimapContent, document.body)
}
