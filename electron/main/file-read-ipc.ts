/**
 * 将已授权文档转换为渲染层可使用的受限来源；PDF 保持 URL 流式读取，EPUB 仅返回受限字节副本。
 */
import { FILE_READ_IPC_CHANNELS } from '../shared/ipc'

export type FileReadIpcMainPort = {
  handle(channel: string, handler: (event: unknown, path: unknown) => string | Promise<ArrayBuffer>): void
}

export type AuthorizedDocumentReader = {
  getPdfUrl(path: string): string
  readEpubBuffer(path: string): Promise<ArrayBuffer>
}

/**
 * 注册文件读取白名单通道；handler 只接受字符串路径，再交由主进程服务验证授权和扩展名。
 */
export function registerFileReadIpcHandlers(ipcMain: FileReadIpcMainPort, documentReader: AuthorizedDocumentReader): void {
  ipcMain.handle(FILE_READ_IPC_CHANNELS.getPdfUrl, (_event, path) => {
    if (typeof path !== 'string') {
      throw new Error('PDF 路径无效')
    }
    return documentReader.getPdfUrl(path)
  })
  ipcMain.handle(FILE_READ_IPC_CHANNELS.readBuffer, (_event, path) => {
    if (typeof path !== 'string') {
      throw new Error('EPUB 路径无效')
    }
    return documentReader.readEpubBuffer(path)
  })
}
