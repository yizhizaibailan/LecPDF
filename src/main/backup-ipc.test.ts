import { expect, test } from 'vitest'
import { BACKUP_IPC_CHANNELS, type BackupResult } from '../../shared/ipc'
import { registerBackupIpcHandlers } from './backup-ipc'

test('forwards a renderer backup request to the main-process backup service', async () => {
  const handlers: { runBackup?: () => Promise<BackupResult> } = {}
  const result: BackupResult = {
    path: 'C:\\AppData\\LecPDF\\backups\\backup-123.zip',
    manifest: { app: 'LecPDF', version: 1, exportedAt: 123 }
  }
  const ipcMain = {
    handle(channel: string, candidate: () => Promise<BackupResult>) {
      expect(channel).toBe(BACKUP_IPC_CHANNELS.runBackup)
      handlers.runBackup = candidate
    }
  }
  const backupService = { runBackup: async () => result }

  registerBackupIpcHandlers(ipcMain, backupService)

  await expect(handlers.runBackup?.()).resolves.toEqual(result)
})
