import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { ZipArchive } from 'archiver'
import * as yauzl from 'yauzl'
import { CURRENT_SCHEMA_VERSION, type BackupManifest } from '../../shared/schema'
import type { BackupResult, ConfigImportMode, ImportResult } from '../../shared/ipc'
import { DataStore } from './dataStore'

const BACKUP_DIRECTORY = 'backups'
const DATA_DIRECTORY = 'data'

export type BackupSaveDialog = {
  showSaveDialog(options: { defaultPath: string; filters: Array<{ name: string; extensions: string[] }> }): Promise<{ canceled: boolean; filePath?: string }>
}

export class BackupService {
  constructor(
    private readonly dataStore: DataStore,
    private readonly now: () => number = () => Math.floor(Date.now() / 1000),
    private readonly saveDialog?: BackupSaveDialog
  ) {}

  async runBackup(keep = 3): Promise<BackupResult> {
    const manifest: BackupManifest = {
      app: 'LecPDF',
      version: CURRENT_SCHEMA_VERSION,
      exportedAt: this.now()
    }
    const backupPath = join(this.dataStore.rootPath, BACKUP_DIRECTORY, `backup-${manifest.exportedAt}.zip`)
    await this.writeArchive(backupPath, manifest)
    await this.pruneBackups(keep)

    return { path: backupPath, manifest }
  }

  async exportData(): Promise<BackupResult | null> {
    if (this.saveDialog === undefined) {
      throw new Error('导出位置选择不可用')
    }
    const exportedAt = this.now()
    const result = await this.saveDialog.showSaveDialog({
      defaultPath: join(this.dataStore.rootPath, `LecPDF-export-${exportedAt}.zip`),
      filters: [{ name: 'LecPDF 备份', extensions: ['zip'] }]
    })
    if (result.canceled || result.filePath === undefined) {
      return null
    }
    const manifest: BackupManifest = { app: 'LecPDF', version: CURRENT_SCHEMA_VERSION, exportedAt }
    await this.writeArchive(result.filePath, manifest)
    return { path: result.filePath, manifest }
  }

  async importData(sourcePath: string, configMode: ConfigImportMode = 'skip'): Promise<ImportResult> {
    const entries = await readZipEntries(sourcePath)
    const manifest = readJsonEntry<BackupManifest>(entries, 'manifest.json')
    if (manifest?.app !== 'LecPDF' || typeof manifest.version !== 'number') {
      throw new Error('不是有效的 LecPDF 备份包')
    }
    const library = readJsonEntry<Record<string, unknown>>(entries, 'library.json')
    const sidecars = [...entries.entries()]
      .filter(([name]) => /^data\/[^/]+\.json$/.test(name))
      .flatMap(([name, content]) => {
        const sidecar = parseJson<Record<string, unknown>>(content, name)
        return typeof sidecar.path === 'string' ? [{ path: sidecar.path, sidecar }] : []
      })
    const paths = new Set(sidecars.map((sidecar) => sidecar.path))
    if (library?.files !== null && typeof library?.files === 'object') {
      Object.keys(library.files as Record<string, unknown>).forEach((path) => paths.add(path))
    }
    const existingPaths = new Set<string>()
    const missingPaths: string[] = []
    for (const path of paths) {
      if (await fileExists(path)) existingPaths.add(path)
      else missingPaths.push(path)
    }
    if (configMode === 'overwrite') {
      const config = readJsonEntry<Record<string, unknown>>(entries, 'config.json')
      if (config !== null) await this.dataStore.writeJson('config.json', config)
    }
    if (library !== null) {
      await this.dataStore.writeJson('library.json', filterLibrary(library, existingPaths))
    }
    const importedPaths: string[] = []
    for (const sidecar of sidecars) {
      if (!existingPaths.has(sidecar.path)) continue
      await this.dataStore.writeJson(`data/${pathHash(sidecar.path)}.json`, sidecar.sidecar)
      importedPaths.push(sidecar.path)
    }
    return { importedPaths, missingPaths }
  }

  private async collectPersistedFiles(): Promise<Array<{ name: string; content: Buffer }>> {
    const files = await Promise.all([
      ...['config.json', 'library.json'].map((name) => this.readOptionalFile(name)),
      ...await this.readSidecars()
    ])

    return files.filter((file): file is { name: string; content: Buffer } => file !== null)
  }

  private async writeArchive(path: string, manifest: BackupManifest): Promise<void> {
    await mkdir(dirname(path), { recursive: true })
    const temporaryPath = join(dirname(path), `.${basename(path)}.tmp`)
    try {
      await writeZip(temporaryPath, [{ name: 'manifest.json', content: JSON.stringify(manifest, null, 2) }, ...(await this.collectPersistedFiles())])
      await rename(temporaryPath, path)
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined)
      throw error
    }
  }

  private async readSidecars(): Promise<Array<{ name: string; content: Buffer } | null>> {
    const dataDirectoryPath = this.dataStore.resolvePath(DATA_DIRECTORY)

    try {
      const entries = await readdir(dataDirectoryPath, { withFileTypes: true })
      return Promise.all(entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => this.readOptionalFile(join(DATA_DIRECTORY, entry.name))))
    } catch (error) {
      if (isMissingFileError(error)) {
        return []
      }
      throw error
    }
  }

  private async readOptionalFile(name: string): Promise<{ name: string; content: Buffer } | null> {
    try {
      return { name: normalizeArchivePath(name), content: await readFile(this.dataStore.resolvePath(name)) }
    } catch (error) {
      if (isMissingFileError(error)) {
        return null
      }
      throw error
    }
  }

  private async pruneBackups(keep: number): Promise<void> {
    const backupDirectoryPath = join(this.dataStore.rootPath, BACKUP_DIRECTORY)
    const backupPaths = (await readdir(backupDirectoryPath))
      .filter((name) => /^backup-\d+\.zip$/.test(name))
      .map((name) => ({ path: join(backupDirectoryPath, name), timestamp: getBackupTimestamp(name) }))
    const existingBackups = await Promise.all(backupPaths.map(async (backup) => ({ ...backup, stats: await stat(backup.path) })))
    const staleBackups = existingBackups
      .filter((backup) => backup.stats.isFile())
      .sort((left, right) => right.timestamp - left.timestamp || right.path.localeCompare(left.path))
      .slice(Math.max(keep, 0))

    await Promise.all(staleBackups.map((backup) => rm(backup.path, { force: true })))
  }
}

async function writeZip(path: string, entries: Array<{ name: string; content: Buffer | string }>): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const output = createWriteStream(path)
    const archive = new ZipArchive({ zlib: { level: 9 } })
    let settled = false
    const resolve = (): void => {
      if (!settled) {
        settled = true
        resolvePromise()
      }
    }
    const reject = (error: Error): void => {
      if (!settled) {
        settled = true
        rejectPromise(error)
      }
    }

    output.once('close', resolve)
    output.once('error', reject)
    archive.once('error', reject)
    archive.pipe(output)
    entries.forEach((entry) => archive.append(entry.content, { name: entry.name }))
    void archive.finalize().catch(reject)
  })
}

function normalizeArchivePath(path: string): string {
  return path.replaceAll('\\', '/')
}

function getBackupTimestamp(name: string): number {
  return Number.parseInt(name.slice('backup-'.length, -'.zip'.length), 10)
}

async function readZipEntries(path: string): Promise<Map<string, Buffer>> {
  return new Promise((resolvePromise, rejectPromise) => {
    yauzl.open(path, { lazyEntries: true }, (error, zipFile) => {
      if (error !== null) return rejectPromise(error)
      const entries = new Map<string, Buffer>()
      zipFile.on('error', rejectPromise)
      zipFile.on('entry', (entry) => {
        if (entry.fileName.endsWith('/')) return zipFile.readEntry()
        if (!isSafeEntryName(entry.fileName)) return rejectPromise(new Error('备份包包含不安全路径'))
        zipFile.openReadStream(entry, (streamError, stream) => {
          if (streamError !== null) return rejectPromise(streamError)
          const chunks: Buffer[] = []
          stream.on('data', (chunk: Buffer) => chunks.push(chunk))
          stream.on('error', rejectPromise)
          stream.on('end', () => { entries.set(entry.fileName, Buffer.concat(chunks)); zipFile.readEntry() })
        })
      })
      zipFile.on('end', () => resolvePromise(entries))
      zipFile.readEntry()
    })
  })
}

function readJsonEntry<T>(entries: Map<string, Buffer>, name: string): T | null {
  const content = entries.get(name)
  return content === undefined ? null : parseJson<T>(content, name)
}

function parseJson<T>(content: Buffer, name: string): T {
  try { return JSON.parse(content.toString('utf8')) as T } catch { throw new Error(`备份包 JSON 损坏：${name}`) }
}

function filterLibrary(library: Record<string, unknown>, existingPaths: Set<string>): Record<string, unknown> {
  const files = library.files !== null && typeof library.files === 'object' ? library.files as Record<string, unknown> : {}
  return {
    ...library,
    recent: Array.isArray(library.recent) ? library.recent.filter((item) => isExistingPathItem(item, existingPaths)) : [],
    starred: Array.isArray(library.starred) ? library.starred.filter((path) => typeof path === 'string' && existingPaths.has(path)) : [],
    files: Object.fromEntries(Object.entries(files).filter(([path]) => existingPaths.has(path)))
  }
}

function isExistingPathItem(item: unknown, existingPaths: Set<string>): boolean {
  return typeof item === 'object' && item !== null && 'path' in item && typeof item.path === 'string' && existingPaths.has(item.path)
}

function pathHash(path: string): string { return createHash('md5').update(path).digest('hex').slice(0, 16) }
function isSafeEntryName(name: string): boolean { return !name.startsWith('/') && !name.includes('\\') && !name.split('/').includes('..') }
async function fileExists(path: string): Promise<boolean> { return stat(path).then(() => true).catch(() => false) }

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}
