import {
  BACKUP_IPC_CHANNELS,
  FILE_READ_IPC_CHANNELS,
  LIBRARY_IPC_CHANNELS,
  LIFECYCLE_IPC_CHANNELS,
  WINDOW_IPC_CHANNELS,
  type BackupResult,
  type FileIndexEntry,
  type FileStat,
  type ImportResult,
  type LecApi,
  type PersistedDocument,
  type UpdateCheckResult
} from '../../shared/ipc'

export type IpcRendererListener = (event: unknown, ...args: unknown[]) => void

export type IpcRendererPort = {
  invoke(channel: string, ...arguments_: unknown[]): Promise<unknown>
  on(channel: string, listener: IpcRendererListener): unknown
  removeListener(channel: string, listener: IpcRendererListener): unknown
}

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

function createWindowApi(ipcRenderer?: IpcRendererPort): LecApi['window'] {
  if (ipcRenderer === undefined) {
    return Object.freeze({
      minimize: unavailable<void>('window.minimize'),
      toggleMaximize: unavailable<void>('window.toggleMaximize'),
      close: unavailable<void>('window.close'),
      onMaximizedChange: unavailableSubscription('window.onMaximizedChange')
    })
  }

  return Object.freeze({
    minimize: async () => {
      await ipcRenderer.invoke(WINDOW_IPC_CHANNELS.minimize)
    },
    toggleMaximize: async () => {
      await ipcRenderer.invoke(WINDOW_IPC_CHANNELS.toggleMaximize)
    },
    close: async () => {
      await ipcRenderer.invoke(WINDOW_IPC_CHANNELS.close)
    },
    onMaximizedChange: (listener) => {
      const listenerWrapper: IpcRendererListener = (_event, maximized) => {
        if (typeof maximized === 'boolean') {
          listener(maximized)
        }
      }
      ipcRenderer.on(WINDOW_IPC_CHANNELS.maximizedChange, listenerWrapper)
      return () => ipcRenderer.removeListener(WINDOW_IPC_CHANNELS.maximizedChange, listenerWrapper)
    }
  })
}

function createLifecycleApi(ipcRenderer?: IpcRendererPort): LecApi['lifecycle'] {
  if (ipcRenderer === undefined) {
    return Object.freeze({
      onOpenFileRequest: unavailableSubscription('lifecycle.onOpenFileRequest'),
      openLogsFolder: unavailable<void>('lifecycle.openLogsFolder')
    })
  }

  const listeners = new Set<(path: string) => void>()
  const pendingPaths: string[] = []
  const receiveFileRequest: IpcRendererListener = (_event, path) => {
    if (typeof path !== 'string') {
      return
    }

    if (listeners.size === 0) {
      pendingPaths.push(path)
      return
    }

    listeners.forEach((listener) => listener(path))
  }
  ipcRenderer.on(LIFECYCLE_IPC_CHANNELS.openFileRequest, receiveFileRequest)

  return Object.freeze({
    onOpenFileRequest: (listener) => {
      listeners.add(listener)
      pendingPaths.splice(0).forEach((path) => listener(path))
      return () => listeners.delete(listener)
    },
    openLogsFolder: unavailable<void>('lifecycle.openLogsFolder')
  })
}

function createFileReadApi(ipcRenderer?: IpcRendererPort): LecApi['fileRead'] {
  if (ipcRenderer === undefined) {
    return Object.freeze({
      readBuffer: unavailable<ArrayBuffer>('fileRead.readBuffer'),
      getPdfUrl: unavailable<string>('fileRead.getPdfUrl')
    })
  }

  return Object.freeze({
    readBuffer: unavailable<ArrayBuffer>('fileRead.readBuffer'),
    getPdfUrl: async (path: string) => {
      const url = await ipcRenderer.invoke(FILE_READ_IPC_CHANNELS.getPdfUrl, path)
      if (typeof url !== 'string') {
        throw new Error('主进程未返回有效 PDF URL')
      }
      return url
    }
  })
}

function createLibraryApi(ipcRenderer?: IpcRendererPort): LecApi['library'] {
  if (ipcRenderer === undefined) {
    return Object.freeze({
      scanFolders: unavailable<FileIndexEntry[]>('library.scanFolders')
    })
  }

  return Object.freeze({
    scanFolders: async (paths: string[]) => {
      const entries = await ipcRenderer.invoke(LIBRARY_IPC_CHANNELS.scanFolders, paths)
      if (!Array.isArray(entries)) {
        throw new Error('主进程未返回有效目录扫描结果')
      }
      return entries as FileIndexEntry[]
    }
  })
}

function createBackupApi(ipcRenderer?: IpcRendererPort): LecApi['backup'] {
  if (ipcRenderer === undefined) {
    return Object.freeze({
      runBackup: unavailable<BackupResult>('backup.runBackup'),
      exportData: unavailable<BackupResult | null>('backup.exportData'),
      importData: unavailable<ImportResult>('backup.importData')
    })
  }

  return Object.freeze({
    runBackup: async () => {
      const result = await ipcRenderer.invoke(BACKUP_IPC_CHANNELS.runBackup)
      if (!isBackupResult(result)) {
        throw new Error('主进程未返回有效备份结果')
      }
      return result
    },
    exportData: unavailable<BackupResult | null>('backup.exportData'),
    importData: unavailable<ImportResult>('backup.importData')
  })
}

export function createPreloadApi(version: string, ipcRenderer?: IpcRendererPort): LecApi {
  return Object.freeze({
    app: Object.freeze({ version }),
    window: createWindowApi(ipcRenderer),
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
    library: createLibraryApi(ipcRenderer),
    fileRead: createFileReadApi(ipcRenderer),
    data: Object.freeze({
      readJson: async <T extends PersistedDocument>() => {
        throw new Error('尚未实现：data.readJson')
      },
      writeJson: async <T extends PersistedDocument>() => {
        throw new Error('尚未实现：data.writeJson')
      }
    }),
    backup: createBackupApi(ipcRenderer),
    update: Object.freeze({
      checkForUpdates: unavailable<UpdateCheckResult>('update.checkForUpdates')
    }),
    lifecycle: createLifecycleApi(ipcRenderer)
  })
}

function isBackupResult(value: unknown): value is BackupResult {
  return typeof value === 'object'
    && value !== null
    && 'path' in value
    && typeof value.path === 'string'
    && 'manifest' in value
    && typeof value.manifest === 'object'
    && value.manifest !== null
    && 'app' in value.manifest
    && value.manifest.app === 'LecPDF'
    && 'version' in value.manifest
    && typeof value.manifest.version === 'number'
    && 'exportedAt' in value.manifest
    && typeof value.manifest.exportedAt === 'number'
}
