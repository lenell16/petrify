import { describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadDestinations } from './destinations.mjs'

describe('destination configuration', () => {
  it('resolves per-destination environment references and builds separate Files instances', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'petrify-destinations-'))
    try {
      await writeFile(join(directory, '.env'), 'PETRIFY_TEST_ROOT=' + join(directory, 'first') + '\n')
      const configPath = join(directory, 'destinations.json')
      await writeFile(configPath, JSON.stringify({ destinations: [
        { id: 'first', label: 'First', provider: 'fs', options: { root: { $env: 'PETRIFY_TEST_ROOT' } } },
        { id: 'second', label: 'Second', provider: 'fs', options: { root: join(directory, 'second') } },
      ] }))
      const items = await loadDestinations(configPath, join(directory, '.env'))
      await items.get('first').files.upload('sample.txt', 'first')
      expect(await items.get('first').files.exists('sample.txt')).toBe(true)
      expect(await items.get('second').files.exists('sample.txt')).toBe(false)
      expect(items.get('first').providerName).toBe('Filesystem')
      await writeFile(configPath, JSON.stringify({ destinations: [
        { id: 'first', label: 'First', provider: 'fs', options: { root: join(directory, 'first') } },
        { id: 'first', label: 'Duplicate', provider: 'fs', options: { root: join(directory, 'second') } },
      ] }))
      await expect(loadDestinations(configPath, join(directory, '.env'))).rejects.toThrow('Duplicate destination ID')
      await writeFile(configPath, JSON.stringify({ destinations: [
        { id: 'missing', label: 'Missing key', provider: 'fs', options: { root: { $env: 'PETRIFY_TEST_MISSING' } } },
      ] }))
      await expect(loadDestinations(configPath, join(directory, '.env'))).rejects.toThrow('Missing environment variable: PETRIFY_TEST_MISSING')
    } finally {
      delete process.env.PETRIFY_TEST_ROOT
      await rm(directory, { recursive: true, force: true })
    }
  })
})
