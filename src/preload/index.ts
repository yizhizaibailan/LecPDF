import { contextBridge, ipcRenderer } from 'electron'
import { createPreloadApi, type IpcRendererPort } from './api'

contextBridge.exposeInMainWorld('lec', createPreloadApi(process.env.npm_package_version ?? '0.1.0', ipcRenderer as IpcRendererPort))
