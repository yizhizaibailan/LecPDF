import { expect, test } from 'vitest'
import { FILE_READ_IPC_CHANNELS } from '../../shared/ipc'
import { registerFileReadIpcHandlers, type FileReadIpcMainPort } from './file-read-ipc'

test('returns a registered PDF URL through the narrow file-read IPC channel', async () => {
  const handlers = new Map<string, (event: unknown, path: unknown) => string>()
  const ipcMain: FileReadIpcMainPort = {
    handle: (channel, handler) => handlers.set(channel, handler)
  }

  registerFileReadIpcHandlers(ipcMain, {
    getPdfUrl: (path) => `lec-file://document/registered-${path.length}`
  })

  expect(handlers.get(FILE_READ_IPC_CHANNELS.getPdfUrl)?.({}, 'C:\\books\\reader.pdf')).toBe('lec-file://document/registered-19')
  expect(() => handlers.get(FILE_READ_IPC_CHANNELS.getPdfUrl)?.({}, 42)).toThrow('PDF 路径无效')
})
