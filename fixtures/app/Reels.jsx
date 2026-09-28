import { posts } from '../data.js'
import { useEffect, useRef, useState } from 'react'
import { Action } from './Actions.jsx'
import { Media } from './Media.jsx'
import { navigate } from './navigation.jsx'

function Reel({ code, active }) {
  return <div className="reel-card" data-reel={code}>
    {active ? <><Media item={posts[code].items[0]} />
      <div className="rail"><Action label="Like" /><Action label="Comment" />
        <Action label="Repost" /><Action label="Share" /></div></>
      : <div className="reel-placeholder" aria-hidden="true" />}
  </div>
}

export function Reels({ feed = false, code = 'BC' }) {
  const container = useRef(null)
  const [active, setActive] = useState(code)
  useEffect(() => {
    if (!feed) return
    if (location.pathname === '/reels/') navigate('/reels/BC/', false, true)
    if (code === 'BE') container.current.querySelector('[data-reel="BE"]').scrollIntoView()
    const onScroll = () => {
      const cards = [...container.current.querySelectorAll('.reel-card')]
      const active = cards.sort((a, b) => {
        const visible = (card) => {
          const rect = card.getBoundingClientRect()
          return Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top))
        }
        return visible(b) - visible(a)
      })[0]
      if (active && location.pathname !== `/reels/${active.dataset.reel}/`) {
        setActive(active.dataset.reel)
        navigate(`/reels/${active.dataset.reel}/`, false, true)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [feed])
  return <div className="reels" ref={container}>
    {(feed ? ['BC', 'BE'] : [code]).map((key) => <Reel key={key} code={key} active={key === active} />)}
  </div>
}
