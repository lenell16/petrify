import { useEffect, useState, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { isValidFolder } from '../downloadSettings'
import './style.css'

type CompanionDestination = { id: string; label: string; providerName: string }

function Options() {
  const [folder, setFolder] = useState('Petrify')
  const [askWhereToSave, setAskWhereToSave] = useState(false)
  const [destination, setDestination] = useState('downloads')
  const [companionToken, setCompanionToken] = useState('')
  const [companionDestination, setCompanionDestination] = useState('')
  const [destinations, setDestinations] = useState<CompanionDestination[]>([])
  const [connection, setConnection] = useState('')
  const [status, setStatus] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void chrome.storage.local.get(['downloadFolder', 'askWhereToSave', 'destination', 'companionToken', 'companionDestination']).then((settings) => {
      if (typeof settings.downloadFolder === 'string') setFolder(settings.downloadFolder)
      setAskWhereToSave(settings.askWhereToSave === true)
      if (settings.destination === 'companion') setDestination('companion')
      if (typeof settings.companionToken === 'string') setCompanionToken(settings.companionToken)
      if (typeof settings.companionDestination === 'string') setCompanionDestination(settings.companionDestination)
      setLoaded(true)
    }).catch(() => setStatus('Could not load settings. Please reload this page.'))
  }, [])

  useEffect(() => {
    if (destination !== 'companion' || !/^[a-f0-9]{64}$/.test(companionToken.trim())) return
    let active = true
    void fetch('http://127.0.0.1:47631/destinations', {
      headers: { Authorization: `Bearer ${companionToken.trim()}` },
    }).then(async (response) => {
      if (!response.ok) throw new Error('Could not connect to the companion. Check the pairing token.')
      return response.json() as Promise<CompanionDestination[]>
    }).then((items) => {
      if (!active) return
      setDestinations(items)
      setCompanionDestination((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? '')
      setConnection(items.length ? '' : 'No destinations are configured in the companion.')
    }).catch(() => {
      if (active) { setDestinations([]); setConnection('Start the companion on this computer and check the pairing token.') }
    })
    return () => { active = false }
  }, [destination, companionToken])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValidFolder(folder)) {
      setStatus('Enter a folder name or a relative path without empty, . or .. segments or special characters.')
      return
    }
    if (destination === 'companion' && !/^[a-f0-9]{64}$/.test(companionToken.trim())) {
      setStatus('Enter the 64-character pairing token printed by the companion CLI.')
      return
    }
    if (destination === 'companion' && !destinations.some((item) => item.id === companionDestination)) {
      setStatus('Connect to the companion and choose a destination first.')
      return
    }
    try {
      await chrome.storage.local.set({ downloadFolder: folder, askWhereToSave, destination, companionToken: companionToken.trim(), companionDestination })
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
          <label htmlFor="destination">Save to</label>
          <p className="hint">Use Chrome Downloads or a local companion running on this computer.</p>
          <select id="destination" value={destination} onChange={(event) => { setDestination(event.target.value); setStatus('') }} disabled={!loaded}>
            <option value="downloads">Chrome Downloads</option>
            <option value="companion">Companion (any local folder)</option>
          </select>

          {destination === 'companion' && <>
            <label htmlFor="token">Companion pairing token</label>
            <p className="hint">Run <code>npm run companion -- start /absolute/path</code> on this computer and paste its token here.</p>
            <input className="token" id="token" type="password" autoComplete="off" value={companionToken} onChange={(event) => { setCompanionToken(event.target.value); setStatus('') }} disabled={!loaded} />
            <label htmlFor="companion-destination">Companion destination</label>
            <p className="hint">Destinations are configured on the companion, never in this extension.</p>
            <select id="companion-destination" value={companionDestination} onChange={(event) => { setCompanionDestination(event.target.value); setStatus('') }} disabled={!loaded || !destinations.length}>
              {!destinations.length && <option value="">No destinations available</option>}
              {destinations.map((item) => <option key={item.id} value={item.id}>{item.label} ({item.providerName})</option>)}
            </select>
            {connection && <p className="hint" role="status">{connection}</p>}
          </>}

          <label htmlFor="folder">Folder inside {destination === 'companion' ? 'the companion destination' : 'Downloads'}</label>
          <p className="hint">Media is organized by Instagram account inside this folder. Use / for nested folders.</p>
          <div className="field">
            <span>{destination === 'companion' ? 'Destination /' : 'Downloads /'}</span>
            <input id="folder" value={folder} onChange={(event) => { setFolder(event.target.value); setStatus('') }} placeholder="Petrify" disabled={!loaded} />
          </div>
          <p className="example">Example: {destination === 'companion' ? 'Destination' : 'Downloads'} / {folder || 'Petrify'} / nasa / nasa_post_…jpg</p>

          {destination === 'downloads' && <label className="checkbox">
            <input type="checkbox" checked={askWhereToSave} onChange={(event) => { setAskWhereToSave(event.target.checked); setStatus('') }} disabled={!loaded} />
            <span><strong>Choose a location for each file</strong><small>Opens Chrome’s native Save As dialog for every image or video, including each carousel item.</small></span>
          </label>}

          <div className="actions">
            <button type="submit" disabled={!loaded}>Save settings</button>
            <p role="status">{status}</p>
          </div>
        </form>
      </section>
      <p className="note">Chrome Downloads is limited to its Downloads directory. The optional companion runs on the same computer as Chrome; configure local or cloud destinations in its configuration file.</p>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Options />)
