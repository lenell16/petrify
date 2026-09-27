import { parseInstagramTarget } from '@/instagram'
import { useEffect, useState } from 'react'
import './App.css'

type DownloadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; count: number }
  | { status: 'error'; message: string }

type DownloadResponse =
  | { ok: true; count: number }
  | { ok: false; error: string }

function App() {
  const [currentUrl, setCurrentUrl] = useState(window.location.href)
  const [download, setDownload] = useState<DownloadState>({ status: 'idle' })
  const target = parseInstagramTarget(currentUrl)

  useEffect(() => {
    const updateUrl = () => setCurrentUrl((previous) => previous === window.location.href ? previous : window.location.href)
    const timer = window.setInterval(updateUrl, 500)
    window.addEventListener('popstate', updateUrl)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('popstate', updateUrl)
    }
  }, [])

  useEffect(() => {
    setDownload({ status: 'idle' })
  }, [currentUrl])

  if (!target) return null

  const startDownload = async () => {
    if (download.status === 'loading') return
    setDownload({ status: 'loading' })

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'download-current-media',
        url: window.location.href,
      }) as DownloadResponse

      if (response.ok) {
        setDownload({ status: 'success', count: response.count })
        window.setTimeout(() => setDownload({ status: 'idle' }), 2500)
      } else {
        setDownload({ status: 'error', message: response.error })
      }
    } catch {
      setDownload({ status: 'error', message: 'Petrify could not reach the extension background service.' })
    }
  }

  const label = download.status === 'loading'
    ? 'Saving…'
    : download.status === 'success'
      ? `Saved ${download.count}`
      : 'Save media'

  return (
    <div className="petrify-download">
      {download.status === 'error' && (
        <div className="petrify-error" role="alert">
          <span>{download.message}</span>
          <button type="button" onClick={() => setDownload({ status: 'idle' })} aria-label="Dismiss error">×</button>
        </div>
      )}
      <button
        className={`petrify-button petrify-button--${download.status}`}
        type="button"
        disabled={download.status === 'loading'}
        onClick={startDownload}
        aria-label={`Save this Instagram ${target.kind}`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" />
        </svg>
        <span>{label}</span>
      </button>
    </div>
  )
}

export default App
