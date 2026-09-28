import { account, posts } from '../data.js'
import { Link, navigate } from './navigation.jsx'
import { Avatar, Carousel } from './Media.jsx'
import { Actions } from './Actions.jsx'

export function FeedPost({ code }) {
  const post = posts[code]
  const url = `/${post.kind === 'reel' ? 'reel' : 'p'}/${code}/`
  return <article data-code={code}>
    <header><Avatar /><Link href="/fieldnotes/">{account}</Link> · <span className="dim">fixture</span></header>
    <Link href={url}><Carousel items={post.items} /></Link>
    <Actions /><p className="caption"><strong>{account}</strong> {post.title}</p>
    <span className="dim">View all 2 comments</span>
  </article>
}

export function PostDetail({ code, modal = false }) {
  const post = posts[code]
  if (!post) return <p>Unknown fixture post.</p>
  const body = <>
    {modal && <Link className="modal-permalink" hidden href={`/${account}/${post.kind === 'reel' ? 'reel' : 'p'}/${code}/`}>Permalink</Link>}
    <Carousel items={post.items} />
    <div className="detail-side"><header><Avatar /> {account}</header>
      <p className="caption">{post.title}<br /><span className="dim">NASA imagery · bundled locally for testing.</span></p>
      <Actions modal={modal} /><p className="dim">2 comments · mock content</p>
    </div>
  </>
  if (!modal) return <div className="detail">{body}</div>
  return <div className="modal-backdrop" onClick={(event) => {
    if (event.target === event.currentTarget) navigate('/fieldnotes/')
  }}>
    <button className="modal-close" type="button" aria-label="Close" onClick={() => navigate('/fieldnotes/')}>×</button>
    <div className="modal"><article className="modal-content" data-code={code}>{body}</article></div>
  </div>
}
