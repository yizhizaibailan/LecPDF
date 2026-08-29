import { UPDATE_IPC_CHANNELS, type UpdateCheckResult } from '../../shared/ipc'

export function registerUpdateIpcHandlers(ipcMain: { handle(channel: string, handler: () => Promise<UpdateCheckResult>): void }, updateService: { checkForUpdates(): Promise<UpdateCheckResult> }): void {
  ipcMain.handle(UPDATE_IPC_CHANNELS.checkForUpdates, () => updateService.checkForUpdates())
}
