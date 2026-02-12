import { NextRequest, NextResponse } from 'next/server'
import { validateSession, validateApiKey } from '@/lib/auth'

const SESSION_NAME = 'changelog_session'

// Routes that don't require authentication
const publicRoutes = [
  '/login',
  '/release',
  '/releasegrid',
  '/changelog',
  '/timeline',
  '/api/auth',
  '/api/slack/events',
  '/api/cron/sync',
]

// API routes that allow public read access (for public changelog page)
const publicApiRoutes = [
  { path: '/api/releases', methods: ['GET'] },
]

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(route => pathname.startsWith(route))
}

function isPublicApiRoute(pathname: string, method: string): boolean {
  return publicApiRoutes.some(
    route => pathname.startsWith(route.path) && route.methods.includes(method)
  )
}

function isAuthenticated(request: NextRequest): boolean {
  // Check session cookie
  const session = request.cookies.get(SESSION_NAME)
  if (session?.value && validateSession(session.value)) {
    return true
  }

  // Check API key header
  const apiKey = request.headers.get('x-api-key')
  if (apiKey && validateApiKey(apiKey)) {
    return true
  }

  return false
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Allow public API routes (e.g., GET /api/releases for changelog)
  if (pathname.startsWith('/api') && isPublicApiRoute(pathname, method)) {
    return NextResponse.next()
  }

  // Check authentication
  if (!isAuthenticated(request)) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp|lottie|json|woff|woff2|ttf|eot)).*)',
  ],
}
