'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Star, CheckCircle, Zap, Rocket, PartyPopper } from 'lucide-react'
import { motion } from 'framer-motion'

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

const typeConfig: Record<string, { icon: typeof Sparkles; label: string; color: string }> = {
  'New Feature': { icon: Rocket, label: 'NEW FEATURE', color: '#D4FF00' },
  'Improvement': { icon: Zap, label: 'IMPROVEMENT', color: '#7DE2D1' },
  'Bug Fix': { icon: CheckCircle, label: 'BUG FIX', color: '#FFB6C1' },
  'Update': { icon: Sparkles, label: 'UPDATE', color: '#D4FF00' },
  'Deprecation': { icon: Star, label: 'DEPRECATION', color: '#FFD93D' },
  'Rollback': { icon: PartyPopper, label: 'ROLLBACK', color: '#FF6B9D' },
}

const CARD_WIDTH = 448
const CARD_HEIGHT = CARD_WIDTH * 16 / 9 // ~796px

export function ReleaseCard({ releaseNote }: ReleaseCardProps) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const updateScale = () => {
      const vh = window.innerHeight * 0.95
      const vw = window.innerWidth * 0.95
      const scaleByHeight = vh / CARD_HEIGHT
      const scaleByWidth = vw / CARD_WIDTH
      setScale(Math.min(1, scaleByHeight, scaleByWidth))
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  const config = typeConfig[releaseNote.type] || typeConfig['Update']
  const Icon = config.icon

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

  return (
    <div
      style={{
        width: CARD_WIDTH * scale,
        height: CARD_HEIGHT * scale,
      }}
    >
      <div
        className="relative bg-[#4A7CFF] rounded-3xl overflow-hidden shadow-2xl origin-top-left"
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.svg
          className="absolute top-8 left-6"
          width="80"
          height="60"
          viewBox="0 0 80 60"
          fill="none"
          animate={{ rotate: [0, 10, 0], x: [0, 5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path
            d="M10 10 Q 20 5, 30 15 T 50 20 T 70 10"
            stroke="#FF6B9D"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
        </motion.svg>

        <motion.svg
          className="absolute top-24 right-8"
          width="60"
          height="50"
          viewBox="0 0 60 50"
          fill="none"
          animate={{ rotate: [0, -15, 0], y: [0, -5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path
            d="M10 25 Q 20 15, 30 25 T 50 25"
            stroke="#FF6B9D"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        </motion.svg>

        <motion.div
          className="absolute top-40 right-10 w-16 h-16 bg-[#7DE2D1] rounded-xl opacity-60"
          animate={{ rotate: [0, 180, 360], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div
          className="absolute top-56 left-6 w-0 h-0 opacity-50"
          style={{
            borderLeft: '25px solid transparent',
            borderRight: '25px solid transparent',
            borderBottom: '44px solid #A8E6CF',
          }}
          animate={{ rotate: [0, -180, -360], y: [0, 10, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div
          className="absolute bottom-32 right-12 w-10 h-10 rounded-full bg-[#FFB6C1] opacity-60"
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div
          className="absolute bottom-44 left-10 w-12 h-12 rounded-full bg-white opacity-20"
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col p-8">
        {/* Header - Type badge and date */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-3 mb-6"
        >
          <div
            className="rounded-full px-4 py-2 flex items-center gap-2"
            style={{ backgroundColor: config.color }}
          >
            <Icon className="w-4 h-4 text-[#4A7CFF]" />
            <span className="text-[#4A7CFF] text-sm font-bold">{config.label}</span>
          </div>
          {formattedDate && <span className="text-white/70 text-sm">{formattedDate}</span>}
        </motion.div>

        {/* Main content - centered */}
        <div className="flex-1 flex flex-col justify-center">
          {/* Title - BIG */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-8"
          >
            {releaseNote.title}
          </motion.h1>

          {/* Description - prominent */}
          {releaseNote.description && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-xl text-white/90 leading-relaxed mb-8"
            >
              {releaseNote.description}
            </motion.p>
          )}

          {/* Why It Matters - as a highlight */}
          {releaseNote.whyItMatters && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20"
            >
              <div className="flex items-center gap-3">
                <Star className="w-6 h-6 text-[#D4FF00] flex-shrink-0" fill="currentColor" />
                <p className="text-white text-lg font-medium">{releaseNote.whyItMatters}</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="flex items-center justify-center pt-6"
        >
          <a
            href={`/changelog/${releaseNote.id}`}
            className="bg-white rounded-full px-8 py-4 shadow-lg hover:shadow-xl transition-shadow"
          >
            <p className="text-[#4A7CFF] font-bold">Learn more</p>
          </a>
        </motion.div>
      </div>
      </div>
    </div>
  )
}
