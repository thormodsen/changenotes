'use client'

/* eslint-disable @next/next/no-img-element */

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

export interface ReleaseCardTheme {
  background: string
  /** Callout background behind "Why it matters" box. */
  calloutBg: string
  /** Text color inside the callout. Defaults to white when omitted. */
  calloutTextColor?: string
  Footer: React.ComponentType<ReleaseCardFooterProps>
}

/* ──────────────────────────────────────────
   Footer components – use exact Figma SVGs
   ────────────────────────────────────────── */

/** 1. Blue – court surface + tennis ball (Figma Frame 26, node 1601:281). */
function FooterBlue() {
  return (
    <img
      src="/illustrations/footer-blue.svg"
      alt=""
      className="absolute w-full h-full left-0 bottom-0"
      style={{ objectFit: 'cover', objectPosition: 'center bottom' }}
      draggable={false}
    />
  )
}

/** 2. Green – court lines + padel racket + ball (Figma Frame 27, node 1601:327). */
function FooterGreen() {
  return (
    <>
      <img
        src="/illustrations/footer-green-court.svg"
        alt=""
        className="absolute w-full h-full left-0 bottom-0"
        style={{ objectFit: 'cover', objectPosition: 'center bottom' }}
        draggable={false}
      />
      <img
        src="/illustrations/footer-green-racket.svg"
        alt=""
        className="absolute right-0 bottom-0"
        style={{ width: '70%', height: '100%', objectFit: 'contain', objectPosition: 'right bottom' }}
        draggable={false}
      />
    </>
  )
}

/** 3. Grey – ball on abstract court lines (Figma Frame 28, node 1601:370). */
function FooterGrey() {
  return (
    <img
      src="/illustrations/footer-grey.svg"
      alt=""
      className="absolute w-full left-0 bottom-0"
      style={{ height: '100%', objectFit: 'cover', objectPosition: 'center bottom' }}
      draggable={false}
    />
  )
}

/** 4. Pink – padel racket + ball (Figma Frame 427320050, node 1607:600). */
function FooterPink() {
  return (
    <>
      <img
        src="/illustrations/footer-pink-bg.svg"
        alt=""
        className="absolute w-full left-0 bottom-0"
        style={{ height: '100%', objectFit: 'cover', objectPosition: 'left bottom' }}
        draggable={false}
      />
      <img
        src="/illustrations/footer-pink-complete.svg"
        alt=""
        className="absolute right-0 bottom-0"
        style={{ width: '80%', height: '100%', objectFit: 'contain', objectPosition: 'right bottom' }}
        draggable={false}
      />
    </>
  )
}

/** 5. Teal – geometric court lines (Figma Frame 427320051, node 1607:651). */
function FooterTeal() {
  return (
    <img
      src="/illustrations/footer-teal.svg"
      alt=""
      className="absolute w-full left-0 bottom-0"
      style={{ height: '140%', objectFit: 'cover', objectPosition: 'center bottom' }}
      draggable={false}
    />
  )
}

/* ──────────────────────────────────
   Themes – exact Figma color values
   ────────────────────────────────── */

const THEMES: ReleaseCardTheme[] = [
  {
    // Blue (Figma Frame 26) – bg #335fff, callout #294ccc, white text
    background: '#335FFF',
    calloutBg: '#294CCC',
    Footer: FooterBlue,
  },
  {
    // Green (Figma Frame 27) – bg #227649, callout #174f30, white text
    background: '#227649',
    calloutBg: '#174F30',
    Footer: FooterGreen,
  },
  {
    // Grey (Figma Frame 28) – bg #3e505c, callout #879199, dark text
    background: '#3E505C',
    calloutBg: '#879199',
    calloutTextColor: '#0E2433',
    Footer: FooterGrey,
  },
  {
    // Pink (Figma Frame 427320050) – bg #f556c0, callout #ff96dc, dark text
    background: '#F556C0',
    calloutBg: '#FF96DC',
    calloutTextColor: '#0E2433',
    Footer: FooterPink,
  },
  {
    // Teal (Figma Frame 427320051) – bg #0082b5, callout #33c5ff, dark text
    background: '#0082B5',
    calloutBg: '#33C5FF',
    calloutTextColor: '#0E2433',
    Footer: FooterTeal,
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
