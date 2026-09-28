import { account } from '../data.js'
import { Link, useRoute } from './navigation.jsx'
import { Avatar } from './Media.jsx'
import { FeedPost, PostDetail } from './Post.jsx'
import { Profile } from './Profile.jsx'
import { Reels } from './Reels.jsx'
import { Viewer } from './Viewer.jsx'

function Sidebar() {
  return <nav className="sidebar" aria-label="Main navigation">
    <Link className="brand" href="/">◎ <span>Instagram</span></Link>
    <Link href="/">⌂ <span>Home</span></Link>
    <Link href="/reels/">▣ <span>Reels</span></Link>
    <Link href="/fieldnotes/">◉ <span>Profile</span></Link>
    <Link href="/stories/fieldnotes/">◌ <span>Stories</span></Link>
    <Link href="/stories/highlights/9001/">✧ <span>Highlights</span></Link>
    <p>Local fixture · no login</p>
  </nav>
}

function Feed() {
  return <div className="feed">
    <div className="tray"><Link href={`/stories/${account}/`}><Avatar />{account}</Link>
      <Link href="/stories/highlights/9001/"><Avatar />Highlights</Link></div>
    {['BA', 'BB', 'BD', 'BC'].map((code) => <FeedPost key={code} code={code} />)}
  </div>
}

export default function App() {
  const { path, query, modal } = useRoute()
  const code = path.match(/\/(?:p|reel)\/(BA|BB|BC|BD|BE)\//)?.[1]
  let page
  if (path === '/') page = <Feed />
  else if (path === '/fieldnotes/' || path === '/fieldnotes/reels/') page = <Profile reels={path.includes('reels')} />
  else if (path.startsWith('/stories/')) page = <Viewer path={path} query={query} highlightMode={path.includes('/highlights/')} />
  else if (path.startsWith('/reels/')) page = <Reels feed code={path.includes('/BE/') ? 'BE' : 'BC'} />
  else if ((path.startsWith('/reel/') || path.startsWith('/fieldnotes/reel/')) && code && !modal) page = <Reels code={code} />
  else if (code) page = modal ? <><Profile /><PostDetail code={code} modal /></> : <PostDetail code={code} />
  else page = <p>Unknown fixture route.</p>

  return <><Sidebar /><main className={path.startsWith('/stories/') ? 'story-page' : ''}>{page}</main></>
}
