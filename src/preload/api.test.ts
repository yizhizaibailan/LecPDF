import { expect, test } from 'vitest'
import { FILE_READ_IPC_CHANNELS, LIFECYCLE_IPC_CHANNELS, WINDOW_IPC_CHANNELS } from '../../shared/ipc'
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
  type Listener = (event: unknown, ...args: unknown[]) => void
  const listeners = new Map<string, Set<Listener>>()
  const ipcRenderer: IpcRendererPort = {
    invoke: async (channel) => {
      invokedChannels.push(channel)
    },
    on: (channel, listener) => {
      const channelListeners = listeners.get(channel) ?? new Set()
      channelListeners.add(listener as unknown as Listener)
      listeners.set(channel, channelListeners)
    },
    removeListener: (channel, listener) => {
      listeners.get(channel)?.delete(listener as unknown as Listener)
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

test('buffers early file-open requests until the renderer subscribes and supports unsubscription', () => {
  type Listener = (event: unknown, ...args: unknown[]) => void
  const listeners = new Map<string, Set<Listener>>()
  const ipcRenderer: IpcRendererPort = {
    invoke: async () => undefined,
    on: (channel, listener) => {
      const channelListeners = listeners.get(channel) ?? new Set()
      channelListeners.add(listener as unknown as Listener)
      listeners.set(channel, channelListeners)
    },
    removeListener: (channel, listener) => {
      listeners.get(channel)?.delete(listener as unknown as Listener)
    }
  }
  const api = createPreloadApi('0.1.0', ipcRenderer)
  const received: string[] = []

  listeners.get(LIFECYCLE_IPC_CHANNELS.openFileRequest)?.forEach((listener) => listener({}, 'C:\\books\\initial.pdf'))
  const unsubscribe = api.lifecycle.onOpenFileRequest((path) => received.push(path))
  listeners.get(LIFECYCLE_IPC_CHANNELS.openFileRequest)?.forEach((listener) => listener({}, 'C:\\books\\later.epub'))
  unsubscribe()
  listeners.get(LIFECYCLE_IPC_CHANNELS.openFileRequest)?.forEach((listener) => listener({}, 'C:\\books\\ignored.pdf'))

  expect(received).toEqual(['C:\\books\\initial.pdf', 'C:\\books\\later.epub'])
})

test('returns a registered PDF URL through the exposed file-read API', async () => {
  const ipcRenderer: IpcRendererPort = {
    invoke: async (channel, path) => {
      expect(channel).toBe(FILE_READ_IPC_CHANNELS.getPdfUrl)
      expect(path).toBe('C:\\books\\reader.pdf')
      return 'lec-file://document/token-6'
    },
    on: () => undefined,
    removeListener: () => undefined
  }
  const api = createPreloadApi('0.1.0', ipcRenderer)

  await expect(api.fileRead.getPdfUrl('C:\\books\\reader.pdf')).resolves.toBe('lec-file://document/token-6')
})
