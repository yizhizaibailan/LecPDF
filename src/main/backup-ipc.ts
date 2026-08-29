import { BACKUP_IPC_CHANNELS, type BackupResult, type ConfigImportMode, type ImportResult } from '../../shared/ipc'

export type BackupIpcMainPort = {
  handle(channel: string, handler: (event: unknown, ...args: unknown[]) => Promise<unknown>): void
}

export type BackupServicePort = {
  runBackup(keep?: number): Promise<BackupResult>
  exportData(): Promise<BackupResult | null>
  importData(sourcePath: string, configMode?: ConfigImportMode): Promise<ImportResult>
}

export function registerBackupIpcHandlers(ipcMain: BackupIpcMainPort, backupService: BackupServicePort): void {
  ipcMain.handle(BACKUP_IPC_CHANNELS.runBackup, () => backupService.runBackup())
  ipcMain.handle(BACKUP_IPC_CHANNELS.exportData, () => backupService.exportData())
  ipcMain.handle(BACKUP_IPC_CHANNELS.importData, async (_event: unknown, sourcePath: unknown, configMode: unknown) => {
    if (typeof sourcePath !== 'string' || sourcePath.length === 0) throw new Error('导入文件路径无效')
    if (configMode !== undefined && configMode !== 'overwrite' && configMode !== 'skip') throw new Error('配置导入策略无效')
    return backupService.importData(sourcePath, configMode)
  })
}
