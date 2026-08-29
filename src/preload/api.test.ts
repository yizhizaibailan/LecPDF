import { expect, test } from 'vitest'
import { WINDOW_IPC_CHANNELS } from '../../shared/ipc'
import { createPreloadApi, type IpcRendererPort } from './api'

test('exposes a frozen, fail-closed IPC placeholder API', async () => {
  const api = createPreloadApi('0.1.0')

  expect(api.app.version).toBe('0.1.0')
  expect(typeof api.window.minimize).toBe('function')
  expect(typeof api.library.scanFolders).toBe('function')
  expect(Object.isFrozen(api)).toBe(true)
  expect(Object.isFrozen(api.app)).toBe(true)
  expect(Object.isFrozen(api.window)).toBe(true)
  await expect(api.fs.stat('C:\\docs\\paper.pdf')).rejects.toThrow('尚未实现：fs.stat')
})

test('forwards window controls and removes the maximize subscription when requested', async () => {
  const invokedChannels: string[] = []
  const listeners = new Map<string, Set<(event: unknown, maximized: boolean) => void>>()
  const ipcRenderer: IpcRendererPort = {
    invoke: async (channel) => {
      invokedChannels.push(channel)
    },
    on: (channel, listener) => {
      const channelListeners = listeners.get(channel) ?? new Set()
      channelListeners.add(listener)
      listeners.set(channel, channelListeners)
    },
    removeListener: (channel, listener) => {
      listeners.get(channel)?.delete(listener)
    }
  }
  const api = createPreloadApi('0.1.0', ipcRenderer)
  const observedStates: boolean[] = []
  const unsubscribe = api.window.onMaximizedChange((maximized) => observedStates.push(maximized))

  await api.window.minimize()
  await api.window.toggleMaximize()
  await api.window.close()
  listeners.get(WINDOW_IPC_CHANNELS.maximizedChange)?.forEach((listener) => listener({}, true))
  unsubscribe()
  listeners.get(WINDOW_IPC_CHANNELS.maximizedChange)?.forEach((listener) => listener({}, false))

  expect(invokedChannels).toEqual([
    WINDOW_IPC_CHANNELS.minimize,
    WINDOW_IPC_CHANNELS.toggleMaximize,
    WINDOW_IPC_CHANNELS.close
  ])
  expect(observedStates).toEqual([true])
})
