import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
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

test('exports to the user-selected ZIP path and leaves no file when the selection is cancelled', async () => {
  const dataStore = await createDataStore()
  await dataStore.writeJson('library.json', { version: 1, files: {} })
  const selectedPath = join(dataStore.rootPath, 'chosen', 'LecPDF-export.zip')
  const service = new BackupService(dataStore, () => 123, {
    showSaveDialog: async () => ({ canceled: false, filePath: selectedPath })
  })
  const cancelledService = new BackupService(dataStore, () => 456, {
    showSaveDialog: async () => ({ canceled: true })
  })

  await expect(service.exportData()).resolves.toMatchObject({ path: selectedPath })
  await expect(listZipEntries(selectedPath)).resolves.toContain('library.json')
  await expect(cancelledService.exportData()).resolves.toBeNull()
})

test('imports only documents still on disk, remaps sidecars by path, and can skip imported config', async () => {
  const sourceStore = await createDataStore()
  const destinationStore = await createDataStore()
  const availablePath = join(destinationStore.rootPath, 'books', 'available.pdf')
  const missingPath = join(destinationStore.rootPath, 'books', 'missing.pdf')
  await mkdir(join(destinationStore.rootPath, 'books'), { recursive: true })
  await writeFile(availablePath, 'pdf')
  await sourceStore.writeJson('config.json', { version: 1, language: 'en-US' })
  await sourceStore.writeJson('library.json', {
    version: 1,
    recent: [{ path: availablePath }, { path: missingPath }],
    starred: [availablePath, missingPath],
    folders: [],
    files: { [availablePath]: { name: 'available.pdf' }, [missingPath]: { name: 'missing.pdf' } }
  })
  await sourceStore.writeJson('data/original-name.json', { version: 1, path: availablePath })
  await sourceStore.writeJson('data/missing-name.json', { version: 1, path: missingPath })
  const sourceBackup = await new BackupService(sourceStore, () => 123).runBackup()
  await destinationStore.writeJson('config.json', { version: 1, language: 'zh-CN' })
  const service = new BackupService(destinationStore)

  const result = await service.importData(sourceBackup.path, 'skip')

  expect(result).toEqual({ importedPaths: [availablePath], missingPaths: [missingPath] })
  await expect(destinationStore.readJson('config.json')).resolves.toEqual({ version: 1, language: 'zh-CN' })
  await expect(destinationStore.readJson(`data/${createHash('md5').update(availablePath).digest('hex').slice(0, 16)}.json`)).resolves.toEqual({ version: 1, path: availablePath })
  await expect(destinationStore.readJson('library.json')).resolves.toMatchObject({
    recent: [{ path: availablePath }],
    starred: [availablePath],
    files: { [availablePath]: { name: 'available.pdf' } }
  })
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
