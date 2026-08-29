import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { basename, dirname, resolve, sep } from 'node:path'

type DataStoreFileSystem = Pick<typeof import('node:fs/promises'), 'mkdir' | 'readFile' | 'rename' | 'rm' | 'writeFile'>

const nodeFileSystem: DataStoreFileSystem = { mkdir, readFile, rename, rm, writeFile }

export class DataStore {
  readonly rootPath: string
  private readonly fileSystem: DataStoreFileSystem
  private readonly writeTails = new Map<string, Promise<void>>()

  constructor(rootPath: string, fileSystem: Partial<DataStoreFileSystem> = {}) {
    this.rootPath = resolve(rootPath)
    this.fileSystem = { ...nodeFileSystem, ...fileSystem }
  }

  resolvePath(relativePath: string): string {
    const targetPath = resolve(this.rootPath, relativePath)

    if (targetPath === this.rootPath || !targetPath.startsWith(`${this.rootPath}${sep}`)) {
      throw new Error(`超出用户数据目录：${relativePath}`)
    }

    return targetPath
  }

  async readJson<T>(relativePath: string): Promise<T | null> {
    const targetPath = this.resolvePath(relativePath)
    let content: string

    try {
      content = await this.fileSystem.readFile(targetPath, 'utf8')
    } catch (error) {
      if (isMissingFileError(error)) {
        return null
      }

      throw error
    }

    try {
      return JSON.parse(content) as T
    } catch (error) {
      throw new Error(`无法解析 JSON：${relativePath}`, { cause: error })
    }
  }

  writeJson<T>(relativePath: string, document: T): Promise<void> {
    const targetPath = this.resolvePath(relativePath)
    const previous = this.writeTails.get(targetPath) ?? Promise.resolve()
    const operation = previous.then(() => this.writeAtomically(targetPath, document))
    const tail = operation.catch(() => undefined)

    this.writeTails.set(targetPath, tail)
    void tail.finally(() => {
      if (this.writeTails.get(targetPath) === tail) {
        this.writeTails.delete(targetPath)
      }
    })

    return operation
  }

  private async writeAtomically<T>(targetPath: string, document: T): Promise<void> {
    const directoryPath = dirname(targetPath)
    const temporaryPath = resolve(directoryPath, `.${basename(targetPath)}.${randomUUID()}.tmp`)

    await this.fileSystem.mkdir(directoryPath, { recursive: true })

    try {
      await this.fileSystem.writeFile(temporaryPath, JSON.stringify(document, null, 2), 'utf8')
      await this.fileSystem.rename(temporaryPath, targetPath)
    } catch (error) {
      await this.fileSystem.rm(temporaryPath, { force: true }).catch(() => undefined)
      throw error
    }
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}
