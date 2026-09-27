import {
  downloadFilename,
  normalizeMediaResponse,
  parseInstagramTarget,
  shortcodeToMediaId,
  type InstagramTarget,
} from '../instagram'

const INSTAGRAM_APP_ID = '936619743392459'

type DownloadRequest = {
  type: 'download-current-media'
  url: string
}

type DownloadResponse =
  | { ok: true; count: number }
  | { ok: false; error: string }

function isDownloadRequest(message: unknown): message is DownloadRequest {
  if (typeof message !== 'object' || message === null) return false
  const request = message as Partial<DownloadRequest>
  return request.type === 'download-current-media' && typeof request.url === 'string'
}

function mediaIdFor(target: InstagramTarget): string {
  return target.kind === 'story' ? target.identifier : shortcodeToMediaId(target.identifier)
}

async function fetchMedia(target: InstagramTarget): Promise<unknown> {
  if (target.kind === 'highlight' || target.kind === 'story-tray') {
    const reelId = target.kind === 'highlight' ? `highlight:${target.identifier}` : target.identifier
    const response = await fetch(`https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=${encodeURIComponent(reelId)}`, {
      credentials: 'include',
      headers: {
        'X-IG-App-ID': INSTAGRAM_APP_ID,
        'X-Requested-With': 'XMLHttpRequest',
      },
    })

    if (!response.ok) throw new Error(`Instagram returned an error (${response.status}).`)
    return response.json()
  }

  const mediaId = mediaIdFor(target)
  const response = await fetch(`https://www.instagram.com/api/v1/media/${encodeURIComponent(mediaId)}/info/`, {
    credentials: 'include',
    headers: {
      'X-IG-App-ID': INSTAGRAM_APP_ID,
      'X-Requested-With': 'XMLHttpRequest',
    },
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Instagram did not authorize the request. Make sure you are signed in.')
    }
    throw new Error(`Instagram returned an error (${response.status}).`)
  }

  return response.json()
}

async function downloadCurrentMedia(url: string): Promise<DownloadResponse> {
  const target = parseInstagramTarget(url)
  if (!target) return { ok: false, error: 'Open an Instagram post, reel, or individual story first.' }

  try {
    const rawMedia = await fetchMedia(target)
    const media = normalizeMediaResponse(rawMedia, target)

    for (const [index, item] of media.items.entries()) {
      await chrome.downloads.download({
        conflictAction: 'uniquify',
        filename: downloadFilename(media, index),
        saveAs: false,
        url: item.url,
      })
    }

    return { ok: true, count: media.items.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The download failed.'
    return { ok: false, error: message }
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: DownloadResponse) => void) => {
  if (!isDownloadRequest(message)) return false
  void downloadCurrentMedia(message.url).then(sendResponse)
  return true
})
