import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadFiles } from 'files-sdk/loader'
import { createCompanionServer } from './server.mjs'

let root
let secondRoot
let server
let url
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'petrify-server-'))
  secondRoot = await mkdtemp(join(tmpdir(), 'petrify-second-'))
  const local = (await loadFiles({ provider: 'fs', root })).files
  const alternate = (await loadFiles({ provider: 'fs', root: secondRoot })).files
  server = createCompanionServer({ token: 'test-token', destinations: new Map([
    ['local', { id: 'local', label: 'Local archive', provider: 'fs', providerName: 'Filesystem', files: local }],
    ['alternate', { id: 'alternate', label: 'Second archive', provider: 'fs', providerName: 'Filesystem', files: alternate }],
  ]) })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${server.address().port}`
})
afterEach(async () => {
  await new Promise((resolve) => server.close(resolve))
  await rm(root, { recursive: true, force: true })
  await rm(secondRoot, { recursive: true, force: true })
})

function upload(path, body = 'contents', token = 'test-token', destination = 'local') {
  return fetch(`${url}/files`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'X-Petrify-Path': path, 'X-Petrify-Destination': destination },
    body,
  })
}

describe('companion uploads', () => {
  it('requires a token and never writes on unauthorized requests', async () => {
    expect((await upload('Archive/a.jpg', 'bytes', 'wrong')).status).toBe(401)
    expect(await readdir(root)).toEqual([])
  })

  it('writes nested files and uniquifies collisions without replacing the first', async () => {
    expect((await upload('Archive/space/one.jpg', 'first')).status).toBe(201)
    expect((await upload('Archive/space/one.jpg', 'second')).status).toBe(201)
    expect(await readFile(join(root, 'Archive/space/one.jpg'), 'utf8')).toBe('first')
    expect(await readFile(join(root, 'Archive/space/one (1).jpg'), 'utf8')).toBe('second')
    expect((await upload('Archive/space/one.jpg', 'different archive', 'test-token', 'alternate')).status).toBe(201)
    expect(await readFile(join(secondRoot, 'Archive/space/one.jpg'), 'utf8')).toBe('different archive')
    expect((await upload('Archive/space/one.jpg', 'bad', 'test-token', 'missing')).status).toBe(400)
  })

  it('gives concurrent uploads to the same destination distinct keys', async () => {
    const results = await Promise.all([
      upload('Archive/space/race.jpg', 'alpha'),
      upload('Archive/space/race.jpg', 'beta'),
    ])
    expect(results.map((result) => result.status)).toEqual([201, 201])
    const contents = await Promise.all([
      readFile(join(root, 'Archive/space/race.jpg'), 'utf8'),
      readFile(join(root, 'Archive/space/race (1).jpg'), 'utf8'),
    ])
    expect(contents.sort()).toEqual(['alpha', 'beta'])
  })

  it('lists safe destination metadata only after authentication', async () => {
    const unauthorized = await fetch(`${url}/destinations`)
    expect(unauthorized.status).toBe(401)
    const response = await fetch(`${url}/destinations`, { headers: { Authorization: 'Bearer test-token' } })
    expect(await response.json()).toEqual([
      { id: 'local', label: 'Local archive', provider: 'fs', providerName: 'Filesystem' },
      { id: 'alternate', label: 'Second archive', provider: 'fs', providerName: 'Filesystem' },
    ])
  })

  it('rejects traversal and symlinks outside the configured root', async () => {
    expect((await upload('../outside.jpg')).status).toBe(400)
    const outside = await mkdtemp(join(tmpdir(), 'petrify-outside-'))
    try {
      await symlink(outside, join(root, 'linked'))
      expect((await upload('linked/escape.jpg')).status).toBe(400)
      expect(await readdir(outside)).toEqual([])
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
  })
})
