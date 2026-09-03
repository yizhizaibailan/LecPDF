import { expect, test, vi } from 'vitest'
import { bindCrashMarkerCleanExit, type CrashMarkerLifecycleApp } from './crash-marker-lifecycle'

test('waits for the crash marker to be persisted before finishing a normal quit', async () => {
  const listeners: { beforeQuit?: (event: { preventDefault(): void }) => void } = {}
  const app: CrashMarkerLifecycleApp = {
    on(event, listener) {
      expect(event).toBe('before-quit')
      listeners.beforeQuit = listener
    },
    exit: vi.fn()
  }
  const marker = { markCleanExit: vi.fn().mockResolvedValue(undefined) }
  const event = { preventDefault: vi.fn() }

  bindCrashMarkerCleanExit(app, marker)
  listeners.beforeQuit?.(event)

  await vi.waitFor(() => {
    expect(marker.markCleanExit).toHaveBeenCalledOnce()
    expect(app.exit).toHaveBeenCalledWith(0)
  })
  expect(event.preventDefault).toHaveBeenCalledOnce()
})

test('does not persist the clean marker twice when Electron emits before-quit again', async () => {
  const listeners: { beforeQuit?: (event: { preventDefault(): void }) => void } = {}
  const app: CrashMarkerLifecycleApp = {
    on(_event, listener) {
      listeners.beforeQuit = listener
    },
    exit: vi.fn()
  }
  const marker = { markCleanExit: vi.fn().mockResolvedValue(undefined) }

  bindCrashMarkerCleanExit(app, marker)
  listeners.beforeQuit?.({ preventDefault: vi.fn() })
  listeners.beforeQuit?.({ preventDefault: vi.fn() })

  await vi.waitFor(() => expect(app.exit).toHaveBeenCalledWith(0))
  expect(marker.markCleanExit).toHaveBeenCalledOnce()
})
/** 覆盖启动和退出生命周期与崩溃标记服务的连接。 */
