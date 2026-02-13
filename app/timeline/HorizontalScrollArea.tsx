'use client'

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'next/navigation'

const FRICTION = 0.92
const MIN_VELOCITY = 0.5
const DRAG_THRESHOLD_PX = 5

function getScrollBounds(
  contentEl: HTMLElement,
  viewportEl: HTMLElement
): { maxX: number } {
  const contentWidth = contentEl.scrollWidth
  const viewportWidth = viewportEl.clientWidth
  return {
    maxX: Math.max(0, contentWidth - viewportWidth),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

interface HorizontalScrollAreaProps {
  children: ReactNode
  /** Callback when scroll position changes */
  onScrollChange?: (scrollX: number, maxScrollX: number) => void
  /** External scroll position to sync to */
  externalScrollX?: number
}

export function HorizontalScrollArea({
  children,
  onScrollChange,
  externalScrollX,
}: HorizontalScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scrollX, setScrollX] = useState(0)
  const velocityRef = useRef(0)
  const lastPosRef = useRef(0)
  const startPosRef = useRef(0)
  const lastTimeRef = useRef(0)
  const isDraggingRef = useRef(false)
  const hasDraggedRef = useRef(false)
  const rafRef = useRef<number>()
  const searchParams = useSearchParams()
  const cardId = searchParams.get('card')

  // Initial scroll: center viewport or scroll to specific card
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return

    if (cardId) {
      const cardEl = document.getElementById(`card-${cardId}`)
      if (!cardEl) return
      let el: HTMLElement | null = cardEl
      let offsetLeft = 0
      while (el && el !== content) {
        offsetLeft += el.offsetLeft
        el = el.offsetParent as HTMLElement
      }
      const cardCenterX = offsetLeft + cardEl.offsetWidth / 2
      const targetX = cardCenterX - viewport.clientWidth / 2
      const bounds = getScrollBounds(content, viewport)
      setScrollX(clamp(targetX, 0, bounds.maxX))
    } else {
      // Start scrolled to the left (newest cards are on the left)
      setScrollX(0)
    }
  }, [cardId])

  const runInertia = useCallback(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return

    const tick = () => {
      let vx = velocityRef.current
      if (Math.abs(vx) < MIN_VELOCITY) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        return
      }

      setScrollX((prev) => {
        const bounds = getScrollBounds(content, viewport)
        const nextX = clamp(prev - vx, 0, bounds.maxX)
        velocityRef.current = nextX !== prev ? vx * FRICTION : 0
        return nextX
      })

      vx = velocityRef.current
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    isDraggingRef.current = true
    hasDraggedRef.current = false
    lastPosRef.current = e.clientX
    startPosRef.current = e.clientX
    lastTimeRef.current = performance.now()
    velocityRef.current = 0
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    const dist = Math.abs(e.clientX - startPosRef.current)
    if (!hasDraggedRef.current && dist > DRAG_THRESHOLD_PX) {
      hasDraggedRef.current = true
    }
    if (!hasDraggedRef.current) return
    const now = performance.now()
    const dt = Math.max(now - lastTimeRef.current, 1)
    const dx = e.clientX - lastPosRef.current
    lastPosRef.current = e.clientX
    lastTimeRef.current = now
    velocityRef.current = (dx / dt) * 16
    setScrollX((prev) => {
      const viewport = viewportRef.current
      const content = contentRef.current
      if (!viewport || !content) return prev
      const bounds = getScrollBounds(content, viewport)
      return clamp(prev - dx, 0, bounds.maxX)
    })
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
      isDraggingRef.current = false
      if (hasDraggedRef.current) runInertia()
    },
    [runInertia]
  )

  const onPointerLeave = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      if (hasDraggedRef.current) runInertia()
    }
  }, [runInertia])

  const onWheel = useCallback((e: React.WheelEvent) => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return
    const bounds = getScrollBounds(content, viewport)
    // Use deltaX for horizontal scroll, or deltaY if no horizontal scroll detected
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    setScrollX((prev) => clamp(prev + delta, 0, bounds.maxX))
  }, [])

  // Report scroll changes to parent
  useEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content || !onScrollChange) return
    const bounds = getScrollBounds(content, viewport)
    onScrollChange(scrollX, bounds.maxX)
  }, [scrollX, onScrollChange])

  // Sync external scroll position
  useEffect(() => {
    if (externalScrollX === undefined) return
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return
    const bounds = getScrollBounds(content, viewport)
    setScrollX(clamp(externalScrollX, 0, bounds.maxX))
  }, [externalScrollX])

  return (
    <div
      ref={viewportRef}
      className="w-full h-full overflow-hidden touch-none cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerLeave}
      onWheel={onWheel}
    >
      <div
        ref={contentRef}
        className="inline-flex items-center h-full will-change-transform"
        style={{
          transform: `translateX(${-scrollX}px)`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
