import { asset, posts } from '../data.js'
import { useState } from 'react'

export function Media({ item, className = 'post-media', storyTray = false }) {
  return item.file.endsWith('.mp4')
    ? <video className={className} src={asset(item)} poster={storyTray ? asset(item, true).split('?')[0] : asset(item, true)} muted loop playsInline autoPlay />
    : <img className={className} src={asset(item)} alt="Earth and aurora photographed from space" />
}

export function Avatar() {
  return <img className="avatar" alt="fieldnotes avatar" src={asset(posts.BA.items[0])} />
}

export function Carousel({ items }) {
  const [index, setIndex] = useState(0)
  return <div className="media-frame">
    <ul className="slide-list">{items.map((item, position) =>
      <li key={item.id} hidden={position !== index}><Media item={item} /></li>)}</ul>
    {items.length > 1 && <button className="slide-next" type="button" aria-label="Next" onClick={(event) => {
      event.preventDefault()
      setIndex((current) => (current + 1) % items.length)
    }}>›</button>}
  </div>
}
