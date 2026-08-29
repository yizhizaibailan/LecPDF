import { expect, test } from 'vitest'
import { WINDOW_IPC_CHANNELS } from '../../shared/ipc'
import { registerWindowIpcHandlers, type IpcMainPort } from './window-ipc'

test('registers each window command against its WindowManager action', async () => {
  const handlers = new Map<string, (event: unknown) => void | Promise<void>>()
  const ipcMain: IpcMainPort = {
    handle: (channel, handler) => {
      handlers.set(channel, handler)
    }
  }
  const calls: string[] = []

  registerWindowIpcHandlers(ipcMain, {
    minimize: () => calls.push('minimize'),
    toggleMaximize: () => calls.push('toggleMaximize'),
    close: () => calls.push('close')
  })

  await handlers.get(WINDOW_IPC_CHANNELS.minimize)?.({})
  await handlers.get(WINDOW_IPC_CHANNELS.toggleMaximize)?.({})
  await handlers.get(WINDOW_IPC_CHANNELS.close)?.({})

  expect(calls).toEqual(['minimize', 'toggleMaximize', 'close'])
})
