import { account, asset, posts } from '../data.js'
import { Link } from './navigation.jsx'
import { Avatar } from './Media.jsx'

export function Profile({ reels = false }) {
  const codes = reels ? ['BC', 'BE'] : ['BA', 'BB', 'BC', 'BD', 'BE']
  return <div className="profile">
    <div className="profile-head"><Avatar /><div><h1>{account}</h1>
      <p><strong>5</strong> posts &nbsp; <strong>1,204</strong> followers</p>
      <strong>Fieldnotes Studio</strong><p>Views from orbit · NASA media in a fictional local test account</p></div></div>
    <div className="highlights"><Link className="highlight-link" href="/stories/highlights/9001/"><Avatar />Portfolio</Link>
      <Link className="highlight-link" href="/stories/fieldnotes/"><Avatar />Today</Link></div>
    <div className="tabs"><Link href="/fieldnotes/">▦ Posts</Link><Link href="/fieldnotes/reels/">▣ Reels</Link></div>
    <div className="grid">{codes.map((code) => {
      const post = posts[code]
      const first = post.items[0]
      return <Link key={code} data-grid={code} modal href={`/${account}/${post.kind === 'reel' ? 'reel' : 'p'}/${code}/`}
        route={post.kind === 'reel' ? `/p/${code}/` : `/${account}/p/${code}/`}>
        <img src={asset(first, first.file.endsWith('.mp4'))} alt={post.title} />
      </Link>
    })}</div>
  </div>
}
