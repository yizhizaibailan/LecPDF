/**
 * 注册手动更新检查 IPC；通过小接口把渲染层请求交给 UpdateService。
 */
import { UPDATE_IPC_CHANNELS, type UpdateCheckResult } from '../shared/ipc'

export function registerUpdateIpcHandlers(ipcMain: { handle(channel: string, handler: () => Promise<UpdateCheckResult>): void }, updateService: { checkForUpdates(): Promise<UpdateCheckResult> }): void {
  ipcMain.handle(UPDATE_IPC_CHANNELS.checkForUpdates, () => updateService.checkForUpdates())
}
