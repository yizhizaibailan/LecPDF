import { expect, test } from 'vitest'
import { WindowManager, type ManagedWindow } from './window-manager'

class FakeWindow implements ManagedWindow {
  minimized = 0
  maximized = false
  maximizedCalls = 0
  restoredCalls = 0
  closed = 0
  readonly sentEvents: Array<{ channel: string; maximized: boolean }> = []
  private readonly listeners = new Map<'maximize' | 'unmaximize', Set<() => void>>()

  readonly webContents = {
    send: (channel: string, maximized: boolean) => this.sentEvents.push({ channel, maximized })
  }

  minimize(): void {
    this.minimized += 1
  }

  isMaximized(): boolean {
    return this.maximized
  }

  maximize(): void {
    this.maximized = true
    this.maximizedCalls += 1
  }

  unmaximize(): void {
    this.maximized = false
    this.restoredCalls += 1
  }

  close(): void {
    this.closed += 1
  }

  on(event: 'maximize' | 'unmaximize', listener: () => void): this {
    const eventListeners = this.listeners.get(event) ?? new Set()
    eventListeners.add(listener)
    this.listeners.set(event, eventListeners)
    return this
  }

  emit(event: 'maximize' | 'unmaximize'): void {
    this.listeners.get(event)?.forEach((listener) => listener())
  }
}

test('controls the active window and publishes native maximize state changes', () => {
  const window = new FakeWindow()
  const manager = new WindowManager(() => window)
  manager.observe(window)

  manager.minimize()
  manager.toggleMaximize()
  window.emit('maximize')
  manager.toggleMaximize()
  window.emit('unmaximize')
  manager.close()

  expect(window.minimized).toBe(1)
  expect(window.maximizedCalls).toBe(1)
  expect(window.restoredCalls).toBe(1)
  expect(window.closed).toBe(1)
  expect(window.sentEvents).toEqual([
    { channel: 'lec:window:maximized-change', maximized: true },
    { channel: 'lec:window:maximized-change', maximized: false }
  ])
})

test('rejects a command when there is no active window', () => {
  const manager = new WindowManager(() => null)

  expect(() => manager.close()).toThrow('没有可用窗口')
})
