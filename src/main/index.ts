import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { createMainWindow } from './window'
import { WindowManager, type ManagedWindow } from './window-manager'
import { registerWindowIpcHandlers } from './window-ipc'

const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173'
const preloadPath = join(__dirname, '../preload/index.cjs')
let activeMainWindow: BrowserWindow | null = null
const windowManager = new WindowManager(() => activeMainWindow as ManagedWindow | null)

async function openMainWindow(): Promise<void> {
  activeMainWindow = await createMainWindow(BrowserWindow, preloadPath, rendererUrl)
  windowManager.observe(activeMainWindow as unknown as ManagedWindow)
  activeMainWindow.once('closed', () => {
    activeMainWindow = null
  })
}

app.whenReady().then(async () => {
  registerWindowIpcHandlers(ipcMain, windowManager)
  await openMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void openMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
