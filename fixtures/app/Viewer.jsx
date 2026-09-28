import { account, highlight, stories } from '../data.js'
import { Action } from './Actions.jsx'
import { Media } from './Media.jsx'
import { navigate } from './navigation.jsx'

export function Viewer({ highlightMode = false, query = '', path }) {
  const items = highlightMode ? highlight : stories
  const params = new URLSearchParams(query)
  const selected = highlightMode ? Number(params.get('slide') ?? 0)
    : Number(params.get('item') ?? Math.max(0, items.findIndex((item) => path.endsWith(`/${item.id}/`))))
  const index = selected >= 0 && selected < items.length ? selected : 0
  const item = items[index]
  const advance = (delta) => {
    const next = (index + delta + items.length) % items.length
    navigate(highlightMode ? `/stories/highlights/9001/?slide=${next}`
      : next === 1 ? `/stories/${account}/?item=1` : `/stories/${account}/${items[next].id}/`)
  }
  return <div className="viewer">
    <button type="button" aria-label="Previous" onClick={() => advance(-1)}>‹</button>
    <div className="story">
      <div className="progress">{items.map((bar, position) => <div key={bar.id}>{position === index && <span />}</div>)}</div>
      <Media item={item} className="story-media" storyTray={!highlightMode} />
      <strong className="story-name">{account} · {highlightMode ? 'Portfolio' : 'Today'}</strong>
      <div className="story-footer"><input aria-label={`Reply to ${account}`} placeholder={`Reply to ${account}…`} />
        <Action label="Like" /><Action label="Direct" /></div>
    </div>
    <button type="button" aria-label="Next" onClick={() => advance(1)}>›</button>
    <script type="application/json">{'{"pk":"7001","username":"fieldnotes"}'}</script>
  </div>
}
