'use client'

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'next/navigation'

const FRICTION = 0.92
const MIN_VELOCITY = 0.5
const DRAG_THRESHOLD_PX = 5

function getScrollBounds(
  contentEl: HTMLElement,
  viewportEl: HTMLElement
): { maxX: number; maxY: number } {
  const contentWidth = contentEl.offsetWidth
  const contentHeight = contentEl.offsetHeight
  const viewportWidth = viewportEl.clientWidth
  const viewportHeight = viewportEl.clientHeight
  return {
    maxX: Math.max(0, contentWidth - viewportWidth),
    maxY: Math.max(0, contentHeight - viewportHeight),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function MomentumScrollArea({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState({ x: 0, y: 0 })
  const velocityRef = useRef({ x: 0, y: 0 })
  const lastPosRef = useRef({ x: 0, y: 0 })
  const startPosRef = useRef({ x: 0, y: 0 })
  const lastTimeRef = useRef(0)
  const isDraggingRef = useRef(false)
  const hasDraggedRef = useRef(false)
  const rafRef = useRef<number>()
  const searchParams = useSearchParams()
  const cardId = searchParams.get('card')

  // Scroll to card when ?card= is present
  useLayoutEffect(() => {
    if (!cardId || !viewportRef.current || !contentRef.current) return
    const cardEl = document.getElementById(`card-${cardId}`)
    if (!cardEl) return

    const viewport = viewportRef.current
    const content = contentRef.current
    let el: HTMLElement | null = cardEl
    let offsetLeft = 0
    let offsetTop = 0
    while (el && el !== content) {
      offsetLeft += el.offsetLeft
      offsetTop += el.offsetTop
      el = el.offsetParent as HTMLElement
    }
    const cardCenterX = offsetLeft + cardEl.offsetWidth / 2
    const cardCenterY = offsetTop + cardEl.offsetHeight / 2
    const targetX = cardCenterX - viewport.clientWidth / 2
    const targetY = cardCenterY - viewport.clientHeight / 2
    const bounds = getScrollBounds(content, viewport)
    setScroll({
      x: clamp(targetX, 0, bounds.maxX),
      y: clamp(targetY, 0, bounds.maxY),
    })
  }, [cardId])

  const runInertia = useCallback(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return

    const tick = () => {
      let { x: vx, y: vy } = velocityRef.current
      if (Math.abs(vx) < MIN_VELOCITY && Math.abs(vy) < MIN_VELOCITY) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        return
      }

      setScroll((prev) => {
        const bounds = getScrollBounds(content, viewport)
        const nextX = clamp(prev.x + vx, 0, bounds.maxX)
        const nextY = clamp(prev.y + vy, 0, bounds.maxY)
        velocityRef.current = {
          x: nextX !== prev.x ? vx * FRICTION : 0,
          y: nextY !== prev.y ? vy * FRICTION : 0,
        }
        return { x: nextX, y: nextY }
      })

      vx = velocityRef.current.x
      vy = velocityRef.current.y
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    isDraggingRef.current = true
    hasDraggedRef.current = false
    lastPosRef.current = { x: e.clientX, y: e.clientY }
    startPosRef.current = { x: e.clientX, y: e.clientY }
    lastTimeRef.current = performance.now()
    velocityRef.current = { x: 0, y: 0 }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    const { x: startX, y: startY } = startPosRef.current
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY)
    if (!hasDraggedRef.current && dist > DRAG_THRESHOLD_PX) {
      hasDraggedRef.current = true
    }
    if (!hasDraggedRef.current) return
    const now = performance.now()
    const dt = Math.max(now - lastTimeRef.current, 1)
    const dx = e.clientX - lastPosRef.current.x
    const dy = e.clientY - lastPosRef.current.y
    lastPosRef.current = { x: e.clientX, y: e.clientY }
    lastTimeRef.current = now
    velocityRef.current = { x: (dx / dt) * 16, y: (dy / dt) * 16 }
    setScroll((prev) => {
      const viewport = viewportRef.current
      const content = contentRef.current
      if (!viewport || !content) return prev
      const bounds = getScrollBounds(content, viewport)
      return {
        x: clamp(prev.x - dx, 0, bounds.maxX),
        y: clamp(prev.y - dy, 0, bounds.maxY),
      }
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
    setScroll((prev) => ({
      x: clamp(prev.x + e.deltaX, 0, bounds.maxX),
      y: clamp(prev.y + e.deltaY, 0, bounds.maxY),
    }))
  }, [])

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
        className="inline-block min-w-0 will-change-transform"
        style={{
          transform: `translate(${-scroll.x}px, ${-scroll.y}px)`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
