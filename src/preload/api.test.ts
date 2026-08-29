import { expect, test } from 'vitest'
import { createPreloadApi } from './api'

test('exposes a frozen, fail-closed IPC placeholder API', async () => {
  const api = createPreloadApi('0.1.0')

  expect(api.app.version).toBe('0.1.0')
  expect(typeof api.window.minimize).toBe('function')
  expect(typeof api.library.scanFolders).toBe('function')
  expect(Object.isFrozen(api)).toBe(true)
  expect(Object.isFrozen(api.app)).toBe(true)
  expect(Object.isFrozen(api.window)).toBe(true)
  await expect(api.fs.stat('C:\\docs\\paper.pdf')).rejects.toThrow('尚未实现：fs.stat')
})
