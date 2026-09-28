#!/usr/bin/env node
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadDestinations } from './destinations.mjs'
import { createCompanionServer } from './server.mjs'

const configDirectory = resolve(homedir(), '.petrify')
const configPath = resolve(configDirectory, 'companion.json')
const destinationsPath = resolve(configDirectory, 'destinations.json')
const envPath = resolve(configDirectory, '.env')
const port = 47631

async function config() {
  return JSON.parse(await readFile(configPath, 'utf8'))
}

async function running(token) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(1000),
    })
    return response.ok
  } catch { return false }
}

const [command, ...args] = process.argv.slice(2)
try {
  if (command === 'serve') {
    const settings = await config()
    const destinations = await loadDestinations(destinationsPath, envPath)
    createCompanionServer({ token: settings.token, destinations }).listen(port, '127.0.0.1')
  } else if (command === 'start') {
    const rootArg = args[0]
    if (rootArg && !isAbsolute(rootArg)) throw new Error('Use an absolute destination path')
    let previous
    try { previous = await config() } catch { /* first run */ }
    if (previous && await running(previous.token)) throw new Error('Companion is already running. Stop it before changing destinations.')
    await mkdir(configDirectory, { recursive: true, mode: 0o700 })
    const token = previous?.token ?? randomBytes(32).toString('hex')
    let destinationConfig
    try { destinationConfig = JSON.parse(await readFile(destinationsPath, 'utf8')) } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    if (!destinationConfig) {
      const root = rootArg ?? previous?.root
      if (!root) throw new Error(`Create ${destinationsPath} or run: npm run companion -- start /absolute/path`)
      destinationConfig = { destinations: [{ id: 'local', label: 'Local archive', provider: 'fs', options: { root: resolve(root) } }] }
      await writeFile(destinationsPath, JSON.stringify(destinationConfig, null, 2), { mode: 0o600 })
    } else if (rootArg && destinationConfig.destinations?.find((entry) => entry.id === 'local')?.options?.root !== resolve(rootArg)) {
      throw new Error(`Edit ${destinationsPath} to change the local destination, then restart`)
    }
    const destinations = await loadDestinations(destinationsPath, envPath)
    await writeFile(configPath, JSON.stringify({ token }), { mode: 0o600 })
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve'], {
      detached: true, stdio: 'ignore',
    })
    child.unref()
    for (let attempt = 0; attempt < 20 && !(await running(token)); attempt++) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 100))
    }
    if (!(await running(token))) throw new Error('Companion did not start. Check that port 47631 is free.')
    console.log(`Companion running on 127.0.0.1:${port}\nDestinations: ${[...destinations.keys()].join(', ')}\nPairing token: ${token}`)
  } else if (command === 'status') {
    const settings = await config()
    console.log(await running(settings.token) ? 'Running' : 'Not running')
  } else if (command === 'stop') {
    const settings = await config()
    const response = await fetch(`http://127.0.0.1:${port}/stop`, {
      method: 'POST', headers: { Authorization: `Bearer ${settings.token}` },
    })
    if (!response.ok) throw new Error('Could not stop the companion')
    console.log('Companion stopped')
  } else {
    throw new Error('Usage: npm run companion -- start /absolute/path | status | stop')
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
