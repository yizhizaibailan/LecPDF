import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import type { FileIndexEntry } from '../../shared/ipc'
import type { FileKind } from '../../shared/schema'

type DirectoryEntry = {
  name: string
  isDirectory(): boolean
  isFile(): boolean
  isSymbolicLink(): boolean
}

export type LibraryFileSystem = {
  readDirectory(path: string): Promise<DirectoryEntry[]>
  stat(path: string): Promise<{ size: number; mtimeMs: number; isFile(): boolean }>
}

const nodeFileSystem: LibraryFileSystem = {
  readDirectory: async (path) => (await readdir(path, { withFileTypes: true })) as DirectoryEntry[],
  stat
}

export class LibraryService {
  constructor(
    private readonly fileSystem: LibraryFileSystem = nodeFileSystem,
    private readonly now: () => number = () => Math.floor(Date.now() / 1000)
  ) {}

  async scanFolders(folderPaths: string[]): Promise<FileIndexEntry[]> {
    const results: FileIndexEntry[] = []
    const visitedFolders = new Set<string>()

    for (const folderPath of folderPaths) {
      await this.scanFolder(resolve(folderPath), visitedFolders, results)
    }

    return results.sort((left, right) => left.path.localeCompare(right.path))
  }

  private async scanFolder(folderPath: string, visitedFolders: Set<string>, results: FileIndexEntry[]): Promise<void> {
    if (visitedFolders.has(folderPath)) {
      return
    }
    visitedFolders.add(folderPath)

    let entries: DirectoryEntry[]
    try {
      entries = await this.fileSystem.readDirectory(folderPath)
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue
      }

      const path = join(folderPath, entry.name)
      if (entry.isDirectory()) {
        await this.scanFolder(path, visitedFolders, results)
        continue
      }

      const kind = getFileKind(entry.name)
      if (!entry.isFile() || kind === null) {
        continue
      }

      try {
        const metadata = await this.fileSystem.stat(path)
        if (!metadata.isFile()) {
          continue
        }

        results.push({
          path,
          kind,
          name: basename(path),
          size: metadata.size,
          mtime: Math.floor(metadata.mtimeMs / 1000),
          addedAt: this.now(),
          pageCount: null,
          missing: false
        })
      } catch {
        // A file can disappear or become inaccessible between directory listing and stat.
      }
    }
  }
}

function getFileKind(path: string): FileKind | null {
  const extension = extname(path).toLowerCase()
  if (extension === '.pdf' || extension === '.epub') {
    return extension.slice(1) as FileKind
  }
  return null
}
