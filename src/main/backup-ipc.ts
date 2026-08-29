import { BACKUP_IPC_CHANNELS, type BackupResult } from '../../shared/ipc'

export type BackupIpcMainPort = {
  handle(channel: string, handler: () => Promise<BackupResult>): void
}

export type BackupServicePort = {
  runBackup(keep?: number): Promise<BackupResult>
}

export function registerBackupIpcHandlers(ipcMain: BackupIpcMainPort, backupService: BackupServicePort): void {
  ipcMain.handle(BACKUP_IPC_CHANNELS.runBackup, () => backupService.runBackup())
}
