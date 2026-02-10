import { ImageResponse } from 'next/og'
import { getReleaseById } from '@/lib/db/client'

export const runtime = 'edge'
export const alt = 'Release Preview'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

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

  // Truncate description if too long
  const truncatedDescription = description.length > 180 
    ? description.slice(0, 177) + '...' 
    : description

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#335FFF',
          padding: '60px',
          paddingBottom: '180px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Title - larger and more prominent */}
        <h1
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: 'white',
            lineHeight: 1.1,
            margin: 0,
            marginBottom: '32px',
          }}
        >
          {title}
        </h1>

        {/* Description */}
        {truncatedDescription && (
          <p
            style={{
              fontSize: 32,
              fontWeight: 300,
              color: 'white',
              lineHeight: 1.4,
              margin: 0,
              opacity: 0.9,
            }}
          >
            {truncatedDescription}
          </p>
        )}

        {/* Footer - Court lines SVG */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '180px',
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

        {/* Tennis ball - larger */}
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            left: '80px',
            width: '120px',
            height: '120px',
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
