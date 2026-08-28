import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { createMainWindow } from './window'

const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173'
const preloadPath = join(__dirname, '../preload/index.cjs')

async function openMainWindow(): Promise<void> {
  await createMainWindow(BrowserWindow, preloadPath, rendererUrl)
}

app.whenReady().then(async () => {
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
