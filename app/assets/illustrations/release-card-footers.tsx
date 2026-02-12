'use client'

import {
  CourtLines,
  TennisBall,
  TennisBallShadow,
  PadelRacket,
} from '@/app/assets/icons'

/** Deterministic index from release id so the same release always gets the same theme. */
export function getReleaseFooterVariantIndex(releaseId: string, variantCount: number): number {
  let h = 0
  for (let i = 0; i < releaseId.length; i++) {
    h = ((h << 5) - h + releaseId.charCodeAt(i)) | 0
  }
  return Math.abs(h) % variantCount
}

export interface ReleaseCardFooterProps {
  className?: string
}

/** Theme: background + optional callout tint + footer component. Matches Figma Community Concepts (5 cards). */
export interface ReleaseCardTheme {
  background: string
  /** Darker shade for "Why it matters" callout; falls back to a darkened background if omitted. */
  calloutBg?: string
  Footer: React.ComponentType<ReleaseCardFooterProps>
}

/** 1. Blue – court + tennis ball (original). */
function FooterCourtAndBall({ className }: ReleaseCardFooterProps) {
  return (
    <>
      <CourtLines className={`absolute inset-0 w-full h-full ${className ?? ''}`} />
      <div className="absolute bottom-[55px] left-[95px] w-[70px] h-[30px] min-[480px]:w-[80px] min-[480px]:h-[35px] overflow-visible">
        <TennisBallShadow className="w-full h-full" />
      </div>
      <div className="absolute bottom-[55px] left-[105px] w-[70px] h-[70px] min-[480px]:bottom-[60px] min-[480px]:w-[90px] min-[480px]:h-[90px]">
        <TennisBall className="w-full h-full" />
      </div>
    </>
  )
}

/** 2. Green – court + blue padel racket + ball. */
function FooterCourtRacketBall({ className }: ReleaseCardFooterProps) {
  return (
    <>
      <CourtLines className={`absolute inset-0 w-full h-full ${className ?? ''}`} />
      <div className="absolute bottom-[50px] left-[60px] w-[56px] h-[70px] min-[480px]:bottom-[55px] min-[480px]:left-[70px] min-[480px]:w-[64px] min-[480px]:h-[80px]">
        <PadelRacket fill="#708FFF" className="w-full h-full" />
      </div>
      <div className="absolute bottom-[55px] left-[125px] w-[70px] h-[30px] min-[480px]:w-[80px] min-[480px]:h-[35px] overflow-visible">
        <TennisBallShadow className="w-full h-full" />
      </div>
      <div className="absolute bottom-[55px] left-[135px] w-[70px] h-[70px] min-[480px]:bottom-[60px] min-[480px]:left-[145px] min-[480px]:w-[90px] min-[480px]:h-[90px]">
        <TennisBall className="w-full h-full" />
      </div>
    </>
  )
}

/** 3. Grey – court + tennis ball (same graphic as blue, different bg). */
function FooterCourtAndBallGrey({ className }: ReleaseCardFooterProps) {
  return <FooterCourtAndBall className={className} />
}

/** 4. Pink – court + pink padel racket + ball. */
function FooterCourtRacketBallPink({ className }: ReleaseCardFooterProps) {
  return (
    <>
      <CourtLines className={`absolute inset-0 w-full h-full ${className ?? ''}`} />
      <div className="absolute bottom-[50px] left-[60px] w-[56px] h-[70px] min-[480px]:bottom-[55px] min-[480px]:left-[70px] min-[480px]:w-[64px] min-[480px]:h-[80px]">
        <PadelRacket fill="#E91E63" className="w-full h-full" />
      </div>
      <div className="absolute bottom-[55px] left-[125px] w-[70px] h-[30px] min-[480px]:w-[80px] min-[480px]:h-[35px] overflow-visible">
        <TennisBallShadow className="w-full h-full" />
      </div>
      <div className="absolute bottom-[55px] left-[135px] w-[70px] h-[70px] min-[480px]:bottom-[60px] min-[480px]:left-[145px] min-[480px]:w-[90px] min-[480px]:h-[90px]">
        <TennisBall className="w-full h-full" />
      </div>
    </>
  )
}

/** 5. Teal – abstract geometric (lines, triangles, yellow dot). */
function FooterAbstractGeometric({ className }: ReleaseCardFooterProps) {
  return (
    <svg
      className={`absolute inset-0 w-full h-full ${className ?? ''}`}
      viewBox="0 0 480 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <path
        d="M0 140 L120 60 L240 100 L360 50 L480 120 L480 200 L0 200 Z"
        fill="rgba(255,255,255,0.08)"
      />
      <path
        d="M0 160 L80 100 L200 140 L320 80 L480 140 L480 200 L0 200 Z"
        fill="rgba(255,255,255,0.05)"
      />
      <line x1="0" y1="100" x2="480" y2="140" stroke="white" strokeWidth="1" strokeOpacity="0.15" />
      <line x1="80" y1="200" x2="80" y2="60" stroke="white" strokeWidth="1" strokeOpacity="0.12" />
      <line x1="200" y1="200" x2="200" y2="80" stroke="white" strokeWidth="1" strokeOpacity="0.12" />
      <line x1="320" y1="200" x2="320" y2="70" stroke="white" strokeWidth="1" strokeOpacity="0.12" />
      <polygon points="60,150 90,120 120,150" fill="rgba(255,255,255,0.1)" />
      <polygon points="380,130 410,100 440,130" fill="rgba(255,255,255,0.08)" />
      <circle cx="100" cy="165" r="12" fill="#CCFF00" opacity={0.9} />
    </svg>
  )
}

const THEMES: ReleaseCardTheme[] = [
  {
    background: '#335FFF',
    calloutBg: '#294CCC',
    Footer: FooterCourtAndBall,
  },
  {
    background: '#1B5E4D',
    calloutBg: '#134A3D',
    Footer: FooterCourtRacketBall,
  },
  {
    background: '#374151',
    calloutBg: '#1F2937',
    Footer: FooterCourtAndBallGrey,
  },
  {
    background: '#BE185D',
    calloutBg: '#9D174D',
    Footer: FooterCourtRacketBallPink,
  },
  {
    background: '#0D9488',
    calloutBg: '#0F766E',
    Footer: FooterAbstractGeometric,
  },
]

export function getReleaseCardTheme(releaseId: string): ReleaseCardTheme {
  const index = getReleaseFooterVariantIndex(releaseId, THEMES.length)
  return THEMES[index]
}

/** @deprecated Use getReleaseCardTheme(releaseId).Footer for the footer component. */
export function getReleaseCardFooterComponent(releaseId: string): React.ComponentType<ReleaseCardFooterProps> {
  return getReleaseCardTheme(releaseId).Footer
}
