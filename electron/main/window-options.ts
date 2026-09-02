/**
 * 生成安全的无边框 BrowserWindow 配置；通过 contextIsolation、sandbox 和禁用 nodeIntegration 限制渲染权限。
 */
import type { BrowserWindowConstructorOptions } from 'electron'
import type { WindowBounds } from './window-geometry'

export function createMainWindowOptions(preloadPath: string, bounds?: WindowBounds): BrowserWindowConstructorOptions {
  return {
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 800,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 1080,
    minHeight: 720,
    frame: false,
    backgroundColor: '#e8edf4',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  }
}
