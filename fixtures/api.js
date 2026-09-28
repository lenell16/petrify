import { shortcodeToMediaId } from '../src/instagram'
import { account, apiItem, highlight, posts, stories } from './data.js'

// Instagram-shaped responses consumed by the real extension background worker.
export function fixtureResponse(url) {
  const reelId = url.searchParams.get('reel_ids')
  const reelItems = reelId === 'highlight:9001' ? highlight : reelId === '7001' ? stories : null
  if (reelItems) return { reels: { [reelId]: { user: { username: account }, items: reelItems.map(apiItem) } } }

  const id = url.pathname.match(/^\/api\/v1\/media\/(\d+)\/info\/$/)?.[1]
  const post = Object.entries(posts).find(([code]) => shortcodeToMediaId(code) === id)?.[1]
  if (post) return { items: [{ user: { username: account }, ...(post.items.length > 1
    ? { carousel_media: post.items.map(apiItem) } : apiItem(post.items[0])) }] }

  const story = [...stories, ...highlight].find((item) => item.id === id)
  return story ? { items: [{ user: { username: account }, ...apiItem(story) }] } : null
}
