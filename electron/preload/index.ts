/**
 * 作为预加载脚本入口暴露最小化的 window.lec API；通过 contextBridge 隔离渲染页面与 Electron 原生对象。
 */
import { contextBridge, ipcRenderer } from 'electron'
import { createPreloadApi, type IpcRendererPort } from './api'

contextBridge.exposeInMainWorld('lec', createPreloadApi(process.env.npm_package_version ?? '0.1.0', ipcRenderer as IpcRendererPort))
