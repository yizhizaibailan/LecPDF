import type { BrowserWindowConstructorOptions } from 'electron'
import { createMainWindowOptions } from './window-options'

type WindowInstance = {
  loadURL(url: string): Promise<unknown>
}

type WindowConstructor<T extends WindowInstance> = new (options: BrowserWindowConstructorOptions) => T

export async function createMainWindow<T extends WindowInstance>(
  BrowserWindow: WindowConstructor<T>,
  preloadPath: string,
  rendererUrl: string
): Promise<T> {
  const window = new BrowserWindow(createMainWindowOptions(preloadPath))
  await window.loadURL(rendererUrl)
  return window
}
