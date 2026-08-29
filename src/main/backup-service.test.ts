import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as yauzl from 'yauzl'
import { afterEach, expect, test } from 'vitest'
import { BackupService } from './backup-service'
import { DataStore } from './dataStore'

const testRoots: string[] = []

async function createDataStore(): Promise<DataStore> {
  const root = await mkdtemp(join(tmpdir(), 'lecpdf-backup-service-'))
  testRoots.push(root)
  return new DataStore(root)
}

afterEach(async () => {
  await Promise.all(testRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

test('creates a standard ZIP containing the manifest, library, config, and every sidecar', async () => {
  const dataStore = await createDataStore()
  await dataStore.writeJson('config.json', { version: 1, language: 'zh-CN' })
  await dataStore.writeJson('library.json', { version: 1, files: {} })
  await dataStore.writeJson('data/paper.json', { version: 1, path: 'C:\\books\\paper.pdf' })
  await dataStore.writeJson('data/novel.json', { version: 1, path: 'C:\\books\\novel.epub' })
  const service = new BackupService(dataStore, () => 123)

  const backup = await service.runBackup(3)

  expect(backup).toEqual({
    path: join(dataStore.rootPath, 'backups', 'backup-123.zip'),
    manifest: { app: 'LecPDF', version: 1, exportedAt: 123 }
  })
  await expect(listZipEntries(backup.path)).resolves.toEqual([
    'config.json',
    'data/novel.json',
    'data/paper.json',
    'library.json',
    'manifest.json'
  ])
})

test('removes the oldest backups after a successful write and keeps the configured count', async () => {
  const dataStore = await createDataStore()
  await dataStore.writeJson('library.json', { version: 1, files: {} })
  const timestamps = [9, 10, 11, 12]
  const service = new BackupService(dataStore, () => timestamps.shift() ?? 0)

  await service.runBackup(3)
  await service.runBackup(3)
  await service.runBackup(3)
  await service.runBackup(3)

  await expect(readdir(join(dataStore.rootPath, 'backups'))).resolves.toEqual([
    'backup-10.zip',
    'backup-11.zip',
    'backup-12.zip'
  ])
})

function listZipEntries(path: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true }, (error, zipFile) => {
      if (error !== null) {
        reject(error)
        return
      }

      const entries: string[] = []
      zipFile.on('error', reject)
      zipFile.on('entry', (entry) => {
        entries.push(entry.fileName)
        zipFile.readEntry()
      })
      zipFile.on('end', () => resolve(entries.sort()))
      zipFile.readEntry()
    })
  })
}
