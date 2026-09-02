/**
 * 创建并加载唯一主窗口；通过注入 BrowserWindow 构造器和预加载路径保持窗口创建可测试。
 */
import type { BrowserWindowConstructorOptions } from 'electron'
import type { WindowBounds } from './window-geometry'
import { createMainWindowOptions } from './window-options'

type WindowInstance = {
  loadURL(url: string): Promise<unknown>
}

type WindowConstructor<T extends WindowInstance> = new (options: BrowserWindowConstructorOptions) => T

export async function createMainWindow<T extends WindowInstance>(
  BrowserWindow: WindowConstructor<T>,
  preloadPath: string,
  rendererUrl: string,
  bounds?: WindowBounds
): Promise<T> {
  const window = new BrowserWindow(createMainWindowOptions(preloadPath, bounds))
  await window.loadURL(rendererUrl)
  return window
}
