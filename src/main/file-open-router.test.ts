import { expect, test } from 'vitest'
import { LIFECYCLE_IPC_CHANNELS } from '../../shared/ipc'
import { FileOpenRouter, getSupportedDocumentPaths, type FileRouteWindow } from './file-open-router'

class FakeWindow implements FileRouteWindow {
  minimized = true
  restored = 0
  shown = 0
  focused = 0
  readonly requests: Array<{ channel: string; path: string }> = []

  isMinimized(): boolean {
    return this.minimized
  }

  restore(): void {
    this.minimized = false
    this.restored += 1
  }

  show(): void {
    this.shown += 1
  }

  focus(): void {
    this.focused += 1
  }

  readonly webContents = {
    send: (channel: string, path: string) => this.requests.push({ channel, path })
  }
}

test('extracts unique PDF and EPUB paths from launch arguments', () => {
  expect(getSupportedDocumentPaths([
    'LecPDF.exe',
    '--inspect=5858',
    'C:\\books\\chapter.PDF',
    'C:\\books\\novel.epub',
    'C:\\books\\chapter.PDF',
    'C:\\notes.txt'
  ])).toEqual(['C:\\books\\chapter.PDF', 'C:\\books\\novel.epub'])
})

test('waits for a window before routing initial files, then restores and focuses it', () => {
  const router = new FileOpenRouter()
  const window = new FakeWindow()

  router.enqueue(['C:\\books\\first.pdf'])
  expect(window.requests).toEqual([])
  router.flushTo(window)

  expect(window.restored).toBe(1)
  expect(window.shown).toBe(1)
  expect(window.focused).toBe(1)
  expect(window.requests).toEqual([
    { channel: LIFECYCLE_IPC_CHANNELS.openFileRequest, path: 'C:\\books\\first.pdf' }
  ])
})

test('routes second-launch files directly to the active window', () => {
  const router = new FileOpenRouter()
  const window = new FakeWindow()
  window.minimized = false

  router.routeTo(window, ['C:\\books\\second.epub'])

  expect(window.restored).toBe(0)
  expect(window.shown).toBe(1)
  expect(window.focused).toBe(1)
  expect(window.requests).toEqual([
    { channel: LIFECYCLE_IPC_CHANNELS.openFileRequest, path: 'C:\\books\\second.epub' }
  ])
})
