import { describe, expect, it } from 'vitest'
import { mediaIdFromInstagramCdnUrl, normalizeMediaResponse, shortcodeToMediaId } from '../src/instagram'
import { account, apiItem, asset, highlight, posts, stories } from './data.js'
import { fixtureResponse } from './api.js'

describe('local Instagram fixture contract', () => {
  it('maps invented shortcodes to the post API and keeps mixed carousel order', () => {
    expect(shortcodeToMediaId('BB')).toBe('65')
    const carousel = posts.BB.items.map(apiItem)
    const resolved = normalizeMediaResponse({ items: [{ user: { username: account }, carousel_media: carousel }] },
      { kind: 'post', identifier: 'BB' })
    expect(resolved.items.map(({ id, extension }) => [id, extension])).toEqual([
      ['502', 'jpg'], ['503', 'mp4'], ['504', 'jpg'],
    ])
    expect(resolved.items[1].url).toBe('http://127.0.0.1:5174/fixtures/assets/motion.mp4?ig_cache_key=NTAz.3-fixture')
  })

  it('uses decodable media IDs and distinct story/highlight reel keys', () => {
    expect(mediaIdFromInstagramCdnUrl(asset(stories[0]))).toBe('801')
    expect(mediaIdFromInstagramCdnUrl(asset(highlight[1], true))).toBe('902')
    const response = { reels: { 'highlight:9001': { user: { username: account }, items: highlight.map(apiItem) } } }
    expect(normalizeMediaResponse(response, { kind: 'highlight', identifier: '9001' }).items.map((item) => item.id))
      .toEqual(['901', '902', '903'])
  })

  it('serves distinct local post, story, tray and highlight API payloads', () => {
    const response = (path) => fixtureResponse(new URL(path, 'http://127.0.0.1:5174'))
    expect(response('/api/v1/media/65/info/').items[0].carousel_media.map((item) => item.pk))
      .toEqual(['502', '503', '504'])
    expect(response('/api/v1/media/801/info/').items[0].pk).toBe('801')
    expect(response('/api/v1/feed/reels_media/?reel_ids=7001').reels['7001'].items.map((item) => item.pk))
      .toEqual(['801', '802', '803'])
    expect(response('/api/v1/feed/reels_media/?reel_ids=highlight%3A9001').reels['highlight:9001'].items.map((item) => item.pk))
      .toEqual(['901', '902', '903'])
    expect(response('/api/v1/media/999/info/')).toBeNull()
  })
})
