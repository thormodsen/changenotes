import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://changenotes.vercel.app'),
  title: 'Changelog Viewer',
  description: 'Generate and view changelog entries for any date range',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
