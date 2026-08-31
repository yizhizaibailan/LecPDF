/**
 * 注册我的文档扫描 IPC；通过领域端口把扫描实现与 Electron 的 ipcMain 解耦。
 */
import { LIBRARY_IPC_CHANNELS, type FileIndexEntry } from '../shared/ipc'

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
