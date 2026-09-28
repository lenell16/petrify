// Invented account and IDs; media is bundled locally. Sources: fixtures/assets/README.md.
export const account = 'fieldnotes'
export const origin = 'http://127.0.0.1:5174'
export const posts = {
  BA: { title: 'Looking down at home from orbit. A little perspective for today. 🌍', kind: 'post', items: [{ id: '501', file: 'iss045e013851.jpg' }] },
  BB: { title: 'The sky never holds still. Swipe through three views of the aurora.', kind: 'post', items: [
    { id: '502', file: 'S39-23-020.jpg' }, { id: '503', file: 'motion.mp4', poster: 'S39-23-036.jpg' },
    { id: '504', file: 'S39-23-036.jpg' },
  ] },
  BC: { title: 'A short journey through the southern lights. ✨', kind: 'reel', items: [{ id: '505', file: 'motion.mp4', poster: 'S39-23-036.jpg' }] },
  BD: { title: 'Aurora from the station window. The colors feel unreal.', kind: 'post', items: [{ id: '506', file: 'iss072e083078.jpg' }] },
  BE: { title: 'One more look at the blue planet.', kind: 'reel', items: [{ id: '507', file: 'earth.mp4', poster: '0300804.jpg' }] },
}
export const stories = [
  { id: '801', file: '0300804.jpg' },
  { id: '802', file: 'motion.mp4', poster: 'S39-23-036.jpg' },
  { id: '803', file: 'iss072e083078.jpg' },
]
export const highlight = [
  { id: '901', file: 'iss045e013851.jpg' },
  { id: '902', file: 'motion.mp4', poster: 'S39-23-036.jpg' },
  { id: '903', file: 'S39-23-020.jpg' },
]

export function asset(item, poster = false) {
  const file = poster ? item.poster ?? item.file : item.file
  return `${origin}/fixtures/assets/${file}?ig_cache_key=${encodeURIComponent(btoa(item.id) + '.3-fixture')}`
}

export function apiItem(item) {
  return {
    pk: item.id,
    ...(item.file.endsWith('.mp4')
      ? { video_versions: [{ width: 640, height: 960, url: asset(item) }] }
      : { image_versions2: { candidates: [{ width: 640, height: 960, url: asset(item) }] } }),
  }
}
