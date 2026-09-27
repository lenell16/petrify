import { beforeEach, describe, expect, it, vi } from 'vitest'

const download = vi.fn(async (_options: chrome.downloads.DownloadOptions) => 1)
let listener: (message: unknown, sender: unknown, reply: (response: unknown) => void) => boolean

beforeEach(async () => {
  vi.resetModules()
  download.mockClear()
  vi.stubGlobal('chrome', {
    downloads: { download },
    runtime: { onMessage: { addListener: (callback: typeof listener) => { listener = callback } } },
  })
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ items: [{
      user: { username: 'space' },
      carousel_media: [
        { pk: '100', image_versions2: { candidates: [{ url: 'https://cdn/first.jpg' }] } },
        { pk: '200', video_versions: [{ url: 'https://cdn/middle.mp4' }] },
        { pk: '300', image_versions2: { candidates: [{ url: 'https://cdn/last.jpg' }] } },
      ],
    }] }),
  })))
  await import('./main')
})

async function send(message: unknown): Promise<unknown> {
  return new Promise((resolve) => listener(message, null, resolve))
}

describe('carousel downloads', () => {
  const url = 'https://www.instagram.com/p/BA/'

  it('inspects the item order and downloads only the selected video with its original position', async () => {
    expect(await send({ type: 'inspect-media', url })).toEqual({ ok: true, count: 3, ids: ['100', '200', '300'] })
    expect(await send({ type: 'download-current-media', url, index: 0, mediaId: '200' })).toEqual({ ok: true, count: 1 })
    expect(download).toHaveBeenCalledExactlyOnceWith({
      url: 'https://cdn/middle.mp4',
      filename: 'Petrify/space/space_post_BA_02.mp4',
      saveAs: false,
      conflictAction: 'uniquify',
    })
  })

  it('downloads all carousel items in order and rejects an invalid selection', async () => {
    expect(await send({ type: 'download-current-media', url, index: 3 })).toEqual({
      ok: false, error: 'The selected carousel item is no longer available.',
    })
    expect(download).not.toHaveBeenCalled()
    expect(await send({ type: 'download-current-media', url })).toEqual({ ok: true, count: 3 })
    expect(download.mock.calls.map(([options]) => options.filename)).toEqual([
      'Petrify/space/space_post_BA_01.jpg',
      'Petrify/space/space_post_BA_02.mp4',
      'Petrify/space/space_post_BA_03.jpg',
    ])
  })
})
