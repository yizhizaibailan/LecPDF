/**
 * 注册通用受限数据读写 IPC；通过允许的持久化路径类型阻止渲染层写入任意本地文件。
 */
import { DATA_IPC_CHANNELS, type PersistedDocument, type PersistedDocumentPath } from '../shared/ipc'

export type DataIpcMainPort = { handle(channel: string, handler: (event: unknown, ...args: unknown[]) => Promise<unknown>): void }
export type JsonStore = { readJson<T>(path: string): Promise<T | null>; writeJson<T>(path: string, document: T): Promise<void> }

function isPersistedPath(value: unknown): value is PersistedDocumentPath {
  return value === 'config' || value === 'library' || value === 'runtime' || (typeof value === 'string' && /^data\/[a-f0-9]{16}\.json$/.test(value))
}

export function registerDataIpcHandlers(ipcMain: DataIpcMainPort, dataStore: JsonStore): void {
  ipcMain.handle(DATA_IPC_CHANNELS.readJson, async (_event, path) => {
    if (!isPersistedPath(path)) throw new Error('数据路径无效')
    return dataStore.readJson<PersistedDocument>(`${path}.json`)
  })
  ipcMain.handle(DATA_IPC_CHANNELS.writeJson, async (_event, path, document) => {
    if (!isPersistedPath(path) || typeof document !== 'object' || document === null) throw new Error('数据写入无效')
    await dataStore.writeJson(`${path}.json`, document as PersistedDocument)
  })
}
