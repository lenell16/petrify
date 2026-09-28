import { useEffect, useState } from 'react'

export function navigate(path, modal = false, replace = false) {
  history[replace ? 'replaceState' : 'pushState']({ modal }, '', path)
  window.dispatchEvent(new Event('fixture:navigate'))
}

export function useRoute() {
  const [route, setRoute] = useState(() => ({ path: location.pathname, query: location.search, modal: !!history.state?.modal }))
  useEffect(() => {
    const update = () => setRoute({ path: location.pathname, query: location.search, modal: !!history.state?.modal })
    window.addEventListener('popstate', update)
    window.addEventListener('fixture:navigate', update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('fixture:navigate', update)
    }
  }, [])
  return route
}

export function Link({ href, route = href, modal = false, children, ...props }) {
  return <a href={href} {...props} onClick={(event) => {
    if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(route, modal)
    window.scrollTo(0, 0)
  }}>{children}</a>
}
