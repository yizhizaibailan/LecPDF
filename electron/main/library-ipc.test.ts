import { expect, test } from 'vitest'
import { LIBRARY_IPC_CHANNELS } from '../shared/ipc'
import { registerLibraryIpcHandlers, type LibraryIpcMainPort } from './library-ipc'

test('routes valid folder lists to the library service and rejects malformed IPC input', async () => {
  const handlers = new Map<string, (event: unknown, paths: unknown) => Promise<unknown>>()
  const ipcMain: LibraryIpcMainPort = {
    handle: (channel, handler) => handlers.set(channel, handler)
  }
  const calls: string[][] = []

  registerLibraryIpcHandlers(ipcMain, {
    scanFolders: async (paths) => {
      calls.push(paths)
      return []
    }
  })

  await expect(handlers.get(LIBRARY_IPC_CHANNELS.scanFolders)?.({}, ['C:\\books', 'D:\\documents'])).resolves.toEqual([])
  expect(calls).toEqual([['C:\\books', 'D:\\documents']])
  await expect(handlers.get(LIBRARY_IPC_CHANNELS.scanFolders)?.({}, ['C:\\books', 42])).rejects.toThrow('文件夹路径无效')
})
