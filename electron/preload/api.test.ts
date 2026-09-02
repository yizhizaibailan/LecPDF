/**
 * 职责：验证 preload 只暴露固定 IPC 能力，并校验主进程返回值。
 * 异步说明：测试等待每次 invoke 与订阅回调完成，不启动真实 Electron 进程。
 * 安全说明：渲染层不能指定任意通道，畸形返回值会在桥接边界被拒绝。
 * 资源说明：内存监听器会在测试中显式取消，不遗留真实 IPC 订阅。
 */
import { expect, test } from 'vitest'
import { BACKUP_IPC_CHANNELS, DIALOG_IPC_CHANNELS, FILE_READ_IPC_CHANNELS, LIBRARY_IPC_CHANNELS, LIFECYCLE_IPC_CHANNELS, WINDOW_IPC_CHANNELS } from '../shared/ipc'
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

test('通过固定对话框通道返回主进程选择的文档路径', async () => {
  const invocations: Array<{ channel: string; arguments_: unknown[] }> = []
  const ipcRenderer: IpcRendererPort = {
    invoke: async (channel, ...arguments_) => {
      invocations.push({ channel, arguments_ })
      return ['C:\\books\\a.pdf', 'C:\\books\\b.epub']
    },
    on: () => undefined,
    removeListener: () => undefined
  }
  const api = createPreloadApi('0.1.0', ipcRenderer)

  await expect(api.dialogs.openDocuments()).resolves.toEqual(['C:\\books\\a.pdf', 'C:\\books\\b.epub'])
  expect(invocations).toEqual([{ channel: DIALOG_IPC_CHANNELS.openDocuments, arguments_: [] }])
})

test('拒绝打开文档 IPC 返回的非字符串路径', async () => {
  const ipcRenderer: IpcRendererPort = {
    invoke: async () => ['C:\\books\\a.pdf', 42],
    on: () => undefined,
    removeListener: () => undefined
  }
  const api = createPreloadApi('0.1.0', ipcRenderer)

  await expect(api.dialogs.openDocuments()).rejects.toThrow('主进程未返回有效文档路径')
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

test('forwards authorized EPUB buffer reads through the fixed IPC channel', async () => {
  const ipcRenderer: IpcRendererPort = {
    invoke: async (channel, path) => {
      expect(channel).toBe(FILE_READ_IPC_CHANNELS.readBuffer)
      expect(path).toBe('C:\\books\\novel.epub')
      return new Uint8Array([0x50, 0x4b]).buffer
    },
    on: () => undefined,
    removeListener: () => undefined
  }
  const api = createPreloadApi('0.1.0', ipcRenderer)

  await expect(api.fileRead.readBuffer('C:\\books\\novel.epub')).resolves.toEqual(new Uint8Array([0x50, 0x4b]).buffer)
})

test('rejects a non-buffer payload returned by the file-read IPC channel', async () => {
  const ipcRenderer: IpcRendererPort = {
    invoke: async () => 'not-an-array-buffer',
    on: () => undefined,
    removeListener: () => undefined
  }
  const api = createPreloadApi('0.1.0', ipcRenderer)

  await expect(api.fileRead.readBuffer('C:\\books\\novel.epub')).rejects.toThrow('主进程未返回有效文件字节')
})

test('forwards folder scans through the exposed library API', async () => {
  const ipcRenderer: IpcRendererPort = {
    invoke: async (channel, paths) => {
      expect(channel).toBe(LIBRARY_IPC_CHANNELS.scanFolders)
      expect(paths).toEqual(['C:\\books'])
      return [{ path: 'C:\\books\\reader.pdf', kind: 'pdf' }]
    },
    on: () => undefined,
    removeListener: () => undefined
  }
  const api = createPreloadApi('0.1.0', ipcRenderer)

  await expect(api.library.scanFolders(['C:\\books'])).resolves.toEqual([{ path: 'C:\\books\\reader.pdf', kind: 'pdf' }])
})

test('forwards a manual backup request through the exposed backup API', async () => {
  const ipcRenderer: IpcRendererPort = {
    invoke: async (channel) => {
      expect(channel).toBe(BACKUP_IPC_CHANNELS.runBackup)
      return {
        path: 'C:\\AppData\\LecPDF\\backups\\backup-123.zip',
        manifest: { app: 'LecPDF', version: 1, exportedAt: 123 }
      }
    },
    on: () => undefined,
    removeListener: () => undefined
  }
  const api = createPreloadApi('0.1.0', ipcRenderer)

  await expect(api.backup.runBackup()).resolves.toEqual({
    path: 'C:\\AppData\\LecPDF\\backups\\backup-123.zip',
    manifest: { app: 'LecPDF', version: 1, exportedAt: 123 }
  })
})
