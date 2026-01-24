'use client'

import { Sparkles, Star, CheckCircle, Zap, Rocket, PartyPopper } from 'lucide-react'
import { motion } from 'framer-motion'

interface ReleaseNote {
  title: string
  type: string
  description: string
  whyItMatters: string
  date: string
}

interface ReleaseCardProps {
  releaseNote: ReleaseNote
}

const typeConfig: Record<string, { icon: typeof Sparkles; label: string; color: string }> = {
  'New Feature': { icon: Rocket, label: 'NEW FEATURE', color: '#D4FF00' },
  'Improvement': { icon: Zap, label: 'IMPROVEMENT', color: '#7DE2D1' },
  'Bug Fix': { icon: CheckCircle, label: 'BUG FIX', color: '#FFB6C1' },
  'Update': { icon: Sparkles, label: 'UPDATE', color: '#A8E6CF' },
  'Deprecation': { icon: Star, label: 'DEPRECATION', color: '#FFD93D' },
  'Rollback': { icon: PartyPopper, label: 'ROLLBACK', color: '#FF6B9D' },
}

export function ReleaseCard({ releaseNote }: ReleaseCardProps) {
  const config = typeConfig[releaseNote.type] || typeConfig['Update']
  const Icon = config.icon

  // Extract key features from title
  const features = releaseNote.title.includes('&')
    ? releaseNote.title.split('&').map((f) => f.trim())
    : [releaseNote.title]

  const dateString = releaseNote.date.includes('T') ? releaseNote.date : releaseNote.date + 'T00:00:00'
  const dateObj = new Date(dateString)
  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : ''

  return (
    <div
      className="relative w-full max-w-md mx-auto bg-[#4A7CFF] rounded-3xl overflow-hidden shadow-2xl"
      style={{ aspectRatio: '9/16', minHeight: '600px' }}
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Squiggly lines */}
        <motion.svg
          className="absolute top-8 left-6"
          width="80"
          height="60"
          viewBox="0 0 80 60"
          fill="none"
          animate={{
            rotate: [0, 10, 0],
            x: [0, 5, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
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
          className="absolute top-20 right-8"
          width="60"
          height="50"
          viewBox="0 0 60 50"
          fill="none"
          animate={{
            rotate: [0, -15, 0],
            y: [0, -5, 0],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <path
            d="M10 25 Q 20 15, 30 25 T 50 25"
            stroke="#FF6B9D"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        </motion.svg>

        {/* Geometric shapes */}
        <motion.div
          className="absolute top-32 right-12 w-12 h-12 bg-[#7DE2D1] rounded-lg opacity-70"
          animate={{
            rotate: [0, 180, 360],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <motion.div
          className="absolute top-44 left-8 w-0 h-0 opacity-60"
          style={{
            borderLeft: '20px solid transparent',
            borderRight: '20px solid transparent',
            borderBottom: '35px solid #A8E6CF',
          }}
          animate={{
            rotate: [0, -180, -360],
            y: [0, 10, 0],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <motion.div
          className="absolute bottom-40 right-16 w-8 h-8 rounded-full bg-[#FFB6C1] opacity-50"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <motion.div
          className="absolute bottom-32 left-12 w-10 h-10 rounded-full bg-white opacity-20"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-between p-6 sm:p-8">
        {/* Header */}
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-2 flex-wrap"
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

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-3xl sm:text-4xl font-bold text-white leading-tight"
          >
            {releaseNote.title}
          </motion.h1>
        </div>

        {/* Features */}
        <div className="space-y-4 sm:space-y-6 flex-1 flex flex-col justify-center">
          {releaseNote.description && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-white/90 text-base leading-relaxed"
            >
              {releaseNote.description}
            </motion.p>
          )}

          {features.length > 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="space-y-3"
            >
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                  className="bg-[#3D68E5]/40 backdrop-blur-sm rounded-2xl p-4 border border-white/20"
                >
                  <div className="flex items-start gap-3">
                    <div className="bg-[#D4FF00] rounded-full p-2 mt-0.5 flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-[#4A7CFF]" />
                    </div>
                    <h3 className="text-white font-semibold text-base">{feature}</h3>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Why It Matters */}
          {releaseNote.whyItMatters && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="bg-[#3D68E5]/40 backdrop-blur-sm rounded-2xl p-4 sm:p-5 border border-white/20"
            >
              <div className="flex items-start gap-3">
                <Star
                  className="w-5 h-5 text-[#D4FF00] flex-shrink-0 mt-0.5"
                  fill="currentColor"
                />
                <div>
                  <h4 className="text-white font-semibold mb-1 sm:mb-2">Why This Matters</h4>
                  <p className="text-white/90 text-sm leading-relaxed">{releaseNote.whyItMatters}</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="flex items-center justify-center pt-4"
        >
          <div className="bg-white rounded-full px-6 py-3 shadow-lg">
            <p className="text-[#4A7CFF] text-sm font-bold">Available Now 🎉</p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
