import { app, BrowserWindow, ipcMain, protocol, screen } from 'electron'
import { join } from 'node:path'
import { extname } from 'node:path'
import { ConfigStore } from './config-store'
import { DataStore } from './dataStore'
import { FileOpenRouter, getSupportedDocumentPaths, type FileRouteWindow } from './file-open-router'
import { registerFileReadIpcHandlers, type FileReadIpcMainPort } from './file-read-ipc'
import { LecFileProtocol, registerLecFileProtocol, type LecFileProtocolPort } from './lec-file-protocol'
import { setupSingleInstance, type SingleInstanceApp } from './single-instance'
import { createMainWindow } from './window'
import { bindWindowGeometryPersistence, restoreWindowGeometry, type GeometryWindow } from './window-geometry'
import { WindowManager, type ManagedWindow } from './window-manager'
import { registerWindowIpcHandlers } from './window-ipc'

const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173'
const preloadPath = join(__dirname, '../preload/index.cjs')
let activeMainWindow: BrowserWindow | null = null
const windowManager = new WindowManager(() => activeMainWindow as ManagedWindow | null)
const fileOpenRouter = new FileOpenRouter()
const lecFileProtocol = new LecFileProtocol()

function routeOpenFiles(paths: string[]): void {
  paths.filter((path) => extname(path).toLowerCase() === '.pdf').forEach((path) => lecFileProtocol.registerPdf(path))

  if (activeMainWindow === null) {
    fileOpenRouter.enqueue(paths)
    return
  }

  fileOpenRouter.routeTo(activeMainWindow as unknown as FileRouteWindow, paths)
}

async function openMainWindow(configStore: ConfigStore): Promise<void> {
  const config = await configStore.load()
  const savedGeometry = restoreWindowGeometry(
    config.window,
    screen.getPrimaryDisplay().workArea,
    screen.getAllDisplays().map((display) => display.workArea)
  )

  activeMainWindow = await createMainWindow(BrowserWindow, preloadPath, rendererUrl, savedGeometry.bounds)
  windowManager.observe(activeMainWindow as unknown as ManagedWindow)
  bindWindowGeometryPersistence(activeMainWindow as unknown as GeometryWindow, configStore)
  if (savedGeometry.maximized) {
    activeMainWindow.maximize()
  }
  fileOpenRouter.flushTo(activeMainWindow as unknown as FileRouteWindow)
  activeMainWindow.once('closed', () => {
    activeMainWindow = null
  })
}

const isPrimaryInstance = setupSingleInstance(app as unknown as SingleInstanceApp, routeOpenFiles)

if (isPrimaryInstance) {
  routeOpenFiles(getSupportedDocumentPaths(process.argv))

  app.on('open-file', (event, path) => {
    event.preventDefault()
    routeOpenFiles(getSupportedDocumentPaths([path]))
  })

  app.whenReady().then(async () => {
    const configStore = new ConfigStore(new DataStore(app.getPath('userData')))
    registerLecFileProtocol(protocol as unknown as LecFileProtocolPort, lecFileProtocol)
    registerFileReadIpcHandlers(ipcMain as unknown as FileReadIpcMainPort, lecFileProtocol)
    registerWindowIpcHandlers(ipcMain, windowManager)
    await openMainWindow(configStore)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void openMainWindow(configStore)
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
