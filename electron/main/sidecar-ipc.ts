/**
 * 注册与单个文档关联的 sidecar 读写 IPC；通过内部计算哈希路径避免调用方指定存储位置。
 */
import { SIDECAR_IPC_CHANNELS } from '../shared/ipc'
import type { Sidecar } from '../shared/schema'
import { sidecarDataPath } from './sidecar-path'

export type SidecarIpcMainPort = { handle(channel: string, handler: (event: unknown, ...args: unknown[]) => Promise<unknown>): void }
export type SidecarStore = { readJson<T>(path: string): Promise<T | null>; writeJson<T>(path: string, value: T): Promise<void> }

export function registerSidecarIpcHandlers(ipcMain: SidecarIpcMainPort, store: SidecarStore): void {
  ipcMain.handle(SIDECAR_IPC_CHANNELS.read, async (_event, path) => {
    if (typeof path !== 'string' || path.length === 0) throw new Error('文档路径无效')
    return store.readJson<Sidecar>(sidecarDataPath(path))
  })
  ipcMain.handle(SIDECAR_IPC_CHANNELS.write, async (_event, sidecar) => {
    if (typeof sidecar !== 'object' || sidecar === null || typeof (sidecar as Sidecar).path !== 'string') throw new Error('sidecar 无效')
    await store.writeJson(sidecarDataPath((sidecar as Sidecar).path), sidecar as Sidecar)
  })
}
