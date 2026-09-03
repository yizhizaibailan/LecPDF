import { expect, test } from 'vitest'
import { FILE_READ_IPC_CHANNELS } from '../shared/ipc'
import { registerFileReadIpcHandlers, type FileReadIpcMainPort } from './file-read-ipc'

test('returns a registered PDF URL through the narrow file-read IPC channel', async () => {
  const handlers = new Map<string, (event: unknown, path: unknown) => string | Promise<ArrayBuffer>>()
  const ipcMain: FileReadIpcMainPort = {
    handle: (channel, handler) => handlers.set(channel, handler)
  }

  registerFileReadIpcHandlers(ipcMain, {
    getPdfUrl: (path) => `lec-file://document/registered-${path.length}`,
    readEpubBuffer: async () => new ArrayBuffer(0)
  })

  expect(handlers.get(FILE_READ_IPC_CHANNELS.getPdfUrl)?.({}, 'C:\\books\\reader.pdf')).toBe('lec-file://document/registered-19')
  expect(() => handlers.get(FILE_READ_IPC_CHANNELS.getPdfUrl)?.({}, 42)).toThrow('PDF 路径无效')
})

test('forwards only string EPUB paths to the restricted buffer reader', async () => {
  const handlers = new Map<string, (event: unknown, path: unknown) => string | Promise<ArrayBuffer>>()
  const ipcMain: FileReadIpcMainPort = {
    handle: (channel, handler) => handlers.set(channel, handler)
  }
  const readEpubBuffer = async (path: string) => new Uint8Array([path.length]).buffer

  registerFileReadIpcHandlers(ipcMain, {
    getPdfUrl: () => 'lec-file://document/registered',
    readEpubBuffer
  })

  const readBuffer = handlers.get(FILE_READ_IPC_CHANNELS.readBuffer)
  expect(readBuffer).toBeTypeOf('function')
  await expect(readBuffer?.({}, 'C:\\books\\novel.epub')).resolves.toEqual(new Uint8Array([19]).buffer)
  expect(() => readBuffer?.({}, 42)).toThrow('EPUB 路径无效')
})
/** 覆盖受限文件读取 IPC 的权限与结果契约。 */
