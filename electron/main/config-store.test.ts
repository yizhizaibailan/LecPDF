import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { CURRENT_SCHEMA_VERSION, type Config } from '../shared/schema'
import { ConfigStore } from './config-store'
import { DataStore } from './dataStore'

const testRoots: string[] = []

async function createDataStore(): Promise<DataStore> {
  const root = await mkdtemp(join(tmpdir(), 'lecpdf-config-store-'))
  testRoots.push(root)
  return new DataStore(root)
}

afterEach(async () => {
  await Promise.all(testRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

test('creates default settings and persists a captured window geometry', async () => {
  const dataStore = await createDataStore()
  const configStore = new ConfigStore(dataStore)

  const defaults = await configStore.load()
  const persisted = await configStore.saveWindowGeometry({
    bounds: { x: 40, y: 60, width: 1400, height: 900 },
    maximized: true
  })

  expect(defaults.window).toEqual({ bounds: { x: 0, y: 0, width: 1280, height: 800 }, maximized: false })
  expect(persisted).toBe(true)
  await expect(dataStore.readJson<Config>('config.json')).resolves.toMatchObject({
    version: CURRENT_SCHEMA_VERSION,
    language: 'zh-CN',
    general: { autoBackup: { enabled: true, intervalDays: 7, keep: 3 } },
    window: { bounds: { x: 40, y: 60, width: 1400, height: 900 }, maximized: true }
  })
})

test('does not overwrite configuration created by a newer app version', async () => {
  const dataStore = await createDataStore()
  const newerConfig = {
    version: 99,
    language: 'en-US',
    window: { bounds: { x: 12, y: 24, width: 1280, height: 800 }, maximized: false },
    futureSetting: 'keep-me'
  } as unknown as Config
  await dataStore.writeJson('config.json', newerConfig)
  const configStore = new ConfigStore(dataStore)

  await configStore.load()
  const persisted = await configStore.saveWindowGeometry({
    bounds: { x: 1, y: 2, width: 1080, height: 720 },
    maximized: true
  })

  expect(persisted).toBe(false)
  await expect(dataStore.readJson('config.json')).resolves.toEqual(newerConfig)
})
