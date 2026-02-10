'use client'

import './release-card.css'
import { Newspaper, Star, CheckCircle, Zap, Rocket, PartyPopper } from 'lucide-react'
import { BackgroundReleaseCard } from '@/app/assets/icons'
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

export function ReleaseCard({ releaseNote }: ReleaseCardProps) {
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
    <div className="w-full min-w-[288px] min-[480px]:min-w-[448px] min-[480px]:max-w-[448px]">
      <motion.div
        initial={{ opacity: 0, y: 15, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative bg-[#335FFF] overflow-hidden w-full h-full release-card"
      >
      
      {/* Content */}
      <div className="relative flex flex-col p-4 gap-8 min-[480px]:p-7">
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
            className="text-3xl font-extrabold text-white leading-tight mb-4 min-[480px]:text-4xl"
          >
            {releaseNote.title}
          </h1>

          {/* Description - prominent */}
          {releaseNote.description && (
            <p
              className="text-base font-light text-white leading-relaxed mb-8 min-[480px]:text-xl"
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
              <div className="flex-shrink-0 overflow-visible" style={{ width: '46px', height: '56px' }}>
                <DotLottieReact
                  src="/lotties/LightBulb-10s.lottie"
                  loop
                  autoplay
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              {/* <LightBulbs width={56} height={56} className="clipboard-icon" /> */}
              <p className="text-white opacity-85 text-base font-light min-[480px]:text-lg">{releaseNote.whyItMatters}</p>
  
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
