export type InstagramTarget = {
  kind: 'post' | 'reel' | 'story'
  identifier: string
  username?: string
}

export type DownloadableMedia = {
  extension: 'jpg' | 'mp4'
  url: string
}

export type ResolvedMedia = {
  identifier: string
  items: DownloadableMedia[]
  kind: InstagramTarget['kind']
  username: string
}

type UnknownRecord = Record<string, unknown>

const SHORTCODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com'])

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function recordAt(value: unknown, key: string): UnknownRecord | undefined {
  if (!isRecord(value)) return undefined
  const child = value[key]
  return isRecord(child) ? child : undefined
}

function stringAt(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined
  const child = value[key]
  return typeof child === 'string' && child.length > 0 ? child : undefined
}

function arrayAt(value: unknown, key: string): unknown[] {
  if (!isRecord(value)) return []
  const child = value[key]
  return Array.isArray(child) ? child : []
}

export function parseInstagramTarget(input: string): InstagramTarget | null {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return null
  }

  if (!INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) return null

  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const [surface, firstIdentifier, secondIdentifier] = segments

  if ((surface === 'p' || surface === 'reel' || surface === 'reels' || surface === 'tv') && firstIdentifier) {
    return {
      kind: surface === 'p' ? 'post' : 'reel',
      identifier: firstIdentifier,
    }
  }

  if (surface === 'stories' && firstIdentifier && secondIdentifier && /^\d+$/.test(secondIdentifier)) {
    return {
      kind: 'story',
      identifier: secondIdentifier,
      username: firstIdentifier.replace(/^@/, ''),
    }
  }

  return null
}

export function shortcodeToMediaId(shortcode: string): string {
  if (!shortcode) throw new Error('The Instagram shortcode is empty.')

  let mediaId = 0n
  for (const character of shortcode) {
    const value = SHORTCODE_ALPHABET.indexOf(character)
    if (value < 0) throw new Error('The Instagram shortcode is invalid.')
    mediaId = mediaId * 64n + BigInt(value)
  }

  return mediaId.toString()
}

function candidateUrl(candidates: unknown[]): string | undefined {
  let best: { score: number; url: string } | undefined

  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue
    const url = stringAt(candidate, 'url')
    if (!url) continue
    const width = typeof candidate.width === 'number' ? candidate.width : 0
    const height = typeof candidate.height === 'number' ? candidate.height : 0
    const score = width * height
    if (!best || score > best.score) best = { score, url }
  }

  return best?.url
}

function usernameFrom(item: unknown): string | undefined {
  return stringAt(recordAt(item, 'user'), 'username') ?? stringAt(recordAt(item, 'owner'), 'username')
}

function normalizeItem(item: unknown): DownloadableMedia | null {
  if (!isRecord(item)) return null

  const videoUrl = candidateUrl(arrayAt(item, 'video_versions'))
  if (videoUrl) return { extension: 'mp4', url: videoUrl }

  const imageVersions = recordAt(item, 'image_versions2')
  const imageUrl = candidateUrl(arrayAt(imageVersions, 'candidates'))
  if (imageUrl) return { extension: 'jpg', url: imageUrl }

  return null
}

export function normalizeMediaResponse(response: unknown, target: InstagramTarget): ResolvedMedia {
  const parent = arrayAt(response, 'items')[0]
  if (!isRecord(parent)) throw new Error('Instagram did not return media for this item.')

  const carousel = arrayAt(parent, 'carousel_media')
  const sourceItems = carousel.length > 0 ? carousel : [parent]
  const items = sourceItems.map(normalizeItem).filter((item): item is DownloadableMedia => item !== null)
  if (items.length === 0) throw new Error('No downloadable image or video was found.')

  const username = usernameFrom(parent) ?? sourceItems.map(usernameFrom).find(Boolean) ?? target.username
  if (!username) throw new Error('Instagram did not return the account name for this item.')

  return {
    identifier: target.identifier,
    items,
    kind: target.kind,
    username,
  }
}

export function sanitizePathSegment(value: string): string {
  const sanitized = value
    .trim()
    .replace(/^@/, '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/\.+$/g, '')

  return sanitized || 'unknown'
}

export function downloadFilename(media: ResolvedMedia, index: number): string {
  const username = sanitizePathSegment(media.username)
  const identifier = sanitizePathSegment(media.identifier)
  const item = media.items[index]
  if (!item) throw new Error('The requested media item does not exist.')

  const position = media.items.length > 1 ? `_${String(index + 1).padStart(2, '0')}` : ''
  return `Petrify/${username}/${username}_${media.kind}_${identifier}${position}.${item.extension}`
}
