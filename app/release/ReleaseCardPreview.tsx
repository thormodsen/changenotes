'use client'

import Link from 'next/link'

interface ReleaseCardPreviewProps {
  id: string
  title: string
  date: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ReleaseCardPreview({ id, title, date }: ReleaseCardPreviewProps) {
  return (
    <Link
      href={`/release/${id}`}
      className="block w-[200px] aspect-[9/16] rounded-3xl bg-[#335FFF] p-4 flex flex-col transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0E2433] shrink-0"
    >
      <p className="text-xs text-white/80 shrink-0">{formatDate(date)}</p>
      <h2 className="text-lg font-semibold text-white line-clamp-4 mt-2 flex-1 flex items-center justify-center text-center">
        {title}
      </h2>
    </Link>
  )
}
