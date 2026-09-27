import { mediaIdFromInstagramCdnUrl, parseInstagramTarget } from '@/instagram'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './App.css'

type DownloadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; count: number }

type DownloadResponse =
  | { ok: true; count: number }
  | { ok: false; error: string }

type InspectResponse =
  | { ok: true; count: number; ids: (string | null)[] }
  | { ok: false; error: string }

type SaveButton = {
  key: string
  url: string
  kind: 'post' | 'reel' | 'story' | 'highlight'
  top: number
  left: number
  element: Element
  nativeSlots?: HTMLElement[]
  grid?: boolean
}

const elementIds = new WeakMap<Element, number>()
const slotContainers = new WeakMap<HTMLElement, HTMLElement>()
const extraContainers = new WeakMap<HTMLElement, HTMLElement>()
const slotBounds = new WeakMap<HTMLElement, DOMRect>()
let nextElementId = 0

function containerFor(slot: HTMLElement) {
  let container = slotContainers.get(slot)
  if (!container) {
    container = document.createElement('span')
    container.className = 'petrify-action-slot'
    slotContainers.set(slot, container)
  }
  return container
}

function extraContainerFor(slot: HTMLElement) {
  let container = extraContainers.get(slot)
  if (!container) {
    container = document.createElement('span')
    container.className = 'petrify-action-slot'
    extraContainers.set(slot, container)
  }
  return container
}

function boundsFor(slot: HTMLElement) {
  const container = slotContainers.get(slot)
  const rect = (container?.isConnected ? container : slot).getBoundingClientRect()
  if (rect.width) slotBounds.set(slot, rect)
  return rect.width ? rect : slotBounds.get(slot) ?? rect
}

function elementId(element: Element) {
  let id = elementIds.get(element)
  if (id === undefined) {
    id = nextElementId++
    elementIds.set(element, id)
  }
  return id
}

function isVisible(rect: DOMRect) {
  return rect.width >= 120
    && rect.height >= 120
    && rect.bottom > 0
    && rect.right > 0
    && rect.top < window.innerHeight
    && rect.left < window.innerWidth
}

function buttonFor(element: Element, url: string, key: string): SaveButton | null {
  const target = parseInstagramTarget(url)
  const rect = element.getBoundingClientRect()
  if (!target || !isVisible(rect)) return null

  return {
    key,
    url,
    kind: target.kind === 'story-tray' ? 'story' : target.kind,
    top: Math.max(8, rect.top + 10),
    left: Math.max(8, Math.min(window.innerWidth - 44, rect.left + 10)),
    element,
  }
}

function actionSlots(scope: ParentNode, labels: string[], near?: DOMRect): HTMLElement[] {
  return labels.flatMap((label) => {
    const control = Array.from(scope.querySelectorAll<HTMLElement>(`svg[aria-label="${label}"], button[aria-label="${label}"]`))
      .map((icon) => {
        const clickable = icon.closest<HTMLElement>('[role="button"], button')
        let parent = clickable ?? icon.parentElement
        if (!clickable) {
          while (parent && boundsFor(parent).width < 36) parent = parent.parentElement
        }
        return parent
      })
      .find((parent) => {
        if (!parent) return false
        for (let ancestor = parent.parentElement; ancestor; ancestor = ancestor.parentElement) {
          if (getComputedStyle(ancestor).display === 'none') return false
        }
        const rect = boundsFor(parent)
        if (!near) return rect.width > 0
        return rect.left >= near.left - 80 && rect.right <= near.right + 100
          && rect.top >= near.top && rect.top <= near.bottom + 80
      })
    return control ? [control] : []
  })
}

function postActionRow(scope: ParentNode) {
  return Array.from(scope.querySelectorAll('svg[aria-label="Share"], svg[aria-label="Share Post"]'))
    .map((icon) => icon.closest('section'))
    .find((section) => section && section.getBoundingClientRect().height > 0
      && section.getBoundingClientRect().height <= 80)
}

function postActionSlots(row: HTMLElement) {
  return actionSlots(row, ['Repost', row.querySelector('svg[aria-label="Share"]') ? 'Share' : 'Share Post'])
}

function placeInActions(button: SaveButton, slots: HTMLElement[]) {
  if (!slots.length) return
  slots.forEach(boundsFor)
  const rect = boundsFor(slots[0])
  if (rect.width === 0) return
  button.nativeSlots = slots
  button.top = rect.top
  button.left = rect.left
}

function storyUrlFromMedia(media: HTMLElement): string | null {
  const pageUrl = new URL(window.location.href)
  const segments = pageUrl.pathname.split('/').filter(Boolean)
  if (segments[0] !== 'stories' || !segments[1] || segments[2]) return null

  const source = media instanceof HTMLImageElement
    ? media.currentSrc
    : media instanceof HTMLVideoElement
      ? media.poster
      : ''
  const mediaId = mediaIdFromInstagramCdnUrl(source)
  if (mediaId) {
    pageUrl.pathname = `/stories/${segments[1]}/${mediaId}/`
    return pageUrl.href
  }

  const escapedUsername = segments[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const userMatch = document.documentElement.innerHTML.match(
    new RegExp(`"(?:pk|id)":"(\\d+)".{0,200}"username":"${escapedUsername}"`),
  )
  if (!userMatch?.[1]) return null

  pageUrl.searchParams.set('petrify_reel_id', userMatch[1])
  const mediaRect = media.getBoundingClientRect()
  const progress = Array.from(document.querySelectorAll<HTMLElement>('div')).find((element) => {
    const rect = element.getBoundingClientRect()
    const bars = Array.from(element.children)
    return rect.top >= mediaRect.top
      && rect.top < mediaRect.top + 40
      && rect.width > mediaRect.width * 0.6
      && bars.length > 1
      && bars.every((bar) => bar.getBoundingClientRect().height <= 4)
  })
  if (progress) {
    let currentIndex = -1
    Array.from(progress.children).forEach((bar, index) => {
      if (bar.firstElementChild) currentIndex = index
    })
    if (currentIndex >= 0) pageUrl.searchParams.set('petrify_story_index', String(currentIndex))
  }
  return pageUrl.href
}

function findSaveButtons(): SaveButton[] {
  const buttons: SaveButton[] = []

  document.querySelectorAll<HTMLElement>('article').forEach((article) => {
    const link = Array.from(article.querySelectorAll<HTMLAnchorElement>('a[href]')).find((candidate) => {
      const target = parseInstagramTarget(candidate.href)
      return target?.kind === 'post' || target?.kind === 'reel'
    })
    if (!link) return

    const visibleArea = (element: Element) => {
      const rect = element.getBoundingClientRect()
      return Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0))
        * Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))
    }
    const media = Array.from(article.querySelectorAll<HTMLElement>('img, video'))
      .filter((element) => isVisible(element.getBoundingClientRect()))
      .sort((a, b) => visibleArea(b) - visibleArea(a))[0]
    if (!media) return

    const button = buttonFor(media, link.href, `feed-${elementId(article)}`)
    if (button) {
      const row = postActionRow(article)
      if (row) placeInActions(button, postActionSlots(row))
      if (button.nativeSlots) buttons.push(button)
    }
  })

  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
    const target = parseInstagramTarget(link.href)
    if (!target || target.kind === 'story') return
    if (link.closest('article')) return
    if (window.location.pathname === '/' || window.location.pathname.startsWith('/reels/')) return
    const media = link.querySelector('img, video')
    const rect = link.getBoundingClientRect()
    if (!media || rect.width / rect.height < 0.7 || rect.width / rect.height > 1.4) return

    const button = buttonFor(link, link.href, `link-${elementId(link)}`)
    if (button) {
      button.grid = true
      buttons.push(button)
    }
  })

  const media = Array.from(document.querySelectorAll<HTMLElement>('img, video'))
    .filter((element) => isVisible(element.getBoundingClientRect()))
    .sort((a, b) => {
      const aRect = a.getBoundingClientRect()
      const bRect = b.getBoundingClientRect()
      return bRect.width * bRect.height - aRect.width * aRect.height
    })[0]

  const currentUrl = parseInstagramTarget(window.location.href)
    ? window.location.href
    : media && storyUrlFromMedia(media)
  const currentTarget = currentUrl ? parseInstagramTarget(currentUrl) : null
  if (!currentUrl || !currentTarget) return buttons

  const hasCurrentLink = buttons.some(({ url }) => {
    const target = parseInstagramTarget(url)
    const sameKind = target?.kind === currentTarget.kind
      || (target?.kind === 'post' || target?.kind === 'reel')
        && (currentTarget.kind === 'post' || currentTarget.kind === 'reel')
    return sameKind && target?.identifier === currentTarget.identifier
  })
  if (hasCurrentLink) return buttons

  if (media) {
    const button = buttonFor(media, currentUrl, `current-${currentTarget.kind}-${currentTarget.identifier}`)
    if (button) {
      if (currentTarget.kind === 'post') {
        const row = postActionRow(document)
        if (row) placeInActions(button, postActionSlots(row))
      } else if (currentTarget.kind === 'reel') {
        placeInActions(button, actionSlots(document, ['Repost', 'Share'], media.getBoundingClientRect()))
      } else {
        placeInActions(button, actionSlots(document, ['Like', 'Direct'], media.getBoundingClientRect()))
      }
      if (button.nativeSlots) buttons.push(button)
    }
  }

  return buttons
}

function App() {
  const [buttons, setButtons] = useState<SaveButton[]>([])
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({})
  const [inspected, setInspected] = useState<Record<string, InspectResponse>>({})
  const pending = useRef(new Set<string>())
  const [error, setError] = useState<string | null>(null)
  const scanFrame = useRef<number | null>(null)
  const replacements = useRef(new Map<HTMLElement, { container: HTMLElement; display: string }>())
  const hiddenCounts = useRef(new Map<HTMLElement, string>())

  const scan = useCallback(() => {
    if (scanFrame.current !== null) return
    scanFrame.current = window.requestAnimationFrame(() => {
      scanFrame.current = null
      setButtons(findSaveButtons())
    })
  }, [])

  useEffect(() => {
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setInterval(scan, 1000)
    window.addEventListener('resize', scan)
    window.addEventListener('scroll', scan, true)
    window.addEventListener('pointerover', scan)
    window.addEventListener('pointerout', scan)

    return () => {
      observer.disconnect()
      window.clearInterval(timer)
      window.removeEventListener('resize', scan)
      window.removeEventListener('scroll', scan, true)
      window.removeEventListener('pointerover', scan)
      window.removeEventListener('pointerout', scan)
      if (scanFrame.current !== null) {
        window.cancelAnimationFrame(scanFrame.current)
        scanFrame.current = null
      }
    }
  }, [scan])

  useEffect(() => {
    buttons.forEach((button) => {
      if (button.kind === 'story') return
      if (inspected[button.url] || pending.current.has(button.url)) return
      pending.current.add(button.url)
      void chrome.runtime.sendMessage({ type: 'inspect-media', url: button.url })
        .then((response: InspectResponse) => setInspected((current) => ({ ...current, [button.url]: response })))
        .catch(() => setInspected((current) => ({
          ...current,
          [button.url]: { ok: false, error: 'Could not inspect this post.' },
        })))
    })
  }, [buttons, inspected])

  useLayoutEffect(() => {
    const slots = new Set(buttons.flatMap((button) => button.nativeSlots ?? []))
    const counts = new Set<HTMLElement>()
    buttons.forEach((button) => {
      if (!button.nativeSlots || (button.kind !== 'post' && button.kind !== 'reel')) return
      const count = button.nativeSlots[0].nextElementSibling
      if (count instanceof HTMLElement && /^\d[\d,.KM]*$/.test(count.textContent?.trim() ?? '')) counts.add(count)
    })

    replacements.current.forEach(({ container, display }, slot) => {
      if (slots.has(slot)) return
      slot.style.display = display
      container.remove()
      extraContainers.get(slot)?.remove()
      replacements.current.delete(slot)
    })
    slots.forEach((slot) => {
      let replacement = replacements.current.get(slot)
      if (!replacement) {
        const container = containerFor(slot)
        slot.parentElement?.insertBefore(container, slot)
        replacement = { container, display: slot.style.display }
        replacements.current.set(slot, replacement)
        slot.style.display = 'none'
      }
      const button = buttons.find((item) => item.nativeSlots?.includes(slot))!
      const inspection = inspected[button.url]
      const carousel = inspection?.ok && inspection.count > 1
      replacement.container.style.display = button.nativeSlots?.[1] === slot
        && !carousel ? 'none' : ''
      const extra = extraContainers.get(slot)
      if (button.nativeSlots?.length === 1 && carousel) {
        const second = extraContainerFor(slot)
        if (replacement.container.nextElementSibling !== second) replacement.container.after(second)
      } else {
        extra?.remove()
      }
    })

    hiddenCounts.current.forEach((display, count) => {
      if (counts.has(count)) return
      count.style.display = display
      hiddenCounts.current.delete(count)
    })
    counts.forEach((count) => {
      if (hiddenCounts.current.has(count)) return
      hiddenCounts.current.set(count, count.style.display)
      count.style.display = 'none'
    })
  }, [buttons, inspected])

  useEffect(() => () => {
    replacements.current.forEach(({ container, display }, slot) => {
      slot.style.display = display
      container.remove()
      extraContainers.get(slot)?.remove()
    })
    hiddenCounts.current.forEach((display, count) => { count.style.display = display })
    replacements.current.clear()
    hiddenCounts.current.clear()
  }, [])

  const startDownload = async (button: SaveButton, mode: 'one' | 'all', ids?: (string | null)[]) => {
    const key = `${button.key}-${mode}`
    if (downloads[key]?.status === 'loading') return
    const visibleMedia = Array.from(button.element.querySelectorAll<HTMLImageElement | HTMLVideoElement>('img, video'))
    if (button.element instanceof HTMLImageElement || button.element instanceof HTMLVideoElement) {
      visibleMedia.push(button.element)
    }
    visibleMedia.sort((a, b) => {
      const overlap = (element: Element) => {
        const rect = element.getBoundingClientRect()
        const frame = button.element.getBoundingClientRect()
        return Math.max(0, Math.min(rect.right, frame.right, window.innerWidth) - Math.max(rect.left, frame.left, 0))
          * Math.max(0, Math.min(rect.bottom, frame.bottom, window.innerHeight) - Math.max(rect.top, frame.top, 0))
      }
      return overlap(b) - overlap(a)
    })
    const activeMedia = visibleMedia[0]
    const mediaId = activeMedia && mediaIdFromInstagramCdnUrl(
      activeMedia instanceof HTMLImageElement ? activeMedia.currentSrc : activeMedia.poster,
    )
    const matchedId = mediaId && ids?.includes(mediaId) ? mediaId : null
    const slide = activeMedia?.closest('li')
    const slides = slide?.parentElement?.querySelectorAll(':scope > li')
    let index = matchedId ? ids?.indexOf(matchedId) : slides && slides.length === ids?.length && slide
      ? Array.from(slides).indexOf(slide)
      : undefined
    if (index === undefined && button.kind === 'highlight' && ids && activeMedia) {
      const mediaRect = activeMedia.getBoundingClientRect()
      const progress = Array.from(document.querySelectorAll<HTMLElement>('div')).find((element) => {
        const rect = element.getBoundingClientRect()
        return rect.top >= mediaRect.top && rect.top < mediaRect.top + 40
          && rect.width > mediaRect.width * 0.6
          && element.children.length === ids.length
          && Array.from(element.children).every((bar) => bar.getBoundingClientRect().height <= 4)
      })
      if (progress) {
        let current = -1
        Array.from(progress.children).forEach((bar, position) => {
          if (bar.firstElementChild) current = position
        })
        if (current >= 0) index = current
      }
    }
    if (mode === 'one' && index === undefined) {
      setError('Could not identify the current carousel item. Try opening the post or use Save all.')
      return
    }
    setError(null)
    setDownloads((current) => ({ ...current, [key]: { status: 'loading' } }))

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'download-current-media',
        url: button.url,
        ...(mode === 'one' ? { index, ...(matchedId ? { mediaId: matchedId } : {}) } : {}),
      }) as DownloadResponse

      if (response.ok) {
        setDownloads((current) => ({
          ...current,
          [key]: { status: 'success', count: response.count },
        }))
        window.setTimeout(() => {
          setDownloads((current) => ({ ...current, [key]: { status: 'idle' } }))
        }, 2000)
      } else {
        setDownloads((current) => ({ ...current, [key]: { status: 'idle' } }))
        setError(response.error)
      }
    } catch {
      setDownloads((current) => ({ ...current, [key]: { status: 'idle' } }))
      setError('Petrify could not reach the extension background service.')
    }
  }

  return (
    <div className="petrify-overlay">
      {buttons.map((button) => {
        const inspection = inspected[button.url]
        const carousel = inspection?.ok && inspection.count > 1
        return (carousel ? ['one', 'all'] as const : ['all'] as const).map((mode, position) => {
          const native = button.nativeSlots
          const download = downloads[`${button.key}-${mode}`] ?? { status: 'idle' }
          const label = download.status === 'loading'
            ? `Saving ${mode === 'one' ? 'this item' : 'all items'}`
            : download.status === 'success'
              ? `Saved ${download.count} media ${download.count === 1 ? 'item' : 'items'}`
              : carousel ? mode === 'one' ? 'Save current image or video' : 'Save all carousel items'
                : `Save this Instagram ${button.kind}`

          const control = (
            <button
              key={`${button.key}-${mode}`}
              className={[
                'petrify-save', `petrify-save--${download.status}`,
                native && 'petrify-save--native',
                native && (button.kind === 'story' || button.kind === 'highlight') && 'petrify-save--story',
                button.grid && 'petrify-save--grid',
                button.grid && button.element.matches(':hover') && 'petrify-save--grid-active',
              ].filter(Boolean).join(' ')}
              style={native ? undefined : {
                top: button.top,
                left: Math.min(window.innerWidth - (carousel ? 84 : 42), button.left) + position * 42,
              }}
              type="button"
              disabled={download.status === 'loading'}
              onClick={(event) => {
                event.stopPropagation()
                void startDownload(button, mode, inspection?.ok ? inspection.ids : undefined)
              }}
              aria-label={label}
              title={label}
            >
              {download.status === 'success' ? (
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              ) : mode === 'all' && carousel ? (
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M4 5h16M4 9h16M12 11v9m0 0 4-4m-4 4-4-4" />
                </svg>
              ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" />
                </svg>
              )}
            </button>
          )
          return native ? createPortal(control, native[position]
            ? containerFor(native[position]) : extraContainerFor(native[0])) : control
        })
      })}

      {error && (
        <div className="petrify-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">×</button>
        </div>
      )}
    </div>
  )
}

export default App
