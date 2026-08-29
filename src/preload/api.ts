import type { BackupResult, FileIndexEntry, FileStat, ImportResult, LecApi, PersistedDocument, UpdateCheckResult } from '../../shared/ipc'

function unavailable<T>(method: string): () => Promise<T> {
  return async () => {
    throw new Error(`尚未实现：${method}`)
  }
}

function unavailableSubscription(method: string): () => never {
  return () => {
    throw new Error(`尚未实现：${method}`)
  }
}

export function createPreloadApi(version: string): LecApi {
  return Object.freeze({
    app: Object.freeze({ version }),
    window: Object.freeze({
      minimize: unavailable<void>('window.minimize'),
      toggleMaximize: unavailable<void>('window.toggleMaximize'),
      close: unavailable<void>('window.close'),
      onMaximizedChange: unavailableSubscription('window.onMaximizedChange')
    }),
    dialogs: Object.freeze({
      openDocuments: unavailable<string[]>('dialogs.openDocuments'),
      openFolder: unavailable<string | null>('dialogs.openFolder'),
      locateMissingFile: unavailable<string | null>('dialogs.locateMissingFile')
    }),
    fs: Object.freeze({
      stat: unavailable<FileStat>('fs.stat'),
      trashItem: unavailable<void>('fs.trashItem'),
      getCacheSize: unavailable<number>('fs.getCacheSize'),
      clearCache: unavailable<void>('fs.clearCache')
    }),
    library: Object.freeze({
      scanFolders: unavailable<FileIndexEntry[]>('library.scanFolders')
    }),
    fileRead: Object.freeze({
      readBuffer: unavailable<ArrayBuffer>('fileRead.readBuffer')
    }),
    data: Object.freeze({
      readJson: async <T extends PersistedDocument>() => {
        throw new Error('尚未实现：data.readJson')
      },
      writeJson: async <T extends PersistedDocument>() => {
        throw new Error('尚未实现：data.writeJson')
      }
    }),
    backup: Object.freeze({
      runBackup: unavailable<BackupResult>('backup.runBackup'),
      exportData: unavailable<BackupResult | null>('backup.exportData'),
      importData: unavailable<ImportResult>('backup.importData')
    }),
    update: Object.freeze({
      checkForUpdates: unavailable<UpdateCheckResult>('update.checkForUpdates')
    }),
    lifecycle: Object.freeze({
      onOpenFileRequest: unavailableSubscription('lifecycle.onOpenFileRequest'),
      openLogsFolder: unavailable<void>('lifecycle.openLogsFolder')
    })
  })
}
