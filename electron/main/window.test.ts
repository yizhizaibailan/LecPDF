import { expect, test } from 'vitest'
import type { BrowserWindowConstructorOptions } from 'electron'
import { createMainWindow } from './window'

class FakeWindow {
  static instances: FakeWindow[] = []
  loadedUrl: string | undefined

  constructor(readonly options: BrowserWindowConstructorOptions) {
    FakeWindow.instances.push(this)
  }

  loadURL(url: string): Promise<void> {
    this.loadedUrl = url
    return Promise.resolve()
  }
}

test('creates the configured reader window and loads the renderer URL', async () => {
  FakeWindow.instances = []

  const window = await createMainWindow(
    FakeWindow,
    'C:/LecPDF/out/preload/index.cjs',
    'http://localhost:5173'
  )

  expect(window.loadedUrl).toBe('http://localhost:5173')
  expect(window.options.webPreferences?.preload).toBe('C:/LecPDF/out/preload/index.cjs')
  expect(window.options.frame).toBe(false)
})
