/**
 * 校验、恢复并持续保存窗口位置和尺寸；通过显示器工作区边界检测让拔屏后的窗口仍可见。
 */
export type WindowBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type DisplayWorkArea = WindowBounds

export type SavedWindowGeometry = {
  bounds: WindowBounds
  maximized: boolean
}

export type GeometryWindow = {
  getBounds(): WindowBounds
  isMaximized(): boolean
  on(event: 'close', listener: () => void): unknown
}

export type WindowGeometryStore = {
  saveWindowGeometry(geometry: SavedWindowGeometry): Promise<boolean>
}

export const DEFAULT_WINDOW_BOUNDS: WindowBounds = { x: 0, y: 0, width: 1280, height: 800 }

const minimumVisiblePixels = 64

export function restoreWindowGeometry(
  saved: SavedWindowGeometry,
  primaryWorkArea: DisplayWorkArea,
  displayWorkAreas: DisplayWorkArea[]
): SavedWindowGeometry {
  if (isValidBounds(saved.bounds) && displayWorkAreas.some((workArea) => isVisibleOnWorkArea(saved.bounds, workArea))) {
    return structuredClone(saved)
  }

  return {
    bounds: centerWithinWorkArea(isValidBounds(saved.bounds) ? saved.bounds : DEFAULT_WINDOW_BOUNDS, primaryWorkArea),
    maximized: saved.maximized
  }
}

export function bindWindowGeometryPersistence(window: GeometryWindow, store: WindowGeometryStore): void {
  window.on('close', () => {
    void store.saveWindowGeometry({
      bounds: window.getBounds(),
      maximized: window.isMaximized()
    })
  })
}

function isVisibleOnWorkArea(bounds: WindowBounds, workArea: DisplayWorkArea): boolean {
  const visibleWidth = Math.max(0, Math.min(bounds.x + bounds.width, workArea.x + workArea.width) - Math.max(bounds.x, workArea.x))
  const visibleHeight = Math.max(0, Math.min(bounds.y + bounds.height, workArea.y + workArea.height) - Math.max(bounds.y, workArea.y))
  return visibleWidth >= Math.min(bounds.width, minimumVisiblePixels) && visibleHeight >= Math.min(bounds.height, minimumVisiblePixels)
}

function isValidBounds(bounds: WindowBounds): boolean {
  return Number.isFinite(bounds.x) && Number.isFinite(bounds.y) && Number.isFinite(bounds.width) && Number.isFinite(bounds.height)
    && bounds.width > 0 && bounds.height > 0
}

function centerWithinWorkArea(bounds: WindowBounds, workArea: DisplayWorkArea): WindowBounds {
  const width = Math.min(bounds.width, workArea.width)
  const height = Math.min(bounds.height, workArea.height)
  return {
    x: workArea.x + Math.floor((workArea.width - width) / 2),
    y: workArea.y + Math.floor((workArea.height - height) / 2),
    width,
    height
  }
}
