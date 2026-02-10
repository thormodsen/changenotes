// Client-side types (dates serialized as strings from API)

export interface MediaImage {
  id: string
  url: string
  thumb_url?: string
  width?: number
  height?: number
  name?: string
}

export interface MediaVideo {
  id: string
  url: string
  mp4_url?: string
  thumb_url?: string
  duration_ms?: number
  name?: string
}

export interface ReleaseMedia {
  images: MediaImage[]
  videos: MediaVideo[]
}

export interface Release {
  id: string
  message_id: string
  date: string
  title: string
  description: string | null
  type: string
  why_this_matters: string | null
  impact: string | null
  prompt_version: string | null
  extracted_at: string
  published: boolean
  published_at: string | null
  message_timestamp?: string
  channel_id?: string
  marketing_title: string | null
  marketing_description: string | null
  marketing_why_this_matters: string | null
  shared: boolean
  media: ReleaseMedia | null
  include_media: boolean
  featured_image_url: string | null
}

export type ReleaseType =
  | 'New Feature'
  | 'Improvement'
  | 'Bug Fix'
  | 'Deprecation'
  | 'Rollback'
  | 'Update'

export type DatePreset = 'today' | '7days' | '30days' | 'month'
