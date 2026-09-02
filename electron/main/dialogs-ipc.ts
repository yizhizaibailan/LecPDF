/**
 * 职责：注册渲染层可调用的受限打开文档对话框 IPC。
 * 异步说明：handler 等待 Electron 对话框完成后再返回所选路径。
 * 安全说明：对话框过滤器之外仍按扩展名二次筛选，并在返回前复用系统打开授权流程。
 * 资源说明：本模块只注册固定 IPC handler，不持有窗口、文件句柄或额外监听器。
 */
import { DIALOG_IPC_CHANNELS } from '../shared/ipc'
import { getSupportedDocumentPaths } from './file-open-router'

export type DialogsIpcMainPort = {
  handle(channel: string, handler: (event: unknown) => Promise<string[]>): void
}

export type OpenDocumentsDialog = {
  showOpenDialog(options: {
    properties: Array<'openFile' | 'multiSelections'>
    filters: Array<{ name: string; extensions: string[] }>
  }): Promise<{ canceled: boolean; filePaths: string[] }>
}

/**
 * 将唯一打开文档通道绑定到受限对话框，并在返回渲染进程前完成主进程授权。
 */
export function registerDialogsIpcHandlers(
  ipcMain: DialogsIpcMainPort,
  dialog: OpenDocumentsDialog,
  authorizeDocuments: (paths: string[]) => void
): void {
  ipcMain.handle(DIALOG_IPC_CHANNELS.openDocuments, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF 与 EPUB 文档', extensions: ['pdf', 'epub'] }]
    })
    if (result.canceled) return []

    const paths = getSupportedDocumentPaths(result.filePaths)
    authorizeDocuments(paths)
    return paths
  })
}
