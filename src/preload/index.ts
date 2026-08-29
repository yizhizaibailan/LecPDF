import { contextBridge } from 'electron'
import { createPreloadApi } from './api'

contextBridge.exposeInMainWorld('lec', createPreloadApi(process.env.npm_package_version ?? '0.1.0'))
