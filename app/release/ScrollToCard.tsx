'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export function ScrollToCard() {
  const searchParams = useSearchParams()
  const cardId = searchParams.get('card')

  useEffect(() => {
    if (!cardId) return
    const el = document.getElementById(`card-${cardId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
  }, [cardId])

  return null
}
