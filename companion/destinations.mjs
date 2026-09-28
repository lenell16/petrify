import { readFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { config as loadEnv } from 'dotenv'
import { loadFiles } from 'files-sdk/loader'
import { PROVIDER_NAMES, getProvider } from 'files-sdk/providers'
import { z } from 'zod'

const destinationSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().min(1),
  provider: z.enum(PROVIDER_NAMES),
  options: z.record(z.string(), z.unknown()),
})

const configSchema = z.object({ destinations: z.array(destinationSchema).min(1) })

function resolveEnv(value) {
  if (Array.isArray(value)) return value.map(resolveEnv)
  if (value && typeof value === 'object') {
    if (Object.keys(value).length === 1 && typeof value.$env === 'string') {
      const resolved = process.env[value.$env]
      if (!resolved) throw new Error(`Missing environment variable: ${value.$env}`)
      return resolved
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveEnv(entry)]))
  }
  return value
}

export async function loadDestinations(configPath, envPath) {
  loadEnv({ path: envPath, quiet: true })
  const parsed = configSchema.parse(JSON.parse(await readFile(configPath, 'utf8')))
  const destinations = new Map()
  for (const { id, label, provider, options } of parsed.destinations) {
    if (destinations.has(id)) throw new Error(`Duplicate destination ID: ${id}`)
    const resolved = resolveEnv(options)
    if (provider === 'fs' && (typeof resolved.root !== 'string' || !isAbsolute(resolved.root))) {
      throw new Error(`Destination ${id} needs an absolute root path`)
    }
    const { files } = await loadFiles({ ...resolved, provider })
    destinations.set(id, { id, label, provider, providerName: getProvider(provider).name, files })
  }
  return destinations
}
