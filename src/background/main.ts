import {
  downloadFilename,
  normalizeMediaResponse,
  parseInstagramTarget,
  shortcodeToMediaId,
  type InstagramTarget,
} from '../instagram'
import { isValidFolder } from '../downloadSettings'

const INSTAGRAM_APP_ID = '936619743392459'

type DownloadRequest = {
  type: 'download-current-media' | 'inspect-media'
  url: string
  index?: number
  mediaId?: string
}

type DownloadResponse =
  | { ok: true; count: number }
  | { ok: false; error: string }

type InspectResponse =
  | { ok: true; ids: (string | null)[]; count: number }
  | { ok: false; error: string }

function isDownloadRequest(message: unknown): message is DownloadRequest {
  if (typeof message !== 'object' || message === null) return false
  const request = message as Partial<DownloadRequest>
  return (request.type === 'download-current-media' || request.type === 'inspect-media')
    && typeof request.url === 'string'
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

async function resolveMedia(url: string) {
  const target = parseInstagramTarget(url)
  if (!target) throw new Error('Open an Instagram post, reel, or individual story first.')
  return normalizeMediaResponse(await fetchMedia(target), target)
}

async function inspectMedia(url: string): Promise<InspectResponse> {
  try {
    const media = await resolveMedia(url)
    return { ok: true, count: media.items.length, ids: media.items.map((item) => item.id ?? null) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'The request failed.' }
  }
}

async function downloadCurrentMedia(request: DownloadRequest): Promise<DownloadResponse> {
  try {
    const media = await resolveMedia(request.url)
    const selectedIndex = request.mediaId
      ? media.items.findIndex((item) => item.id === request.mediaId)
      : -1
    const index = selectedIndex >= 0 ? selectedIndex : request.index
    if (request.mediaId && index === undefined) throw new Error('The selected carousel item is no longer available.')
    if (index !== undefined && (!Number.isInteger(index) || index < 0 || index >= media.items.length)) {
      throw new Error('The selected carousel item is no longer available.')
    }

    const { downloadFolder, askWhereToSave, destination, companionToken, companionDestination } = await chrome.storage.local.get(['downloadFolder', 'askWhereToSave', 'destination', 'companionToken', 'companionDestination'])
    const folder = typeof downloadFolder === 'string' && isValidFolder(downloadFolder) ? downloadFolder : 'Petrify'
    if (destination === 'companion' && (typeof companionToken !== 'string' || !/^[a-f0-9]{64}$/.test(companionToken))) {
      throw new Error('Enter the companion pairing token in download settings first.')
    }
    for (const [itemIndex, item] of media.items.entries()) {
      if (index !== undefined && itemIndex !== index) continue
      const filename = downloadFilename(media, itemIndex, folder)
      if (destination === 'companion') {
        const selectedDestination = companionDestination ?? 'local'
        if (typeof selectedDestination !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(selectedDestination)) {
          throw new Error('Choose a companion destination in download settings first.')
        }
        const source = await fetch(item.url)
        if (!source.ok) throw new Error(`Could not fetch media (${source.status}).`)
        try {
          const result = await fetch('http://127.0.0.1:47631/files', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${companionToken}`, 'X-Petrify-Path': filename, 'X-Petrify-Destination': selectedDestination },
            body: await source.blob(),
          })
          if (!result.ok) throw new Error(`Companion could not save ${filename} (${result.status}).`)
        } catch (error) {
          if (error instanceof TypeError) throw new Error('Could not reach the companion. Start it on this computer and try again.')
          throw error
        }
      } else {
        await chrome.downloads.download({
          conflictAction: 'uniquify',
          filename,
          saveAs: askWhereToSave === true,
          url: item.url,
        })
      }
    }

    return { ok: true, count: index === undefined ? media.items.length : 1 }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The download failed.'
    return { ok: false, error: message }
  }
}

chrome.action.onClicked.addListener(() => { void chrome.runtime.openOptionsPage() })

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: DownloadResponse) => void) => {
  if (!isDownloadRequest(message)) return false
  if (message.type === 'inspect-media') {
    void inspectMedia(message.url).then(sendResponse)
  } else {
    void downloadCurrentMedia(message).then(sendResponse)
  }
  return true
})
