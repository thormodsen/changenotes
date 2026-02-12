'use client'

import { useState, useCallback, memo } from 'react'
import type { Release } from '@/lib/types'
import { buildSlackUrl, formatTimestamp } from '@/lib/text-utils'

interface ReleaseCardProps {
  release: Release
  workspace: string
  onUpdate: (id: string, updates: Partial<Release>) => void
  onDelete: (id: string) => void
  onReextract: (oldId: string, newReleases: Release[]) => void
  onError: (message: string) => void
  onMessage: (message: string) => void
}

interface EditFormState {
  title: string
  description: string
  why_this_matters: string
  impact: string
  marketing_title: string
  marketing_description: string
  marketing_why_this_matters: string
  featured_image_url: string
}

export const ReleaseCard = memo(function ReleaseCard({
  release,
  workspace,
  onUpdate,
  onDelete,
  onReextract,
  onError,
  onMessage,
}: ReleaseCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<EditFormState>({
    title: '',
    description: '',
    why_this_matters: '',
    impact: '',
    marketing_title: '',
    marketing_description: '',
    marketing_why_this_matters: '',
    featured_image_url: '',
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [reextracting, setReextracting] = useState(false)
  const [generatingMarketing, setGeneratingMarketing] = useState(false)

  const startEdit = useCallback(() => {
    setEditForm({
      title: release.title,
      description: release.description || '',
      why_this_matters: release.why_this_matters || '',
      impact: release.impact || '',
      marketing_title: release.marketing_title || '',
      marketing_description: release.marketing_description || '',
      marketing_why_this_matters: release.marketing_why_this_matters || '',
      featured_image_url: release.featured_image_url || '',
    })
    setIsEditing(true)
  }, [release])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
  }, [])

  const saveEdit = useCallback(async () => {
    try {
      const res = await fetch(`/api/releases/${release.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          whyThisMatters: editForm.why_this_matters,
          impact: editForm.impact,
          marketingTitle: editForm.marketing_title,
          marketingDescription: editForm.marketing_description,
          marketingWhyThisMatters: editForm.marketing_why_this_matters,
          featuredImageUrl: editForm.featured_image_url,
        }),
      })

      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || 'Failed to update release')

      onUpdate(release.id, {
        title: editForm.title || release.title,
        description: editForm.description || null,
        why_this_matters: editForm.why_this_matters || null,
        impact: editForm.impact || null,
        marketing_title: editForm.marketing_title || null,
        marketing_description: editForm.marketing_description || null,
        marketing_why_this_matters: editForm.marketing_why_this_matters || null,
        featured_image_url: editForm.featured_image_url || null,
      })
      setIsEditing(false)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save')
    }
  }, [editForm, release, onUpdate, onError])

  const handleDelete = useCallback(async () => {
    if (!confirm(`Delete "${release.title}"?`)) return

    try {
      const res = await fetch(`/api/releases/${release.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to delete')
      }
      onDelete(release.id)
      onMessage('Release deleted')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }, [release, onDelete, onMessage, onError])

  const togglePublish = useCallback(async () => {
    try {
      const res = await fetch('/api/releases/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [release.id], unpublish: release.published }),
      })

      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || 'Failed to update publish status')

      onUpdate(release.id, {
        published: !release.published,
        published_at: !release.published ? new Date().toISOString() : null,
      })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update')
    }
  }, [release, onUpdate, onError])

  const reextract = useCallback(async () => {
    setReextracting(true)
    setMenuOpen(false)

    try {
      const res = await fetch(`/api/releases/${release.id}/reextract`, { method: 'POST' })
      const json = await res.json()

      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to re-extract')
      }

      const { data } = json
      onMessage(
        `Re-extracted: ${data.messagesRead} messages → ${data.extracted} releases (${data.messagesSkipped} skipped)`
      )
      onReextract(release.id, data.newReleases)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to re-extract')
    } finally {
      setReextracting(false)
    }
  }, [release, onReextract, onMessage, onError])

  const generateMarketing = useCallback(async () => {
    setGeneratingMarketing(true)

    try {
      const res = await fetch(`/api/releases/${release.id}/marketing`, {
        method: 'POST',
      })

      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to generate marketing')
      }

      const { marketing } = json.data

      onUpdate(release.id, {
        marketing_title: marketing.title,
        marketing_description: marketing.description,
        marketing_why_this_matters: marketing.whyThisMatters,
      })
      onMessage('Marketing content generated')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Marketing generation failed')
    } finally {
      setGeneratingMarketing(false)
    }
  }, [release, onUpdate, onMessage, onError])

  const toggleShare = useCallback(async () => {
    setGeneratingMarketing(true)

    try {
      const hasMarketing = !!release.marketing_title

      if (!hasMarketing) {
        const res = await fetch(`/api/releases/${release.id}/marketing`, {
          method: 'POST',
        })
        const json = await res.json()
        if (!json.success) {
          throw new Error(json.error?.message || 'Failed to generate marketing')
        }
        const { marketing } = json.data

        await fetch(`/api/releases/${release.id}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shared: true }),
        })

        onUpdate(release.id, {
          marketing_title: marketing.title,
          marketing_description: marketing.description,
          marketing_why_this_matters: marketing.whyThisMatters,
          shared: true,
        })
        onMessage('Share card created')
      } else {
        const newShared = !release.shared
        const res = await fetch(`/api/releases/${release.id}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shared: newShared }),
        })

        const json = await res.json()
        if (!json.success) {
          throw new Error(json.error?.message || 'Failed to toggle share')
        }

        onUpdate(release.id, { shared: newShared })
        onMessage(newShared ? 'Share card enabled' : 'Share card disabled')
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to toggle share')
    } finally {
      setGeneratingMarketing(false)
    }
  }, [release, onUpdate, onMessage, onError])

  const handleMenuToggle = useCallback(() => setMenuOpen(prev => !prev), [])
  const handleMenuClose = useCallback(() => setMenuOpen(false), [])

  const slackUrl =
    workspace && release.channel_id
      ? buildSlackUrl(release.message_id, release.channel_id, workspace)
      : null

  return (
    <div
      className={`p-4 rounded-lg border ${
        release.published ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'
      }`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <ReleaseCardHeader release={release} slackUrl={slackUrl} />

          {isEditing ? (
            <ReleaseEditForm
              form={editForm}
              onChange={setEditForm}
              onSave={saveEdit}
              onCancel={cancelEdit}
            />
          ) : (
            <ReleaseCardContent release={release} slackUrl={slackUrl} workspace={workspace} />
          )}
        </div>

        {!isEditing && (
          <ReleaseCardActions
            release={release}
            menuOpen={menuOpen}
            reextracting={reextracting}
            generatingMarketing={generatingMarketing}
            onMenuToggle={handleMenuToggle}
            onMenuClose={handleMenuClose}
            onEdit={startEdit}
            onDelete={handleDelete}
            onTogglePublish={togglePublish}
            onToggleShare={toggleShare}
            onReextract={reextract}
            onRegenerateMarketing={generateMarketing}
          />
        )}
      </div>
    </div>
  )
})

const ReleaseCardHeader = memo(function ReleaseCardHeader({
  release,
  slackUrl,
}: {
  release: Release
  slackUrl: string | null
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {release.message_timestamp && (
        <span className="text-xs text-gray-500">
          {formatTimestamp(release.message_timestamp)}
        </span>
      )}
      {slackUrl && (
        <a
          href={slackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-blue-600 transition-colors"
          title="View in Slack"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      )}
      {release.prompt_version && (
        <span className="text-xs text-gray-400">v{release.prompt_version}</span>
      )}
    </div>
  )
})

const ReleaseCardContent = memo(function ReleaseCardContent({
  release,
  slackUrl,
  workspace,
}: {
  release: Release
  slackUrl: string | null
  workspace: string
}) {
  const hasMedia =
    release.media && (release.media.images.length > 0 || release.media.videos.length > 0)

  return (
    <>
      <h4 className="font-medium text-gray-900">
        {release.published ? (
          <a
            href={`/changelog/${release.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            {release.title}
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        ) : (
          release.title
        )}
      </h4>

      {release.description && (
        <p className="text-sm text-gray-600 mt-1">{release.description}</p>
      )}

      {release.why_this_matters && (
        <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
          <span className="font-medium text-blue-800">Why this matters: </span>
          <span className="text-blue-700">{release.why_this_matters}</span>
        </div>
      )}

      {release.impact && (
        <div className="mt-2 p-2 bg-amber-50 rounded text-sm">
          <span className="font-medium text-amber-800">Impact: </span>
          <span className="text-amber-700">{release.impact}</span>
        </div>
      )}

      {release.featured_image_url && (
        <div className="mt-3">
          <img
            src={release.featured_image_url}
            alt="Featured"
            className="max-h-48 rounded border border-gray-300"
          />
        </div>
      )}

      {!release.featured_image_url && hasMedia && (
        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>
              {release.media!.images.length} image
              {release.media!.images.length !== 1 ? 's' : ''},{' '}
              {release.media!.videos.length} video
              {release.media!.videos.length !== 1 ? 's' : ''} in Slack
            </span>
            {slackUrl && (
              <a
                href={slackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                View →
              </a>
            )}
            <span className="text-gray-400">•</span>
            <span className="text-gray-500">Edit to add a public image URL</span>
          </div>
        </div>
      )}

      {release.published && release.shared && release.marketing_title && (
        <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded">
          <a
            href={`/releasegrid/${release.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-teal-700 mb-2 hover:text-teal-900 inline-flex items-center gap-1"
          >
            Marketing Copy
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <div className="space-y-1 text-sm">
            <div>
              <span className="font-medium text-teal-800">Title:</span>{' '}
              <span className="text-teal-700">{release.marketing_title}</span>
            </div>
            {release.marketing_description && (
              <div>
                <span className="font-medium text-teal-800">Description:</span>{' '}
                <span className="text-teal-700">{release.marketing_description}</span>
              </div>
            )}
            {release.marketing_why_this_matters && (
              <div>
                <span className="font-medium text-teal-800">Why it matters:</span>{' '}
                <span className="text-teal-700">{release.marketing_why_this_matters}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
})

const ReleaseEditForm = memo(function ReleaseEditForm({
  form,
  onChange,
  onSave,
  onCancel,
}: {
  form: EditFormState
  onChange: (form: EditFormState) => void
  onSave: () => void
  onCancel: () => void
}) {
  const updateField = (field: keyof EditFormState, value: string) => {
    onChange({ ...form, [field]: value })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-600 mb-1">Title</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => updateField('title', e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
          rows={2}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">Why this matters</label>
        <textarea
          value={form.why_this_matters}
          onChange={(e) => updateField('why_this_matters', e.target.value)}
          rows={2}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">Impact</label>
        <textarea
          value={form.impact}
          onChange={(e) => updateField('impact', e.target.value)}
          rows={2}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </div>

      <div className="border-t border-gray-200 pt-3 mt-3">
        <p className="text-xs font-medium text-purple-700 mb-2">Featured Image</p>
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            Image URL (paste any public image/gif URL)
          </label>
          <input
            type="text"
            value={form.featured_image_url}
            onChange={(e) => updateField('featured_image_url', e.target.value)}
            placeholder="https://example.com/image.gif"
            className="w-full px-2 py-1 border border-purple-300 rounded text-sm"
          />
          {form.featured_image_url && (
            <img
              src={form.featured_image_url}
              alt="Preview"
              className="mt-2 max-h-32 rounded border border-gray-300"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-3 mt-3">
        <p className="text-xs font-medium text-teal-700 mb-2">Marketing Copy</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Marketing Title</label>
            <input
              type="text"
              value={form.marketing_title}
              onChange={(e) => updateField('marketing_title', e.target.value)}
              className="w-full px-2 py-1 border border-teal-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Marketing Description</label>
            <textarea
              value={form.marketing_description}
              onChange={(e) => updateField('marketing_description', e.target.value)}
              rows={2}
              className="w-full px-2 py-1 border border-teal-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Marketing Why This Matters
            </label>
            <textarea
              value={form.marketing_why_this_matters}
              onChange={(e) => updateField('marketing_why_this_matters', e.target.value)}
              rows={2}
              className="w-full px-2 py-1 border border-teal-300 rounded text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="px-3 py-1 bg-gray-900 text-white rounded text-sm hover:bg-gray-800"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  )
})

const ReleaseCardActions = memo(function ReleaseCardActions({
  release,
  menuOpen,
  reextracting,
  generatingMarketing,
  onMenuToggle,
  onMenuClose,
  onEdit,
  onDelete,
  onTogglePublish,
  onToggleShare,
  onReextract,
  onRegenerateMarketing,
}: {
  release: Release
  menuOpen: boolean
  reextracting: boolean
  generatingMarketing: boolean
  onMenuToggle: () => void
  onMenuClose: () => void
  onEdit: () => void
  onDelete: () => void
  onTogglePublish: () => void
  onToggleShare: () => void
  onReextract: () => void
  onRegenerateMarketing: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* Menu button - on top */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMenuToggle()
          }}
          className="px-3 py-1 border border-gray-300 text-gray-600 rounded text-xs font-medium hover:bg-gray-100"
        >
          ⋯
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
            {/* Mobile-only actions */}
            <button
              onClick={() => {
                onMenuClose()
                onDelete()
              }}
              className="sm:hidden w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-100"
            >
              Delete
            </button>
            <button
              onClick={() => {
                onMenuClose()
                onEdit()
              }}
              className="sm:hidden w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Edit
            </button>
            <button
              onClick={() => {
                onMenuClose()
                onTogglePublish()
              }}
              className="sm:hidden w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {release.published ? '✓ Published' : 'Publish'}
            </button>
            {release.published && (
              <button
                onClick={() => {
                  onMenuClose()
                  onToggleShare()
                }}
                disabled={generatingMarketing}
                className="sm:hidden w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                {generatingMarketing ? 'Working...' : release.shared ? '✓ Shared' : 'Share'}
              </button>
            )}
            <div className="sm:hidden border-t border-gray-100 my-1" />

            {/* Always visible menu items */}
            <button
              onClick={() => {
                onMenuClose()
                onReextract()
              }}
              disabled={reextracting}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {reextracting ? '↻ Re-extracting...' : '↻ Re-extract'}
            </button>
            {release.marketing_title && (
              <button
                onClick={() => {
                  onMenuClose()
                  onRegenerateMarketing()
                }}
                disabled={generatingMarketing}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                ↻ Regenerate marketing
              </button>
            )}
          </div>
        )}
      </div>

      {/* Desktop buttons: Delete, Edit, Publish, Share (Share only visible when published) */}
      <button
        onClick={onDelete}
        className="hidden sm:block px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200"
      >
        Delete
      </button>
      <button
        onClick={onEdit}
        className="hidden sm:block px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200"
      >
        Edit
      </button>
      <button
        onClick={onTogglePublish}
        className={`hidden sm:block px-3 py-1 rounded text-xs font-medium transition-colors ${
          release.published
            ? 'bg-green-500 text-white hover:bg-green-600'
            : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
        }`}
      >
        {release.published ? 'Published' : 'Publish'}
      </button>
      {release.published && (
        <button
          onClick={onToggleShare}
          disabled={generatingMarketing}
          className={`hidden sm:block px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
            release.shared
              ? 'bg-pink-500 text-white hover:bg-pink-600'
              : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
          }`}
        >
          {generatingMarketing ? 'Working...' : release.shared ? 'Shared' : 'Share'}
        </button>
      )}
    </div>
  )
})
