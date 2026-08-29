import { expect, test } from 'vitest'
import { BACKUP_IPC_CHANNELS, type BackupResult } from '../../shared/ipc'
import { registerBackupIpcHandlers } from './backup-ipc'

test('forwards a renderer backup request to the main-process backup service', async () => {
  const handlers = new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>()
  const result: BackupResult = {
    path: 'C:\\AppData\\LecPDF\\backups\\backup-123.zip',
    manifest: { app: 'LecPDF', version: 1, exportedAt: 123 }
  }
  const ipcMain = {
    handle(channel: string, candidate: (event: unknown, ...args: unknown[]) => Promise<unknown>) {
      handlers.set(channel, candidate)
    }
  }
  const backupService = {
    runBackup: async () => result,
    exportData: async () => null,
    importData: async () => ({ importedPaths: [], missingPaths: [] })
  }

  registerBackupIpcHandlers(ipcMain, backupService)

  await expect(handlers.get(BACKUP_IPC_CHANNELS.runBackup)?.({})).resolves.toEqual(result)
})
