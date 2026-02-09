'use client'

import { useState, useEffect } from 'react'
import './release-card.css'
import { Newspaper, Star, CheckCircle, Zap, Rocket, PartyPopper } from 'lucide-react'
import { LightBulbs, BackgroundReleaseCard } from '@/app/assets/icons'
import { motion } from 'framer-motion'
import React from 'react';
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
      <motion.div
        initial={{ opacity: 0, y: 15, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative bg-[#335FFF] overflow-hidden origin-top-left release-card"
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
      
      {/* Content */}
      <div className="relative flex flex-col p-7 gap-8">
        {/* Header - Type badge and date */}
        <div
          className="flex items-center gap-4"
        >
          <div
            className="rounded-full px-4 py-2 flex items-center gap-2"
            style={{ backgroundColor: config.color }}
          >
            <Icon className="w-4 h-4 text-[#0E2433]" />
            <span className="text-[#0E2433] text-sm font-normal">{config.label}</span>
          </div>
          {formattedDate && <span className="text-white text-sm font-normal">{formattedDate}</span>}
        </div>

        {/* Main content - centered */}
        <div className="flex-1 flex flex-col">
          {/* Title - BIG */}
          <h1
            className="text-4xl sm:text-4xl font-extrabold text-white leading-tight mb-4"
          >
            {releaseNote.title}
          </h1>

          {/* Description - prominent */}
          {releaseNote.description && (
            <p
              className="text-xl font-light text-white leading-relaxed mb-8"
            >
              {releaseNote.description}
            </p>
          )}

          {/* Why It Matters - as a highlight */}
          {releaseNote.whyItMatters && (
            <div
              className="bg-[#294CCC] rounded-3xl p-4 why-it-matters-card"
            >
              <div className="flex items-center gap-2">
              <div className="flex-shrink-0 overflow-visible" style={{ width: '56px', height: '56px' }}>
                <DotLottieReact
                  src="/lotties/LightBulb.lottie"
                  loop
                  autoplay
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              {/* <LightBulbs width={56} height={56} className="clipboard-icon" /> */}
              <p className="text-white opacity-85 text-lg font-light">{releaseNote.whyItMatters}</p>
  
              </div>
            </div>
          )}
          <div
          className="flex items-center justify-center pt-6"
        >
          <a
            href={`/changelog/${releaseNote.id}`}
            className="bg-white w-full text-center rounded-full px-4 py-3 release-card-button"
          >
            <p className="text-[#0E2433] font-semibold text-xl">Learn more</p>
          </a>
        </div>
        </div>
      </div>
              {/* Footer */}
      <div className="">
          <BackgroundReleaseCard className="background-release-card"/>
        </div>
      </motion.div>
    </div>
  )
}
