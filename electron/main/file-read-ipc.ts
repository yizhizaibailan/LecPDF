/**
 * 将受登记的 PDF 文件转换为渲染层可使用的受限 URL；通过 LecFileProtocol 保持路径授权。
 */
import { FILE_READ_IPC_CHANNELS } from '../shared/ipc'

export type FileReadIpcMainPort = {
  handle(channel: string, handler: (event: unknown, path: unknown) => string): void
}

export type PdfUrlProvider = {
  getPdfUrl(path: string): string
}

export function registerFileReadIpcHandlers(ipcMain: FileReadIpcMainPort, pdfUrlProvider: PdfUrlProvider): void {
  ipcMain.handle(FILE_READ_IPC_CHANNELS.getPdfUrl, (_event, path) => {
    if (typeof path !== 'string') {
      throw new Error('PDF 路径无效')
    }
    return pdfUrlProvider.getPdfUrl(path)
  })
}
