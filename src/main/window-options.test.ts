import { expect, test } from 'vitest'
import { createMainWindowOptions } from './window-options'

test('creates a frameless reader window with isolated renderer privileges', () => {
  const options = createMainWindowOptions('C:/LecPDF/out/preload/index.cjs')

  expect(options).toMatchObject({
    frame: false,
    width: 1280,
    height: 800,
    minWidth: 1080,
    minHeight: 720,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: 'C:/LecPDF/out/preload/index.cjs'
    }
  })
})
