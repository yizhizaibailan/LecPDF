import { createWriteStream } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { ZipArchive } from 'archiver'
import { CURRENT_SCHEMA_VERSION, type BackupManifest } from '../../shared/schema'
import type { BackupResult } from '../../shared/ipc'
import { DataStore } from './dataStore'

const BACKUP_DIRECTORY = 'backups'
const DATA_DIRECTORY = 'data'

export class BackupService {
  constructor(
    private readonly dataStore: DataStore,
    private readonly now: () => number = () => Math.floor(Date.now() / 1000)
  ) {}

  async runBackup(keep = 3): Promise<BackupResult> {
    const manifest: BackupManifest = {
      app: 'LecPDF',
      version: CURRENT_SCHEMA_VERSION,
      exportedAt: this.now()
    }
    const backupDirectoryPath = join(this.dataStore.rootPath, BACKUP_DIRECTORY)
    const backupPath = join(backupDirectoryPath, `backup-${manifest.exportedAt}.zip`)
    const temporaryPath = join(backupDirectoryPath, `.backup-${manifest.exportedAt}.tmp`)

    await mkdir(backupDirectoryPath, { recursive: true })

    try {
      await writeZip(temporaryPath, [
        { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) },
        ...(await this.collectPersistedFiles())
      ])
      await rename(temporaryPath, backupPath)
      await this.pruneBackups(keep)
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined)
      throw error
    }

    return { path: backupPath, manifest }
  }

  private async collectPersistedFiles(): Promise<Array<{ name: string; content: Buffer }>> {
    const files = await Promise.all([
      ...['config.json', 'library.json'].map((name) => this.readOptionalFile(name)),
      ...await this.readSidecars()
    ])

    return files.filter((file): file is { name: string; content: Buffer } => file !== null)
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

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}
