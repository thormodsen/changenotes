import { ImageResponse } from 'next/og'
import { getReleaseById } from '@/lib/db/client'

export const runtime = 'edge'
export const alt = 'Release Preview'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

const typeConfig: Record<string, { label: string; color: string }> = {
  'New Feature': { label: 'New Feature', color: '#CCFF00' },
  'Improvement': { label: 'Improvement', color: '#708FFF' },
  'Bug Fix': { label: 'Bug Fix', color: '#39C579' },
  'Update': { label: 'Update', color: '#CCFF00' },
  'Release': { label: 'Update', color: '#CCFF00' },
  'Deprecation': { label: 'Deprecation', color: '#9FA7AD' },
  'Rollback': { label: 'Rollback', color: '#FFB930' },
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const release = await getReleaseById(id)

  if (!release || !release.published || !release.shared) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#335FFF',
            color: 'white',
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          Release Not Found
        </div>
      ),
      { ...size }
    )
  }

  const title = release.marketing_title || release.title
  const description = release.marketing_description || release.description || ''
  const whyItMatters = release.marketing_why_this_matters || release.why_this_matters || ''
  const config = typeConfig[release.type] || typeConfig['Update']

  // Format the date - handle both ISO strings and date-only strings
  let formattedDate = ''
  if (release.date) {
    const dateValue = new Date(release.date)
    if (!isNaN(dateValue.getTime())) {
      formattedDate = dateValue.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    }
  }

  // Truncate description if too long
  const truncatedDescription = description.length > 200 
    ? description.slice(0, 197) + '...' 
    : description

  // Truncate why it matters if too long
  const truncatedWhyItMatters = whyItMatters.length > 120 
    ? whyItMatters.slice(0, 117) + '...' 
    : whyItMatters

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#335FFF',
          padding: '48px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Header - Type badge and date */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: config.color,
              borderRadius: '9999px',
              padding: '12px 24px',
            }}
          >
            <span style={{ color: '#0E2433', fontSize: 20, fontWeight: 500 }}>
              {config.label}
            </span>
          </div>
          <span style={{ color: 'white', fontSize: 20, fontWeight: 400 }}>
            {formattedDate}
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: 'white',
            lineHeight: 1.1,
            margin: 0,
            marginBottom: '24px',
          }}
        >
          {title}
        </h1>

        {/* Description */}
        {truncatedDescription && (
          <p
            style={{
              fontSize: 28,
              fontWeight: 300,
              color: 'white',
              lineHeight: 1.4,
              margin: 0,
              marginBottom: '24px',
            }}
          >
            {truncatedDescription}
          </p>
        )}

        {/* Why It Matters callout - positioned above footer */}
        {truncatedWhyItMatters && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
              backgroundColor: '#294CCC',
              borderRadius: '24px',
              padding: '24px',
              marginTop: 'auto',
              marginBottom: '100px',
            }}
          >
            {/* Lightbulb emoji as placeholder for Lottie */}
            <span style={{ fontSize: 32 }}>💡</span>
            <p
              style={{
                fontSize: 22,
                fontWeight: 300,
                color: 'white',
                opacity: 0.9,
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              {truncatedWhyItMatters}
            </p>
          </div>
        )}

        {/* Footer - Court lines SVG */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '140px',
            display: 'flex',
          }}
        >
          <svg
            viewBox="-32 0 481 207"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: '100%', height: '100%' }}
            preserveAspectRatio="none"
          >
            <path
              d="M448.578 -0.0667042L-32 187.362V207L273.214 82.8323L448.578 158.987V139.842L295.233 73.8745L448.578 11.4933V-0.0793457V-0.0667042Z"
              fill="#FCF8EE"
            />
          </svg>
        </div>

        {/* Tennis ball */}
        <div
          style={{
            position: 'absolute',
            bottom: '50px',
            left: '100px',
            width: '90px',
            height: '90px',
            display: 'flex',
          }}
        >
          <svg
            viewBox="0 0 105 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: '100%', height: '100%' }}
          >
            <g transform="translate(-63, -18)">
              <path
                d="M154.004 89.8873C167.131 69.5638 161.318 42.4576 141.008 29.3315C120.697 16.2054 93.5907 22.0303 80.4646 42.3408C67.3385 62.6642 73.1508 89.7705 93.4613 102.897C113.772 116.023 140.879 110.198 154.018 89.8873H154.004Z"
                fill="#CCFF00"
              />
              <path
                d="M151.286 38.613C151.428 46.3541 149.953 54.2503 146.652 61.8101C135.792 86.7161 108.931 99.6736 83.3647 93.9132C87.6107 99.0523 93.0864 103.324 99.6236 106.172C121.798 115.842 147.597 105.706 157.267 83.5313C163.998 68.1011 161.124 50.9107 151.286 38.613Z"
                fill="#A3CC00"
              />
            </g>
          </svg>
        </div>
      </div>
    ),
    { ...size }
  )
}
