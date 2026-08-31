import { expect, test } from 'vitest'
import {
  bindWindowGeometryPersistence,
  restoreWindowGeometry,
  type GeometryWindow,
  type WindowGeometryStore
} from './window-geometry'

class FakeGeometryWindow implements GeometryWindow {
  private closeListener: (() => void) | undefined

  getBounds() {
    return { x: 120, y: 80, width: 1280, height: 800 }
  }

  isMaximized(): boolean {
    return true
  }

  on(event: 'close', listener: () => void): this {
    if (event === 'close') {
      this.closeListener = listener
    }
    return this
  }

  emitClose(): void {
    this.closeListener?.()
  }
}

test('keeps a saved window geometry when it remains visible on a connected display', () => {
  const saved = { bounds: { x: 2100, y: 80, width: 1280, height: 800 }, maximized: true }

  expect(restoreWindowGeometry(saved, { x: 0, y: 0, width: 1920, height: 1080 }, [
    { x: 0, y: 0, width: 1920, height: 1080 },
    { x: 1920, y: 0, width: 1920, height: 1080 }
  ])).toEqual(saved)
})

test('centers an off-screen saved geometry on the primary display', () => {
  const saved = { bounds: { x: 5000, y: 3000, width: 1280, height: 800 }, maximized: false }

  expect(restoreWindowGeometry(saved, { x: 0, y: 0, width: 1920, height: 1080 }, [
    { x: 0, y: 0, width: 1920, height: 1080 }
  ])).toEqual({
    bounds: { x: 320, y: 140, width: 1280, height: 800 },
    maximized: false
  })
})

test('recovers a saved geometry with an invalid size', () => {
  const saved = { bounds: { x: 80, y: 80, width: 0, height: -1 }, maximized: false }

  expect(restoreWindowGeometry(saved, { x: 0, y: 0, width: 1920, height: 1080 }, [
    { x: 0, y: 0, width: 1920, height: 1080 }
  ])).toEqual({
    bounds: { x: 320, y: 140, width: 1280, height: 800 },
    maximized: false
  })
})

test('captures the latest bounds and maximized state when a window closes', async () => {
  const window = new FakeGeometryWindow()
  const saved: Array<{ bounds: { x: number; y: number; width: number; height: number }; maximized: boolean }> = []
  const store: WindowGeometryStore = {
    saveWindowGeometry: async (geometry) => {
      saved.push(geometry)
      return true
    }
  }

  bindWindowGeometryPersistence(window, store)
  window.emitClose()
  await Promise.resolve()

  expect(saved).toEqual([{ bounds: { x: 120, y: 80, width: 1280, height: 800 }, maximized: true }])
})
