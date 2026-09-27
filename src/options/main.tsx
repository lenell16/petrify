import { useEffect, useState, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { isValidFolder } from '../downloadSettings'
import './style.css'

function Options() {
  const [folder, setFolder] = useState('Petrify')
  const [askWhereToSave, setAskWhereToSave] = useState(false)
  const [status, setStatus] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void chrome.storage.local.get(['downloadFolder', 'askWhereToSave']).then((settings) => {
      if (typeof settings.downloadFolder === 'string') setFolder(settings.downloadFolder)
      setAskWhereToSave(settings.askWhereToSave === true)
      setLoaded(true)
    }).catch(() => setStatus('Could not load settings. Please reload this page.'))
  }, [])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValidFolder(folder)) {
      setStatus('Enter a folder name or a relative path without empty, . or .. segments or special characters.')
      return
    }
    try {
      await chrome.storage.local.set({ downloadFolder: folder, askWhereToSave })
      setStatus('Settings saved. New downloads will use these settings.')
    } catch {
      setStatus('Could not save settings. Please try again.')
    }
  }

  return (
    <main>
      <header>
        <img src="/public/logo.png" alt="" width="48" height="48" />
        <div>
          <p className="eyebrow">PETRIFY</p>
          <h1>Download settings</h1>
        </div>
      </header>
      <section>
        <form onSubmit={(event) => { void save(event) }}>
          <label htmlFor="folder">Folder inside Downloads</label>
          <p className="hint">Media is organized by Instagram account inside this folder. Use / for nested folders.</p>
          <div className="field">
            <span>Downloads /</span>
            <input id="folder" value={folder} onChange={(event) => { setFolder(event.target.value); setStatus('') }} placeholder="Petrify" disabled={!loaded} />
          </div>
          <p className="example">Example: Downloads / {folder || 'Petrify'} / nasa / nasa_post_…jpg</p>

          <label className="checkbox">
            <input type="checkbox" checked={askWhereToSave} onChange={(event) => { setAskWhereToSave(event.target.checked); setStatus('') }} disabled={!loaded} />
            <span><strong>Choose a location for each file</strong><small>Opens Chrome’s native Save As dialog for every image or video, including each carousel item.</small></span>
          </label>

          <div className="actions">
            <button type="submit" disabled={!loaded}>Save settings</button>
            <p role="status">{status}</p>
          </div>
        </form>
      </section>
      <p className="note">Chrome’s download API cannot set a permanent folder outside Downloads for automatic downloads. To move all automatic downloads, open <strong>chrome://settings/downloads</strong> and change Chrome’s download location.</p>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Options />)
