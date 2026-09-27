import { describe, expect, it } from 'vitest'
import {
  downloadFilename,
  normalizeMediaResponse,
  parseInstagramTarget,
  shortcodeToMediaId,
} from './instagram'

describe('parseInstagramTarget', () => {
  it('parses supported post, reel, and story routes', () => {
    expect(parseInstagramTarget('https://www.instagram.com/p/ABC_12-/')).toEqual({
      kind: 'post',
      identifier: 'ABC_12-',
    })
    expect(parseInstagramTarget('https://instagram.com/reel/Cr8xyZ/?utm_source=x')).toEqual({
      kind: 'reel',
      identifier: 'Cr8xyZ',
    })
    expect(parseInstagramTarget('https://www.instagram.com/stories/nasa/35123456789012345/')).toEqual({
      kind: 'story',
      identifier: '35123456789012345',
      username: 'nasa',
    })
  })

  it('rejects lookalike hosts and non-specific story routes', () => {
    expect(parseInstagramTarget('https://instagram.example/p/ABC/')).toBeNull()
    expect(parseInstagramTarget('https://www.instagram.com/stories/nasa/')).toBeNull()
  })
})

describe('shortcodeToMediaId', () => {
  it('decodes Instagram base64 identifiers without losing integer precision', () => {
    expect(shortcodeToMediaId('B')).toBe('1')
    expect(shortcodeToMediaId('BA')).toBe('64')
    expect(shortcodeToMediaId('___________')).toBe('73786976294838206463')
  })
})

describe('normalizeMediaResponse', () => {
  it('normalizes a mixed carousel and chooses the largest renditions', () => {
    const resolved = normalizeMediaResponse({
      items: [{
        user: { username: 'space account' },
        carousel_media: [
          {
            image_versions2: {
              candidates: [
                { width: 320, height: 320, url: 'https://cdn/small.jpg' },
                { width: 1080, height: 1080, url: 'https://cdn/large.jpg' },
              ],
            },
          },
          {
            video_versions: [
              { width: 480, height: 854, url: 'https://cdn/small.mp4' },
              { width: 1080, height: 1920, url: 'https://cdn/large.mp4' },
            ],
          },
        ],
      }],
    }, { kind: 'post', identifier: 'Post:42' })

    expect(resolved.items).toEqual([
      { extension: 'jpg', url: 'https://cdn/large.jpg' },
      { extension: 'mp4', url: 'https://cdn/large.mp4' },
    ])
    expect(downloadFilename(resolved, 0)).toBe('Petrify/space_account/space_account_post_Post_42_01.jpg')
    expect(downloadFilename(resolved, 1)).toBe('Petrify/space_account/space_account_post_Post_42_02.mp4')
  })

  it('uses the story URL username when the media object omits its owner', () => {
    const resolved = normalizeMediaResponse({
      items: [{
        image_versions2: { candidates: [{ width: 100, height: 200, url: 'https://cdn/story.jpg' }] },
      }],
    }, { kind: 'story', identifier: '123456', username: 'nasa' })

    expect(downloadFilename(resolved, 0)).toBe('Petrify/nasa/nasa_story_123456.jpg')
  })
})
