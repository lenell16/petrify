const paths = {
  Like: 'M12 21 3 12C-1 6 7 1 12 7c5-6 13-1 9 5z',
  Comment: 'M3 4h18v13H8l-5 4z',
  Repost: 'M4 9V5h14l3 4M20 15v4H6l-3-4',
  Share: 'M3 12 21 3l-5 18-4-8z',
  Direct: 'M3 12 21 3l-5 18-4-8z',
}

export function Action({ label }) {
  return <button type="button" aria-label={label}>
    <svg aria-label={label} viewBox="0 0 24 24"><path d={paths[label === 'Share Post' ? 'Share' : label]} /></svg>
  </button>
}

export function Actions({ modal = false }) {
  return <section className="action-row" aria-label="Post actions">
    <Action label="Like" /><Action label="Comment" /><span className="count">2</span>
    <Action label="Repost" /><span className="count">12</span><Action label={modal ? 'Share Post' : 'Share'} />
  </section>
}
