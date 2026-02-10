import type { ReleaseType } from './types'

export const RELEASE_TYPE_COLORS: Record<ReleaseType, string> = {
  'New Feature': 'bg-lime-100 text-lime-800',
  Improvement: 'bg-blue-100 text-blue-800',
  'Bug Fix': 'bg-red-100 text-red-800',
  Deprecation: 'bg-orange-100 text-orange-800',
  Rollback: 'bg-yellow-100 text-yellow-800',
  Update: 'bg-gray-100 text-gray-800',
}

export const DEFAULT_RELEASE_TYPE_COLOR = 'bg-gray-100 text-gray-800'

export const RELEASES_PAGE_SIZE = 100
