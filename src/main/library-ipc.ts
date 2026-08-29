import { LIBRARY_IPC_CHANNELS, type FileIndexEntry } from '../../shared/ipc'

export type LibraryIpcMainPort = {
  handle(channel: string, handler: (event: unknown, paths: unknown) => Promise<FileIndexEntry[]>): void
}

export type FolderScanner = {
  scanFolders(paths: string[]): Promise<FileIndexEntry[]>
}

export function registerLibraryIpcHandlers(ipcMain: LibraryIpcMainPort, libraryService: FolderScanner): void {
  ipcMain.handle(LIBRARY_IPC_CHANNELS.scanFolders, async (_event, paths) => {
    if (!Array.isArray(paths) || paths.some((path) => typeof path !== 'string' || path.length === 0)) {
      throw new Error('文件夹路径无效')
    }
    return libraryService.scanFolders(paths)
  })
}
