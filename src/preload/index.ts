import { contextBridge } from 'electron'
import { createAppApi } from './api'

contextBridge.exposeInMainWorld('lec', createAppApi(process.env.npm_package_version ?? '0.1.0'))
