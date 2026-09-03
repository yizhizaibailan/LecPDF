import { expect, test } from 'vitest'
import { CURRENT_SCHEMA_VERSION, type BackupManifest, type Config, type Library, type RuntimeMark, type Sidecar, type UnifiedAnnotation } from './schema'

test('models every persisted document root at the current schema version', () => {
  const config: Config = {
    version: CURRENT_SCHEMA_VERSION,
    language: 'zh-CN',
    appearance: { theme: 'system' },
    reading: { defaultZoom: 100, defaultLayout: 'continuous', pdfNightMode: false, pageAnimation: true },
    annotation: {
      defaultColors: {
        highlight: '#fff1a8', underline: '#1677ff', strikeout: '#f5222d', squiggly: '#722ed1',
        note: '#faad14', freetext: '#1677ff', ink: '#fa8c16'
      }
    },
    shortcuts: { open: 'Ctrl+O', closeTab: 'Ctrl+W', search: 'Ctrl+F', highlight: 'H', underline: 'U', strikeout: 'D', squiggly: 'W', note: 'N', ink: 'P', fullscreen: 'F11', print: 'Ctrl+P', undo: 'Ctrl+Z', redo: 'Ctrl+Y', zoomIn: 'Ctrl+=', zoomOut: 'Ctrl+-', zoomReset: 'Ctrl+0' },
    general: { launchAtStartup: false, autoBackup: { enabled: true, intervalDays: 7, keep: 3 } },
    window: { bounds: { x: 0, y: 0, width: 1280, height: 800 }, maximized: false }
  }
  const library: Library = {
    version: CURRENT_SCHEMA_VERSION,
    recent: [{ path: 'C:\\docs\\paper.pdf', openedAt: 1, progress: { page: 8, chapter: null, percent: 0.33 } }],
    starred: ['C:\\docs\\paper.pdf'],
    folders: ['C:\\docs'],
    files: { 'C:\\docs\\paper.pdf': { kind: 'pdf', name: 'paper.pdf', size: 42, mtime: 1, addedAt: 1, pageCount: null, missing: false } }
  }
  const sidecar: Sidecar = {
    version: CURRENT_SCHEMA_VERSION,
    path: 'C:\\docs\\paper.pdf',
    kind: 'pdf',
    book: { progress: { page: 8, epubCfi: null, scrollTop: 0, percent: 0.33, zoom: 100, layout: 'continuous', updatedAt: 1 } },
    annotations: [],
    bookmarks: [],
    epubSettings: null,
    tts: null
  }
  const runtime: RuntimeMark = { version: CURRENT_SCHEMA_VERSION, cleanExit: false, lastTabPaths: ['C:\\docs\\paper.pdf'], startedAt: 1 }
  const backup: BackupManifest = { app: 'LecPDF', version: CURRENT_SCHEMA_VERSION, exportedAt: 1 }

  expect([config, library, sidecar, runtime, backup]).toHaveLength(5)
})

test('uses discriminated annotation shapes for text, note, free text, and ink', () => {
  const annotations: UnifiedAnnotation[] = [
    { id: 'a-highlight', type: 'highlight', loc: { page: 8, epubCfi: null }, quote: '重点', rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.04 }], color: '#fff1a8', createdAt: 1, updatedAt: 1 },
    { id: 'a-note', type: 'note', loc: { page: null, epubCfi: 'epubcfi(/6/4)' }, quote: '说明', point: { x: 0.3, y: 0.4 }, body: '我的笔记', color: '#faad14', createdAt: 1, updatedAt: 1 },
    { id: 'a-freetext', type: 'freetext', loc: { page: 2, epubCfi: null }, quote: '结论', rect: { x: 0.2, y: 0.4, w: 0.3, h: 0.1 }, body: '补充', color: '#1677ff', createdAt: 1, updatedAt: 1 },
    { id: 'a-ink', type: 'ink', loc: { page: 3, epubCfi: null }, quote: '', ink: [[{ x: 0.1, y: 0.2 }, { x: 0.2, y: 0.3 }]], color: '#fa8c16', createdAt: 1, updatedAt: 1 }
  ]

  expect(annotations.map(({ type }) => type)).toEqual(['highlight', 'note', 'freetext', 'ink'])
})
/** 覆盖共享数据 schema 的运行时约束，确保主进程与渲染层使用相同数据契约。 */
