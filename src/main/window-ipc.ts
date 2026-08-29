import { WINDOW_IPC_CHANNELS } from '../../shared/ipc'

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
