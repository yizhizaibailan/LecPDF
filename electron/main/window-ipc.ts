/**
 * 注册最小化、最大化和关闭窗口的 IPC；通过 WindowManager 只操作当前受管理窗口。
 */
import { WINDOW_IPC_CHANNELS } from '../shared/ipc'

export type IpcMainPort = {
  handle(channel: string, handler: (event: unknown) => void | Promise<void>): void
}

export type WindowCommandHandler = {
  minimize(): void
  toggleMaximize(): void
  close(): void
}

export function registerWindowIpcHandlers(ipcMain: IpcMainPort, windowManager: WindowCommandHandler): void {
  ipcMain.handle(WINDOW_IPC_CHANNELS.minimize, () => windowManager.minimize())
  ipcMain.handle(WINDOW_IPC_CHANNELS.toggleMaximize, () => windowManager.toggleMaximize())
  ipcMain.handle(WINDOW_IPC_CHANNELS.close, () => windowManager.close())
}
