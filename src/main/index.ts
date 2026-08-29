import { app, BrowserWindow, dialog, ipcMain, protocol, screen } from 'electron'
import { join } from 'node:path'
import { extname } from 'node:path'
import log from 'electron-log/main'
import { autoUpdater } from 'electron-updater'
import { registerBackupIpcHandlers, type BackupIpcMainPort } from './backup-ipc'
import { BackupScheduler } from './backup-scheduler'
import { BackupService, type BackupSaveDialog } from './backup-service'
import { ConfigStore } from './config-store'
import { CrashMarker } from './crash-marker'
import { bindCrashMarkerCleanExit, type CrashMarkerLifecycleApp } from './crash-marker-lifecycle'
import { DataStore } from './dataStore'
import { FileOpenRouter, getSupportedDocumentPaths, type FileRouteWindow } from './file-open-router'
import { registerFileReadIpcHandlers, type FileReadIpcMainPort } from './file-read-ipc'
import { registerLibraryIpcHandlers, type LibraryIpcMainPort } from './library-ipc'
import { LibraryService } from './library-service'
import { LecFileProtocol, registerLecFileProtocol, type LecFileProtocolPort } from './lec-file-protocol'
import { setupSingleInstance, type SingleInstanceApp } from './single-instance'
import { createMainWindow } from './window'
import { bindWindowGeometryPersistence, restoreWindowGeometry, type GeometryWindow } from './window-geometry'
import { WindowManager, type ManagedWindow } from './window-manager'
import { registerWindowIpcHandlers } from './window-ipc'
import { registerUpdateIpcHandlers } from './update-ipc'
import { UpdateService } from './update-service'

const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173'
const preloadPath = join(__dirname, '../preload/index.cjs')
let activeMainWindow: BrowserWindow | null = null
const windowManager = new WindowManager(() => activeMainWindow as ManagedWindow | null)
const fileOpenRouter = new FileOpenRouter()
const lecFileProtocol = new LecFileProtocol()
const libraryService = new LibraryService()
const openedTabPaths: string[] = []
let crashMarker: CrashMarker | null = null
let backupScheduler: BackupScheduler | null = null

function routeOpenFiles(paths: string[]): void {
  recordOpenedTabPaths(paths)
  paths.filter((path) => extname(path).toLowerCase() === '.pdf').forEach((path) => lecFileProtocol.registerPdf(path))

  if (activeMainWindow === null) {
    fileOpenRouter.enqueue(paths)
    return
  }

  fileOpenRouter.routeTo(activeMainWindow as unknown as FileRouteWindow, paths)
}

function recordOpenedTabPaths(paths: string[]): void {
  for (const path of paths) {
    if (!openedTabPaths.includes(path)) {
      openedTabPaths.push(path)
    }
  }

  if (crashMarker !== null) {
    void crashMarker.recordOpenTabPaths(openedTabPaths).catch(() => undefined)
  }
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
    const dataStore = new DataStore(app.getPath('userData'))
    log.transports.file.resolvePathFn = () => join(dataStore.rootPath, 'logs', 'main.log')
    log.transports.remote.level = false
    log.info('LecPDF 主进程启动')
    process.on('uncaughtException', (error) => log.error('未捕获异常', error))
    process.on('unhandledRejection', (error) => log.error('未处理拒绝', error))
    const configStore = new ConfigStore(dataStore)
    const backupService = new BackupService(dataStore, undefined, dialog as unknown as BackupSaveDialog)
    backupScheduler = new BackupScheduler(backupService)
    backupScheduler.configure((await configStore.load()).general.autoBackup)
    app.on('before-quit', () => backupScheduler?.stop())
    crashMarker = new CrashMarker(dataStore)
    await crashMarker.start(openedTabPaths)
    bindCrashMarkerCleanExit(app as unknown as CrashMarkerLifecycleApp, crashMarker)
    registerLecFileProtocol(protocol as unknown as LecFileProtocolPort, lecFileProtocol)
    registerFileReadIpcHandlers(ipcMain as unknown as FileReadIpcMainPort, lecFileProtocol)
    registerLibraryIpcHandlers(ipcMain as unknown as LibraryIpcMainPort, libraryService)
    registerBackupIpcHandlers(ipcMain as unknown as BackupIpcMainPort, backupService)
    registerUpdateIpcHandlers(ipcMain, new UpdateService(app.getVersion(), autoUpdater))
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
