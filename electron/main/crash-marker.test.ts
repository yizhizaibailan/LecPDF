import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { CURRENT_SCHEMA_VERSION, type RuntimeMark } from '../shared/schema'
import { CrashMarker } from './crash-marker'
import { DataStore } from './dataStore'

const testRoots: string[] = []

async function createDataStore(): Promise<DataStore> {
  const root = await mkdtemp(join(tmpdir(), 'lecpdf-crash-marker-'))
  testRoots.push(root)
  return new DataStore(root)
}

afterEach(async () => {
  await Promise.all(testRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

test('writes an unclean runtime marker for the current session', async () => {
  const dataStore = await createDataStore()
  const marker = new CrashMarker(dataStore, () => 123)

  const recovery = await marker.start(['C:\\docs\\first.pdf', 'C:\\docs\\second.epub', 'C:\\docs\\first.pdf'])

  expect(recovery).toEqual({ needsRecovery: false, lastTabPaths: [] })
  await expect(dataStore.readJson<RuntimeMark>('runtime.json')).resolves.toEqual({
    version: CURRENT_SCHEMA_VERSION,
    cleanExit: false,
    lastTabPaths: ['C:\\docs\\first.pdf', 'C:\\docs\\second.epub'],
    startedAt: 123
  })
})

test('detects paths left by an interrupted previous session without carrying them into the new one', async () => {
  const dataStore = await createDataStore()
  await dataStore.writeJson<RuntimeMark>('runtime.json', {
    version: CURRENT_SCHEMA_VERSION,
    cleanExit: false,
    lastTabPaths: ['C:\\docs\\interrupted.pdf'],
    startedAt: 99
  })
  const marker = new CrashMarker(dataStore, () => 456)

  const recovery = await marker.start(['C:\\docs\\new-session.pdf'])

  expect(recovery).toEqual({ needsRecovery: true, lastTabPaths: ['C:\\docs\\interrupted.pdf'] })
  await expect(dataStore.readJson<RuntimeMark>('runtime.json')).resolves.toEqual({
    version: CURRENT_SCHEMA_VERSION,
    cleanExit: false,
    lastTabPaths: ['C:\\docs\\new-session.pdf'],
    startedAt: 456
  })
})

test('detects an interrupted previous session even when it had no open files', async () => {
  const dataStore = await createDataStore()
  await dataStore.writeJson<RuntimeMark>('runtime.json', {
    version: CURRENT_SCHEMA_VERSION,
    cleanExit: false,
    lastTabPaths: [],
    startedAt: 99
  })
  const marker = new CrashMarker(dataStore, () => 456)

  await expect(marker.start()).resolves.toEqual({ needsRecovery: true, lastTabPaths: [] })
})

test('records tabs in opening order and marks a normal exit as clean', async () => {
  const dataStore = await createDataStore()
  const marker = new CrashMarker(dataStore, () => 789)
  await marker.start()

  await marker.recordOpenTabPaths(['C:\\docs\\first.pdf', 'C:\\docs\\second.epub', 'C:\\docs\\first.pdf'])
  await marker.markCleanExit()

  await expect(dataStore.readJson<RuntimeMark>('runtime.json')).resolves.toEqual({
    version: CURRENT_SCHEMA_VERSION,
    cleanExit: true,
    lastTabPaths: ['C:\\docs\\first.pdf', 'C:\\docs\\second.epub'],
    startedAt: 789
  })
})
