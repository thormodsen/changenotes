'use client'

import { useState, useCallback, type ReactNode } from 'react'
import { HorizontalScrollArea } from './HorizontalScrollArea'
import { Minimap } from './Minimap'

interface TimelineContainerProps {
  children: ReactNode
  /** Number of items in the timeline for minimap */
  itemCount: number
  /** Optional: Array of item types for color coding in minimap */
  itemTypes?: string[]
  /** Optional: Array of dates for each item (for date display in minimap) */
  itemDates?: string[]
}

export function TimelineContainer({
  children,
  itemCount,
  itemTypes = [],
  itemDates = [],
}: TimelineContainerProps) {
  const [scrollX, setScrollX] = useState(0)
  const [maxScrollX, setMaxScrollX] = useState(0)
  const [targetScrollX, setTargetScrollX] = useState<number | undefined>(undefined)

  const handleScrollChange = useCallback((newScrollX: number, newMaxScrollX: number) => {
    setScrollX(newScrollX)
    setMaxScrollX(newMaxScrollX)
    // Clear target after syncing
    setTargetScrollX(undefined)
  }, [])

  const handleNavigate = useCallback((newScrollX: number) => {
    setTargetScrollX(newScrollX)
  }, [])

  // Don't show minimap if there are very few items
  const showMinimap = itemCount > 2

  return (
    <div className="relative w-full h-full">
      <HorizontalScrollArea
        onScrollChange={handleScrollChange}
        externalScrollX={targetScrollX}
      >
        {children}
      </HorizontalScrollArea>

      {showMinimap && (
        <Minimap
          itemCount={itemCount}
          scrollX={scrollX}
          maxScrollX={maxScrollX}
          onNavigate={handleNavigate}
          itemTypes={itemTypes}
          itemDates={itemDates}
        />
      )}
    </div>
  )
}
